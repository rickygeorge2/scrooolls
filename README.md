# Scrooolls

Scripture, one swipe at a time. A Bible-engagement web app that installs on phones (a PWA), with an admin and contributor dashboard.

- **Launch steps:** see `LAUNCH-GUIDE.md`
- **Built with:** Next.js, Supabase (database, logins, image storage) and web push notifications, hosted on Vercel
- **Database setup:** `supabase/schema.sql`; hourly job: `supabase/cron.sql`

## Pages
- `/`: landing page, or the swipe feed when logged in
- `/login`: log in or create an account
- `/onboarding`: themes, contributors, morning notification time
- `/discover`: contributors, themes, genres and account settings
- `/apply`: apply to become a contributor
- `/dashboard`: admin and contributor dashboard
