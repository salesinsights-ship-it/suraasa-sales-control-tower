# Suraasa Sales Control Tower

A project and task platform for the Head of Sales and the sales team. It answers one question first: what needs me today? A manager assigns a task by entering an employee's email, and the rest happens by itself: it saves to the Google Sheet, emails the employee, appears on their dashboard, and tells the manager when it is done.

---

## How it is organised

- **Home**: headline statistics, charts and workload. Employees see their own dashboard.
- **My Tasks**: list, board or calendar, with saved views and bulk edit.
- **Projects** and **My Projects**: list or timeline. Each project has Summary, Plan, Risks, Updates, People, Files and Activity.
- **Decisions & risks**, **Weekly review**, **Notifications**, **Reports**.
- **Action plan**, **Who does what**, **How we work**.
- **Administration**: Employees, Integrations, Notification log, Audit log, Deleted items, Health rules, Sheet and data. Managers see Employees and the Notification log.
- Everywhere: `/` to find anything, and **New** to add anything, including **Assign a task by email**.

## How it works

The page holds no business data. It loads from a Google Sheet through an Apps Script web app, which handles validation and the audit log.

People sign in with their work email and a password. The script checks every sign-in on the server, against the Users tab, and applies each person's role to everything they read or change.

| Read this | For |
|---|---|
| [docs/OPERATING_MANUAL.md](docs/OPERATING_MANUAL.md) | How to use it day to day |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Installing an update, settings, and rollback |
| [docs/CREDENTIALS.md](docs/CREDENTIALS.md) | What access is needed, and why |
| [SETUP_SIGN_IN.md](SETUP_SIGN_IN.md) | Setting up sign-in and passwords |
| [SETUP_GOOGLE_SHEET.md](SETUP_GOOGLE_SHEET.md) | Connecting a brand-new Sheet |
| [docs/AUDIT.md](docs/AUDIT.md) | What was found, and before and after |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How it works, and the data model |
| [docs/PERMISSIONS.md](docs/PERMISSIONS.md) | Who can do what |
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | Lifecycle, progress, health, audit log, notifications |
| [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md) | Tests and results |
| [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) | What it does not do |
| [CHANGELOG.md](CHANGELOG.md) | What changed |

No runtime dependencies: plain HTML, CSS and JavaScript.

```
npm run build       # builds dist/
npm test            # rules and server tests
npm run test:e2e    # browser tests (needs: npm i --no-save playwright)
```

---

## File Structure

```
├── src/
│   ├── engine.js        # Rules: lifecycle, progress, health, notifications
│   ├── app.js           # Sign-in, screens, forms, permissions shown to the user, sync
│   ├── seed.js          # Data used by the tests. Not published
│   ├── styles.css       # Light and dark themes
│   └── shell_*.html     # Page frame
├── apps-script/Code.gs  # Server: sign-in, permissions, validation, audit log, notifications
├── assets/              # Official logos, favicons, app icons
├── tests/               # Rules, server and browser tests
├── docs/                # Audit, architecture, permissions, workflow, tests
├── dist/                # Built site, deployed by Vercel
└── build.js
```

---

## Building Locally

To rebuild the distribution files after editing `src/`:

```bash
# Using Node.js
node build.js

# Or using bash
./build.sh
```

This compiles `src/*` into `dist/Suraasa_Sales_Control_Tower.html`, `dist/index.html`, and `index.html`.

---

## Deploying to Vercel

`vercel.json` already holds the settings, so pushing to `main` on GitHub publishes the site.

- Framework preset: **Other**
- Build command: `node build.js`
- Output directory: `dist`

---

## Data Storage & Reset

- The Google Sheet is the system of record. Each browser keeps a working copy under `suraasa_sales_control_tower_v1`, and signing out clears it.
- Changes save to the Sheet automatically. The status at the top of the page shows Saved, Saving or Not saved.
- **Administration > Sheet and data** shows the connected link and exports a backup.
