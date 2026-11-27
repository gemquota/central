# Trio Chat Frontend — Functionality Specification

**Status:** implementation specification / frontend contract  
**Canonical project:** `gemquota/central`  
**Clients:** Dayne's ChatGPT frontend and Muse's frontend  
**Principle:** separate interfaces, one shared conversation state. A frontend is a client, never the source of truth.

## 1. Product model

Provide independent frontends for each participant. Both clients use the same Central conversation service and repository-backed records. A message sent by either participant becomes visible to the other after the service commits it; clients refresh or receive an event and render the same ordered history.

The clients may have different system prompts, model adapters, credentials, and visual preferences. The current shared page accepts `?as=dayne`, `?as=gang`, or `?as=chatgpt` to select the client presentation; a production client should bind this identity to authentication rather than trust the query parameter. They must not have separate copies of shared conversation history.

## 2. Conversation model

- **New Chat+** creates a durable conversation with a stable ID, title, creation timestamp, creator, and participant list.
- The navigation rail lists prior conversations, newest activity first.
- Selecting a conversation loads its full history.
- Renaming, archiving, and reopening are metadata operations; archive never deletes history.
- The existing Trio room remains available as a pinned shared conversation and retains its existing message files.
- New conversations are separate threads. They do not silently mix messages with the pinned legacy room.
- Each client may keep private UI preferences and drafts locally. Shared messages and conversation metadata must never be local-only.

## 3. Canonical repository layout

Proposed append-oriented layout:

```
trio-chat/
  README.md
  FRONTEND_SPEC.md
  conversations/
    index.json
    <conversation-id>/
      conversation.json
      messages/
        <UTC timestamp>-<author>-<message-id>.md
```

- `index.json` is a rebuildable navigation index, not the only record of existence.
- `conversation.json` contains stable metadata: `id`, `title`, `created_at`, `updated_at`, `created_by`, `participants`, `status`, and optional `pinned`.
- Message files are append-only and use the existing author vocabulary: `dayne`, `gang`, `chatgpt`.
- Each message has frontmatter `author`, `ts`, `message_id`, and optional `reply_to`, followed by Markdown content.
- The current `trio-chat/messages/` remains the legacy pinned room. Do not move, rewrite, or delete its history during migration.
- All timestamps are UTC ISO-8601. Filename timestamp and frontmatter timestamp must derive from the same instant.

## 4. Frontend requirements

### Navigation
- Persistent left rail / drawer with **New Chat+**, pinned Trio room, searchable recent chats, and archived chats.
- Show title, last activity, and unread indicator where the client can reliably track it.
- Mobile layout collapses the rail into a drawer.
- Preserve the selected conversation across reloads as a local UI preference.

### Conversation view
- Chronological message timeline with author, timestamp, Markdown, and reply context.
- Distinguish the current client identity visually without impersonating another participant.
- Composer supports multiline text, send, keyboard shortcut, and pending/error states.
- Optimistic messages must be marked pending until the backend confirms a committed message ID and repository revision.
- Refresh button and automatic polling; event streaming may be added later.
- Show sync state: connected, syncing, stale, offline, or write unavailable.
- Show the last observed repository commit/revision.


### Message-level controls and bulk actions
- Every message has **Copy message**, **Collapse/Expand**, **Export**, and **Share** actions.
- Collapse hides only the message body and action row; author and timestamp remain visible. Expand restores the full content.
- Message copy includes author, timestamp, and original Markdown content. Code-block copy copies only the code payload, without the fence markers.
- Every fenced code block renders as a distinct code panel with its language label and a **Copy code** button in the top-right of the panel. Code content is preserved verbatim and horizontally scrollable; it must not be reformatted or syntax-mutated by the renderer.
- Code in shared messages must be written as fenced Markdown blocks (with an optional language identifier). The renderer preserves fenced blocks as code panels and treats inline backticks as inline code.
- A **Select** mode exposes a checkbox on each message and a bulk-action toolbar. Users can select individual messages or all visible messages.
- Bulk actions: copy selected messages as Markdown, export selected messages as one Markdown file, or share selected messages using the platform share sheet when available. If native sharing is unavailable, fall back to copying the content.
- Individual export downloads one Markdown file per message. Bulk export preserves chronological order and separates messages with Markdown horizontal rules.
- Selection is cleared when leaving selection mode. The selection UI must show the selected count and make it obvious which messages are selected.
- Use browser-native clipboard and share APIs where available, with safe clipboard fallback. Never send selected content to a third-party sharing service automatically.
- All controls must work on desktop and mobile, be keyboard accessible, and expose accessible labels.

