# Suraasa Sales Control Tower

A single-page project tracker for the Head of Sales and the sales team. It answers one question first: what needs me today? It saves to a Google Sheet, and edits in the Sheet show up here.

---

## How it is organised

- **Home**: one sentence saying what is waiting, slipping and due, then the top items of each.
- **Projects**: list grouped by health, or a timeline. Open one for its summary, plan, risks, updates and people.
- **Tasks**: open tasks grouped by date. Tick to finish, with undo. Click for everything else.
- **Decisions & risks**: decisions, risks and what you are waiting on from others.
- **Weekly review**: projects that still need an update.
- **More**: Action plan, Who does what, How we work, Data & settings.
- **Everywhere**: `/` to find anything, **New** to add anything, and your name (top right) to see only your work. Your name is remembered in this browser.

Every list is one line per item. Anything rarely needed sits behind **More details** in the side panel, and delete lives there too.

## Google Sheet sync

- Backed by Google Apps Script (`apps-script/Code.gs`) with 17 structured tabs.
- The site gets the latest from the Sheet when it opens, when you return to the tab and every 60 seconds.
- The status next to **New** shows Saved, Saving, Not saved or This browser only.
- See [SETUP_GOOGLE_SHEET.md](SETUP_GOOGLE_SHEET.md) for setup.

No runtime dependencies: plain HTML, CSS and JavaScript, deployable to any static host.

---

## File Structure

```
├── dist/
│   ├── Suraasa_Sales_Control_Tower.html   # Standalone assembled single-file deliverable
│   └── index.html                         # Production build for Vercel/static hosts
├── src/
│   ├── shell_head.html                    # HTML head and meta tags
│   ├── styles.css                         # Application styles, light and dark
│   ├── shell_mid.html                     # Top bar, menus, sync status, phone tab bar
│   ├── seed.js                            # Default seed data and option lists
│   ├── app.js                             # Views, forms, state, SYNC module
│   ├── smoke-test.js                      # Headless check of every page (needs jsdom)
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
- To go back to the original data, open **More → Data & settings → Reset**.
