# Workflow assistante complet — annotations, WhatsApp assisté, notifications

**Date** : 2026-08-12 · **Branche** : `feat/workflow-assistante-complet` (base `origin/main` = `f59a85894`)
**Périmètre** : revue des bilans (annotations, correction), envoi WhatsApp voie B (liens signés), notifications assistante et parents, UX du fil complet. **Banques, scoring, snapshots append-only, candidat libre : intouchés. LLM off.**

---

## 1. Annotations et « Correction demandée »

- Nouvel état de révision `CORRECTION_REQUESTED`, **distinct** de « Rejeté » (qui ferme) et d'« En attente de diffusion ». Visible dans la file avec son badge et son compteur dédiés.
- L'assistante cible **audience** (élève / parents / Nexus) et **section** (vocabulaire stable de 11 sections), écrit sa remarque et un motif structuré → revue `CHANGES_REQUESTED` + annotations créées **dans la même transaction** que le changement d'état.
- Annotations tracées (auteur, date, contenu) dans `canonical_report_review_annotations`, **append-only par trigger DB** — jamais écrasées. La reprise de revue est elle-même tracée (annotation interne « reprise-de-revue ») ; le bilan revient en « À revoir », historique intact et affiché.
- Le garde DB des révisions a été **étendu, jamais relâché** : les transitions historiques restent identiques (reprises à la lettre de la migration 20260802170000) ; s'ajoutent PENDING_REVIEW→CORRECTION_REQUESTED (revue tracée exigée) et CORRECTION_REQUESTED→PENDING_REVIEW, contenu et provenance immuables dans tous les cas.
- **Note d'architecture** : la régénération complète (nouvelle révision N+1) reste impossible par construction (`@@unique(scoreSnapshotId)`) — c'est le chantier LLM qui la réintroduira. Ici, la « correction » est celle du rendu déterministe (code/paramètres), le document se reconstruisant du snapshot à chaque prévisualisation/diffusion.

## 2. Envoi WhatsApp assisté — voie B

