<!-- markdownlint-disable MD013 MD022 MD032 MD031 -->
# 📘 Cahier des Charges – Version 3 (Améliorée)

## 🎯 Objectifs
Améliorer Nexus Réussite en intégrant :
- Une **gestion dynamique des tarifs** (modifiable par admin/assistante via dashboard).
- Une **mise à jour en temps réel** des tarifs affichés sur le site (API + revalidation ISR).
- Une **intégration claire des modalités de paiement** (CB, virement, espèces).
- Une **gestion des échelonnements** pour les offres annuelles (20% à la souscription, reste jusqu’à juin 2026).
- Une **gestion des crédits** (1 crédit = 10 TND, utilisable sur toutes les offres à la carte).

---

## 🔧 Fonctionnalités à Implémenter

### 1. Gestion Dynamique des Tarifs
- Création d’un modèle `Pricing` en base de données.
- Champs : `service`, `variable`, `valeur`, `devise`.
- API `/api/pricing` :
  - **GET** : renvoie tous les tarifs.
  - **PUT/POST** : mise à jour par admin/assistante (auth requise).
- Côté front : toutes les pages offres consomment cette API (affichage des tarifs en temps réel).

### 2. Dashboard Admin & Assistante
- Section « Tarifs & Crédits » dans le dashboard.
- Liste editable des tarifs (inputs numériques).
- Bouton « Sauvegarder » → mise à jour DB + revalidation cache.
- Confirmation visuelle (*« Tarifs mis à jour avec succès »*).

### 3. Modalités de Paiement
- CB (intégration Stripe/Konnect),
- Virement bancaire (affichage IBAN),
- Espèces (paiement au centre, reçu officiel).
- Logos (Visa, Mastercard, SEPA, Cash) visibles sur toutes les pages offres.

### 4. Échelonnement Offres Annuelles
- Règle standard :
  - **20% acompte à la souscription**.
  - **80% restants en mensualités jusqu’à juin 2026**.
- Gestion backend : plan de facturation récurrent.

### 5. Crédits Nexus
- 1 crédit = 10 TND.
- Packs disponibles : 50 (500 TND), 100 (1000 TND), 250 (2500 TND + 10 offerts).
- Dashboard :
  - Achat de crédits (paiement CB/virement/espèces).
  - Solde en temps réel visible.
  - Utilisation possible pour : SOS devoirs, cours ponctuels, ARIA, PDF premium…

---

## 🛠 Architecture Technique

### Prisma Model
```prisma
model Pricing {
  id        Int      @id @default(autoincrement())
  service   String   // Ex: "ARIA", "Studio Flex"
  variable  String   // Ex: "prix_individuel", "prix_stage_groupe8"
  valeur    Float
  devise    String   @default("TND")
  updatedAt DateTime @updatedAt
}
```

### API Next.js
- **GET /api/pricing** → Liste tarifs en temps réel.
- **PUT /api/pricing/:id** → Modification admin.
- **ISR revalidation** : mise à jour auto du site dès changement.

### Sécurité
- Authentification requise pour la modification (rôles : admin, assistante).
- Logs des modifications (qui a changé quoi, quand).

---

## 📌 Résumé
- Tarifs 100% dynamiques, modifiables sans redéploiement.
- Paiement flexible (CB, virement, espèces).
- Packs annuels avec acompte 20% + échelonnement jusqu’à juin.
- Crédits utilisables sur tous les services.
- Dashboard simple et intuitif pour l’équipe Nexus.
