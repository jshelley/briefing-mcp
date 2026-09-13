# briefing-mcp

[![Listed on mcpservers.org](https://mcpservers.org/badge.svg)](https://mcpservers.org/servers/briefing-service-wholemind-workers-dev) [![briefing-mcp on Glama](https://glama.ai/mcp/servers/jshelley/briefing-mcp/badges/score.svg)](https://glama.ai/mcp/servers/jshelley/briefing-mcp)

MCP server for [Briefing Service](https://briefing-service.wholemind.workers.dev): every hour an LLM editor ranks ~100 feeds per topic (AI, frontier labs, markets, US sports, European football, US news, world) and publishes the result as structured JSON, a rendered 480x800 e-ink page, a multi-page Morning Paper PDF, and a free provenance dump of every candidate it saw.

This package runs locally over stdio and calls the public REST API. The same tools are served remotely (streamable HTTP, no install) at `https://briefing-service.wholemind.workers.dev/mcp`.

## Install

Claude Desktop / Claude Code / Cursor / any stdio client:

```json
{
  "mcpServers": {
    "briefings": {
      "command": "npx",
      "args": ["-y", "github:jshelley/briefing-mcp"],
      "env": { "BRIEFING_KEY": "" }
    }
  }
}
```

Claude Code one-liner:

```bash
claude mcp add briefings -- npx -y github:jshelley/briefing-mcp
```

Claude Desktop, one click: download [briefing-mcp-0.1.0.mcpb](https://github.com/jshelley/briefing-mcp/releases/download/v0.1.0/briefing-mcp-0.1.0.mcpb) and open it (MCP bundle; it asks for the optional Reader key).

## Tools

| tool | what it returns | cost |
|---|---|---|
| `list_briefings` | keys, names and prices | free |
| `get_briefing(key)` | lead, ranked stories, research, why-it-matters, key points | 25 free/IP/day, then key or x402 |
| `get_summary(key)` | headlines and one-liners | free |
| `get_candidates(key)` | every candidate this hour: canonical link, outlets, `selected`, collapsed duplicates with `duplicate_of` | free |
| `get_page(key, page, wide)` | 480x800 1-bit PNG (or 800x480 wide front page) | 25 free/IP/day |
| `render_briefing(feeds, persona)` | rank and render your own feeds | Reader key or x402 |

## Pricing

- Free: 25 JSON/page/tool calls per IP per day, plus the summary and candidates endpoints.
- Reader key: $9/month, unlimited reads, Morning Paper delivery, 10 custom renders/day. Set it as `BRIEFING_KEY`. Buy at https://briefing-service.wholemind.workers.dev/billing/checkout
- Per call: x402 (USDC on Base) against the remote endpoint.

Docs for agents: https://briefing-service.wholemind.workers.dev/llms.txt

## How it works

`index.js` is the whole server: it registers six tools with `@modelcontextprotocol/sdk` and answers each by calling the public Briefing Service REST API over HTTPS (`GET /v1/briefings/...`, `POST /v1/render`). It stores nothing, runs no shell commands, and reads only two environment variables (`BRIEFING_KEY`, `BRIEFING_BASE_URL`). The `Dockerfile` builds the same thing; `docker run -i` speaks MCP over stdio.

Run the smoke test locally:

```bash
npm install
node client-test.mjs   # lists tools and calls list_briefings, get_summary, get_candidates, get_page, get_briefing
```

Write-up of the pipeline (collect, entity-overlap dedupe, LLM editor, 1-bit render) and what the first week taught: https://dev.to/jshelley/i-built-an-hourly-newspaper-for-e-ink-and-turned-the-pipeline-into-an-mcp-server-1ebg. Each briefing also has an Atom feed at `/v1/briefings/{key}/feed.xml`; the Morning Paper PDF carries an outline per story, front-page go-to links and a clickable source URL on every story page.

## Environment

- `BRIEFING_KEY`: optional Reader key (sent as `Authorization: Bearer`).
- `BRIEFING_BASE_URL`: override the API base (default: the public service).

## License

MIT
