-- =====================================================================
-- Scrooolls hourly job
-- Run this AFTER your website is live (guide step 7).
-- Replace the two placeholders below before running:
--   YOUR-SITE-ADDRESS  → e.g. scrooolls.com  (or scrooolls.vercel.app)
--   YOUR-CRON-SECRET   → the CRON_SECRET value from your keys file
-- Every hour it: publishes scheduled stories (and notifies everyone),
-- and sends each reader their morning notification at the time they picked.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'scrooolls-hourly',
  '0 * * * *',
  $$
  select net.http_get(
    url := 'https://YOUR-SITE-ADDRESS/api/cron/hourly',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR-CRON-SECRET'),
    timeout_milliseconds := 55000
  );
  $$
);
