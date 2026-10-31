# Arambh website and Supabase

The website has two data flows:

- The public early-access form writes to `public.launch_interest`.
- Member sign-up uses Supabase Auth. A member creates one profile, saves matching preferences, uploads a private profile photo, and may publish a member card.

## Enable member profiles

1. Open the Supabase project used by `supabase-config.js`.
2. In **SQL Editor**, create a new query and paste the full contents of `supabase/member-marketplace.sql`.
3. Review the script and run it once. It is safe to rerun; its policies and triggers are replaced by name.
4. In **Authentication → URL Configuration**, set the site URL to:
   `https://apeksha008.github.io/Aarambh-Matrimony/`
5. Add this redirect URL if email confirmation is enabled:
   `https://apeksha008.github.io/Aarambh-Matrimony/members.html`

The website uses the project's public publishable key in `supabase-config.js`. Never put a `service_role` or secret key in browser code.

## What the member migration creates

- `member_profiles`: one profile per authenticated account, including age, height, gender, marital status, location, education, occupation, optional religion/community, photo path, family background, nature, and partner expectations.
- `member_preferences`: private match filters for age, height, gender, religion/community, location, and education.
- A private `member-photos` storage bucket. Photos can be uploaded by their owner and read by signed-in members only when the owner has published a profile.
- `search_members`: a bounded search function. It returns published profile-card fields only, excludes the signed-in user's profile, never returns email, phone number, or exact birth date, and returns religion/community only when the member opted to display them.

Row Level Security keeps profile and preference rows private to their owner. The search function is the only path for another signed-in member to discover profiles. Religion and community can still be used as filters while staying hidden on cards by default. Phone and email are never included in search results.

Profiles stay private drafts until the member checks the publish consent and publishes. Members can hide their profile at any time. Email confirmation behavior depends on the Supabase Auth settings.

## Current scope

This launches registration, profile creation, photo upload, member-only profile discovery, and filters. It does not yet include chat, contact sharing, interest notifications, paid memberships, identity verification, or admin moderation. Do not collect real member details until you have reviewed the site's privacy notice and Supabase Auth email settings.
