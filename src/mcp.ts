/**
 * supportchat MCP server. Core subset: 12 tools.
 *
 * Low-level Server API with explicit inputSchema literals (the
 * McpServer+zod path injects $schema/additionalProperties and breaks
 * parity). Zod still validates call args. The literals match the
 * labelled core-subset fixture exactly.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { apiBaseFromEnv, callTool, tokenFromEnv, VERSION } from "./intercom.js";
import type { FetchFn } from "./types.js";

const ARG_SCHEMAS: Record<string, z.ZodTypeAny> = {
  list_conversations: z.object({ per_page: z.number().optional(), state: z.string().optional() }),
  get_conversation: z.object({ conversation_id: z.string() }),
  reply_to_conversation: z.object({ conversation_id: z.string(), message: z.string(), admin_id: z.string() }),
  close_conversation: z.object({ conversation_id: z.string(), admin_id: z.string() }),
  search_conversations: z.object({ query: z.string(), per_page: z.number().optional() }),
  list_contacts: z.object({ per_page: z.number().optional() }),
  get_contact: z.object({ contact_id: z.string() }),
  create_contact: z.object({ email: z.string(), role: z.string().optional(), name: z.string().optional() }),
  update_contact: z.object({ contact_id: z.string(), name: z.string().optional(), email: z.string().optional() }),
  list_tags: z.object({}),
  tag_contact: z.object({ contact_id: z.string(), tag_name: z.string() }),
  list_articles: z.object({ per_page: z.number().optional() }),
};

export const TOOLS = [
  {
    name: "list_conversations",
    description: "List Intercom conversations.",
    inputSchema: { type: "object" as const, properties: { per_page: { type: "number", description: "Optional maximum number of conversations to return per page." }, state: { type: "string", description: "Optional conversation state to filter by, passed as the state query parameter." } }, required: [] as string[] },
  },
  {
    name: "get_conversation",
    description: "Retrieve a single Intercom conversation by ID.",
    inputSchema: { type: "object" as const, properties: { conversation_id: { type: "string", description: "The unique identifier of the Intercom conversation to retrieve." } }, required: ["conversation_id"] },
  },
  {
    name: "reply_to_conversation",
    description: "Reply to an Intercom conversation as an admin.",
    inputSchema: { type: "object" as const, properties: { conversation_id: { type: "string", description: "The unique identifier of the Intercom conversation to reply to." }, message: { type: "string", description: "The reply message text to send as the conversation body." }, admin_id: { type: "string", description: "The unique identifier of the admin sending the reply." } }, required: ["conversation_id", "message", "admin_id"] },
  },
  {
    name: "close_conversation",
    description: "Close an Intercom conversation as an admin.",
    inputSchema: { type: "object" as const, properties: { conversation_id: { type: "string", description: "The unique identifier of the Intercom conversation to close." }, admin_id: { type: "string", description: "The unique identifier of the admin closing the conversation." } }, required: ["conversation_id", "admin_id"] },
  },
  {
    name: "search_conversations",
    description: "Search Intercom conversations matching a query.",
    inputSchema: { type: "object" as const, properties: { query: { type: "string", description: "The search text to match against conversation bodies." }, per_page: { type: "number", description: "Optional maximum number of conversations to return per page." } }, required: ["query"] },
  },
  {
    name: "list_contacts",
    description: "List Intercom contacts.",
    inputSchema: { type: "object" as const, properties: { per_page: { type: "number", description: "Optional maximum number of contacts to return per page." } }, required: [] as string[] },
  },
  {
    name: "get_contact",
    description: "Retrieve a single Intercom contact by ID.",
    inputSchema: { type: "object" as const, properties: { contact_id: { type: "string", description: "The unique identifier of the Intercom contact to retrieve." } }, required: ["contact_id"] },
  },
  {
    name: "create_contact",
    description: "Create an Intercom contact.",
    inputSchema: { type: "object" as const, properties: { email: { type: "string", description: "The email address of the new contact." }, role: { type: "string", description: "Optional role of the new contact (defaults to 'user' when omitted)." }, name: { type: "string", description: "Optional display name of the new contact." } }, required: ["email"] },
  },
  {
    name: "update_contact",
    description: "Update an Intercom contact by ID.",
    inputSchema: { type: "object" as const, properties: { contact_id: { type: "string", description: "The unique identifier of the Intercom contact to update." }, name: { type: "string", description: "Optional new display name for the contact." }, email: { type: "string", description: "Optional new email address for the contact." } }, required: ["contact_id"] },
  },
  {
    name: "list_tags",
    description: "List Intercom tags.",
    inputSchema: { type: "object" as const, properties: {}, required: [] as string[] },
  },
  {
    name: "tag_contact",
    description: "Tag an Intercom contact with a tag name.",
    inputSchema: { type: "object" as const, properties: { contact_id: { type: "string", description: "The unique identifier of the Intercom contact to tag." }, tag_name: { type: "string", description: "The name of the tag to apply to the contact." } }, required: ["contact_id", "tag_name"] },
  },
  {
    name: "list_articles",
    description: "List Intercom help center articles.",
    inputSchema: { type: "object" as const, properties: { per_page: { type: "number", description: "Optional maximum number of articles to return per page." } }, required: [] as string[] },
  },
];

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}
function errorResult(err: unknown) {
  return { content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
}

const server = new Server({ name: "supportchat", version: VERSION }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const schema = ARG_SCHEMAS[name];
  if (!schema) throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  try {
    const token = tokenFromEnv();
    const parsed = schema.parse(args ?? {}) as Record<string, unknown>;
    const fetchFn = globalThis.fetch as unknown as FetchFn;
    return textResult(await callTool(fetchFn, token, apiBaseFromEnv(), name, parsed));
  } catch (err) {
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}
void main();
