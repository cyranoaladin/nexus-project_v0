# Nexus Réussite — DNB Maths : dernière ligne droite

> Version 2.0 — Saisie du nom élève, multi-élèves, bilan nominatif, export JSON/CSV.

## Contenu des fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page autonome, déployable sans build |
| `src/logic.js` | Fonctions pures exportées pour les tests unitaires |
| `tests/unit/` | Tests unitaires Vitest |
| `tests/e2e/` | Tests end-to-end Playwright |
| `scripts/check.js` | Vérification statique de `index.html` |
| `package.json` | Scripts npm |

## Déploiement rapide

```bash
scp index.html favicon.svg root@88.99.254.59:/srv/nexusreussite/docs_DNB/derniere-ligne-droite/
```

URL accessible :

```
https://nexusreussite.academy/docs_DNB/derniere-ligne-droite/
```

## Tester localement

```bash
cd docs/nexus_dnb_derniere_ligne_droite
python3 -m http.server 8080
# → http://localhost:8080
```

## Lancer les tests

```bash
cd docs/nexus_dnb_derniere_ligne_droite
npm install
npm run test:unit        # Vitest — tests unitaires
npm run test:e2e         # Playwright — tests end-to-end
npm run check            # Vérification statique HTML
```

## Comment fonctionne l'historique élève

1. Au premier chargement, une **modale** demande le prénom de l'élève.
2. Le nom est validé (non vide), puis stocké dans `sessionStorage` pour la session en cours.
3. La progression est sauvegardée dans `localStorage` sous une clé unique `nexusDnbRoot` (objet racine avec tous les élèves de l'appareil).
4. Après rechargement dans le même onglet, `sessionStorage` est consulté : si un élève est actif, la modale est ignorée.
5. Pour **changer d'élève** : cliquer sur le chip du nom en haut (↺).

### Schéma de stockage

```
localStorage:
  nexusDnbStudents         → ["neil-zayane", "eleve-test", ...]
  nexusDnbV2:neil-zayane   → { schemaVersion:2, studentName:"Neil ZAYANE", xp:…, auto:{}, … }
  nexusDnbV2:eleve-test    → { schemaVersion:2, studentName:"Élève Test", … }

sessionStorage:
  nexusDnbCurrent          → "Neil ZAYANE"
```

### Version du schéma

`SCHEMA_VERSION = 2`. Si elle change, l'état sauvegardé est ignoré (migration propre).

## ⚠ Limites du stockage local

> **L'historique est récupérable uniquement sur le même navigateur et le même appareil.**
> Il n'est pas synchronisé entre appareils ni entre navigateurs (Chrome ≠ Safari).
> En navigation privée, les données sont perdues à la fermeture de l'onglet.

Si `localStorage` est indisponible, la page affiche une bannière et demande à l'élève d'exporter son bilan avant de fermer.

> **L'historique est sauvegardé dans le navigateur de l'élève via localStorage. Il est récupérable sur le même appareil et le même navigateur. Pour une récupération automatique par le professeur, il faut ajouter un backend. En l'état, le professeur récupère le bilan si l'élève l'exporte ou le copie.**

## Procédure de récupération du bilan — professeur

> **Le professeur récupère le bilan si l'élève l'exporte ou le copie. Aucun envoi automatique.**

L'élève dispose de quatre boutons dans la section **Bilan final** :

1. **Générer le bilan** — affiche un récapitulatif nominatif sur la page.
2. **Exporter JSON** — télécharge `bilan_<nom>_dnb.json` (données complètes).
3. **Exporter CSV** — télécharge `bilan_<nom>_dnb.csv` (résumé une ligne).
4. **Copier pour le prof** — copie le bilan texte dans le presse-papier.

## Nginx — configuration sur le serveur

```nginx
location ^~ /docs_DNB/ {
    index index.html;
    alias /srv/nexusreussite/docs_DNB/;
    autoindex on;
    autoindex_exact_size off;
    autoindex_localtime on;
}
```

## Points UX intégrés (v2)

- Modale saisie du nom — obligatoire au premier démarrage.
- Chip "Nom ↺" en topbar — changer d'élève avec confirmation.
- Indicateur "✓ Sauvegardé" — apparaît 2,5 s après chaque sauvegarde.
- Bannière si `localStorage` indisponible.
- Bilan nominatif : nom, date, score, XP, badges, erreurs, réponses papier.
- Export JSON / CSV / copie texte pour le professeur.
- Reset avec confirmation du nom de l'élève.
- Responsive mobile / tablette / desktop.
- Mode impression : topbar et boutons masqués, modèles de rédaction affichés.
