#!/usr/bin/env bash
# Harness minimal et déterministe pour tester
# scripts/demo-utica-env-guard.sh sans lancer l'artefact standalone complet
# (voir __tests__/demo/utica-2026/startup-env-guard.test.ts).
#
# Résout son propre chemin de façon strictement relative à lui-même
# (BASH_SOURCE), plutôt que de recevoir un chemin construit côté appelant :
# évite tout passage de valeur dérivée de process.cwd() au processus enfant
# (CodeQL js/shell-command-injection-from-environment).
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/demo-utica-env-guard.sh"

demo_utica_refuse_inherited_env
demo_utica_export_local_env 127.0.0.1 3000 /tmp/demo-utica-env-guard-test-storage
env
