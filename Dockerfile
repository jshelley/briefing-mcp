# briefing-mcp: stdio MCP server over the Briefing Service REST API.
# Runs with no secrets; set BRIEFING_KEY to use a Reader key.
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY index.js ./
ENV NODE_ENV=production
ENTRYPOINT ["node", "index.js"]
