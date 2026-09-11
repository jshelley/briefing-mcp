#!/usr/bin/env node
// briefing-mcp: stdio MCP server for Briefing Service (hourly LLM-ranked news
// briefings, rendered e-ink pages, Morning Paper, provenance dump).
// It is a thin client over the public REST API; the same tools are also served
// remotely at https://briefing-service.wholemind.workers.dev/mcp.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.BRIEFING_BASE_URL || "https://briefing-service.wholemind.workers.dev").replace(/\/$/, "");
const KEY = process.env.BRIEFING_KEY || "";
const VERSION = "0.1.0";

function headers(extra = {}) {
  const h = { "user-agent": `briefing-mcp/${VERSION}`, accept: "application/json", ...extra };
  if (KEY) h.authorization = `Bearer ${KEY}`;
  return h;
}

async function get(path, accept) {
  const res = await fetch(`${BASE}${path}`, { headers: headers(accept ? { accept } : {}) });
  return res;
}

function paywallText(res, body) {
  if (res.status === 402) {
    return (
      `Payment required (free trial of ${res.headers.get("x-trial-per-day") || "25"} calls per IP per day is used up). ` +
      `Options: set BRIEFING_KEY to a Reader key ($9/month, ${BASE}/billing/checkout) or pay per call with x402 (USDC on Base) against the remote endpoint ${BASE}/mcp. ` +
      `Docs: ${BASE}/llms.txt`
    );
  }
  return `error ${res.status}: ${body.slice(0, 500)}`;
}

const server = new McpServer(
  { name: "briefing-mcp", version: VERSION, title: "Briefing Service: hourly ranked news" },
  {
    instructions:
      "Hourly LLM-ranked news briefings (AI, frontier labs, markets, US sports, European football, US news, world) as structured JSON, rendered e-ink pages and a provenance dump. " +
      "Call list_briefings first, then get_briefing(key). get_page returns a 480x800 1-bit PNG. get_candidates returns every source item the editor saw this hour with dedupe metadata. " +
      "render_briefing ranks your own feeds (paid). Free: 25 calls per IP per day; then a Reader key in BRIEFING_KEY ($9/month) or x402 on the remote endpoint. Docs: " + BASE + "/llms.txt",
  },
);

server.registerTool(
  "list_briefings",
  { description: "List the hourly briefings available (key and name), with prices.", inputSchema: {} },
  async () => {
    const res = await get("/v1/briefings");
    const text = await res.text();
    return res.ok ? { content: [{ type: "text", text }] } : { content: [{ type: "text", text: paywallText(res, text) }], isError: true };
  },
);

server.registerTool(
  "get_briefing",
  {
    description: "One briefing as structured JSON: lead story, ranked stories and research items with summaries, why-it-matters and key points, plus when it was ranked.",
    inputSchema: { key: z.string().describe("briefing key from list_briefings, e.g. 'ai'") },
  },
  async ({ key }) => {
    const res = await get(`/v1/briefings/${encodeURIComponent(key)}`);
    const text = await res.text();
    return res.ok ? { content: [{ type: "text", text }] } : { content: [{ type: "text", text: paywallText(res, text) }], isError: true };
  },
);

server.registerTool(
  "get_summary",
  {
    description: "Free, small: headlines and one-line summaries of a briefing (for widgets and quick reads).",
    inputSchema: { key: z.string().describe("briefing key, e.g. 'world'") },
  },
  async ({ key }) => {
    const res = await get(`/v1/briefings/${encodeURIComponent(key)}/summary`);
    const text = await res.text();
    return res.ok ? { content: [{ type: "text", text }] } : { content: [{ type: "text", text: paywallText(res, text) }], isError: true };
  },
);

server.registerTool(
  "get_candidates",
  {
    description: "Free provenance dump: every candidate the editor saw this hour with canonical_link, published time, feed weight, the other outlets that ran the story (also_in), a selected flag, and collapsed duplicates (duplicate_of, dup_rule, dup_score).",
    inputSchema: { key: z.string().describe("briefing key, e.g. 'ai'") },
  },
  async ({ key }) => {
    const res = await get(`/v1/briefings/${encodeURIComponent(key)}/candidates`);
    const text = await res.text();
    return res.ok ? { content: [{ type: "text", text }] } : { content: [{ type: "text", text: paywallText(res, text) }], isError: true };
  },
);

server.registerTool(
  "get_page",
  {
    description: "One rendered page of a briefing as a 480x800 1-bit PNG (page 0 is the front page; story pages follow). Made for e-ink and small displays. wide=true returns the 800x480 landscape front page.",
    inputSchema: { key: z.string(), page: z.number().int().min(0).max(32).default(0), wide: z.boolean().default(false) },
  },
  async ({ key, page, wide }) => {
    const q = wide && page === 0 ? "?size=wide" : "";
    const res = await get(`/v1/briefings/${encodeURIComponent(key)}/pages/${page}.png${q}`, "image/png");
    if (!res.ok) return { content: [{ type: "text", text: paywallText(res, await res.text()) }], isError: true };
    const data = Buffer.from(await res.arrayBuffer()).toString("base64");
    return { content: [{ type: "image", data, mimeType: "image/png" }] };
  },
);

server.registerTool(
  "render_briefing",
  {
    description: "Rank and render a briefing from your own feeds and persona (one editor run; needs a Reader key with render credits, or use x402 on the remote endpoint). Returns JSON and page URLs.",
    inputSchema: { feeds: z.array(z.string().url()).min(1).max(30), persona: z.string().max(2000) },
  },
  async ({ feeds, persona }) => {
    const res = await fetch(`${BASE}/v1/render`, { method: "POST", headers: headers({ "content-type": "application/json" }), body: JSON.stringify({ feeds, persona }) });
    const text = await res.text();
    return res.ok ? { content: [{ type: "text", text }] } : { content: [{ type: "text", text: paywallText(res, text) }], isError: true };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
