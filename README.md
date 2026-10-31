# Suraasa Sales Control Tower

A single-page enterprise project-management dashboard for the Head of Sales and executive leadership. Fully reactive, persistent, and two-way synced with Google Sheets.

---

## Key Features

1. **Complete CRUD (Add / Edit / Delete) Across All Collections**:
   - **Projects**: Charters, owners, sponsors, workstreams, dates, budgets, deliverables, and RAG status.
   - **Tasks & Subtasks**: Assignees, status transitions, due dates, and deliverable links.
   - **Programs (`SI-xx`)**: Strategic initiatives bundling child projects.
   - **People & Roles**: Full roster management with cascading renames and safe deletion.
   - **Configurable Dropdown Options**: 15 distinct categories (statuses, phases, cadences, etc.) customizable directly from the UI with in-use validation.
   - **Governance**: Editable cadence checklists (Daily, Weekly, Monthly), RAG criteria, and initiative classifications.
   - **Risks, Dependencies, Decisions, & RACI**: Full lifecycle tracking and matrix views.
   - **Project Comments**: Threaded team comments with edit and delete capabilities.
   - **Weekly Updates & Action Queue**: Executive sign-offs, blockers, and escalations.

2. **Real-Time Two-Way Google Sheet Sync**:
   - Backed by Google Apps Script (`apps-script/Code.gs`).
   - 17 structured tabs with frozen headers and data validations.
   - Conflict detection and auto-sync polling every 15 seconds.
   - See [SETUP_GOOGLE_SHEET.md](SETUP_GOOGLE_SHEET.md) for setup instructions.

3. **Zero Runtime Dependencies**:
   - Pure HTML5, CSS3, and modern vanilla JavaScript.
   - Fast, lightweight, and deployable to any static host (Vercel, Netlify, GitHub Pages, or local file).

---

## File Structure

```
├── dist/
│   ├── Suraasa_Sales_Control_Tower.html   # Standalone assembled single-file deliverable
│   └── index.html                         # Production build for Vercel/static hosts
├── src/
│   ├── shell_head.html                    # HTML head and meta tags
│   ├── styles.css                         # Application styles and dark theme
│   ├── shell_mid.html                     # Navigation sidebar, topbar, sync indicator
│   ├── seed.js                            # Default seed data and option lists
│   ├── app.js                             # Reactive UI, state manager, SYNC module
│   └── shell_tail.html                    # HTML footer closing tags
├── apps-script/
│   └── Code.gs                            # Google Apps Script two-way sync backend
├── build.js                               # Node.js build script
├── build.sh                               # Shell wrapper for build.js
├── index.html                             # Root copy of production build
├── package.json                           # Build scripts and metadata
├── vercel.json                            # Vercel deployment configuration
├── SETUP_GOOGLE_SHEET.md                  # Complete Google Sheets setup guide
└── README.md
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
- To reset the dashboard back to initial seed data, navigate to **Data & settings** and click **Reset to seed data**.