- Bouton « Envoyer par WhatsApp » sur un bilan **diffusé** uniquement, masqué si téléphone absent (gardes testées). Il crée des **liens signés neufs** (les précédents du destinataire sont révoqués), construit le message français personnalisé (prénom de l'enfant, matière, niveau, durée de validité) et ouvre `wa.me/216<phoneNormalized>` — littéral wa.me confiné à `lib/whatsapp.ts` (garde CI conservé).
- **Liens signés** : jeton `<id>.<secret 256 bits>`, seul le SHA-256 du secret est stocké, comparaison en temps constant ; expiration 30 jours (paramétrable `BILAN_SHARE_LINK_VALIDITY_DAYS`) ; révocation unique et irréversible (trigger DB) ; **audience NEXUS interdite par CHECK en base** ; chaque consultation journalisée (date seule, ni IP ni user-agent). Jamais de PDF en pièce jointe : consultation HTML en ligne, `no-store`, `noindex`, rate-limitée.
- **Trace de transmission** : « Confirmer : message envoyé » → `canonical_report_transmissions` (append-only) → statut « Transmis au parent le [date] par WhatsApp » dans la file et le compteur de suivi. Impossible sans diffusion préalable ni liens actifs (testé).

## 3. Notifications

- **Assistante — dashboard** : fil du workflow (Foyer → Saisie → Revue → Diffusion → WhatsApp → Suivi), six compteurs d'états sur la page bilans, tuile « Bilans de positionnement à traiter » sur l'accueil (à revoir / en correction / à transmettre), notifications in-app (cloche existante) : bilan prêt à revue (créée par le worker dans la transaction de la révision), parent ayant activé son espace, synthèse envoyée.
- **Assistante — e-mail** : synthèse **groupée** (jamais un e-mail par événement) via l'outbox chiffrée existante (`enqueueEmailIntent`, aucune seconde infrastructure), envoyée par le scheduler worker existant au plus une fois par intervalle (24 h par défaut, `BILAN_ASSISTANT_DIGEST_INTERVAL_HOURS`) et seulement s'il y a matière : bilans à revoir, corrections, foyers sans e-mail au-delà de N jours (3 par défaut), diffusés non transmis au-delà de N jours (2 par défaut), activations parents.
- **Parents** : e-mail « bilan disponible » à la diffusion — annonce la disponibilité sur l'espace parent, **jamais le contenu** ; l'e-mail d'activation existant a été relu et corrigé (accents restaurés : « a bien été enregistrée », « Nexus Réussite », insécables).
- Évolution notée, hors périmètre : notification WhatsApp automatique = API Meta.

## 4. Preuves (démonstration réelle scriptée, base de démonstration)

Captures dans `captures/` (données synthétiques uniquement) : accueil avec tuile, file complète (les trois états), panneau de correction, historique d'annotations, saisie papier, « Transmis au parent le… », correction demandée après action réelle.

Démonstration de bout en bout exécutée sur serveur réel (résultats bruts) :
- URL produite : `https://wa.me/21699192822?text=…` — message français typographié, personnalisé, deux liens signés (parents + élève), **aucun lien Nexus** ;
- consultation du lien signé → **200** ; même lien altéré d'un caractère → **404** ; (lien expiré → refus prouvé par test unitaire, et gardes DB prouvées sur PostgreSQL réel) ;
- confirmation → « Transmis au parent le 12 août 2026 » affiché ;
- demande de correction via l'UI → badge et compteur « Correction demandée ».

Gardes prouvées par tests (49 nouveaux tests unitaires + 6 tests PostgreSQL réels) :
- lien expiré/altéré/révoqué/non diffusé → refusé ; NEXUS impossible (service **et** SQL) ;
- aucun bilan transmis sans diffusion ; pas de confirmation sans liens actifs ;
- annotations : snapshot de score et contenu de révision intacts (aucune écriture, vérifié) ; append-only en SQL réel ;
- français : apostrophes typographiques, insécables, accents sur tous les nouveaux textes (tests dédiés).

## 5. Suite et non-régression

- Suite unitaire complète : **8 907/8 907 verts** (795 suites), 0 skip injustifié ; typecheck vert ; lint vert sur les fichiers touchés ; scan sécurité inchangé.
- Les deux gardiens qui balayaient le disque (`whatsapp-centralized`, `bilan-validated-pack-boundary`) énumèrent désormais **les fichiers suivis par Git** — correction de cause racine demandée par le responsable le 12/08 : plus d'échec local sur worktrees, efficacité intacte (le non-commité ne peut pas être livré).
- Garde des 17 packs vert ; parité papier/en ligne verte ; workflow 5 étapes vert ; migration additive appliquée et testée sur clone vierge (`migrate deploy` + 6 tests SQL réels).

## 6. Texte RGPD à faire valider (ne pas publier sans validation du responsable)

À intégrer dans la notice de confidentialité (proposition, à relire) :

> **Transmission des bilans par WhatsApp.** Avec votre accord, notre équipe peut vous transmettre, via WhatsApp, des liens d'accès aux bilans pédagogiques de votre enfant. Ces liens sont personnels, signés, à durée de validité limitée (30 jours par défaut) et révocables à tout moment sur simple demande. Ils donnent accès au seul compte rendu vous concernant, en consultation ; aucun document n'est joint au message. La date de chaque consultation d'un lien est journalisée à des fins de sécurité, sans collecte d'adresse IP ni d'identifiant technique de votre appareil. WhatsApp est un service de Meta Platforms ; son utilisation est soumise à ses propres conditions et politique de confidentialité, et le numéro de téléphone que vous nous avez communiqué y est utilisé pour vous joindre.

Points à arbitrer avec le responsable : base juridique retenue (consentement vs intérêt légitime), mention de la durée de conservation des journaux de consultation, procédure de révocation affichée aux familles.

## 7. Paramétrage (env, valeurs par défaut sûres)

`BILAN_SHARE_LINK_VALIDITY_DAYS=30` · `BILAN_ASSISTANT_DIGEST_INTERVAL_HOURS=24` · `BILAN_PARENT_EMAIL_REMINDER_DAYS=3` · `BILAN_TRANSMISSION_REMINDER_DAYS=2`. Rien à configurer pour un comportement nominal.
