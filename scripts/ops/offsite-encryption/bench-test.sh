#!/usr/bin/env bash
# Banc de validation du chiffrement avant offsite (aucun accès production, aucun secret réel).
# Prouve : artefact offsite = .gpg seul ; clair supprimé succès/échec ; fail-fast sur empreinte
# invalide ; serveur (clé publique seule) incapable de déchiffrer ; restauration offline complète.
# Usage : bench-test.sh <url-postgres-jetable-source>   (ex: postgresql://u:p@127.0.0.1:5444/db_test)
set -euo pipefail
SRC_URL=${1:?url postgres jetable requise}
case "$SRC_URL" in *disposable*|*_test*|*rehearsal*) ;; *) echo "REFUS: l'URL ne ressemble pas à une base jetable" >&2; exit 2;; esac
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT; umask 077
mkdir -p $T/{bin,remote,gnupg-server,gnupg-offline,root/runs/bench/run1}; chmod 700 $T/gnupg-server $T/gnupg-offline
export GNUPGHOME=$T/gnupg-offline
gpg --batch --quiet --pinentry-mode loopback --passphrase '' --quick-gen-key "Bench <bench@example.invalid>" ed25519 cert never
FPR=$(gpg --list-keys --with-colons | awk -F: '/^fpr/{print $10;exit}')
gpg --batch --quiet --pinentry-mode loopback --passphrase '' --quick-add-key "$FPR" cv25519 encr never
gpg --export "$FPR" | GNUPGHOME=$T/gnupg-server gpg --quiet --import
[ "$(GNUPGHOME=$T/gnupg-server gpg --list-secret-keys --with-colons | grep -c '^sec' || true)" = 0 ] || { echo FAIL_PRIVATE_KEY_ON_SERVER; exit 1; }
cat > $T/bin/ssh <<EOS
#!/usr/bin/env bash
while [[ \$1 == -* ]]; do [[ \$1 == -i || \$1 == -p || \$1 == -o ]] && shift; shift; done
shift; cd $T/remote; eval "\$*"
EOS
cat > $T/bin/scp <<EOS
#!/usr/bin/env bash
while [[ \$1 == -* ]]; do [[ \$1 == -i || \$1 == -P || \$1 == -o ]] && shift; shift; done
mkdir -p "$T/remote/\$(dirname "\${2#*:}")"; cp "\$1" "$T/remote/\${2#*:}"
EOS
chmod +x $T/bin/ssh $T/bin/scp; touch $T/key
printf 'SB_USER="bench"\nSB_KEY="%s"\nSB_ENC_FPR="%s"\n' "$T/key" "$FPR" > $T/config.sh
pg_dump "$SRC_URL" -Fc -f $T/root/runs/bench/run1/database.dump
echo '{"backup_complete": true}' > $T/root/runs/bench/run1/result.json
H=$(cd "$(dirname "$0")" && pwd)
sed "s#^ROOT=.*#ROOT=pathlib.Path('$T/root')#; s#^CONFIG=.*#CONFIG=pathlib.Path('$T/config.sh')#" "$H/publish_backup.py.patched" > $T/publish.py
GNUPGHOME=$T/gnupg-server PATH=$T/bin:$PATH python3 $T/publish.py $T/root/runs/bench/run1
ls $T/root/exports/ | grep -q '\.tar\.gz$' && { echo FAIL_PLAINTEXT_LEFT; exit 1; }
find $T/remote -name '*.tar.gz' | grep -q . && { echo FAIL_PLAINTEXT_OFFSITE; exit 1; }
GNUPGHOME=$T/gnupg-server gpg --batch -d -o /dev/null $T/remote/backups/*/*/*.gpg 2>/dev/null && { echo FAIL_SERVER_CAN_DECRYPT; exit 1; }
GNUPGHOME=$T/gnupg-offline gpg --quiet --batch -d -o $T/r.tar.gz $T/remote/backups/*/*/*.gpg
tar -xzf $T/r.tar.gz -C $T database.dump && pg_restore --list $T/database.dump >/dev/null
# échec d'empreinte = fail-fast sans clair
sed 's/SB_ENC_FPR=.*/SB_ENC_FPR="DEADBEEF"/' $T/config.sh > $T/bad.sh
mkdir -p $T/root/runs/bench2/run1; cp $T/root/runs/bench/run1/{database.dump,result.json} $T/root/runs/bench2/run1/
sed "s#$T/config.sh#$T/bad.sh#" $T/publish.py > $T/publish-bad.py
GNUPGHOME=$T/gnupg-server PATH=$T/bin:$PATH python3 $T/publish-bad.py $T/root/runs/bench2/run1 2>/dev/null && { echo FAIL_BAD_FPR_ACCEPTED; exit 1; }
ls $T/root/exports/ | grep -q bench2 && { echo FAIL_PLAINTEXT_AFTER_FAILURE; exit 1; }
echo "OFFSITE_ENCRYPTION_BENCH=PASS"
