# Scrooolls launch guide

This takes about an hour, and it's easiest on a laptop or desktop computer. You don't need to write any code. You'll copy and paste a few things between three websites.

**What you need open:**
- `scrooolls.zip` (the code), unzipped into a folder on your computer
- `scrooolls-keys.txt` (your private keys). Keep this file to yourself.

**The three free services:**
- **Supabase** runs the database, the logins and the image storage.
- **GitHub** stores the code.
- **Vercel** puts the website online and updates it whenever the code changes.

Website menus change from time to time. If a button has a slightly different name from the one here, look for the closest match.

---

## Step 1: Create the Supabase project (5 min)

1. Go to **supabase.com** and sign up. Signing up with GitHub is fine.
2. Click **New project**.
   - **Name:** `scrooolls`
   - **Database password:** click *Generate a password*, then save it somewhere safe.
   - **Region:** choose the one closest to your readers, e.g. **South Asia (Mumbai)**.
3. Click **Create new project** and wait 1–2 minutes while it sets up.

## Step 2: Set up the database (3 min)

1. In the left menu, open **SQL Editor**, then click **New query**.
2. On your computer, open the file `supabase/schema.sql` from the unzipped folder in a text editor (Notepad or TextEdit). Select everything and copy it.
3. Paste it into the SQL Editor and click **Run**.
4. You should see **"Success. No rows returned."**

This creates every table, the security rules, the image storage, and your starting themes and genres.

> If you see an error, take a screenshot and send it to me. Don't run the file a second time.

## Step 3: Let people sign up without an email check (1 min)

1. In the left menu, open **Authentication**, then **Sign In / Providers** (it may be called just **Providers**). Click **Email**.
2. Turn **off** "Confirm email", then click **Save**.

Free Supabase projects can only send a few emails, so for launch, people sign up with an email and password with no confirmation step. We can add proper emails (confirmation, forgotten password) later.

## Step 4: Copy your Supabase keys (2 min)

1. Open **Project Settings** (the gear icon), then **API Keys**. On some projects it's under **Data API** or the **Connect** button at the top.
2. Copy these three things into the bottom of your `scrooolls-keys.txt` file:

| Name in Vercel | What to copy from Supabase |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Project URL**, which looks like `https://abcdefgh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The **publishable** key (older projects call it **anon public**) |
| `SUPABASE_SERVICE_ROLE_KEY` | The **secret** key (older projects call it **service_role**). Click *Reveal* to see it. |

> The secret key gives full access to your database. Never share it or put it anywhere except Vercel.

## Step 5: Put the code on GitHub (10 min)

1. Go to **github.com** and sign up.
2. Click the **+** at the top right, then **New repository**.
   - **Name:** `scrooolls`
   - Choose **Private**.
   - Click **Create repository**.
3. On the next page, click the link **"uploading an existing file"**.
4. Open your unzipped `scrooolls` folder. Select **everything inside it** (the `app`, `components`, `lib`, `public` and `supabase` folders, plus all the files). Drag it all onto the GitHub page. Use Chrome or Edge, which can upload folders.
5. Wait for the uploads to finish, then click **Commit changes**.
6. Check the repository: you should see `package.json` and the `app` folder at the top level, *not* a single folder called `scrooolls`. If you see just one folder, delete the repository and upload again, dragging the *contents* of the folder rather than the folder itself.

## Step 6: Put the website online with Vercel (10 min)

1. Go to **vercel.com** and sign up **with your GitHub account**. Choose the free **Hobby** plan.
2. Click **Add New…**, then **Project**. Find `scrooolls` and click **Import**. If it isn't listed, click *Adjust GitHub App Permissions* and give Vercel access to the repository.
3. **Before you click Deploy**, open **Environment Variables** and add these 7. For each one, paste the name on the left and its value on the right, then click **Add**.

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from step 4 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from step 4 |
| `SUPABASE_SERVICE_ROLE_KEY` | from step 4 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | from `scrooolls-keys.txt` |
| `VAPID_PRIVATE_KEY` | from `scrooolls-keys.txt` |
| `VAPID_SUBJECT` | `mailto:` followed by your email, e.g. `mailto:you@gmail.com` |
| `CRON_SECRET` | from `scrooolls-keys.txt` |

4. Click **Deploy** and wait about 2 minutes.
5. When it says **Congratulations**, click the preview. Your site is live at an address like `scrooolls.vercel.app`. Write this address down.

> If the site says **"Almost there"**, the keys weren't added in time. Go to **Settings → Environment Variables**, check all 7 are there, then go to **Deployments**, open the ⋯ menu on the latest one and click **Redeploy**.

## Step 7: Tell Supabase your website address (1 min)

1. In Supabase, open **Authentication**, then **URL Configuration**.
2. Set **Site URL** to your Vercel address, e.g. `https://scrooolls.vercel.app`, and click **Save**.

