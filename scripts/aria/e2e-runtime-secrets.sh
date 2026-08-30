#!/usr/bin/env bash

set -euo pipefail

prepare_aria_e2e_runtime_secrets() {
  local variable_name runtime_value
  for variable_name in \
    ARIA_E2E_FIXTURE_ADMIN_TOKEN \
    ARIA_E2E_MODEL_API_KEY \
    RAG_BFF_SERVICE_TOKEN \
    NEXUS_INTERNAL_TOKEN_SECRET
  do
    runtime_value="$(openssl rand -hex 32)"
    printf -v "$variable_name" '%s' "$runtime_value"
    export "$variable_name"
  done
}
