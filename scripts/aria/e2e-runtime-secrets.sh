#!/usr/bin/env bash

set -euo pipefail

prepare_aria_e2e_runtime_secrets() {
  local variable_name runtime_value
  for variable_name in \
    ARIA_E2E_FIXTURE_ADMIN_TOKEN \
    ARIA_E2E_MODEL_API_KEY \
    RAG_BFF_SERVICE_TOKEN \
    RAG_ENGINE_API_KEY \
    NEXUS_INTERNAL_TOKEN_SECRET
  do
    runtime_value="$(openssl rand -hex 32)"
    printf -v "$variable_name" '%s' "$runtime_value"
    export "$variable_name"
    if [[ "${GITHUB_ACTIONS:-}" == true ]]; then
      printf '::add-mask::%s\n' "$runtime_value"
    fi
  done
  CORE_V2_ACCOUNT_TOKEN_HMAC_CURRENT_KEY_ID=e2e
  runtime_value="$(openssl rand -hex 32)"
  printf -v CORE_V2_ACCOUNT_TOKEN_HMAC_KEYS '{"e2e":"%s"}' "$runtime_value"
  export CORE_V2_ACCOUNT_TOKEN_HMAC_CURRENT_KEY_ID CORE_V2_ACCOUNT_TOKEN_HMAC_KEYS
  if [[ "${GITHUB_ACTIONS:-}" == true ]]; then
    printf '::add-mask::%s\n' "$runtime_value"
    printf '::add-mask::%s\n' "$CORE_V2_ACCOUNT_TOKEN_HMAC_KEYS"
  fi
}
