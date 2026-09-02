# Deployment guide

Use this guide only when you are ready to connect the accounts and run the real test.

The website goes to GitHub Pages. The private API goes to a Cloudflare Worker.

## 1. Prepare the external services

Complete these guides first:

1. [Supabase setup](SUPABASE_SETUP.md)
2. [Turnstile and abuse-protection setup](ABUSE_PROTECTION_SETUP.md)
3. [Retell setup](../retell/SETUP.md)

Do not paste any private key into chat, GitHub source files, or a `VITE_*` setting.

## 2. Prepare the production Worker file

1. Open Terminal.
2. Go to the project:

   ```bash
   cd /Users/mac/Desktop/Git/Retell
   ```

3. Copy the safe example:

   ```bash
   cp apps/worker/wrangler.production.example.jsonc apps/worker/wrangler.production.jsonc
   ```

4. Open `apps/worker/wrangler.production.jsonc`.
5. Replace `YOUR_GITHUB_USER` in both places.

`ALLOWED_ORIGINS` must contain only the website origin. For a project page, that is still `https://YOUR_GITHUB_USER.github.io` without the repository path.

## 3. Prepare Worker secrets

1. Go to the Worker folder:

   ```bash
   cd /Users/mac/Desktop/Git/Retell/apps/worker
   ```

2. Sign in to Cloudflare:

   ```bash
   npx wrangler login
   ```

3. Copy the empty secret template:

   ```bash
   cp .prod.secrets.example .prod.secrets
   ```

4. Open `.prod.secrets`.
5. Add each value after its equals sign.
6. Keep this file private. It is ignored by Git.

## 4. Check and deploy the Worker

1. Check the production package:

   ```bash
   npx wrangler deploy --dry-run --config wrangler.production.jsonc --secrets-file .prod.secrets
   ```

2. If that passes, deploy:

   ```bash
   npx wrangler deploy --config wrangler.production.jsonc --secrets-file .prod.secrets
   ```

3. Save the HTTPS Worker address shown by Wrangler.
4. Delete `.prod.secrets` after the deployment succeeds. Cloudflare keeps the encrypted values.
5. Add the Worker address plus `/webhooks/retell` to Retell.
6. Select `call_started`, `call_ended`, and `call_analyzed`.

## 5. Prepare GitHub Pages

The checked-in workflow validates, tests, builds, and deploys the website. It stops before deployment if the public Worker address or Turnstile site key is missing.

1. Create the final GitHub repository.
2. Push this project to its `main` branch.
3. In GitHub, open **Settings → Pages**.
4. Choose **GitHub Actions** as the source.
5. Open **Settings → Secrets and variables → Actions → Variables**.
6. Add `VITE_DEMO_API_URL` with the HTTPS Worker origin. Do not add a path.
7. Add `VITE_TURNSTILE_SITE_KEY` with the public Turnstile site key.
8. Run **Check and deploy website** from the Actions page.

GitHub calculates the repository base path and public social-preview address automatically.

## 6. Finish

Use [the manual test checklist](MANUAL_SETUP_CHECKLIST.md). Do not call Phase A accepted until every live item passes.

The Worker is deployed manually on purpose. This prevents a normal website edit from unexpectedly changing the private calling service.

Official references:

- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Cloudflare Worker deployment](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
