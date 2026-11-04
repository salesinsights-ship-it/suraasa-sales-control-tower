# Turn on Google sign-in

The email and password screen on the site decides what each person sees, but it does not protect the data: anyone with the Apps Script link can still read and change it. Google sign-in, checked on the server, closes that. It takes about 15 minutes and costs nothing.

Do this only after the new `apps-script/Code.gs` is in use. When it is on, Google sign-in replaces the password screen.

## 1. Add your team

In the Sheet, open the **Users** tab and add one row per person.

| email | name | role | active |
|---|---|---|---|
| you@suraasa.com | Your Name | Administrator | TRUE |

- **role** is one of: `Administrator`, `Project Owner`, `Task Owner`, `Viewer`. `management` and `employee` also work: they mean Administrator and Task Owner. `management` means Administrator and `employee` means Task Owner.
- **name** must match how the person is written in the Owner fields, exactly. A task owned by `Sales Operations` gives no rights to someone named `Priya`.

You can add more people later in **Administration** on the site. At least one active Administrator is required.

## 2. Create a Google client ID

1. Open [console.cloud.google.com](https://console.cloud.google.com) with your Suraasa account. Create a project, for example `Control Tower`.
2. **APIs & Services > OAuth consent screen.** Choose **Internal** so only your Workspace can sign in. Fill in the app name and your email.
3. **APIs & Services > Credentials > Create credentials > OAuth client ID.**
4. Application type: **Web application**.
5. **Authorised JavaScript origins:** add `https://suraasa-sales-control-tower-rouge.vercel.app`
6. Leave redirect URIs empty. Click **Create** and copy the client ID. It ends in `.apps.googleusercontent.com`. It is not a secret.

## 3. Turn it on

In the Sheet: **Control Tower > Turn on sign-in**, and paste the client ID.

Open the site in a private window. You should see the sign-in screen. Sign in, and check your role in the person menu at the top right.

## If something goes wrong

- **"Your account has no access yet":** add the email to the Users tab.
- **Google shows an origin error:** check the address in step 5 exactly, with no trailing slash. Changes can take a few minutes.
- **Locked out:** Sheet menu: **Control Tower > Turn off sign-in**.
