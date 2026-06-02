# SmartLibrary Content Engine

SmartLibrary Content Engine now contains two deployable surfaces:

1. **Existing Vite/React web preview** at the repository root, used by Vercel.
2. **Whop React Native app** in [`whop-native/`](./whop-native), used for native Whop iOS/Android/web app builds.

## Why the Whop React Native folder was added

The original Google Stitch / AI Studio output was a React DOM web app. That can render in a browser, but it is not a Whop React Native build and it does not export Whop-native views like `ExperienceView` or `DashboardView`.

Whop React Native apps are uploaded to Whop as app builds. Vercel should be used as your API/server origin, not as the native mobile frontend.

## Web/Vercel preview and API

```bash
npm install
npm run dev
npm run build
```

The Vercel SPA fallback is configured in [`vercel.json`](./vercel.json).

Serverless API routes were added for the Whop native app:

```txt
api/ingest.ts      Fetches and extracts readable text from links.
api/transform.ts   Generates SmartLibrary outputs from retrieved source excerpts.
```

For AI-enhanced generation, set one of these environment variables in Vercel:

```env
GEMINI_API_KEY="..."
```

If no Gemini key is configured, the API returns a deterministic grounded fallback so the app remains usable.

## Whop React Native app

The native app lives in:

```txt
whop-native/
```

It includes:

```txt
whop-native/src/views/experience-view.tsx
whop-native/src/views/dashboard-view.tsx
whop-native/src/views/discover-view.tsx
```

### Requirements

- Node.js 22+
- pnpm 9.15+ recommended by Whop
- Whop developer app credentials from <https://whop.com/dashboard/developer>

### Install

```bash
cd whop-native
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install
cp .env.example .env.local
```

Fill `.env.local`:

```env
WHOP_API_KEY="..."
NEXT_PUBLIC_WHOP_APP_ID="app_..."
NEXT_PUBLIC_WHOP_AGENT_USER_ID="user_..."
NEXT_PUBLIC_WHOP_COMPANY_ID="biz_..."
```

### Build and upload a development build

```bash
pnpm ship
```

Preview it on your phone:

```bash
pnpm preview
```

In the Whop mobile app, shake your phone to enable dev mode so development builds become visible.

### Promote to production

1. Test the dev build inside the Whop mobile app.
2. Go to Whop Developer Dashboard → your app → Builds.
3. Promote the tested build to production.

## Root helper scripts

From the repo root you can also run:

```bash
npm run whop:install
npm run whop:typecheck
npm run whop:build
npm run whop:ship
npm run whop:preview
```

## Important Whop dashboard URL checklist

The Cloudflare `Error 1003: Direct IP access not allowed` is usually caused by using an IP address instead of a real hostname.

In Whop Developer Dashboard:

- Do **not** paste any Cloudflare/Vercel IP address.
- Use only a hostname such as:

```txt
https://smartlibrary-content-engine.vercel.app
```

- If using React Native, upload builds with `pnpm ship` from `whop-native/`.
- If using Vercel, use it for API routes/server calls. Do not expect a Vercel-hosted React DOM app to become a Whop React Native mobile app automatically.

## Original AI Studio reference

Original AI Studio app link:

<https://ai.studio/apps/d61376d0-48d0-4753-a97e-54b671598022>