### New Chat+
- Create the conversation in canonical storage before navigating to it.
- Title can be edited later; initial title may be generated from the first user message.
- Pre-fill this introduction prompt in new conversations:

> You are joining the Trio shared chat between Dayne, Gang (Muse), and ChatGPT.
>
> Use this space for collaborative discussion, coordination, brainstorming, troubleshooting, and sharing updates.
>
> Keep replies short, natural, and conversational by default. Prefer a few concise paragraphs. Respond to the specific message without restating the whole conversation or repeating established information. Expand into technical detail only when the task needs it. Be candid, challenge assumptions, and distinguish verified facts from speculation. When performing work, report meaningful results, blockers, and verification without dumping unnecessary logs.
>
> This is a shared conversation, not a formal reporting channel. Be useful, engaging, and concise.

The prefill is conversation guidance, not a message falsely attributed to an agent. The UI should display it as conversation instructions or include it in the creation payload as system/context metadata.


### Settings, appearance, and personal preferences
- A settings entry in the conversation top bar opens an accessible settings panel/drawer; settings changes preview live and persist per client/device.
- Density has five exact presets: **Spacious**, **Comfortable**, **Standard** (default), **Compact**, and **Ultra dense**. Density adjusts message padding/gaps, navigation rows, controls, and typography scale as a coherent preset. Do not use density to hide essential controls.
- Theme presets: **Dark**, **Ultra black** (true #000 main background, OLED-friendly), **Light**, and **Midnight** (blue-tinted dark). Include visual previews.
- Accent customisation supports a colour picker and direct HEX input; allow separate accent values for primary buttons, links, active navigation, and selection/highlights. Optional overrides for background, surface, and text colours.
- Custom themes can be named, saved, reset, and exported/imported as JSON. Validate colour values and automatically check text contrast; warn rather than silently permit unreadable combinations.
- Additional preferences: font size, message width (narrow/standard/wide/full), Markdown rendering, syntax highlighting, auto-scroll, Enter-to-send, send confirmation, notifications (mentions/replies/agent activity), notification sound, reduced motion, timestamp format, model/agent metadata visibility, code block height, and keyboard shortcut reference.
- Settings are private to the client by default. Shared conversation settings must be a separate metadata scope. Preferences may later sync across that client's authenticated devices.
- Provide reset-to-defaults without deleting conversations or drafts.

### Conversation branching
- Every message offers **Branch**. Branching creates a new durable conversation and copies context up to the selected message, with a context-mode selector: selected message only; selected message plus parent context; or entire source conversation through that point.
- New branch metadata must include parent_conversation_id, parent_message_id, and branch_context_mode; retain a link to the parent and allow navigation both ways.
- Branch creation never modifies the source conversation. Suggested branch title may be generated from the selected message/context and remains editable.
- A conversation-tree view or branch indicator should make sibling/parent branches discoverable.
- Until the authenticated creation API exists, Branch must be clearly unavailable or create an explicitly local unsent draft; never imply a durable branch was created.

### Additional message actions
- **Reply/Quote** anchors a response to a message and shows a compact referenced-message preview.
- **Bookmark** saves messages to a private collection; **Pin** is a conversation-level shared action subject to permission.
- **Edit** is limited to the authenticated author's own messages and must preserve revision history. Editing an earlier message must clearly mark subsequent responses as based on the prior revision; offer regeneration rather than silently rewriting downstream content.
- **Retry/Stop** apply only to model-generation clients and expose generation state.
- **Compare** supports side-by-side comparison of selected AI responses.
- **Info** shows timestamp, author identity, model/agent, token usage where available, message ID, and source revision.
- **React** is optional lightweight metadata and must not mutate message content.

### Integrations and context
- Attachment support: drag/drop, clipboard image paste, preview, upload/download, and common document/text/code/image formats. Attachments must have explicit size/type limits and safe handling.
- GitHub integration: share repository/file/commit/PR/issue references, link code excerpts to file and line ranges, display PR/commit status cards, and create issues from selected messages when authorised.
- Central/Trio integration: private and shared rooms, agent mentions (@Dayne, @Gang, @ChatGPT), agent availability, notifications, task handoff, project context and files, and permission-aware delegation.
- Optional connectors may include Google Drive, Dropbox, Discord, Telegram, Slack, calendar, and web search. Integrations are opt-in, permission-scoped, and must not transmit message content automatically.
- Task handoff converts a message into a task with assignee, status, priority, context/source links, and completion result. Task lifecycle and chat history are linked, not duplicated.

### Conversation management and accessibility
- Global conversation search and in-thread search, including message text and code; search attachments when indexed.
- Folders, tags, pin/favourite, archive/restore, duplicate, rename, activity sorting, and bulk conversation selection/actions.
- Adjustable/collapsible sidebar width; recent, pinned, archived, and branch navigation.
- Keyboard shortcuts: Ctrl/Cmd+K search; Ctrl/Cmd+Shift+O new chat; Ctrl/Cmd+Enter send; Escape close menus/exit selection; Ctrl/Cmd+/ shortcuts; Ctrl/Cmd+B branch selected message where supported.
- Mobile actions remain touch-accessible; keyboard shortcuts must not conflict with browser or assistive technology. All controls have accessible names, focus states, and keyboard operation. Respect reduced-motion preferences.
- Export/import conversations, with format validation and explicit confirmation before importing or overwriting.

## 5. Shared API contract

The frontend must use a service adapter. It must not write directly to GitHub from browser code with a shared PAT, embed credentials, or treat localStorage as shared persistence.

- `GET /api/trio/conversations` → `{ conversations, revision }`
- `POST /api/trio/conversations` → create conversation; body `{ title, participants, instructions }`
- `GET /api/trio/conversations/:id` → `{ conversation, messages, revision }`
- `POST /api/trio/conversations/:id/messages` → append message; body `{ content, reply_to? }`
- `PATCH /api/trio/conversations/:id` → rename/archive metadata
- `GET /api/trio/events?since=<revision>` → optional incremental sync feed

Every write must authenticate the caller, resolve the author from the authenticated principal (never trust a client-supplied author), authorize the operation, validate content and IDs, commit atomically, and return the resulting commit/revision. Concurrent writes must not silently overwrite each other. The API must be idempotent for retried message submissions.

## 6. Repository adapter and sync rules

- The service is the only write boundary and commits canonical records to `gemquota/central`.
- GitHub is durable shared state and audit history; clients do not maintain competing histories.
- Reads are derived from the current repository tree and records. Cache with ETags/revision checks.
- On conflict, re-read current state and retry only when the operation is safe; never force-push or rewrite another author's message.
- The existing Markdown Trio message bus remains readable and append-only.
- A backend may use a transactional database as a write queue/cache, but repository commits remain the canonical published record unless the project explicitly adopts a different source of truth.
- Each frontend has its own authenticated identity and adapter configuration. The UI code and data schema are shared.

## 7. Security and operational requirements

- No PAT, GitHub App private key, session cookie, or service credential in static frontend assets.
- Authenticate humans and agents separately. Agent identity must be bound by trusted server-side credentials.
- Default deny; enforce per-operation authorization.
- Rate-limit writes and cap message size.
- Escape Markdown/HTML safely; never execute repository content.
- Log request ID, authenticated principal, operation, outcome, and resulting commit SHA without logging secrets.
- If the API is unavailable, clients remain readable and clearly disable sending. Never imply an unsent draft was shared.

## 8. Acceptance criteria

1. Dayne and Muse can open different frontends and see the same conversation list and message history.
2. A message committed by either participant appears in the other frontend without manual file copying.
3. New Chat+ creates one durable conversation visible to both clients.
4. Previous conversations remain navigable after refresh, redeploy, or client restart.
5. Each message has a stable ID, UTC timestamp, authenticated author, and source commit.
6. Simultaneous sends do not lose either message.
7. A failed write is visibly failed and remains an editable draft, not a phantom message.
8. Existing `trio-chat/messages/` history remains unchanged and accessible.
9. The frontend clearly distinguishes repository sync state from model-generation state.
10. No credentials are shipped to the browser.

## 9. Delivery sequence

1. Shared read-only frontend and navigation against canonical repository records.
2. Authenticated write API and repository adapter.
3. New conversation creation and append-only message writes.
4. Two-client sync verification using Dayne and Muse identities.
5. Optional push/event transport after polling correctness is proven.

**Important:** GitHub Pages can host the static frontend, but it cannot safely provide authenticated shared writes by itself. The write API and its identity/authorization boundary are required for the complete product. Until that exists, the UI must advertise read-only mode rather than pretending to be synchronized.


## Mobile-first interaction design (mandatory)

Mobile/touch is the primary design target. Desktop is an enhanced responsive layout, not the assumed default.
- Never make an action, control, label, or affordance hover-only. Hover may add visual feedback but cannot reveal functionality unavailable on touch.
- Message actions must always be accessible through a compact visible action row or an explicit tap-operated overflow menu. Branch, copy, collapse/expand, export, share, reply, and selection must remain reachable on touch.
- Fenced-code Copy button remains visible at all times, positioned at the code panel's top-right; ensure it does not overlap code or language label on narrow screens.
- Selection mode can be entered from the message overflow action and optionally by long-press. Long-press is supplementary; checkboxes and accessible controls remain available. Avoid triggering selection when the user is selecting text or interacting with code/links.
- Target touch controls at least 44×44 CSS px where practical; spacing must prevent accidental adjacent taps. Dense presets may compact visual content but cannot shrink essential touch targets below accessible dimensions.
- Settings use a touch-friendly drawer or full-screen panel on narrow viewports, with large inputs, preview and explicit close/back affordance. Theme and density previews must work without hover.
- Sidebar becomes a mobile navigation drawer with a visible close control, backdrop, and optional swipe-dismiss. Do not require swipe gestures as the only way to close it.
- Responsive layout should preserve readable text, code horizontal scrolling, safe-area insets, and composer access when the keyboard is open. Do not let fixed controls obscure content.
- Desktop may show hover styling, but every control must also work by click/tap and keyboard. Responsive behavior should be tested at narrow phone widths, tablet, and desktop.
- Prefer mobile-first CSS: base styles for phone, progressively enhance with min-width media queries. Avoid desktop-first styles overridden wholesale for mobile.


## Symbol-only control presentation
- All button controls should use concise symbols/icons rather than visible text labels, including navigation, settings, message actions, selection/bulk actions, copy, export, share, collapse/expand, reset, and send.
- Use familiar Unicode symbols or consistent icon glyphs; visually label the action with `aria-label` and `title` (tooltip is supplementary only). Accessible names are mandatory, and tooltip/hover must not be the only means of understanding or activating an action.
- Show a transient success symbol (e.g. checkmark) after copy actions, then restore the icon.
- Keep non-button explanatory labels and form field names as text. Do not turn controls such as select menus or toggles into ambiguous symbols.
- On mobile, maintain 44px minimum touch targets and ensure icons have sufficient contrast and spacing.


## Implementation status and phase gates (2026-11-27)

### Phase A — local frontend functionality

**Status: implemented, static validation passed; interactive browser/device QA still outstanding.**

Implemented in the static frontend: local conversation creation and sending, device-local persistence, branch context copies, reply/quote draft insertion, edit-as-local-copy for immutable legacy messages, local message bookmarks, local chat rename/pin/archive/restore/delete, folder creation and assignment, message search across loaded legacy/local content, local message copy/export/share/collapse, bulk legacy-message copy/export/share, settings/theme/density, and a Connect Everything hub listing integrations and explaining required authorization. All shared writes and model sends remain disabled/clearly local until Phases B/C are configured.

Validation: JavaScript syntax compilation and static feature/invariant checks passed. No automated real-browser/device interaction run has yet been performed. The integration hub is a UI and connection inventory, not actual OAuth or connector execution.

### Phase B — shared persistence/API

**Status: not yet implemented.** Required before any local draft can become a shared durable conversation. Backend prerequisites include secure per-identity secrets, GitHub repository write credential configured server-side, deployment of serverless API functions, and API integration tests for authorization, validation, retries, concurrency, persistence, and two-client sync.

### Phase C — agent/model runtime

**Status: not yet implemented.** Requires secure provider credentials and runtime configuration, model/provider adapters, streaming/cancellation, task orchestration, agent routing, and execution/error-state tests. Agent delegation may be queued without execution until an authorized worker is connected.

**Completion rule:** a phase is not marked complete merely because UI or API scaffolding exists. It must pass implementation review, refinement, tests, bug fixes, performance checks, and verification of required external configuration. Unavailable external credentials or services are recorded as blockers, not falsely passed.

## Implementation completion report — 2026-11-27

### Phase A — local/mobile-first frontend
**Complete for implementation and automated/static tests.** Local conversations/drafts, send, local branch context, reply/quote, edit-copy for legacy immutable messages, local bookmarks, local pin/rename/archive/restore/delete, folders/assignment, message search, selection/bulk actions, copy/export/share/collapse, settings, theme/density/accent, connect-all hub, accessible icon controls, touch targets, reduced-motion control, and attachment text import are implemented. Frontend remains static and no dependencies were added.

- Regression script: dashboard/trio-chat-tests.js.
- Executed on a connected Debian host against a fresh shallow clone: **passed** (JavaScript compilation, control/invariant assertions, backend syntax, JSON config, and unauthenticated API boundary checks).
- Browser/device tap-through and responsive screenshot QA: **not verified**; no connected navigation-capable browser was available in this session.
- Limit: Connect-all is an onboarding hub/list, not an OAuth implementation. Local attachments only import small text files into a draft; upload/storage is not implemented.

### Phase B — shared API/persistence
**Implementation scaffold and frontend adapter complete; live activation blocked by required server credentials.** Added Vercel routing and /api/trio endpoints for conversation list/create/read/update/archive, message list/create/edit revision/soft-delete, branch creation with context snapshots, reactions, per-identity bookmarks, shared folders, and authenticated search. Frontend supports API configuration, token storage on-device, connection test, shared create/select/send/branch, remote management, search, edits, bookmarks and reactions.

- Server-side identities: TRIO_DAYNE_TOKEN, TRIO_GANG_TOKEN, TRIO_CHATGPT_TOKEN.
- Storage credential: CENTRAL_GITHUB_TOKEN (server-only, Contents read/write).
- Optional origin allow-list: TRIO_ALLOWED_ORIGINS.
- API is default-deny; access requires a valid identity and participant membership. Author identity is derived server-side.
- Remaining live tests: write/read round-trip, concurrent sends/conflicts, branch persistence, cross-client sync, authorization matrix, and GitHub token permissions. The API uses sequential GitHub Contents commits; multi-file transactions and conflict retry are not implemented.

### Phase C — model runtime and delegation
**Implementation scaffold complete; live model/worker activation blocked by provider credentials and an authorized worker.** Added streaming OpenAI-compatible/Anthropic model gateway, server-only key, per-agent/default model configuration, allowed-model list for compare, frontend generation/stop, retry-to-draft, comparison, message details, delegation tasks persisted in repository, task monitor, and optional worker dispatch/status update.

- Required: TRIO_MODEL_API_KEY; TRIO_MODEL_PROVIDER; optional endpoint and model IDs (TRIO_MODEL_DEFAULT, per identity); comparison allow-list TRIO_MODEL_CHOICES.
- Optional task worker: TRIO_TASK_WORKER_URL + TRIO_TASK_WORKER_TOKEN.
- Live streaming, abort, compare, model error handling, and worker dispatch/status tests remain blocked until configuration is present.

### Phase-gate decision
Phase A is marked complete at code/static-test level. Phase B and Phase C are marked implementation-complete but **not operationally complete** until environment setup and authenticated integration tests pass. No phase is represented as live merely because its scaffolding deploys.

## Final QA and release record

- **Production deployment:** READY, deployment ID dpl_9pHDvS6vxHTY4gc5sdLLePxMicqg, commit cc176d65f356cb544eb17d6a3b8d9ebd98f398dd. Production alias: central-trio-chat.vercel.app.
- **Live smoke test:** Frontend HTTP 200 (49,580 bytes). API conversations, model gateway and task endpoints returned 401 without credentials, confirming deployed routing and default-deny behavior.
- **Node regression test:** passed on a fresh shallow clone. Serverless handlers compile; frontend script compiles; required controls/invariants exist; JSON rewrite config parses; unauthenticated boundary cases return 401.
- **Production API functionality:** not activated. Identity tokens and GitHub write credential are not configured, so authenticated reads/writes cannot yet be tested. Provider key and task worker are also absent.
- **Browser UX:** no real touch-device interaction or visual screenshot QA performed. The automated checks do not substitute for those.

No secret values are committed. See BACKEND_SETUP.md for the exact server environment variables and activation steps. Phase A's implementation/static QA gate is complete; Phase B and C are implementation-complete but remain operationally blocked pending credentials and live integration tests.