## Step 8: Switch on the hourly job (3 min)

This job publishes scheduled stories and sends each reader their morning notification.

1. Open `supabase/cron.sql` in a text editor.
2. Replace `YOUR-SITE-ADDRESS` with your address *without* `https://`, e.g. `scrooolls.vercel.app`.
3. Replace `YOUR-CRON-SECRET` with the `CRON_SECRET` value from your keys file.
4. Copy the whole file, paste it into a **New query** in Supabase's SQL Editor, and click **Run**.

## Step 9: Make yourself the admin (3 min)

1. On your phone, open your Scrooolls address. Tap **Create an account**, then go through the sign-up steps.
2. Back in Supabase's **SQL Editor**, open a **New query**, paste this, put your email in, and click **Run**:

```sql
update public.profiles set role = 'admin' where email = 'YOUR-EMAIL@example.com';
```

3. Open `your-address/dashboard` (e.g. `scrooolls.vercel.app/dashboard`) on your computer and log in. You'll see the admin dashboard. On the phone, the dashboard is under **Discover → Me → Open the dashboard**.

To make someone else an admin later, run the same line with their email. They need to sign up first.

## Step 10: Install it on your phone and test (5 min)

1. **Android:** open the site in Chrome, tap ⋮, then **Install app** (or use the **Download the app** button).
   **iPhone:** open it in Safari, tap **Share**, then **Add to Home Screen**.
2. Open Scrooolls **from the home-screen icon**, log in, and tap **Turn on** in the yellow bar to allow notifications. On iPhone, this only works from the home-screen icon.
3. On your computer, open the dashboard, go to **New story**, and publish a test story.
4. Your phone should get a notification within a few seconds. Tap it, and the story opens first in the feed.

You're live!

---

## Step 11 (whenever you're ready): Use your own domain

1. Buy `scrooolls.com` (or `.app`) from GoDaddy, Namecheap, Hostinger or similar.
2. In Vercel, open your project, then **Settings → Domains**. Add `scrooolls.com` and follow the instructions. They'll show you one or two records to add at the place you bought the domain.
3. Once it shows a green check, update two places with the new address:
   - Supabase **Authentication → URL Configuration → Site URL**: `https://scrooolls.com`
   - The hourly job: in the SQL Editor, run `select cron.unschedule('scrooolls-hourly');`, then run step 8 again with `scrooolls.com`.

---

## Making changes later

When I send you updated files, open your repository on GitHub, click **Add file → Upload files**, drag in the changed files (in the same folders), and click **Commit changes**. Vercel puts the new version online within about 2 minutes. Readers don't need to update anything.

## Good to know

- **The admin can do everything:** publish, schedule, approve or decline contributor stories, approve contributors, send notifications, and edit themes and genres.
- **Contributors** apply in the app (**Discover → Become a contributor**). After you approve them, they write stories from the same dashboard, and their stories wait for your approval.
- **Every new story notifies every reader**, whether an admin published it or approved it. Each reader also gets one morning notification at the time they picked.
- **The feed** shows today's unread stories. When a reader has read them all, they can go back to the previous day's stories.
- **Forgotten passwords** need email sending, which isn't set up yet. Until then, you can delete a user in Supabase (**Authentication → Users**) so they can sign up again. Ask me when you want proper emails added.
- **Vercel's free Hobby plan** is meant for personal and non-commercial projects. If Scrooolls becomes a registered organisation or takes money, check whether you need their paid plan.
