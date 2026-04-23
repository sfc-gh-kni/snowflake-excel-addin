# Snowflake Excel Add-in

A Microsoft Excel Add-in that connects Snowflake directly to Excel — inspired by the Databricks Excel Add-in. Browse your Snowflake catalog, import tables and views, write SQL queries, and use native Excel formulas to pull live Snowflake data, all inside Excel.

Designed to be deployed on **Snowpark Container Services (SPCS)** so it lives entirely within your Snowflake account — no external infrastructure required.

---

## Features

| Feature | Details |
|---|---|
| **Sign in with Snowflake** | OAuth 2.0 PKCE — users see the standard Snowflake login page |
| **Catalog browser** | Navigate Databases → Schemas → Tables and Views |
| **Table import** | Select columns, add filters, set row limits, preview before importing |
| **SQL editor** | Write arbitrary SQL with named parameters (`:param_name`) |
| **Saved imports** | Persist imports per workbook, refresh individually or all at once |
| **Custom functions** | `=SNOWFLAKE.TABLE(...)` and `=SNOWFLAKE.SQL(...)` as native Excel formulas |
| **RBAC enforced** | Data access is governed by Snowflake roles — users only see what they are permitted to |
| **SPCS hosted** | Runs inside your Snowflake account on Snowpark Container Services |

---

## Architecture

```
Excel (Office Add-in)
        │
        │  manifest.xml  (deployed by IT via M365 Admin Center)
        │
        ▼
https://<hash>-<account>.snowflakecomputing.app   ← SPCS Service
        │                                            (React UI + Express proxy)
        │  OAuth PKCE flow
        ▼
https://<account>.snowflakecomputing.com          ← Snowflake Login Page
        │
        │  Bearer token (access granted)
        ▼
Snowflake SQL API  (same account, governed by RBAC)
```

**Why SPCS?**
- HTTPS is handled automatically (`*.snowflakecomputing.app` cert)
- No external cloud infrastructure (no AWS, Azure, GCP)
- Endpoint access controlled by Snowflake roles
- Everything stays inside your Snowflake security perimeter

---

## Repository Structure

```
snowflake-excel-addin/
├── manifest.template.xml          # Office Add-in manifest template (checked in)
├── manifest.xml                   # Generated manifest — DO NOT commit (in .gitignore)
├── Dockerfile                     # Container definition for SPCS
├── package.json
├── tsconfig.json
├── webpack.config.js
├── .env.example                   # Environment variable reference
├── .gitignore
│
├── deploy/
│   ├── snowflake.sql              # All Snowflake setup SQL (run step by step)
│   └── build.sh                  # Build + push image to Snowflake registry
│
├── scripts/
│   ├── generate-manifest.js       # Generates manifest.xml from template
│   ├── generate-icons.js          # Generates PNG icons from canvas
│   └── setup-certs.js             # Generates trusted HTTPS certs for local dev
│
├── server/
│   ├── index.js                   # Express server: OAuth flow + API proxy
│   └── snowflake.js               # Snowflake SQL API wrapper
│
├── src/
│   ├── taskpane/                  # React task pane application
│   │   ├── App.tsx                # Main shell + OAuth dialog + Excel write logic
│   │   ├── api.ts                 # Fetch helpers
│   │   ├── types.ts               # TypeScript interfaces
│   │   ├── styles.css
│   │   ├── index.html
│   │   ├── index.tsx
│   │   └── components/
│   │       ├── AuthScreen.tsx     # Account input + "Sign in with Snowflake" button
│   │       ├── ObjectBrowser.tsx  # Lazy-loading catalog tree
│   │       ├── ImportConfig.tsx   # Column picker, filters, preview
│   │       ├── SQLEditor.tsx      # SQL editor with parameters and preview
│   │       └── ImportList.tsx     # Saved imports panel
│   └── functions/
│       ├── functions.ts           # SNOWFLAKE.TABLE and SNOWFLAKE.SQL
│       ├── functions.json         # Custom function metadata for Excel
│       └── custom-functions.d.ts  # CustomFunctions type declarations
│
└── assets/
    ├── snowflake-logo.svg
    ├── icon-16.png
    ├── icon-32.png
    ├── icon-64.png
    └── icon-80.png
```

