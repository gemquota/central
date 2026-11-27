# Trio Chat backend setup

The dashboard is static, with Vercel Functions under `api/`. Configure these environment variables in the Vercel project **central-trio-chat**, rooted at `dashboard`, then redeploy.

## Phase B shared API

Required:
- `CENTRAL_GITHUB_TOKEN`: server-only fine-grained GitHub token for gemquota/central Contents read/write. Never put this in frontend code.
- `TRIO_DAYNE_TOKEN`, `TRIO_GANG_TOKEN`, `TRIO_CHATGPT_TOKEN`: separate high-entropy bearer secrets, one per identity. The frontend user config stores the chosen token locally on that device.
Optional:
- `TRIO_ALLOWED_ORIGINS`: comma-separated allowed browser origins. Same-origin requests are preferred.
- API path: `/api/trio/conversations`, `/api/trio/conversations/:id`, `/messages`, and `/branch`.

Repository records are written beneath `trio-chat/conversations/`. Legacy `trio-chat/messages/` is untouched. Branches retain parent conversation/message IDs and selected context mode. Message writes use an idempotency key if supplied.

**Operational limitation:** GitHub Contents API writes are sequential commits, not multi-file transactions. Message records are append-only; metadata may lag if a second commit fails. A reconciliation task should repair updated_at/index data. GitHub's Contents API can also conflict on concurrent metadata updates; the API currently reports the conflict instead of silently overwriting it.

## Phase C model runtime

Optional:
- `TRIO_MODEL_PROVIDER`: `openai` or `anthropic`.
- `TRIO_MODEL_API_KEY`: provider key, server-only.
- `TRIO_MODEL_ENDPOINT`: optional compatible endpoint override.
- `TRIO_MODEL_DEFAULT`, `TRIO_MODEL_DAYNE`, `TRIO_MODEL_GANG`, `TRIO_MODEL_CHATGPT`: model IDs.
- `TRIO_TASK_WORKER_URL`, `TRIO_TASK_WORKER_TOKEN`: external authorized agent worker for task handoff.

Generation streams through `/api/generate`; tasks are persisted at `/api/task`. Without a worker, delegation remains queued and is clearly reported as awaiting execution. Do not add credentials to repository files or chat.

## Verification

The repository contains a dependency-free static frontend check at `node dashboard/trio-chat-tests.js`. It validates script syntax and key UI invariants. Real browser interaction, authenticated API integration, concurrency and provider streaming tests still need to be run after credentials are configured.
