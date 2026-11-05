# Set up sign-in

People sign in with their work email and a password. The script checks every sign-in on the server, against the `Users` tab, so nothing is readable without one. It needs no Google Cloud project, and it costs nothing.

## 1. Add your team

In the Sheet, open the **Users** tab and add one row per person.

| email | name | role | active |
|---|---|---|---|
| you@suraasa.com | Your Name | Super Admin | TRUE |

- **role** is one of `Super Admin`, `Manager`, `Employee`, `Viewer`. The older words `Administrator`, `Project Owner`, `Task Owner`, `management` and `employee` still work.
- **email** is what identifies a person. Work is assigned by exact email.
- **name** must match how the person appears in owner fields on older tasks. A name in brackets is another name for the same person: `Manish Pandey (Head of Sales)` also owns tasks owned by `Head of Sales`.

Later, add people under **Administration > Employees** on the site. At least one active Super Admin is required.

## 2. Give the first person a password

1. In the Sheet: **Control Tower > Give someone a temporary password**.
2. Enter your email, exactly as it is in the `Users` tab.
3. Copy the temporary password it shows. It is shown once.
4. Open the site, sign in with your email and that password, then choose your own.

## 3. Give everyone else a password

1. Sign in as a Super Admin and open **Administration > Employees**.
2. Open the person, then click **Reset password**.
3. Give them the temporary password privately. It expires in 3 days, and they choose their own when they sign in.

The Sheet menu in step 2 does the same job, for anyone who can open the Sheet.

## Passwords

- A password needs at least 10 characters. Do not reuse one from another site.
- To change yours: click your picture at the top right, then **My profile > Change password**.
- If you forget yours, ask a Super Admin to reset it. Nobody can look up a password.
- Five wrong tries lock that person for 15 minutes. A reset ends the lock straight away.
- Changing or resetting a password signs that person out everywhere else.
- Making someone inactive or removing them deletes their password. If they come back, give them a new one.

Passwords are stored only as salted hashes in Script Properties, away from the Sheet. They are never written to the Sheet, the logs or the browser.

## How long a session lasts

A session ends after 6 hours without use, 12 hours after sign-in at the latest, on **Sign out**, when the person's password changes, or at their next request after they are deactivated.

## If something goes wrong

- **"That email or password is not right":** check the spelling, or ask a Super Admin for a reset. The same message covers an email that is not in the `Users` tab.
- **"Too many wrong tries":** wait 15 minutes, or ask a Super Admin for a reset.
- **"The server needs updating":** the script is an older version. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Optional: Sign in with Google

If you ever want a **Sign in with Google** button as well, create a Web client ID in Google Cloud and add it with **Control Tower > Set Google sign-in client ID**. Passwords keep working alongside it. Nothing needs this.
