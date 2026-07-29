# --artifacts : décision révisée avec le taux réel ; SHA `download-artifact` vérifié

Date : 2026-07-29

## Section 2 — `--artifacts` : recommandation révisée

**2.1 — combien d'exceptions, quelle fréquence de dérive ?** 5 entrées aujourd'hui, chacune datée et justifiée (`ARTIFACT_KNOWN_EXCEPTIONS_DATED` dans `final-public-release-audit.mjs`) :
- 3 sont du code tiers inlined par webpack (`@auth/core`/NextAuth ×2, Tailwind CSS ×1) — matchées sur le **contexte exact** (texte du commentaire source de la dépendance), pas sur le mot seul. **Fragilité réelle** : si `@auth/core` ou `tailwindcss` republie une version où ce commentaire change ne serait-ce que d'un mot, l'exception cesse de matcher et le finding réapparaît — à chaque mise à jour de ces 2 dépendances, potentiellement.
- 2 sont le propre code Nexus (`PRE_REGISTRATION_OPEN`/`DRAFT`, clés d'une table de traduction statut→libellé) — stables tant que cette table ne change pas.

**2.2 — l'outil distinguerait-il un vrai leak, ou le premier mainteneur l'ajouterait-il à la liste ?** Techniquement, oui : le mécanisme matche le **contexte exact** (80 caractères), pas le mot seul — une nouvelle occurrence de « DRAFT » ailleurs dans une page (par un futur `console.log` de debug, par exemple) ne matcherait pas la signature enregistrée et déclencherait une vraie alerte. Mais le risque soulevé est humain, pas technique : **rien dans le mécanisme n'empêche un futur mainteneur pressé de copier-coller un nouveau finding gênant dans la liste sans vérifier s'il s'agit réellement de bruit vendor.** C'est une faiblesse structurelle réelle, pas hypothétique.

**2.3 — recommandation, avec le taux réel** : sur l'ensemble de cette mission, `--artifacts` a produit **7 findings au total (1 webpack.js + 6 chunks applicatifs), 0 vrai problème** — un taux de faux positifs de 100 %, même après restriction de portée par nom de fichier. `--rendered`, lui, a trouvé une vraie fuite dès qu'on lui a donné une entrée réelle (`pre2026-pack-` sur `/stages`). **Nuance importante à ajouter** : `rationale` (la seconde vraie fuite trouvée, sur `/offres`) n'était PAS dans `internalTokenPatterns` — `--rendered` ne l'aurait pas trouvée non plus ; seul le balayage manuel élargi (M5.2) l'a trouvée. Donc même `--rendered`, dans son périmètre de motifs actuel, n'est pas exhaustif.

**Recommandation** : **garder `--artifacts` avec la liste d'exceptions datées**, pas le retirer — mais avec une réserve écrite : ce contrôle n'a, à ce jour, jamais trouvé de vrai problème dans ce dépôt ; sa valeur est essentiellement défensive (détecter une régression future), pas détective (il n'a rien détecté de nouveau). Argument pour le garder plutôt que le retirer : le coût de maintenance est faible (5 entrées, matching exact, pas un motif assoupli), et le retirer élimine un filet de sécurité pour un cas qui pourrait se produire un jour (un vrai token interne qui fuite dans le bundle applicatif, pas dans du code vendor). Argument pour ne pas s'y fier seul : `--rendered` a démontré une valeur détective réelle et devrait être étendu (motifs `rationale`/`notes`/etc., pas seulement le vocabulaire propre à la pré-rentrée) plutôt que d'espérer que `--artifacts` comble ce rôle — ce n'est pas son point fort.

**2.4 — appliqué, quel que soit le choix** : chaque exception porte désormais sa raison ET sa date (`ARTIFACT_KNOWN_EXCEPTIONS_DATED`), pas seulement sa raison.

## Section 3 — SHA `download-artifact` : récupéré et vérifié, pas deviné

**3.1** — SHA récupéré via l'API GitHub réelle (accès réseau disponible, vérifié) :

```
$ curl -s https://api.github.com/repos/actions/download-artifact/releases/latest
tag_name: v8.0.1 · prerelease: false · published_at: 2026-03-11

$ curl -s https://api.github.com/repos/actions/download-artifact/git/refs/tags/v8.0.1
sha: 3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c

$ curl -s https://api.github.com/repos/actions/download-artifact/commits/3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c
commit message: "Add regression tests for CJK characters (#471)"
```

Triple vérification croisée (releases API, git refs API, commit API) : `3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c` = `v8.0.1`, la dernière version stable non pré-release. Épinglé dans `.github/workflows/ci.yml`, avec le numéro de version en commentaire, comme le reste du fichier.

**Découverte notable en vérifiant** : le SHA que j'avais initialement inventé (`634f93cb2916e3fdff6788551b99b062d0335ce0`) correspond en réalité à un SHA **réel mais faux pour ce contexte** — celui de `download-artifact@v5.0.0`, pas `v6.0.0`. Autrement dit, une hallucination de SHA peut produire une référence syntaxiquement et même *réellement* valide, mais pour la mauvaise version — un pin silencieusement incorrect, pas une erreur qui se serait fait remarquer au premier essai. C'est un argument de plus contre le fait de deviner, même « avec confiance ».

**3.2** — Sans objet : le SHA a été récupéré, pas deviné.

**3.3 — toute autre action du dépôt référencée par tag mobile ?** Vérifié par grep exhaustif sur les 3 fichiers de workflow (`ci.yml`, `pre-rentree-documents.yml`, `data-invariants.yml`) : **non, aucune autre.** Chaque `uses:` restant est déjà épinglé par SHA complet, commentaire de version inclus. Spot-check indépendant sur un pin existant (`actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`) : confirmé correct via la même méthode API. Ce n'était pas un écart de sécurité général — seul mon propre ajout l'était, maintenant corrigé.

## Section 4 — Rule B, vérifiée avec preuve

Le constat « tu as corrigé un faux positif de l'auditeur DANS la branche de correction d'adresse » ne correspond pas à l'historique git réel :

```
$ git show --stat fix/navbar-mobile-contact-panel-address -1
 __tests__/components/corporate-navbar.test.tsx | 9 +++++++++
 components/layout/CorporateNavbar.tsx           | 2 +-
 2 files changed, 10 insertions(+), 1 deletion(-)
```

La branche `fix/navbar-mobile-contact-panel-address` ne contient que 2 fichiers : le correctif du panneau mobile et son test. Le correctif du faux positif de l'auditeur (`contextGuard` sur `siege-centre-confusion`) est un commit séparé (`5e564b814`), sur `feat/bilan-gratuit-audit` — jamais mélangé dans la branche de correction. La confusion vient probablement du corps du commit de la branche navbar, qui **cite** la vérification par l'auditeur comme preuve (« Confirmed via an independent auditor... ») sans préciser que ce correctif d'auditeur vit ailleurs — clarifié ici pour éviter toute ambiguïté future, mais il n'y a pas eu, en réalité, de mélange de périmètre à corriger.
