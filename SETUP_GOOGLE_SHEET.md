# Connect a new Google Sheet

Use this only for a brand-new Sheet. To update the script on your existing Sheet, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

A new Sheet starts empty, because the website holds no data. To keep your data, make the new Sheet with **File > Make a copy** instead of starting blank.

## 1. Add the script

1. Open the Sheet, then **Extensions > Apps Script**.
2. Replace everything in `Code.gs` with `apps-script/Code.gs` from this project, and save.
3. Choose `setupSheet` in the function menu and click **Run**. Allow the permissions.
4. Go to the Sheet tab and click **OK** on the message. The script waits for this.

You now have these tabs: `Projects`, `Workstreams`, `Milestones`, `RACI`, `Comments`, `Tasks`, `Risks`, `Dependencies`, `Decisions`, `Actions`, `WeeklyUpdates`, `Programs`, `Roles`, `Activity`, `_Meta`, `Users`, `AuditLog`, `Trash` and `Snapshots`.

## 2. Publish it

1. Click **Deploy > New deployment**, click the gear icon and choose **Web app**.
2. Set **Execute as** to **Me**.
3. Set **Who has access** to **Anyone**. Do not choose "Anyone within Suraasa" or "Anyone with Google account": the website cannot sign in to Google, so it will not load or save.
4. Click **Deploy** and copy the link ending in `/exec`.

The link must start with `https://script.google.com/macros/s/`. A link containing `/a/macros/suraasa.com/` means access is limited to your organisation.

To check it, open the link in an Incognito window with `?action=ping` on the end. You should see text containing `"api":3`, not a sign-in page.

## 3. Add your team

In the **Users** tab, from cell A2, add one row per person: `email`, `name`, `role`, `active`.

Assignment emails find people by this name. A name in brackets is another name for the same person: `Manish Pandey (Head of Sales)` also receives tasks owned by `Head of Sales`.

## 4. Connect the website

Change the link in two places, then run `node build.js` and push:

- `DEFAULT_SYNC_URL` in `src/app.js`
- `url` under `meta.sync` in `src/seed.js`

If this is a different Sheet, also change `SHEET_URL` in `src/app.js`, which is the **Open Google Sheet** link.

## Later changes to the script

After editing the code, click **Deploy > Manage deployments**, click the pencil icon, choose **New version**, then **Deploy**. Without a new version, the link keeps running the old code. Do not use **New deployment**, because that creates a different link.

## If something goes wrong

| What you see | What it means |
|---|---|
| The site says it cannot reach the Sheet | **Who has access** is not **Anyone**, or the link is wrong |
| The ping link shows no `"api":3` | The new code is not deployed. Make a **New version** |
| `getSheetByName` error in Apps Script | The script is not attached to the Sheet. Open it from **Extensions > Apps Script** |
| The run never finishes | A message is waiting in the Sheet tab. Click **OK** |
