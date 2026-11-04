# SOMA SMART

SOMA SMART is a free digital library for secondary school students in Tanzania. Students can browse and search published learning materials, preview PDFs and download resources. Administrators can sign in to upload, publish, unpublish and remove resources.

## Features

- Responsive home page, library, resource detail, about and contact pages.
- Database-backed categories, subjects, search, filters, sorting and pagination.
- Published-only public resource access and private document storage.
- PDF previews and free document downloads with download counts.
- Administrator sign-in, resource upload/replacement, cover-image management, publishing, deletion and taxonomy controls.
- Contact-message and resource-report inboxes, account-role management and administrator profile settings.
- Supabase PostgreSQL migrations, seed data, Row Level Security and storage policies.

## Technology

- React, TypeScript, Vite and React Router
- Supabase Authentication, PostgreSQL and Storage
- Lucide React icons

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- A Supabase project

## Local setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using your Supabase project's project URL and publishable/anon key.
4. Apply the SQL migration in `supabase/migrations/202611040001_initial_schema.sql` using the Supabase SQL editor or Supabase CLI.
5. Start the development server: `npm run dev`

The public pages render without Supabase credentials, but live library data and administrator features remain unavailable until configured. The service-role key must never be placed in frontend environment variables.
Set `VITE_CONTACT_EMAIL` to an official support address to enable the contact link; it is optional.

## First administrator

1. In Supabase Authentication, create the first user from the Supabase dashboard. Public user registration is not part of this application.
2. Find that user's UUID in Authentication → Users.
3. In the SQL editor, grant the role to that specific account:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = 'AUTH_USER_UUID';
   ```

4. Sign in at `/admin/login`.

The auth trigger creates new profile rows with the non-privileged `student` role. Only an existing administrator can alter roles through policies.

## Storage and access

- The migration creates private `documents` and `covers` buckets with 50 MiB and 5 MiB limits, respectively.
- Resource documents and cover images are stored outside PostgreSQL. Signed file and image URLs are short-lived.
- Public database reads and file reads are limited to published resources. Drafts and all write operations require the administrator role.
- Contact messages and resource reports are rate-limited using client IP headers supplied by the Supabase API gateway. Confirm that `cf-connecting-ip` or `x-real-ip` is available in your deployment; submissions fail explicitly when the source cannot be verified.
- PDFs are rendered with PDF.js using page navigation and zoom controls; DOCX and PPTX files are offered as downloads.
- Browser signature checks complement, but do not replace, server-side storage policies. For a public production deployment requiring malware scanning or deeper document-signature inspection, put uploads behind a trusted server/edge function.

## Commands

- `npm run dev` — local development
- `npm run build` — TypeScript project build and production bundle
- `npm run lint` — Oxlint
- `npm run preview` — preview the production bundle locally

## Deployment

1. Deploy the Vite app to Vercel with the repository's build command `npm run build` and output directory `dist`.
2. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel's environment settings.
3. Apply the migration to the production Supabase project and create the initial administrator.
4. Add the deployed domain to Supabase Authentication's allowed redirect URLs.
5. Configure a custom domain in Vercel if needed.

The frontend uses only the Supabase publishable/anon key. Row Level Security and Storage policies are the authorization boundary; never expose a Supabase service-role key.
# soma-smart
