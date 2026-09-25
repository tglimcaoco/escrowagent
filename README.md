# EscrowAgent

An escrow web app with two programs in one project:

| Program | URL | Who uses it |
|---|---|---|
| EscrowAgent | `https://your-app.vercel.app/` | Buyers and sellers |
| EscrowAgent Admin | `https://your-app.vercel.app/admin` | Administrators only |

Stack: React + Vite, Supabase (Postgres, Auth, Realtime), GitHub, Vercel.

## How the rules are enforced

All status rules live in the database (`supabase/schema.sql`), not in the browser:

- Users can **see** only transactions they created or that were addressed to their email. Administrators see all.
- Nobody can write to the tables directly. Every change goes through a database function that checks who is asking:
  - `create_transaction`: issues a unique `EA-XXXX-XXXX` code, status **Waiting**
  - `accept_transaction`: only the invited email can accept, **Waiting → Pending**
  - `update_my_transaction`:
    - `cancel` (either party, **Waiting/Pending → Cancelled**)
    - `release` (buyer only, **Funded → Completed**)
    - `return` (seller only, **Funded → Refunded**)
  - `admin_set_status`: administrators only, any status, with an optional note
- Every change is written to `transaction_events` as an audit trail.

## Deploy

### 1. Supabase

1. At supabase.com, create a **New project**. Choose region **Southeast Asia (Singapore)**.
2. Open **SQL Editor → New query**, paste all of `supabase/schema.sql`, click **Run**. It's safe to run again later.
3. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key. The newer **publishable** key also works.
4. Go to **Authentication → URL Configuration**:
   - **Site URL**: your Vercel URL (fill in after step 3, e.g. `https://escrowagent.vercel.app`)
   - **Redirect URLs**: add `https://escrowagent.vercel.app/**`. This covers both `/` and `/admin`, so confirmation and password-reset links don't point to localhost.
5. Go to **Authentication → Sign In / Providers → Email** and **leave "Confirm email" ON**. Unlike the Kasambahay app, this matters here: a person accepts a transaction by proving they own the email it was sent to. Supabase's built-in mailer only sends a few emails per hour, so before inviting real users, set up custom SMTP (e.g. Resend) under **Authentication → Emails → SMTP Settings**.

### 2. GitHub

1. Create a new repository named `escrowagent`.
2. Choose **Add file → Upload files**.
3. Open the unzipped `escrowagent` folder and **drag everything inside it onto the upload area**, including the `src` and `supabase` **folders**. Don't use "choose your files", because it skips folders.
4. Check that `src/` and `supabase/` show up as folders, then click **Commit changes**.

### 3. Vercel

1. Choose **Add New → Project** and import `escrowagent`. Vercel detects Vite automatically.
2. Skip Vercel's "add Supabase" button. You already have a project.
3. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`: your Project URL
   - `VITE_SUPABASE_ANON_KEY`: your anon or publishable key
4. Click **Deploy**, then put the resulting URL into Supabase step 1.4.

### 4. Make yourself an administrator

1. Open the live site and **Join** with your email, then confirm it.
2. In Supabase **SQL Editor**, run:

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```

3. Open `/admin` and log in. Add more administrators the same way.

To remove an administrator, run: `delete from public.admins where user_id = (select id from auth.users where email = '...');`

## Run locally (optional)

```bash
cp .env.example .env.local     # then fill in the two values
npm install
npm run dev                    # user app: http://localhost:5173/   admin: http://localhost:5173/admin.html
```

## Sharing a transaction

The **Copy** button on a new code copies a message with a link like `https://your-app.vercel.app/?code=EA-7K3M-Q9XP`. When the recipient logs in, the code is filled in and looked up for them.

## Project layout

```
index.html, admin.html     entry pages for the two programs
vite.config.js             builds both pages
vercel.json                serves /admin without the .html
supabase/schema.sql        tables, security rules, status functions
src/lib/                   Supabase client, session + live-data hooks, formatting
src/components/            login/join, password reset, header, dialogs
src/user/                  create, accept-by-code, dashboard
src/admin/                 administrator ledger
```

## Not yet included

No real money moves. **Funded** means an administrator confirmed the buyer's payment reached the escrow account outside the app. Connecting to actual payment rails would come next.
