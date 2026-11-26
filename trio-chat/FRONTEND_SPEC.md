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
