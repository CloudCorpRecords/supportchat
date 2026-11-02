#!/usr/bin/env node
/**
 * supportchat CLI.
 *   supportchat <tool-name> '<json args>'
 *   supportchat mcp
 * Requires INTERCOM_ACCESS_TOKEN. Exit codes: 0 success, 1 error, 2 usage.
 */
import { apiBaseFromEnv, callTool, tokenFromEnv, VERSION } from "./intercom.js";
import type { FetchFn } from "./types.js";

const TOOL_NAMES = [
  "list_conversations", "get_conversation", "reply_to_conversation",
  "close_conversation", "search_conversations", "list_contacts", "get_contact",
  "create_contact", "update_contact", "list_tags", "tag_contact", "list_articles",
];

function usage(): never {
  console.error(`Usage:
  supportchat <tool> '<json args>'   tools: ${TOOL_NAMES.join(", ")}
  supportchat mcp
  supportchat --version`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") { console.log(VERSION); return; }
  if (cmd === "mcp") { await import("./mcp.js"); return; }
  if (!cmd || !TOOL_NAMES.includes(cmd)) usage();
  let args: Record<string, unknown> = {};
  const raw = rest.join(" ").trim();
  if (raw) {
    try {
      args = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      console.error("error: args must be a JSON object");
      process.exit(1);
    }
  }
  try {
    const fetchFn = globalThis.fetch as unknown as FetchFn;
    const out = await callTool(fetchFn, tokenFromEnv(), apiBaseFromEnv(), cmd, args);
    console.log(typeof out === "string" ? out : JSON.stringify(out, null, 2));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
void main();
