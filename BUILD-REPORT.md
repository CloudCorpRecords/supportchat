# supportchat — BUILD REPORT

Original: intercom (Intercom hosted remote MCP) → Rebuild: supportchat
Tier C core subset. Local only, nothing pushed or published.

## Scope
12 tools against the Intercom REST API (https://api.intercom.io, base
overridable via INTERCOM_API_BASE_URL), Authorization: Bearer
INTERCOM_ACCESS_TOKEN with `Intercom-Version: 2.11` and
`Accept: application/json` on every request, all HTTP behind an
injectable FetchFn:
list_conversations (GET /conversations, per_page/state query params),
get_conversation (GET /conversations/{id}), reply_to_conversation
(POST /conversations/{id}/reply, admin comment shape),
close_conversation (POST /conversations/{id}/parts, close part),
search_conversations (POST /conversations/search, body-field query
shape), list_contacts (GET /contacts), get_contact
(GET /contacts/{id}), create_contact (POST /contacts, role defaults
to user), update_contact (PUT /contacts/{id}, provided fields only),
list_tags (GET /tags), tag_contact (POST /contacts/{id}/tags),
list_articles (GET /articles).

Omitted groups (fixture `_source` lists them): get_article (dropped
to keep exactly 12), companies, teams and teammates admin, events and
data attributes, notes and internal articles, tickets and ticket
types, workflows and series, visitor and lead conversion tools,
counts and reporting exports.

Ground truth: schemas are docs-derived from the public Intercom API
documentation. Fixture: harness/fixtures/intercom-tools-original.json
(labelled core-subset). The original is Intercom's hosted remote MCP
(OAuth); hosted OAuth NOT reproduced — this is a token REST client
for the same API.

## Verified (foreground, from disk)
- Tools: 12/12 — parity.json identical_tools = 12 = total.
- Unit tests: 14/14 pass (fake FetchFn; URL/method/Bearer +
  Intercom-Version + Accept headers/body shaping for every tool,
  search query shape, contact role default, provided-fields-only
  update, upstream error surfacing with first error message,
  empty-body {status} handling, missing-token error).
- tsc: exit 0. dist/cli.js present; `node dist/cli.js --version`
  prints 0.1.0; unknown command exits 2 with Usage.
- Parity: harness/parity.py vs the fixture → PASS, parity_pct 100.0
  (parity-out/parity.json).
- Missing-env checks: CLI list_tags with INTERCOM_ACCESS_TOKEN unset
  → "error: INTERCOM_ACCESS_TOKEN environment variable is required",
  exit 1; stdio tools/call list_tags with the token unset returned
  isError "INTERCOM_ACCESS_TOKEN environment variable is required".
- server.json description 65 chars (≤100); OCI entry has no version
  field; npm entry carries version 0.1.0; Dockerfile label
  io.github.CloudCorpRecords/supportchat; full 19-file factory set
  present.

## Honest gaps
- No live Intercom call was made — request/response behaviour is
  fake-fetch proven only.
- search_conversations exposes a single body-text query; the full
  Intercom segment/query DSL is outside this subset.
- Conversation replies support admin comments only (no user replies,
  notes, or attachments in this subset).
- Lockfile is a copied fleet lockfile with identity fields edited —
  clean lockfile regeneration is REQUIRED before publish.
- mcpaudit / mcpvet / shipcheck not yet run — pre-publish gate.
- Hosted OAuth surface of the original remote server is not
  reproduced (see Scope).
