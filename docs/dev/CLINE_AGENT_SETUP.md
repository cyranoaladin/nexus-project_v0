# Cline — RETIRED

Cline is no longer used on this project (operator decision, 2026-09-30). This file
is kept only as the retirement record and must not be turned back into a setup guide.

## Retirement procedure (already applied on the operator workstation)

* Uninstall the extension with the editor's native command, using the installed id
  (`saoudrizwan.claude-dev`): `cursor --uninstall-extension saoudrizwan.claude-dev`
  (or `code --uninstall-extension …`). Do not reinstall or replace it.
* Remove its extension storage and history. Keep any API key it held until you have
  confirmed that the same key is available through your secure launch mechanism;
  uninstalling never revokes a key at the provider.
* Do not add the extension id to editor recommendations, devcontainers or scripts.
  `__tests__/architecture/cline-retired.test.ts` fails if it reappears.

## Model gateway

OpenRouter is the only model gateway for the applications; Chutes is excluded both as a
client and as a provider behind OpenRouter (`provider.ignore` contains `chutes` on every
request, see `lib/llm/provider-exclusion.ts`).

| Component | Client | Model |
| --- | --- | --- |
| NPC | `lib/npc/ai/openrouter-client.ts` | `openai/gpt-5-mini` (pinned) |
| ARIA | `lib/aria/infrastructure/model/gateway.ts` | per `ARIA_MODEL` policy (`OPENROUTER_HOSTED`) |
| Bilans | `lib/bilans/llm/` | per `data/bilans/model-policy.json` |

Keys are injected per service at launch (`OPENROUTER_API_KEY` for NPC and bilans,
`ARIA_MODEL_API_KEY` for ARIA) and never written to the repository. An inference client
never receives an OpenRouter management key, and there is no automatic switch to another
key when a quota or budget is reached.

The historical `.clinerules/` and `.cline/skills/` content is product guidance that predates
this decision; it is not loaded by any retained tool and is pending a review against
`AGENTS.md` before conversion or removal.
