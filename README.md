# Suraasa Sales Control Tower

A single-page project tracker for the Head of Sales and the sales team. It answers one question first: what needs me today? It saves to a Google Sheet, and edits in the Sheet show up here.

---

## How it is organised

- **Home**: headline statistics and what needs attention. Task owners see My work.
- **My Tasks**: list, board or calendar, with saved views and bulk edit.
- **Projects** and **My Projects**: list or timeline. Each project has Summary, Plan, Risks, Updates, People, Files and Activity.
- **Decisions & risks**, **Weekly review**, **Notifications**, **Reports**.
- **Action plan**, **Who does what**, **How we work**, **Administration**.
- Everywhere: `/` to find anything, and **New** to add anything.

## How it works

The page holds no business data. It loads from a Google Sheet through an Apps Script web app, which handles sign-in, permissions, validation and the audit log.

| Read this | For |
|---|---|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Installing an update, and rollback |
| [SETUP_SIGN_IN.md](SETUP_SIGN_IN.md) | Turning on Google sign-in |
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
│   ├── app.js           # Screens, forms, permissions shown to the user, sync
│   ├── seed.js          # Data used by the tests. Not published
│   ├── styles.css       # Light and dark themes
│   └── shell_*.html     # Page frame
├── apps-script/Code.gs  # Server: sign-in, permissions, validation, audit log
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

The project includes `vercel.json` configured for zero-configuration deployments:

1. **Option A (GitHub Integration)**:
   - Push to your GitHub repository.
   - Connect the repository in Vercel.
   - Framework Preset: **Other**.
   - Build Command: `node build.js` (or leave default from `vercel.json`).
   - Output Directory: `dist` (or leave default).

2. **Option B (Drag and Drop / CLI)**:
   - Upload `dist.zip` or the repository folder directly.
   - Because `index.html` is generated at both root and `dist/index.html`, your site will load immediately without 404 errors.

---

## Data Storage & Reset

- Data is automatically cached in the browser's `localStorage` under `suraasa_sales_control_tower_v1`.
- When connected to a Google Sheet, changes sync to the cloud.
- To go back to the original data, open **More → Data & settings → Reset**.
