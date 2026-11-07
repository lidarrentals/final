# lidar.rentals Knowledge Base (login-protected)

A static page that only shows content after a Supabase login. The articles are **not** in this repo: they live in a private Supabase Storage bucket that only signed-in users can read. That is what keeps them hidden. The page itself is just a login form until someone signs in.

```
site/        The page. Deploy this folder (GitHub Pages workflow included), or copy it into your existing site as /kb/
content/     The articles (manifest.json + img/). Upload to Supabase. Git-ignored, so it never lands in GitHub.
supabase/    setup.sql: private bucket + access policy
scripts/     upload.mjs: pushes content/ to Supabase
```

## Setup

**1. Supabase**
1. Open your project → SQL Editor → paste and run `supabase/setup.sql`.
2. Authentication → Sign In / Providers → turn **off** "Allow new users to sign up".
3. Authentication → Users → **Invite user** for each person who should have access.
4. Authentication → URL Configuration → add the final page address (for example `https://yourname.github.io/your-repo/`) to **Redirect URLs**. This is needed for the email sign-in link.

**2. Upload the articles** (needs Node 18+; the service key stays on your computer)
```
SUPABASE_URL=https://YOUR-REF.supabase.co SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-KEY node scripts/upload.mjs
```
Find both under Project Settings → API. Never put the service_role key in the repo or in `site/`.

**3. Point the page at your project**: edit `site/config.js` with your project URL and the **anon** key (safe to commit).

**4. GitHub**
- New repo: push this folder, then Settings → Pages → Source: **GitHub Actions**. The included workflow publishes `site/`.
- Existing site: copy `site/` into your repo as `kb/` and link to it from nowhere. Same Supabase project and same origin means visitors already signed in on your site are signed in here too.
- GitHub Pages on a private repo needs a paid plan. Vercel, Netlify and Cloudflare Pages work with the `site/` folder as-is.

## How it stays hidden
- The page has `noindex` and a `robots.txt` that disallows crawling, and nothing links to it.
- Without a session, the bucket returns nothing: articles and images are fetched with the visitor's login token and are never in the repo or the page source.
- Don't rely on the URL being secret. The login and the private bucket are the protection.
- To restrict to specific customers instead of every invited user, use Option B in `setup.sql`.

## Updating content
Replace files in `content/` and run the upload command again.

## Notes
- Articles are page images (the source PDFs had no text layer), with OCR text used for search.
- Documentation content is © Exyn Technologies; make sure you have permission to republish it.
