# Google Forms MCP (matteoantoci/google-forms-mcp)

Lets Claude create and edit Google Forms and read their responses. Useful here to check that the Join MAN form
is recording applications. Config: `google-forms-mcp` in `.mcp.json` (not deployed). Source reviewed: it only talks to
Google's APIs (googleapis); tools are `create_form`, `add_text_question`, `add_multiple_choice_question`, `get_form`,
`get_form_responses`. Pinned commit: `96f7fa1ff02b8130105ddc6d98796f3b49c1c574` (2025-05-19). It builds and starts here.

## Read this before creating credentials
The upstream token script asks for two very broad Google permissions: `forms` and **`drive` (full access to the
whole Google Drive)**. Do not hand that token to a cloud session. Use narrower scopes. In the cloned repo, before
running the token script, change `src/get-refresh-token.ts`:

```ts
const scopes = [
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly'
];
```
These cover create/edit/read of forms and read-only responses, with no Drive access. (`get_form_responses` returns
applicants' names, emails and WhatsApp numbers, so treat the token as sensitive and keep it out of chat and git.)

## One-time setup
1. Google Cloud Console (the same project as the Analytics MCP is fine) → APIs & Services → Library → enable **Google Forms API**.
2. APIs & Services → OAuth consent screen: set it up. If the app stays in "Testing" with an external audience, Google
   expires the refresh token after 7 days; publish the app (or use an Internal audience on a Workspace domain) so it lasts.
3. Credentials → Create credentials → OAuth client ID → Application type **Desktop app**. Note the client ID and secret.
4. On your own computer (the sign-in opens a browser):
   ```sh
   git clone https://github.com/matteoantoci/google-forms-mcp && cd google-forms-mcp
   git checkout 96f7fa1ff02b8130105ddc6d98796f3b49c1c574
   # edit src/get-refresh-token.ts scopes as above
   npm install && npm run build && npm run build:token
   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node build/get-refresh-token.js
   ```
   Sign in with the Google account that owns the forms and approve. Copy the refresh token it prints.
5. Cloud environment (menu in the session title bar → Edit):
   - Environment variables / secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` (paste in the settings screen, never in chat).
   - Network access: allow `forms.googleapis.com`, `oauth2.googleapis.com`, `www.googleapis.com` (and `github.com` if the setup script clones it).
   - Setup script (append to any existing one):
     ```sh
     [ -d /opt/google-forms-mcp ] || git clone https://github.com/matteoantoci/google-forms-mcp /opt/google-forms-mcp
     cd /opt/google-forms-mcp && git checkout 96f7fa1ff02b8130105ddc6d98796f3b49c1c574 && npm install --no-audit --no-fund && npm run build
     ```
6. Start a new session and approve `google-forms-mcp`. Until the steps are done it shows as failed to start, which is harmless.

## Using it for the Join MAN form
The form on the site posts to the published form (`.../d/e/1FAIpQLSeqrp_.../formResponse`). The API needs the form's
**editor ID** instead: open the form in Google Forms, and copy the long ID in the address bar between `/forms/d/` and
`/edit`. Then ask: "Get the responses for form <that ID> and show the latest five."
