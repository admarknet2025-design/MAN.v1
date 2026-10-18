# Google Analytics MCP (read-only)

Lets Claude Code read the mangh.org GA4 data (reports, realtime, property settings) so it can answer questions like
"which partner link brought the most visits this week?". It is read-only: it can look, never change anything.

- Server: https://github.com/googleanalytics/google-analytics-mcp (`analytics-mcp` on PyPI, run with `uvx`)
- Config in this repo: `.mcp.json` (not deployed to the website)
- GA4 account `412353605`, property `559420798`, web stream measurement ID `G-CDT1GX4GJ6`

## How it authenticates

A Google Cloud **service account** with a JSON key. The service account is added to the GA4 property as a **Viewer**, so
it can only read. The key is a secret: never paste it into chat, never commit it.

## One-time setup (about 15 minutes)

### 1. Google Cloud
1. console.cloud.google.com → create a project (for example `man-analytics`). Note the **project ID**.
2. APIs & Services → Library → enable both:
   - **Google Analytics Data API**
   - **Google Analytics Admin API**
3. IAM & Admin → Service Accounts → Create service account. Name it `ga-readonly`. It needs **no** Google Cloud roles.
   Copy its email address (`ga-readonly@<project-id>.iam.gserviceaccount.com`).
4. Open the service account → Keys → Add key → Create new key → **JSON**. A file downloads. Keep it private.
   (If your organisation blocks key creation, use the impersonation route in the server's README instead.)

### 2. Google Analytics
Admin → Property access management (for property `559420798`) → **+** → Add users → paste the service account email →
role **Viewer** → Add. (Uncheck "Notify new users by email".)

### 3. The Claude Code cloud environment
Cloud environment menu in the session title bar → Edit:
1. **Network access**: allow these domains (in addition to package managers):
   `analyticsdata.googleapis.com`, `analyticsadmin.googleapis.com`, `oauth2.googleapis.com`, `www.googleapis.com`
2. **Environment variables / secrets** (paste the values in the settings screen, not in a chat):
   - `GA_SERVICE_ACCOUNT_JSON` = the whole contents of the downloaded JSON key file
   - `GOOGLE_CLOUD_PROJECT` = the project ID from step 1
   - `GOOGLE_APPLICATION_CREDENTIALS` = `/root/.config/ga/service-account.json`
3. **Setup script**:
   ```sh
   mkdir -p /root/.config/ga
   [ -n "$GA_SERVICE_ACCOUNT_JSON" ] && printf '%s' "$GA_SERVICE_ACCOUNT_JSON" > /root/.config/ga/service-account.json && chmod 600 /root/.config/ga/service-account.json
   ```
4. Start a **new session** and approve the `analytics-mcp` server when asked.

### 4. Check it works
Ask: "List my Google Analytics accounts and properties", then "Run a report for property 559420798: sessions and
ticket_click events by session source, last 7 days".

## Running it on your own computer instead
1. Install pipx or uv.
2. `gcloud auth application-default login --scopes https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform`
   (or point `GOOGLE_APPLICATION_CREDENTIALS` at the service account key).
3. `claude mcp add analytics-mcp -e GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json -e GOOGLE_CLOUD_PROJECT=<project-id> -- pipx run analytics-mcp`

## Tools it provides
`get_account_summaries`, `get_property_details`, `list_google_ads_links`, `run_report`, `run_funnel_report`,
`get_custom_dimensions_and_metrics`, `run_realtime_report`.

## Housekeeping
- Rotate the key if it is ever exposed: delete it in Google Cloud, create a new one, update `GA_SERVICE_ACCOUNT_JSON`.
- Remove access any time: delete the service account from GA4 Property access management.
- Until step 3 is done, `analytics-mcp` shows as failed to start in new sessions. That is harmless.
