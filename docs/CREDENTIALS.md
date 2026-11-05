# Credentials and access checklist

Nothing here is stored in the code. The only secret-like value is the session each person gets at sign-in, which lives in Apps Script's cache.

| What | Who provides it | Why it is needed | Where it goes | Is it secret? |
|---|---|---|---|---|
| Access to the Google account that owns the Sheet | You | To update the script and publish a new version | Used in the browser, not stored | Yes: never share the password |
| Each person's password | The person, after a temporary one | Sign-in | Stored only as a hash in Script Properties | Yes |
| Google OAuth client ID (optional) | You, from Google Cloud | The extra Sign in with Google button | **Control Tower > Set Google sign-in client ID** | No |
| Team list | You | Decides who can sign in and their role | Users tab | Employee data: keep it out of the repository |
| Permission to send email and use Drive | Granted when you first run `setupSheet` | Sends notifications, and saves uploads and backups in that Google account | Google account | Not applicable |
| GitHub write access | You: install the Claude GitHub App, or push the branch yourself | Publishes the code | GitHub | Not applicable |
| Vercel | Already connected to the repository | Publishes the site | Vercel | Not applicable |

No paid service, API key or second email provider is needed. Emails use your existing Google account, within its daily limit.

Optional settings are listed in [DEPLOYMENT.md](DEPLOYMENT.md).
