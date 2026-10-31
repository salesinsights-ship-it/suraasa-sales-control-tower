# Suraasa Sales Control Tower

Single-file project-management dashboard for the Head of Sales. Open
`dist/Suraasa_Sales_Control_Tower.html` in any modern browser. No server,
no install, no external dependencies.

## Layout

```
dist/Suraasa_Sales_Control_Tower.html   the deliverable (self-contained)
src/seed.js        initial data: 19 project records, tasks, milestones, RACI, risks,
                   dependencies, decisions, action queue, governance text
src/app.js         application: state, health rules, views, forms, charts, export/import
src/styles.css     stylesheet
src/shell_*.html   HTML wrapper pieces used by build.sh
src/smoke-test.js  headless check (needs `npm i jsdom`, then `node src/smoke-test.js`)
build.sh           concatenates src/ into dist/
```

## Editing the data

Change `src/seed.js`, run `./build.sh`, reopen the file. The browser keeps
its own copy in localStorage, so after a rebuild use Data & settings → Reset
to load the new seed, or import a JSON export.

## Storage

Changes persist in the browser's localStorage only. It is per browser and
per device, not shared. Use Export JSON to back up or hand over; Import JSON
on another machine to continue.

## Conventions in the data

- Any value starting with `TBD` is unconfirmed and must be assigned.
- `(proposed)` marks a recommendation from the structuring exercise, not a fact.
- Dates are planning dates unless the brief stated them.
- Health (Green/Amber/Red/Grey) is computed from dates, milestones,
  dependencies and weekly owner updates, never from task completion %.
