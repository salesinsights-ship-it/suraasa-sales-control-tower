# Start here

Control Tower is Suraasa's sales project and task platform. It is plain JavaScript with no framework, hosted on Vercel. A Google Apps Script web app is the backend, and a Google Sheet is the system of record.

This copy is branch `fix/review-findings`, version 3.0.2.

## Current state

| Item | State |
|---|---|
| Live site | https://suraasa-sales-control-tower-rouge.vercel.app/ runs version 3.0.0 from `main` |
| Repository | https://github.com/salesinsights-ship-it/suraasa-sales-control-tower |
| Pull request 2 | Open, not merged. It contains live Sheet updates and review fixes |
| Sheet | `Suraasa Sales Control Tower 3.0`, owned by salesinsights@suraasa.com |
| Script | Bound to that Sheet. API version 6 |
| Sign-in | Email and password, checked on the server. No Google Cloud project is used |
| Emails | Test mode. Everything goes to the script owner |

`build.js` holds the script link. To use a different one, set `CT_API_URL` when building.

## Commands

```
node build.js        # builds dist/ and index.html from src/
npm test             # engine, backend, automation, phase6, task1 and review suites
npm run test:e2e     # browser tests. Needs Playwright with Chromium
```

Tests run the real `apps-script/Code.gs` on a simulated Sheet (`tests/mock-gas.js`). Nothing in them touches real Google services.

## Where things are

- `src/`: the site. `app.js` is the UI and sync, `engine.js` is the rules.
- `apps-script/Code.gs`: the backend. It must be pasted into Apps Script and published as a new version by hand.
- `docs/`: architecture, deployment, permissions, known limitations and test results.

## Rules to keep

- Keep the Google Sheet as the system of record, and keep the existing UI.
- Enforce every permission on the server. Hiding a button is not security.
- Never commit credentials, staff lists or real business data.
- Never send test emails to real employees, or switch emails to live, without approval.
- Do not deploy untested changes to production.
- Never claim a test passed, or an email was delivered, without proof.
- The owner does not want Google Cloud or email codes for sign-in.

## Open items

1. Publish the new `Code.gs` in Apps Script as a **New version** (API 6), keeping the same link.
2. Merge the website pull request and deploy on Vercel.
3. Confirm on the real site that sign-in works, that changes save to the Sheet, and turn on instant updates if desired.
4. Vercel's free Hobby plan is for non-commercial use. Check whether this project may stay on it.

`src/seed.js` holds real project data, so treat this folder as private. See `docs/KNOWN_LIMITATIONS.md` for the rest.
