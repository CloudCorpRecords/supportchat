import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  apiBaseFromEnv,
  closeConversation,
  createContact,
  getContact,
  getConversation,
  listArticles,
  listContacts,
  listConversations,
  listTags,
  replyToConversation,
  searchConversations,
  tagContact,
  tokenFromEnv,
  updateContact,
} from "../src/intercom.js";
import type { FetchFn, HttpResponse } from "../src/types.js";

interface Recorded { url: string; method: string; headers: Record<string, string>; body: unknown; }

function fakeFetch(steps: Array<{ match: string; payload: unknown; status?: number; rawText?: string }>) {
  const calls: Recorded[] = [];
  const fn: FetchFn = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init?.method ?? "GET", headers: init?.headers ?? {}, body });
    const step = steps.find((s) => url.includes(s.match)) ?? { match: "", payload: {} };
    const res: HttpResponse = {
      ok: (step.status ?? 200) < 300,
      status: step.status ?? 200,
      headers: { get: () => null },
      text: async () => step.rawText ?? JSON.stringify(step.payload),
    };
    return res;
  };
  return { fn, calls };
}

const BASE = "https://api.intercom.io";
const TOKEN = "dG9rZW4=";

describe("supportchat core", () => {
  it("names the env var when the token is missing", () => {
    assert.throws(() => tokenFromEnv({}), /INTERCOM_ACCESS_TOKEN environment variable is required/);
    assert.equal(tokenFromEnv({ INTERCOM_ACCESS_TOKEN: " x " }), "x");
    assert.equal(apiBaseFromEnv({}), "https://api.intercom.io");
    assert.equal(apiBaseFromEnv({ INTERCOM_API_BASE_URL: "https://example.test/" }), "https://example.test");
  });

  it("list_conversations gets /conversations with Bearer, version and accept headers", async () => {
    const { fn, calls } = fakeFetch([{ match: "/conversations", payload: { conversations: [] } }]);
    await listConversations(fn, TOKEN, BASE, { per_page: 10, state: "open" });
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.intercom.io/conversations?per_page=10&state=open");
    assert.equal(calls[0].headers.Authorization, "Bearer dG9rZW4=");
    assert.equal(calls[0].headers["Intercom-Version"], "2.11");
    assert.equal(calls[0].headers.Accept, "application/json");
  });

  it("get_conversation gets /conversations/{id}", async () => {
    const { fn, calls } = fakeFetch([{ match: "/conversations/c1", payload: { id: "c1" } }]);
    await getConversation(fn, TOKEN, BASE, { conversation_id: "c1" });
    assert.equal(calls[0].url, "https://api.intercom.io/conversations/c1");
  });

  it("reply_to_conversation posts the admin comment shape", async () => {
    const { fn, calls } = fakeFetch([{ match: "/reply", payload: { id: "c1" } }]);
    await replyToConversation(fn, TOKEN, BASE, { conversation_id: "c1", message: "Thanks!", admin_id: "a1" });
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, "https://api.intercom.io/conversations/c1/reply");
    assert.deepEqual(calls[0].body, { message_type: "comment", type: "admin", admin_id: "a1", body: "Thanks!" });
  });

  it("close_conversation posts a close part", async () => {
    const { fn, calls } = fakeFetch([{ match: "/parts", payload: { id: "c1" } }]);
    await closeConversation(fn, TOKEN, BASE, { conversation_id: "c1", admin_id: "a1" });
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, "https://api.intercom.io/conversations/c1/parts");
    assert.deepEqual(calls[0].body, { message_type: "close", type: "admin", admin_id: "a1" });
  });

  it("search_conversations posts the documented query shape", async () => {
    const { fn, calls } = fakeFetch([{ match: "/conversations/search", payload: { conversations: [] } }]);
    await searchConversations(fn, TOKEN, BASE, { query: "refund", per_page: 5 });
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(calls[0].body, {
      query: { field: "body", operator: "~", value: "refund" },
      pagination: { per_page: 5 },
    });
    await searchConversations(fn, TOKEN, BASE, { query: "x" });
    assert.deepEqual(calls[1].body, { query: { field: "body", operator: "~", value: "x" } });
  });

  it("list_contacts and get_contact hit contact paths", async () => {
    const { fn, calls } = fakeFetch([
      { match: "/contacts/ct1", payload: { id: "ct1" } },
      { match: "/contacts", payload: { data: [] } },
    ]);
    await listContacts(fn, TOKEN, BASE, { per_page: 25 });
    assert.equal(calls[0].url, "https://api.intercom.io/contacts?per_page=25");
    await getContact(fn, TOKEN, BASE, { contact_id: "ct1" });
    assert.equal(calls[1].url, "https://api.intercom.io/contacts/ct1");
  });

  it("create_contact defaults role to user and posts provided fields", async () => {
    const { fn, calls } = fakeFetch([{ match: "/contacts", payload: { id: "ct2" } }]);
    await createContact(fn, TOKEN, BASE, { email: "a@example.test" });
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(calls[0].body, { email: "a@example.test", role: "user" });
    await createContact(fn, TOKEN, BASE, { email: "b@example.test", role: "lead", name: "Bee" });
    assert.deepEqual(calls[1].body, { email: "b@example.test", role: "lead", name: "Bee" });
  });

  it("update_contact puts only provided fields", async () => {
    const { fn, calls } = fakeFetch([{ match: "/contacts/ct1", payload: { id: "ct1" } }]);
    await updateContact(fn, TOKEN, BASE, { contact_id: "ct1", name: "New Name" });
    assert.equal(calls[0].method, "PUT");
    assert.deepEqual(calls[0].body, { name: "New Name" });
  });

  it("list_tags gets /tags", async () => {
    const { fn, calls } = fakeFetch([{ match: "/tags", payload: { data: [{ name: "vip" }] } }]);
    const out = (await listTags(fn, TOKEN, BASE)) as Record<string, unknown>;
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.intercom.io/tags");
    assert.deepEqual(out.data, [{ name: "vip" }]);
  });

  it("tag_contact posts the tag name to the contact tags path", async () => {
    const { fn, calls } = fakeFetch([{ match: "/tags", payload: { name: "vip" } }]);
    await tagContact(fn, TOKEN, BASE, { contact_id: "ct1", tag_name: "vip" });
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, "https://api.intercom.io/contacts/ct1/tags");
    assert.deepEqual(calls[0].body, { name: "vip" });
  });

  it("list_articles gets /articles with optional per_page", async () => {
    const { fn, calls } = fakeFetch([{ match: "/articles", payload: { data: [] } }]);
    await listArticles(fn, TOKEN, BASE, {});
    assert.equal(calls[0].url, "https://api.intercom.io/articles");
    await listArticles(fn, TOKEN, BASE, { per_page: 10 });
    assert.equal(calls[1].url, "https://api.intercom.io/articles?per_page=10");
  });

  it("surfaces upstream error status and first error message", async () => {
    const { fn } = fakeFetch([{ match: "/contacts", payload: { errors: [{ message: "unauthorized" }] }, status: 401 }]);
    await assert.rejects(() => listContacts(fn, TOKEN, BASE, {}), /Intercom API error 401: unauthorized/);
  });

  it("returns {status} for an empty successful body", async () => {
    const { fn } = fakeFetch([{ match: "/tags", payload: null, rawText: "", status: 200 }]);
    const out = (await listTags(fn, TOKEN, BASE)) as Record<string, unknown>;
    assert.deepEqual(out, { status: 200 });
  });
});
