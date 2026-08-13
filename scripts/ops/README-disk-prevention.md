# Prévention disque — rotation des releases, purge de build, alerte

Contexte : le 2026-08-12, le disque de production a atteint 86 % (32
releases accumulées, 52 Go, plus 11,6 Go de workspaces de build jamais
purgés). À 100 %, l'application s'arrête. Ces trois scripts empêchent la
récidive. **Rien n'est activé automatiquement** : l'activation se fait à la
prochaine fenêtre d'intervention, selon la procédure ci-dessous.

## 1. `rotate-releases.sh` — rotation à la bascule

Politique validée le 2026-08-12 : conserver la release active + l'instance
la plus récente de chacun des 2 derniers SHA distincts à runtime Node
embarqué + toute release épinglée dans `/etc/nexus/release-retention.conf`.

Le fichier d'épinglage est **obligatoire** (fail-closed, même vide). Une
entrée par ligne (nom du dossier de release), commentaires `#` autorisés.
C'est le mécanisme qui aurait protégé automatiquement la release
`1b8219b1…` (facture unique) :

```
# /etc/nexus/release-retention.conf
# Releases à ne jamais purger automatiquement, une par ligne.
1b8219b1cfcfe63354d8cb4035645143e27e5a43   # facture unique (empreinte 4663d26e92dae05d)
```

Usage (dry-run par défaut, `--apply` pour agir). Les chemins réels de
production vivent dans l'espace d'opérations privé (politique du dépôt
public : aucun chemin d'infrastructure) — placeholders ici :

```bash
rotate-releases.sh \
  --release-root "$RELEASE_ROOT" \
  --canonical "$CANONICAL_SYMLINK" \
  --pin-file /etc/nexus/release-retention.conf \
  --health-url "$HEALTH_URL" \
  --apply
```

Intégration : à appeler en **fin de déploiement réussi**, après la bascule
du symlink et le smoke test — jamais avant. Le script revérifie la santé
avant chaque suppression et refuse toute release encore référencée par un
processus.

## 2. `purge-build-workspaces.sh` — purge du staging de build

À appeler au même moment, avec `--keep` sur le workspace de la release qui
vient d'être construite :

```bash
purge-build-workspaces.sh \
  --root "$BUILD_STAGING_ROOT" \
  --root "$BUILD_VALIDATION_ROOT" \
  --keep <nom-du-workspace-courant> \
  --apply
```

Garde-fou : refuse toute racine dont le nom ne commence pas par
`nexus-build-` (serveur mutualisé).

## 3. `disk-alert.sh` + timer systemd — alerte à 85 %

Envoie un e-mail à `INTERNAL_NOTIFICATION_EMAIL` (expéditeur
`contact@nexusreussite.academy`) quand l'occupation du point de montage
atteint le seuil. Sous le seuil : silence total (exit 0).

Activation à la prochaine fenêtre (opérateur, sur le serveur) :

```bash
install -m 0755 scripts/ops/disk-alert.sh /usr/local/libexec/nexus-disk-alert.sh
install -m 0644 scripts/ops/systemd/nexus-disk-alert.service /etc/systemd/system/
install -m 0644 scripts/ops/systemd/nexus-disk-alert.timer /etc/systemd/system/
# /etc/nexus/disk-alert.env doit définir INTERNAL_NOTIFICATION_EMAIL
systemctl daemon-reload
systemctl enable --now nexus-disk-alert.timer
systemctl start nexus-disk-alert.service   # test immédiat (silencieux si < 85 %)
```

Prérequis : un MTA local capable de relayer (`sendmail`/`msmtp`) — le
script ne porte aucun credential SMTP ; sinon passer `--mail-command` vers
l'outil configuré.
