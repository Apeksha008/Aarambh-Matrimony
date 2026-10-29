# Connect the Aarambh website to Supabase

This starter connection sends only the early-access form fields to a `launch_interest` table. It does not yet create member accounts, member profiles, photo uploads, matching, messaging, or payments.

## 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com/). Choose a region that makes sense for your first users and review the project's data-location and privacy terms before collecting real member information.

## 2. Create the table safely

In the Supabase dashboard, open **SQL Editor**, paste and run `supabase/schema.sql`. This creates the early-access table with Row Level Security enabled. Visitors can submit the form but cannot read other people's entries.

## 3. Add the public project settings

Open **Project Settings → API Keys** and copy the Project URL and the **publishable key**. Add those values to `supabase-config.js`:

```js
window.AARAMBH_SUPABASE = {
  url: 'https://YOUR-PROJECT.supabase.co',
  publishableKey: 'sb_publishable_...',
};
```

The publishable key is intended for browser code. Never put a `service_role` or secret key in website files. The database's Row Level Security policies must remain enabled; Supabase explains the [browser-key and RLS model](https://supabase.com/docs/guides/getting-started/api-keys).

## 4. Serve the site over HTTP

Open the website through a local web server or deploy it to a host. A `file:///` page may not load the Supabase client correctly. The form detects whether Supabase is configured: without keys it saves a preview entry in this browser; with the URL and publishable key it submits to the database.

## 5. Before accepting real sign-ups

- Replace the preview privacy copy with a real privacy notice and support contact.
- Add bot protection and rate limiting, preferably through a Supabase Edge Function.
- Review the table's RLS policy in the Supabase dashboard.
- Test with dummy details first; do not collect real member data until you have reviewed the privacy and safety setup.

## Next database phase

After the launch list works, add authentication and member profiles. Keep profile fields, contact details, verification records, and private photos in separate access-controlled areas. Then add mutual-interest requests, paid membership entitlements, reporting/blocking, and an admin review queue. Do not expose identity documents or private contact information in public profile queries.
