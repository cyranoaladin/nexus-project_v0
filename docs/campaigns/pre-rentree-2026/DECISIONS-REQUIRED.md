# Décision restante

Le contenu, la campagne, les sept PDF et le périmètre informatif ont été
approuvés par le propriétaire pour le manifeste exact enregistré hors Git.
Le runbook privé, le rollback non destructif et le health pré-déploiement sont
également qualifiés.

La seule décision atomique restante est le binding final de GO :

1. intégrer la preuve CI dans la PR #79 ;
2. relancer tous les checks sur la tête exacte ;
3. vérifier que le manifeste approuvé n'a pas changé matériellement ;
4. passer uniquement `publication_authorization` et `releaseStatus` à
   `PUBLIC_READY` ;
5. lier le GO au SHA créé par ce commit puis relancer la CI.

Tout changement de tarif, date, matière, claim, PDF ou asset invalide
l'approbation et rouvre une mission produit.
