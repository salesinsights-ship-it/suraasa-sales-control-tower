# Google Sheet Two-Way Sync Setup Guide

This guide walks you through setting up real-time, two-way synchronization between the **Suraasa Sales Control Tower** web application and a Google Sheet using the Google Apps Script backend located in `apps-script/Code.gs`.

---

## Architecture Overview

- **Frontend (`src/app.js` & `dist/index.html`)**:
  - All local changes (Add / Edit / Delete) update the in-memory state `S` and `localStorage`.
  - The `SYNC` client module automatically pushes changes to the Google Sheet backend when connected.
  - The client polls for remote changes every 15 seconds (with exponential backoff and conflict detection via `baseVersion`).
  - Topbar indicator displays real-time status: **Synced**, **Syncing...**, **Offline**, or **Error**.

- **Backend (`apps-script/Code.gs`)**:
  - Bound or standalone Google Apps Script web app responding to HTTP `GET` (`pull_`) and `POST` (`push_`).
  - Contains strict schema definitions (`SCHEMA`) mapping 17 distinct tabs.
  - Generates frozen headers, bold text, and in-sheet dropdown validations.

---

## Step 1: Create a New Google Sheet

1. Open [Google Sheets](https://sheets.new) in your browser.
2. Name the spreadsheet: **`Suraasa Sales Control Tower - Database`**.
3. Copy the URL of your new spreadsheet for reference.

---

## Step 2: Open Google Apps Script Editor

1. In the Google Sheet menu, click **Extensions** > **Apps Script**.
2. Rename the project in the top-left from `Untitled project` to **`Suraasa Control Tower Sync`**.
3. In the left files pane, select `Code.gs`.
4. Delete any placeholder code and replace it with the complete contents of [`apps-script/Code.gs`](apps-script/Code.gs) from this repository.
5. Press `Ctrl + S` (or `Cmd + S`) to save.

---

## Step 3: Run Initial Sheet Setup (`setupSheet`)

1. In the function dropdown at the top of the Apps Script editor, select **`setupSheet`**.
2. Click **Run**.
3. An **Authorization Required** dialog will appear:
   - Click **Review permissions**.
   - Select your Google account.
   - Click **Advanced** > **Go to Suraasa Control Tower Sync (unsafe)**.
   - Click **Allow**.
4. Check the **Execution log** at the bottom. You will see:
   ```
   [setupSheet] Initializing 17 tabs...
   [setupSheet] Created/configured tab: Projects
   [setupSheet] Created/configured tab: Tasks
   ...
   [setupSheet] Finished successfully!
   ```
5. Switch back to your Google Sheet tab. You will see all 17 tabs created, formatted with frozen headers and styled columns:
   - `Projects`
   - `Tasks`
   - `Workstreams`
   - `Milestones`
   - `RACI`
   - `Risks`
   - `Dependencies`
   - `Decisions`
   - `Updates`
   - `Actions`
   - `Programs`
   - `Roles`
   - `Governance`
   - `Options`
   - `Comments`
   - `Activity`
   - `_Meta`

---

## Step 4: Deploy as a Web App

1. In the top-right corner of the Apps Script editor, click **Deploy** > **New deployment**.
2. Click the gear icon next to *Select type* and choose **Web app**.
3. Configure the deployment settings:
   - **Description**: `Suraasa Sales Sync API v1`
   - **Execute as**: **Me (`your-email@domain.com`)**
   - **Who has access**: **Anyone** *(Important: Must be "Anyone" so the browser can make HTTP requests without requiring Google OAuth popups)*
4. Click **Deploy**.
5. Once deployment completes, copy the **Web app URL** under the *Web app* section.
   - It looks like:
     `https://script.google.com/macros/s/AKfycbx.../exec`

---

## Step 5: Connect the Dashboard to the Google Sheet

1. Open your deployed Vercel site or local `dist/index.html` in your browser.
2. In the left navigation, click **Data & settings**.
3. Locate the **Google Sheet Sync** card:
   - Paste the Web App URL into the **Apps Script Web App URL** input field.
   - Click **Save URL**.
4. Click **Push to Sheet** to upload the initial dataset (projects, roles, options, governance, tasks) into the Google Sheet.
5. You can now toggle **Auto-sync** on to sync every 15 seconds.
6. The topbar badge in the upper right will turn green: **● Synced**.

---

## Step 6: Updating Apps Script Code in the Future

Whenever you modify `apps-script/Code.gs`:
1. In the Apps Script editor, click **Deploy** > **Manage deployments**.
2. Click the edit (pencil) icon on the active deployment.
3. Under **Version**, select **New version**.
4. Click **Deploy**.
*(Note: If you do not create a new version, the Web App URL will continue running the previous version of the code).*

---

## Schema Reference (17 Tabs)

| Tab | Key Column | Description |
|---|---|---|
| `Projects` | `id` (e.g. PRJ-01) | Project charters, RAG health, owners, budget, sponsors |
| `Tasks` | `id` (e.g. T-001) | Tasks & subtasks with status, owners, dates, deliverables |
| `Workstreams` | `id` (e.g. WS-1) | Strategic workstream definitions |
| `Milestones` | `id` (e.g. M-01) | Project milestone targets and delivery dates |
| `RACI` | `id` | RACI matrices mapping projects/roles to R, A, C, I |
| `Risks` | `id` (e.g. R-01) | Identified risks, severity, probability, mitigation plans |
| `Dependencies` | `id` (e.g. DEP-01)| Inter-project & external dependencies |
| `Decisions` | `id` (e.g. DEC-01) | Architectural & business decisions |
| `Updates` | `id` (e.g. U-01) | Weekly progress and status updates |
| `Actions` | `id` (e.g. ACT-01) | Head of Sales action queue items |
| `Programs` | `id` (e.g. SI-01) | Strategic initiatives & child project groupings |
| `Roles` | `name` | Confirmed team members, roles, and external stakeholders |
| `Governance` | `key` | Cadence (daily, weekly, monthly) & RAG criteria |
| `Options` | `category` | 15 configurable dropdown option categories |
| `Comments` | `id` | Threaded project comments and feedback |
| `Activity` | `id` | Real-time audit trail of all additions/edits/deletions |
| `_Meta` | `key` | Version stamps, last sync timestamp, conflict detection |

---

## Troubleshooting

- **CORS / Network Error**: Ensure deployment access is set to **Who has access: Anyone**.
- **Conflict Detected Modal**: If someone modified the Sheet directly while local changes were pending, the dashboard prompts whether to overwrite or pull remote changes.
- **Vercel 404 on Deployment**: Ensure Vercel is serving from the project root or `dist/` where `index.html` is generated. Run `node build.js` to ensure `index.html` is up to date.
