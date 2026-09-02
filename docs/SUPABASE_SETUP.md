# Supabase setup for the final testing stage

You do not need Supabase to run the project today. The Worker uses safe in-memory mode by default.

Use these steps only when you are ready to test permanent storage.

## 1. Create a project

Create a Supabase project on the Free plan. Do not paste its keys into chat or source files.

## 2. Apply the migration

Use the Supabase CLI workflow:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_ID
supabase db push --dry-run
supabase db push
```

The migrations are:

`supabase/migrations/20260901000100_create_demo_call_tables.sql`

`supabase/migrations/20260902000100_add_abuse_protection.sql`

`supabase/migrations/20260902000200_add_retell_webhook_events.sql`

Always check the dry-run output before applying the migration.

## 3. Create your local secret file

From the project folder:

```bash
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
```

Open `apps/worker/.dev.vars` and add:

```text
PERSISTENCE_MODE=supabase
SUPABASE_URL=
SUPABASE_SECRET_KEY=
```

After the equals signs, add your project URL and Supabase secret key. Use a secret key, not a browser publishable key. Never put this key in a `VITE_*` value.

## 4. Start the Worker

```bash
npm run dev:worker
```

New mock demo requests will now be written to `demo_requests` and `calls`.

## Security choices

- Row Level Security is enabled on all three tables.
- Browser roles have no table permissions or policies.
- Only the server-side secret key can access these records.
- Public API results never include phone numbers, database IDs, provider call IDs, recording URLs, or disconnection details.
- Webhook event fingerprints are stored for safe replay protection. Raw webhook bodies are not stored.
- Recording URLs are stored privately, but audio files are not copied into Supabase Storage.

## Return to memory mode

Stop the Worker and remove `apps/worker/.dev.vars`. The default in `wrangler.jsonc` will use memory mode again.
