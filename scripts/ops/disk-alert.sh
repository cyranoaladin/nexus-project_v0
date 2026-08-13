#!/usr/bin/env bash
# Alerte d'occupation disque — pensé pour un timer systemd horaire.
#
# df sur le point de montage surveillé ; si l'occupation atteint le seuil,
# envoie un e-mail via la commande sendmail configurée. En dessous du
# seuil : sortie 0 silencieuse.
#
# L'adresse destinataire vient de --to ou de $INTERNAL_NOTIFICATION_EMAIL.
# Aucun secret dans ce script : le relais SMTP est la responsabilité du
# MTA local (sendmail/msmtp) configuré côté serveur.
set -euo pipefail

fail() {
  printf 'disk-alert failed: %s\n' "$1" >&2
  exit 1
}

mount_point='/'
threshold=85
to="${INTERNAL_NOTIFICATION_EMAIL:-}"
from='contact@nexusreussite.academy'
mail_command='sendmail -t'

while (($# > 0)); do
  case "$1" in
    --mount)
      (($# >= 2)) || fail 'MISSING_ARGUMENT_VALUE'
      mount_point=$2; shift 2 ;;
    --threshold)
      (($# >= 2)) || fail 'MISSING_ARGUMENT_VALUE'
      threshold=$2; shift 2 ;;
    --to)
      (($# >= 2)) || fail 'MISSING_ARGUMENT_VALUE'
      to=$2; shift 2 ;;
    --from)
      (($# >= 2)) || fail 'MISSING_ARGUMENT_VALUE'
      from=$2; shift 2 ;;
    --mail-command)
      (($# >= 2)) || fail 'MISSING_ARGUMENT_VALUE'
      mail_command=$2; shift 2 ;;
    *)
      fail 'UNKNOWN_ARGUMENT' ;;
  esac
done

[[ "$threshold" =~ ^[0-9]+$ && "$threshold" -ge 1 && "$threshold" -le 99 ]] \
  || fail 'INVALID_THRESHOLD'
[[ -n "$to" ]] || fail 'RECIPIENT_MISSING'

usage_line=$(df -P "$mount_point" | tail -1)
usage_pct=$(printf '%s' "$usage_line" | awk '{print $5}' | tr -d '%')
avail_kb=$(printf '%s' "$usage_line" | awk '{print $4}')
[[ "$usage_pct" =~ ^[0-9]+$ ]] || fail 'DF_PARSE_ERROR'

if (( usage_pct < threshold )); then
  exit 0
fi

avail_human=$(awk -v kb="$avail_kb" 'BEGIN { printf "%.1f Gio", kb / 1048576 }')
hostname_value=$(hostname)

$mail_command <<MAIL
From: Nexus Ops <${from}>
To: ${to}
Subject: [ALERTE DISQUE] ${hostname_value} — ${mount_point} à ${usage_pct}% (seuil ${threshold}%)
Content-Type: text/plain; charset=utf-8

L'occupation du disque a atteint ${usage_pct}% sur ${hostname_value}:${mount_point}
(seuil d'alerte : ${threshold}%, espace restant : ${avail_human}).

À 100%, l'application de production s'arrête. Actions recommandées :
1. Rotation des releases : scripts/ops/rotate-releases.sh (dry-run d'abord).
2. Purge des workspaces de build : scripts/ops/purge-build-workspaces.sh.
3. Vérifier les gros consommateurs récents : du -x -d1 -h /var | sort -rh | head.

Généré par scripts/ops/disk-alert.sh (timer systemd nexus-disk-alert).
MAIL

printf 'disk-alert: alerte envoyée (%s%% >= %s%%)\n' "$usage_pct" "$threshold"
