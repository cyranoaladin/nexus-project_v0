# Rollback du pilote bilans Seconde

## Date

2026-08-03

## Perimetre

Ce rollback concerne uniquement la release pilote des bilans Canonical et le pack
`entree-seconde-maths-v1`. Il ne touche ni aux conteneurs, ni aux services Korrigo,
ni aux migrations deja appliquees.

Release de retour connue :

```text
/var/www/nexus-releases/11e0dce93e9f1d4c79824f9cccd0a467dde4f11b
```

## Commande exacte

A executer en `root` sur le serveur de production :

```bash
set -euo pipefail

previous=/var/www/nexus-releases/11e0dce93e9f1d4c79824f9cccd0a467dde4f11b
link=/var/www/nexus-project_v0
temporary_link=/var/www/.nexus-project_v0.rollback
env_file=/etc/nexus/nexus-prod.env
env_tmp="$(mktemp /etc/nexus/nexus-prod.env.rollback.XXXXXX)"

test -f "$previous/.next/standalone/server.js"
ln -s "$previous" "$temporary_link"
mv -Tf "$temporary_link" "$link"

awk '
  BEGIN { key = "NEXUS_BILAN_PACK_ENTREE_SECONDE_MATHS_V1_ENABLED"; written = 0 }
  index($0, key "=") == 1 {
    if (!written) print key "=false"
    written = 1
    next
  }
  { print }
  END { if (!written) print key "=false" }
' "$env_file" > "$env_tmp"
chown root:nexusapp "$env_tmp"
chmod 640 "$env_tmp"
mv -f "$env_tmp" "$env_file"

pm2 restart nexus-prod --update-env
test "$(readlink -f "$link")" = "$previous"
for attempt in $(seq 1 30); do
  curl -fsS -o /dev/null https://nexusreussite.academy/ && break
  test "$attempt" -lt 30
  sleep 1
done
curl -fsS -o /dev/null https://nexusreussite.academy/
curl -fsS -o /dev/null https://nexusreussite.academy/bilan-gratuit
curl -fsS -o /dev/null https://nexusreussite.academy/auth/signin
```

## Critere de succes

- le symlink resout vers la release `11e0dce93e9f1d4c79824f9cccd0a467dde4f11b` ;
- `nexus-prod` est `online` dans PM2 ;
- le flag maths Seconde vaut `false` ;
- les trois controles HTTP ci-dessus repondent sans erreur.

## Limite

Les migrations additives ne sont pas retirees par ce rollback. Elles sont compatibles
avec la release precedente et ne doivent pas etre inversees dans l'urgence.
