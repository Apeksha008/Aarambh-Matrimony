# Aarambh Matrimony

Aarambh is a welcoming matrimony website for people seeking meaningful connections from any background or place. This repository contains the website and the database setup files.

## What works now

- Responsive website and early-access form
- Form submission to the Supabase `launch_interest` table
- Row Level Security so public visitors can submit, but cannot read other sign-ups
- Preview-only mode if Supabase is not configured

## Project folders

- `index.html`, `styles.css`, `app.js` — website
- `supabase-config.js` — Supabase project URL and public publishable key
- `supabase/schema.sql` — early-access table and its access rules
- `CONNECTING-SUPABASE.md` — setup notes

The publishable key is meant for browser code. Never add a Supabase secret or `service_role` key, database password, or real member information to this public repository.

## Current scope

The database connection covers the early-access form only. Member accounts, member profiles, profile photos, matching, messaging, payments, and moderation tools are not connected yet.

Before collecting real member information, publish a privacy notice and contact details, and add spam protection. The current form is intended for the early-access list.