---

## Prerequisites

### Tools you need installed

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 18 or 20 LTS | Build and run the server |
| npm | 9+ | Package management |
| Docker | 24+ | Build the container image |
| Snowflake CLI (`snow`) | latest | Push image to Snowflake registry |
| Excel | 2019+, M365, or Excel on the web | The host application |

### Snowflake permissions required

You need a Snowflake role with the following privileges to complete the setup:

- `CREATE DATABASE` (or use an existing database)
- `CREATE SECURITY INTEGRATION`
- `CREATE COMPUTE POOL`
- `CREATE SERVICE`
- `BIND SERVICE ENDPOINT`

Typically `SYSADMIN` + `SECURITYADMIN` is sufficient.

---

## Part 1 — Local Development

Use this to develop and test the add-in on your laptop before deploying to SPCS.

### Step 1 — Clone and install

```bash
git clone https://github.com/<your-org>/snowflake-excel-addin.git
cd snowflake-excel-addin
npm install
```

### Step 2 — Generate icons

```bash
npm run generate-icons
```

This creates `assets/icon-16.png`, `icon-32.png`, `icon-64.png`, and `icon-80.png`.

### Step 3 — Set up HTTPS certificates

Office Add-ins refuse to load over plain HTTP. This generates a trusted localhost certificate and installs it into your system keychain.

```bash
npm run setup-certs
```

> **macOS:** You will be prompted for your system password to add the certificate to your Keychain. This is expected.
>
> **Windows:** Run your terminal as Administrator. The certificate is added to the Windows Certificate Store.

### Step 4 — Configure environment variables

```bash
cp .env.example .env
```

For local development, the defaults in `.env.example` are sufficient. Leave `OAUTH_CLIENT_ID` blank for now — you will fill it in after completing the Snowflake OAuth setup in Part 2.

### Step 5 — Generate the manifest

```bash
npm run generate-manifest -- \
  --host https://localhost:3000 \
  --account https://myorg-myaccount.snowflakecomputing.com
```

Replace `myorg-myaccount` with your actual Snowflake account identifier.

### Step 6 — Start the development server

```bash
npm run dev
```

You should see:

```
[0] Snowflake Add-in server running at https://localhost:3000
[1] webpack 5.x compiled successfully
```

### Step 7 — Trust the certificate in your browser

Open Safari or Chrome and navigate to:

```
https://localhost:3000/taskpane.html
```

You will see a security warning. Click **Advanced → Visit this website** (Safari) or **Advanced → Proceed** (Chrome), then enter your Mac password if prompted. This step is only needed once.

### Step 8 — Sideload the add-in into Excel

