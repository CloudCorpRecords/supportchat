/**
 * supportchat core: a 12-tool core subset of the Intercom MCP server
 * surface, implemented clean-room against the public Intercom REST API
 * (https://api.intercom.io, base overridable via INTERCOM_API_BASE_URL).
 *
 * Auth: INTERCOM_ACCESS_TOKEN, sent as `Authorization: Bearer`, with
 * the `Intercom-Version: 2.11` and `Accept: application/json` headers
 * on every request. A missing token is an error naming the variable.
 * All HTTP goes through an injected FetchFn so the wire behaviour is
 * fully testable offline.
 *
 * Note: the original is Intercom's hosted remote MCP (OAuth); hosted
 * OAuth NOT reproduced — this is a token REST client for the same API.
 */
import type {
  CloseOptions,
  CreateContactOptions,
  FetchFn,
  GetContactOptions,
  GetConversationOptions,
  ListArticlesOptions,
  ListContactsOptions,
  ListConversationsOptions,
  ReplyOptions,
  SearchConversationsOptions,
  TagContactOptions,
  UpdateContactOptions,
} from "./types.js";

export const VERSION = "0.1.0";
export const DEFAULT_API_BASE = "https://api.intercom.io";
export const INTERCOM_VERSION = "2.11";

export function tokenFromEnv(env: Record<string, string | undefined> = process.env): string {
  const raw = env.INTERCOM_ACCESS_TOKEN;
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) throw new Error("INTERCOM_ACCESS_TOKEN environment variable is required");
  return token;
}

export function apiBaseFromEnv(env: Record<string, string | undefined> = process.env): string {
  const raw = env.INTERCOM_API_BASE_URL;
  const base = typeof raw === "string" ? raw.trim() : "";
  return (base || DEFAULT_API_BASE).replace(/\/+$/, "");
}

interface RequestSpec { method: string; path: string; body?: unknown; }

async function apiRequest(fetchFn: FetchFn, token: string, base: string, spec: RequestSpec): Promise<unknown> {
  const res = await fetchFn(`${base}${spec.path}`, {
    method: spec.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Intercom-Version": INTERCOM_VERSION,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { errors?: Array<{ message?: string }> };
      const first = parsed.errors?.[0]?.message;
      if (typeof first === "string") detail = first;
    } catch { /* keep raw */ }
    throw new Error(`Intercom API error ${res.status}: ${detail}`);
  }
  if (!text) return { status: res.status };
  try { return JSON.parse(text) as unknown; } catch { return text; }
}

function query(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}
function clean<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) if (value !== undefined) out[key] = value;
  return out;
}
const enc = encodeURIComponent;

export async function listConversations(fetchFn: FetchFn, token: string, base: string, opts: ListConversationsOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, { method: "GET", path: `/conversations${query({ per_page: opts.per_page, state: opts.state })}` });
}
export async function getConversation(fetchFn: FetchFn, token: string, base: string, opts: GetConversationOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, { method: "GET", path: `/conversations/${enc(opts.conversation_id)}` });
}
export async function replyToConversation(fetchFn: FetchFn, token: string, base: string, opts: ReplyOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, {
    method: "POST",
    path: `/conversations/${enc(opts.conversation_id)}/reply`,
    body: { message_type: "comment", type: "admin", admin_id: opts.admin_id, body: opts.message },
  });
}
export async function closeConversation(fetchFn: FetchFn, token: string, base: string, opts: CloseOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, {
    method: "POST",
    path: `/conversations/${enc(opts.conversation_id)}/parts`,
    body: { message_type: "close", type: "admin", admin_id: opts.admin_id },
  });
}
export async function searchConversations(fetchFn: FetchFn, token: string, base: string, opts: SearchConversationsOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, {
    method: "POST",
    path: "/conversations/search",
    body: clean({
      query: { field: "body", operator: "~", value: opts.query },
      pagination: opts.per_page !== undefined ? { per_page: opts.per_page } : undefined,
    }),
  });
}
export async function listContacts(fetchFn: FetchFn, token: string, base: string, opts: ListContactsOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, { method: "GET", path: `/contacts${query({ per_page: opts.per_page })}` });
}
export async function getContact(fetchFn: FetchFn, token: string, base: string, opts: GetContactOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, { method: "GET", path: `/contacts/${enc(opts.contact_id)}` });
}
export async function createContact(fetchFn: FetchFn, token: string, base: string, opts: CreateContactOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, {
    method: "POST",
    path: "/contacts",
    body: clean({ email: opts.email, role: opts.role ?? "user", name: opts.name }),
  });
}
export async function updateContact(fetchFn: FetchFn, token: string, base: string, opts: UpdateContactOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, {
    method: "PUT",
    path: `/contacts/${enc(opts.contact_id)}`,
    body: clean({ name: opts.name, email: opts.email }),
  });
}
export async function listTags(fetchFn: FetchFn, token: string, base: string): Promise<unknown> {
  return apiRequest(fetchFn, token, base, { method: "GET", path: "/tags" });
}
export async function tagContact(fetchFn: FetchFn, token: string, base: string, opts: TagContactOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, {
    method: "POST",
    path: `/contacts/${enc(opts.contact_id)}/tags`,
    body: { name: opts.tag_name },
  });
}
export async function listArticles(fetchFn: FetchFn, token: string, base: string, opts: ListArticlesOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, { method: "GET", path: `/articles${query({ per_page: opts.per_page })}` });
}

export async function callTool(fetchFn: FetchFn, token: string, base: string, name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "list_conversations": return listConversations(fetchFn, token, base, args as unknown as ListConversationsOptions);
    case "get_conversation": return getConversation(fetchFn, token, base, args as unknown as GetConversationOptions);
    case "reply_to_conversation": return replyToConversation(fetchFn, token, base, args as unknown as ReplyOptions);
    case "close_conversation": return closeConversation(fetchFn, token, base, args as unknown as CloseOptions);
    case "search_conversations": return searchConversations(fetchFn, token, base, args as unknown as SearchConversationsOptions);
    case "list_contacts": return listContacts(fetchFn, token, base, args as unknown as ListContactsOptions);
    case "get_contact": return getContact(fetchFn, token, base, args as unknown as GetContactOptions);
    case "create_contact": return createContact(fetchFn, token, base, args as unknown as CreateContactOptions);
    case "update_contact": return updateContact(fetchFn, token, base, args as unknown as UpdateContactOptions);
    case "list_tags": return listTags(fetchFn, token, base);
    case "tag_contact": return tagContact(fetchFn, token, base, args as unknown as TagContactOptions);
    case "list_articles": return listArticles(fetchFn, token, base, args as unknown as ListArticlesOptions);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
