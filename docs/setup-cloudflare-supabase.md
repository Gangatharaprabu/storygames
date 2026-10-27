# Setting up Cloudflare and Supabase

About 30–40 minutes, once. After this:

- the app is hosted on **Cloudflare Pages** at `https://storygames.pages.dev` (or similar),
  redeployed automatically on every push;
- stories are stored in **Cloudflare R2** and published **separately from the app**, with
  a staging list to check them before they go live;
- players can **sign in** (Supabase) to sync progress across their devices.

You'll create two accounts and copy a handful of keys into GitHub. Nothing secret ever goes
into the code. Dashboard menus get renamed from time to time: if a label below doesn't
match exactly, look for the closest one.

---

## Part A: Cloudflare (hosting + story storage)

### A1. Create the account
1. Sign up at **https://dash.cloudflare.com/sign-up** (free).
2. Copy your **Account ID**: on the dashboard home, open the account menu (or *Workers &
   Pages* → *Overview*) and find **Account ID** in the right-hand column. Keep it handy.

### A2. Create the story bucket (R2)
1. In the sidebar open **R2 Object Storage**. The first time, Cloudflare asks you to enable R2
   and add a payment method. The free allowance (10 GB stored, millions of reads, **no
   download fees**) covers this project for a long time; you're only charged beyond it.
2. **Create bucket** → name it exactly **`storygames-content`** → location *Automatic* → Create.
   Leave it **private** (the app serves it through its own address; don't enable public access).

### A3. Keys for publishing stories (R2 API token)
1. In **R2 Object Storage**, open **Manage API tokens** (or *API* → *Manage R2 API Tokens*) →
   **Create API token**.
2. Name: `storygames publisher`. Permissions: **Object Read & Write**. Apply to: **only**
   the `storygames-content` bucket. Create.
3. Copy the **Access Key ID** and **Secret Access Key** now. The secret is shown only once.

### A4. Key for deploying the app (Cloudflare API token)
1. Top-right profile icon → **My Profile** → **API Tokens** → **Create Token** →
   **Create Custom Token**.
2. Name: `storygames deploy`. Permissions: **Account** → **Cloudflare Pages** → **Edit**.
   Account resources: your account. Create, and copy the token.

### A5. Put the keys in GitHub
In the GitHub repo: **Settings** → **Secrets and variables** → **Actions** → **Secrets** tab →
**New repository secret**, four times:

| Name | Value |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | the Account ID from A1 |
| `CLOUDFLARE_API_TOKEN` | the token from A4 |
| `R2_ACCESS_KEY_ID` | Access Key ID from A3 |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key from A3 |

### A6. First deploy
1. GitHub → **Actions** → **Deploy app to Cloudflare Pages** → **Run workflow**.
2. When it's green, the run's log ends with the site address (usually
   `https://storygames.pages.dev`; Cloudflare adds a suffix if the name is taken). Every push
   redeploys: the repo's default branch is production, other branches get preview addresses.
3. The site shows **no stories yet**. That's expected: stories now come from R2 (next step).

### A7. Publish stories
GitHub → **Actions** → **Stories** → **Run workflow**:

| To… | action | story | channel / version |
|---|---|---|---|
| Upload a story to staging | `publish` | its folder, e.g. `fixtures/test-story` | |
| Check it | open the site with `?channel=staging` (a yellow **Staging** badge shows) | | |
| Make it live | `promote` | its id, e.g. `the-last-ferry` | |
| Go back to an older version | `rollback` | the id | version, e.g. `1.0.0` |
| Take it down | `unpublish` | the id | channel `live` (files are kept) |
| See what's where | `status` | | |

To publish the four sample stories: run `publish` for `fixtures/test-story`,
`fixtures/island-lighthouse`, `fixtures/night-watch` and `fixtures/clockmakers-shop`, then
`promote` `the-last-ferry`, `the-island-lighthouse`, `hanas-night-watch` and
`the-clockmakers-shop`.

**Versions never change once published.** To fix a story, raise `"version"` in its
`story.json` (e.g. `1.0.0` → `1.0.1`) and publish again; players who are mid-story keep
their save as long as the scenes they're in still exist.

---

## Part B: Supabase (accounts and sync)

### B1. Create the project
1. Sign up at **https://supabase.com** → **New project**. Pick a region close to your players,
   and save the database password somewhere safe (you won't need it day to day).

### B2. Create the tables
1. In the project: **SQL Editor** → **New query**.
2. Paste the whole of `supabase/migrations/20261027000000_player_data.sql` from this repo → **Run**.
   It creates the tables with row-level security (each player can only see their own data).

### B3. Allow your site to sign people in
**Authentication** → **URL Configuration**:
- **Site URL**: your Pages address, e.g. `https://storygames.pages.dev`
- **Redirect URLs** → add:
  - `https://storygames.pages.dev/**`
  - `https://*.storygames.pages.dev/**` (branch previews)
  - `http://localhost:5173/**` (trying it on your Mac)

### B4. Put the sign-in code in the email
The app asks players for a 6-digit code (the link in the email works too).
**Authentication** → **Emails** (or *Email Templates*) → **Magic Link** → set the body to:

```html
<h2>Your Storygames sign-in code</h2>
<p style="font-size:28px;letter-spacing:6px"><strong>{{ .Token }}</strong></p>
<p>Or <a href="{{ .ConfirmationURL }}">tap here to sign in</a>.</p>
<p>If you didn't ask for this, you can ignore this email.</p>
```

### B5. Give the app the project's address and public key
1. **Project Settings** → **API** (or **API Keys**): copy the **Project URL** and the
   **anon / publishable** key. (This key is meant to be public; the row-level security from
   B2 is what protects data. Never use the *service_role / secret* key in the app.)
2. GitHub → **Settings** → **Secrets and variables** → **Actions** → **Variables** tab →
   **New repository variable**:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Project URL, e.g. `https://abcd1234.supabase.co` |
| `SUPABASE_ANON_KEY` | the anon / publishable key |

3. Re-run **Deploy app to Cloudflare Pages**. The **Account** card on the profile page now
   offers sign-in.

### B6. Before real players: email sending
Supabase's built-in email is for testing only (a few emails per hour). Before launch, connect
an email provider (e.g. Resend, Postmark, Amazon SES) under **Authentication** → **Emails** →
**SMTP Settings**. Supabase's free plan also pauses projects after a week without activity;
the Pro plan ($25/month) doesn't.

---

## Optional: publishing from your Mac

Copy `.env.example` to `.env` in the repo folder and fill in the R2 values (the file is
git-ignored). Then:

```sh
pnpm storygames publish content/series/my-series/01-first --library content/library
pnpm storygames promote first-story-id
pnpm storygames status
```

To try sign-in locally, put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in
`packages/player/.env.local` and run `pnpm dev`.

## Afterwards
- The old **GitHub Pages** preview keeps working with the sample stories built in. Once
  Cloudflare is live you can delete `.github/workflows/deploy-pages.yml`.
- A custom domain can be added later in the Pages project (Custom domains), plus the same
  address in Supabase's URL settings.
