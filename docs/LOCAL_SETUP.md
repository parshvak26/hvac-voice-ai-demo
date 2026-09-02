# Local setup

Local mode is safe. It uses fake verification, memory storage, and a mock call provider. It does not dial a phone.

## Start the website

1. Open Terminal.
2. Go to the project:

   ```bash
   cd /Users/mac/Desktop/Git/Retell
   ```

3. Install the project:

   ```bash
   npm install
   ```

4. Start the website:

   ```bash
   npm run dev
   ```

5. Open the local address shown in Terminal.

## Start the local Worker

1. Keep the website running.
2. Open a second Terminal window.
3. Go to the project:

   ```bash
   cd /Users/mac/Desktop/Git/Retell
   ```

4. Start the Worker:

   ```bash
   npm run dev:worker
   ```

The Worker runs at `http://localhost:8787`.

## Use the full local API flow

This still does not make a real call.

1. Copy the website settings file:

   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```

2. Open `apps/web/.env.local`.
3. Set:

   ```text
   VITE_DEMO_API_URL=http://localhost:8787
   ```

4. Restart the website.

Delete `apps/web/.env.local` to return to the browser-only mock.

## Check the code

Run these one at a time:

```bash
npm run lint
npm test
npm run build
```
