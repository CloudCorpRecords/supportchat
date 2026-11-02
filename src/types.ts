/**
 * supportchat types.
 *
 * A core subset of the Intercom MCP surface: conversations, contacts,
 * tags and articles against the Intercom REST API. HTTP access is
 * described by a minimal response surface so tests can inject a fake
 * fetch.
 */

export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;

export interface ListConversationsOptions { per_page?: number; state?: string; }
export interface GetConversationOptions { conversation_id: string; }
export interface ReplyOptions { conversation_id: string; message: string; admin_id: string; }
export interface CloseOptions { conversation_id: string; admin_id: string; }
export interface SearchConversationsOptions { query: string; per_page?: number; }
export interface ListContactsOptions { per_page?: number; }
export interface GetContactOptions { contact_id: string; }
export interface CreateContactOptions { email: string; role?: string; name?: string; }
export interface UpdateContactOptions { contact_id: string; name?: string; email?: string; }
export interface TagContactOptions { contact_id: string; tag_name: string; }
export interface ListArticlesOptions { per_page?: number; }