**Excel on the web (easiest):**
1. Open [excel.office.com](https://excel.office.com) and create or open a workbook
2. Go to **Home** → **Add-ins** → **More Add-ins** → **Upload My Add-in**
3. Upload `manifest.xml`
4. The **Snowflake** button appears in the Home ribbon

**Excel Desktop on macOS:**
```bash
mkdir -p ~/Library/Containers/com.microsoft.Excel/Data/Documents/wef
cp manifest.xml ~/Library/Containers/com.microsoft.Excel/Data/Documents/wef/
```
Quit and reopen Excel. The **Snowflake** button appears in the Home ribbon.

**Excel Desktop on Windows:**
1. Open Excel → **File** → **Options** → **Trust Center** → **Trust Center Settings** → **Trusted Add-in Catalogs**
2. Add `\\localhost\` or the folder path containing `manifest.xml` as a trusted catalog
3. Restart Excel → **Insert** → **My Add-ins** → **Shared Folder** → **Snowflake**

### Step 9 — Sign in

Click the **Snowflake** button in the ribbon. A task pane opens.

> **Note:** OAuth requires `OAUTH_CLIENT_ID` to be set. For local testing without OAuth, you can temporarily test the catalog and SQL features by manually setting a valid Bearer token in your browser's `localStorage` under the key `sf_session` with the format:
> ```json
> {"account":"myorg-myaccount","token":"<your-token>","tokenType":"oauth"}
> ```

---

## Part 2 — Snowflake OAuth Setup

This registers the add-in as an OAuth client so users can sign in with the standard Snowflake login page.

### Step 1 — Create the Security Integration

Open Snowsight or SnowSQL and run:

```sql
CREATE SECURITY INTEGRATION SNOWFLAKE_EXCEL_ADDIN
  TYPE = OAUTH
  ENABLED = TRUE
  OAUTH_CLIENT = CUSTOM
  OAUTH_CLIENT_TYPE = 'PUBLIC'
  OAUTH_REDIRECT_URI = 'https://localhost:3000/oauth/callback'
  OAUTH_ISSUE_REFRESH_TOKENS = TRUE
  OAUTH_REFRESH_TOKEN_VALIDITY = 86400
  COMMENT = 'OAuth integration for Snowflake Excel Add-in';
```

> `OAUTH_CLIENT_TYPE = 'PUBLIC'` means no client secret is required. The add-in uses PKCE (Proof Key for Code Exchange) instead, which is the secure standard for public clients.

### Step 2 — Retrieve the Client ID

```sql
SELECT SYSTEM$SHOW_OAUTH_CLIENT_SECRETS('SNOWFLAKE_EXCEL_ADDIN');
```

The result is a JSON object. Copy the value of `OAUTH_CLIENT_ID`.

### Step 3 — Update your .env

```bash
# .env
OAUTH_CLIENT_ID=<paste-the-client-id-here>
OAUTH_REDIRECT_URI=https://localhost:3000/oauth/callback
```

Restart the dev server (`npm run dev`) and try signing in. A dialog will open, redirect to the Snowflake login page, and return a token to the task pane.

---

## Part 3 — SPCS Production Deployment

Follow these steps to deploy the add-in to Snowpark Container Services so it is accessible to your entire organization without any local server.

### Step 1 — Create Snowflake objects

Run `deploy/snowflake.sql` in Snowsight **step by step**. The file is heavily commented. Key sections:

1. Creates the database, schema, and image repository
2. Creates the OAuth Security Integration
3. Creates the Compute Pool (`CPU_X64_S`, 1–2 nodes, auto-suspend after 5 minutes)
4. Creates the SPCS Service
5. Grants endpoint access to roles

```bash
# Or run from SnowSQL:
snowsql -f deploy/snowflake.sql
```

### Step 2 — Get your image repository URL

After running the SQL, check the repository URL:

```sql
SHOW IMAGE REPOSITORIES IN SCHEMA EXCEL_ADDIN_DB.APP;
```

The `repository_url` column will look like:

```
myorg-myaccount.registry.snowflakecomputing.com/excel_addin_db/app/excel_addin_repo
```

### Step 3 — Get the OAuth Client ID

```sql
SELECT SYSTEM$SHOW_OAUTH_CLIENT_SECRETS('SNOWFLAKE_EXCEL_ADDIN');
```

Copy the `OAUTH_CLIENT_ID` value. You will need it in the next step.

### Step 4 — Update environment variables

```bash
# .env (used during docker build is NOT needed — env vars go into the SPCS service spec)
# For the build script, export these in your shell:
export SNOWFLAKE_USER=myusername
```

The `OAUTH_CLIENT_ID` and `OAUTH_REDIRECT_URI` are passed as environment variables inside the SPCS service spec in `deploy/snowflake.sql`. Edit that file and replace `<OAUTH_CLIENT_ID>` with your actual value before running the CREATE SERVICE statement.

### Step 5 — Build and push the Docker image

```bash
./deploy/build.sh myorg-myaccount
```

This script:
1. Runs `npm run build` to produce `dist/`
2. Builds the Docker image for `linux/amd64`
3. Logs in to the Snowflake image registry using your Snowflake credentials
4. Pushes the image

> **Apple Silicon Macs:** The script already passes `--platform linux/amd64`. Docker Desktop with Rosetta emulation handles this automatically.

### Step 6 — Create the SPCS Service

Back in Snowsight, run the `CREATE SERVICE` statement from `deploy/snowflake.sql`. You have already filled in `<OAUTH_CLIENT_ID>`. Leave `<SPCS_ENDPOINT>` as-is for now — you will update the redirect URI in the next step.

Wait for the service to become ready:

```sql
CALL SYSTEM$GET_SERVICE_STATUS('EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN');
```

Wait until status shows `READY`.

### Step 7 — Get the public endpoint URL

```sql
SHOW ENDPOINTS IN SERVICE EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN;
```

The `ingress_url` column gives you a URL like:

```
abc123xyz-myorg-myaccount.snowflakecomputing.app
```

That is your **SPCS endpoint**. Write it down.

### Step 8 — Update the OAuth redirect URI

Now that you have the real endpoint URL, update the Security Integration:

```sql
ALTER SECURITY INTEGRATION SNOWFLAKE_EXCEL_ADDIN
  SET OAUTH_REDIRECT_URI = 'https://abc123xyz-myorg-myaccount.snowflakecomputing.app/oauth/callback';
```

Also update the `OAUTH_REDIRECT_URI` env var in the SPCS service spec and redeploy:

```sql
ALTER SERVICE EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN
  FROM SPECIFICATION $$
    spec:
      containers:
        - name: addin
          image: /excel_addin_db/app/excel_addin_repo/snowflake-excel-addin:latest
          env:
            PORT: "3000"
            NODE_ENV: production
            OAUTH_CLIENT_ID: "<OAUTH_CLIENT_ID>"
            OAUTH_REDIRECT_URI: "https://abc123xyz-myorg-myaccount.snowflakecomputing.app/oauth/callback"
  $$;
```

### Step 9 — Generate the production manifest

```bash
npm run generate-manifest -- \
  --host https://abc123xyz-myorg-myaccount.snowflakecomputing.app \
  --account https://myorg-myaccount.snowflakecomputing.com
```

This generates a fresh `manifest.xml` pointing to your SPCS endpoint.

### Step 10 — Deploy the manifest to your organization

**Option A — Microsoft 365 Admin Center (recommended for enterprise):**
1. Go to [admin.microsoft.com](https://admin.microsoft.com)
2. Navigate to **Settings** → **Integrated apps** → **Add-ins** → **Deploy Add-in**
3. Choose **Upload custom apps** → **I have a manifest file** → upload `manifest.xml`
4. Select which users or groups should have access
5. Click **Deploy**

Users will see the Snowflake button in Excel's Home ribbon the next time they open Excel (may take up to 24 hours to propagate).

**Option B — Manual sideload (for testing):**
Distribute `manifest.xml` to users and have them follow the sideload steps in Part 1, Step 8.

### Step 11 — Grant access to the service endpoint

Only Snowflake users whose role has been granted the service role can reach the SPCS endpoint URL. Grant access to your end-user role:

```sql
GRANT SERVICE ROLE EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN!ALL_ENDPOINTS_USAGE
  TO ROLE <YOUR_END_USER_ROLE>;
```

Users without this grant will receive a 403 error when Excel tries to load the add-in.

---

## Custom Excel Functions

Once signed in via the task pane, two custom functions are available in any Excel cell.

### `=SNOWFLAKE.TABLE(tableRef, [columns], [limit])`

Imports rows from a Snowflake table.

| Parameter | Required | Description |
|---|---|---|
| `tableRef` | Yes | Fully qualified: `DATABASE.SCHEMA.TABLE` |
| `columns` | No | Array of column names to include, e.g. `{"ID","NAME","AMOUNT"}` |
| `limit` | No | Maximum rows to return (default: 1000) |

**Examples:**

```excel
=SNOWFLAKE.TABLE("SALES_DB.PUBLIC.CUSTOMERS")

=SNOWFLAKE.TABLE("SALES_DB.PUBLIC.ORDERS", {"ORDER_ID","STATUS","AMOUNT"}, 500)
```

### `=SNOWFLAKE.SQL(query, [params])`

Runs a SQL query and returns results.

| Parameter | Required | Description |
|---|---|---|
| `query` | Yes | SQL text. Use `:param_name` for named parameters |
| `params` | No | Parameter pairs as a 2D range: name in one column, value in the next |

**Examples:**

```excel
=SNOWFLAKE.SQL("SELECT * FROM SALES_DB.PUBLIC.ORDERS WHERE STATUS = 'OPEN' LIMIT 100")

=SNOWFLAKE.SQL("SELECT * FROM SALES_DB.PUBLIC.ORDERS WHERE REGION = :region", {"region","WEST"})

// Using a cell range for parameters (param name in M4, value in N4):
=SNOWFLAKE.SQL("SELECT * FROM ORDERS WHERE REGION = :region", M4:N4)
```

Both functions return a 2D array that spills into adjacent cells, including a header row.

> **Note:** Custom functions require the task pane to be open at least once per session, as they share the same OAuth token established during sign-in.

---

## Maintenance

### View service logs

```sql
CALL SYSTEM$GET_SERVICE_LOGS(
  'EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN', 0, 'addin', 200
);
```

### Deploy a new version

```bash
# Build and push with a version tag
./deploy/build.sh myorg-myaccount v1.1

# Update the service to use the new image
# Run in Snowsight:
ALTER SERVICE EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN
  FROM SPECIFICATION $$
    spec:
      containers:
        - name: addin
          image: /excel_addin_db/app/excel_addin_repo/snowflake-excel-addin:v1.1
  $$;
```

### Suspend and resume the service

```sql
-- Suspend (stops billing for compute)
ALTER SERVICE EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN SUSPEND;

-- Resume
ALTER SERVICE EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN RESUME;
```

### Rotate the OAuth integration

If you need to update the redirect URI or other OAuth settings:

```sql
ALTER SECURITY INTEGRATION SNOWFLAKE_EXCEL_ADDIN
  SET OAUTH_REDIRECT_URI = 'https://<new-endpoint>/oauth/callback';
```

---

## Troubleshooting

### "Sorry, we can't load the add-in" in Excel Desktop

Excel cannot reach the add-in server. Check:

1. The server is running (`npm run dev` shows no errors)
2. Open `https://localhost:3000/taskpane.html` in Safari/Chrome and accept the certificate warning
3. Retry in Excel

### "Authentication in progress" stuck on sign-in

Your Snowflake account URL is not in `AppDomains` in `manifest.xml`. Run `npm run generate-manifest` with the correct `--account` flag.

### OAuth error: "Need admin approval"

Your Microsoft Entra (Azure AD) tenant blocks user consent for OAuth applications. A Global Admin must grant tenant-wide consent:
1. Go to [entra.microsoft.com](https://entra.microsoft.com)
2. **Enterprise Applications** → find Snowflake → **Permissions** → **Grant admin consent**

### SPCS service stuck in PENDING

```sql
CALL SYSTEM$GET_SERVICE_STATUS('EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN');
CALL SYSTEM$GET_SERVICE_LOGS('EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN', 0, 'addin', 50);
```

Common causes: compute pool not yet IDLE, image pull failed (check image path), or insufficient privileges.

### 403 on the SPCS endpoint

The user's Snowflake role has not been granted the service role:

```sql
GRANT SERVICE ROLE EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN!ALL_ENDPOINTS_USAGE
  TO ROLE <USER_ROLE>;
```

### Custom functions return `#VALUE!`

The task pane session has expired. Click the **Snowflake** button in the ribbon to sign in again.

---

## Security Considerations

- **No credentials stored server-side.** The OAuth token is held in the task pane's memory and passed with each API call.
- **PKCE flow.** No client secret is used. The code verifier is generated server-side per request and discarded after use.
- **SPCS endpoint access** is controlled by Snowflake service roles — not publicly open.
- **Data governance.** All queries run as the signed-in Snowflake user. RBAC applies — users cannot access objects they do not have privileges on.
- **Token expiry.** Access tokens expire (typically 10 minutes by default). The add-in will prompt re-authentication when needed.

---

## Snowflake Account Identifier Formats

| Format | Example | Notes |
|---|---|---|
| Legacy | `xy12345` | Older accounts |
| Org-based | `myorg-myaccount` | Recommended |
| Private Link | `xy12345.privatelink` | VPC/private connectivity |

Enter just the identifier (without `.snowflakecomputing.com`) in the sign-in screen.

---

## License

MIT — see [LICENSE](LICENSE)
