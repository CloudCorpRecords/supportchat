# supportchat

Intercom support conversations as MCP tools, talking to the
Intercom REST API. supportchat is a clean-room rebuild of the core
surface of the Intercom MCP server, under a new name: fresh code, no
copied branding. The original is Intercom's hosted remote MCP
(OAuth); hosted OAuth is NOT reproduced — this rebuild is a token
REST client for the same API.

## Tools (core subset, 12)

`list_conversations`, `get_conversation`, `reply_to_conversation`,
`close_conversation`, `search_conversations`, `list_contacts`,
`get_contact`, `create_contact`, `update_contact`, `list_tags`,
`tag_contact`, `list_articles`.

Not in this subset: article detail (get_article, dropped to keep
exactly 12), companies, teams and teammates admin, events and data
attributes, notes, tickets, workflows, visitor conversion tools, and
counts and reporting exports.

## Setup

Create an access token for your Intercom workspace and set it:

```bash
export INTERCOM_ACCESS_TOKEN=dG9r...
```

Optionally override the API base with `INTERCOM_API_BASE_URL`
(default `https://api.intercom.io`). Every request carries the
`Intercom-Version: 2.11` header. Without the token, every tool call
fails with an error naming the missing variable. Replying and closing
conversations require the acting admin's `admin_id`.

## CLI

```bash
npx @reneturcios/supportchat list_conversations '{"state":"open"}'
npx @reneturcios/supportchat mcp        # stdio MCP server
```

Each tool name is a subcommand taking one JSON object argument.

## MCP client config

```json
{
  "mcpServers": {
    "supportchat": {
      "command": "npx",
      "args": ["-y", "@reneturcios/supportchat", "mcp"],
      "env": { "INTERCOM_ACCESS_TOKEN": "dG9r..." }
    }
  }
}
```

## Docker

```bash
docker run -i -e INTERCOM_ACCESS_TOKEN ghcr.io/cloudcorprecords/supportchat
```

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
