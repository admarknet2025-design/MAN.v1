# Google Workspace MCP servers (not set up yet)

Guide: https://developers.google.com/workspace/guides/configure-mcp-servers

Status: **not installed.** The build environment cannot reach developers.google.com (the network policy blocks it),
so I could not read the endpoint URLs, the exact APIs to enable or the configuration the guide gives. A web search
only confirmed the outline: Google offers a separate remote MCP server for each Workspace product (Gmail, Drive,
Calendar, Chat, People, and possibly Docs, Sheets and Slides depending on the page version), set up by enabling the
product APIs plus their matching MCP services in a Google Cloud project, then pointing an MCP client at them. I have not
guessed any endpoints.

## To finish
Either:
1. Allow `developers.google.com` (and `workspace.google.com`) in the cloud environment's network settings, and ask
   me to read the guide and configure it; or
2. Paste the guide's "endpoints" and "client configuration" sections into the chat.

Notes for when we do it:
- These are remote servers behind Google sign-in. The sign-in is interactive (a browser consent screen), so it is
  normally done on a computer with Claude Code (`claude mcp add --transport http <name> <url>`) rather than inside a cloud session.
- Decide which products we need first (Gmail and Drive carry a lot of private data). Enable and approve only those.
- Keep scopes read-only where the guide allows it.
