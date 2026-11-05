# Set up Google sign-in

Google sign-in is the only way in. The script checks every sign-in with Google and against the Users tab, so nothing is readable without it. It takes about 15 minutes and costs nothing.

## 1. Add your team

In the Sheet, open the **Users** tab and add one row per person.

| email | name | role | active |
|---|---|---|---|
| you@suraasa.com | Your Name | Super Admin | TRUE |

- **role** is one of `Super Admin`, `Manager`, `Employee`, `Viewer`. The older words `Administrator`, `Project Owner`, `Task Owner`, `management` and `employee` still work.
- **email** is what identifies a person. Work is assigned by exact email.
- **name** must match how the person appears in owner fields on older tasks. A name in brackets is another name for the same person: `Manish Pandey (Head of Sales)` also owns tasks owned by `Head of Sales`.

Later, add people under **Administration > Employees** on the site. At least one active Super Admin is required.

## 2. Create a Google client ID

1. Open [console.cloud.google.com](https://console.cloud.google.com) with your Suraasa account. Create a project, for example `Control Tower`.
2. **APIs & Services > OAuth consent screen.** Choose **Internal**, so only your Workspace can sign in. Fill in the app name and your email.
3. **APIs & Services > Credentials > Create credentials > OAuth client ID.**
4. Application type: **Web application**.
5. **Authorised JavaScript origins:** add `https://suraasa-sales-control-tower-rouge.vercel.app`. Add any preview address you want to test on.
6. Leave redirect URIs empty. Click **Create** and copy the client ID. It ends in `.apps.googleusercontent.com`. It is not a secret.

## 3. Turn it on

In the Sheet: **Control Tower > Set Google sign-in client ID**, and paste it.

Open the site in a private window and sign in. Your role shows in the person menu at the top right.

## How long a session lasts

A session ends after 6 hours without use, 12 hours after sign-in at the latest, on **Sign out**, or at the person's next request after they are deactivated.

## If something goes wrong

- **"Your account has no access yet":** add the email to the Users tab.
- **"Google sign-in has not been set up yet":** the client ID is missing. Do step 3.
- **"The server needs updating":** the script is an older version. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), steps 4 and 6.
- **Google shows an origin error:** check the address in step 2.5 exactly, with no trailing slash. Changes can take a few minutes.
