# SmartLibrary Content Engine — Whop React Native build

This folder is a Whop React Native replacement scaffold for the current Vite/React web deployment.

It provides the three Whop-native views expected by the Whop React Native build system:

- `src/views/experience-view.tsx` — member-facing app experience
- `src/views/dashboard-view.tsx` — creator/admin dashboard
- `src/views/discover-view.tsx` — optional marketplace/discovery view

## Why this exists

The currently deployed URL (`https://smartlibrary-content-engine.vercel.app/`) is a static React DOM/Vite website. It is not a Whop React Native app bundle and it does not export Whop RN views. For a native Whop mobile app, you must build and upload a Whop React Native bundle using the `@whop/react-native` CLI.

## Requirements

- Node.js 22+
- pnpm 9.15+
- A Whop developer app with environment variables from <https://whop.com/dashboard/developer>

Check versions:

```bash
node -v
pnpm -v
```

If pnpm is missing:

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
```

## Setup

```bash
cd smartlibrary-whop-react-native
pnpm install
cp .env.example .env.local
```

Fill `.env.local` with the values from the Whop Developer Dashboard:

```env
WHOP_API_KEY="..."
NEXT_PUBLIC_WHOP_APP_ID="app_..."
NEXT_PUBLIC_WHOP_AGENT_USER_ID="user_..."
NEXT_PUBLIC_WHOP_COMPANY_ID="biz_..."
```

## Build and upload development build

```bash
pnpm ship
```

Specific platforms:

```bash
pnpm ship --web
pnpm ship --ios --android
```

Preview on your phone:

```bash
pnpm preview
```

Shake the phone in the Whop app to enable dev mode so development builds are visible.

## Promote to production

1. Test the development build in Whop mobile.
2. Open <https://whop.com/dashboard/developer>.
3. Go to your app → Builds.
4. Promote the tested build to production.

## API / Vercel usage

For Whop React Native, Vercel should be used as your server/API origin, not as the native app frontend. If you need Gemini/Google AI Studio, run it only in a server API route and call it from the RN view using:

```ts
import { __internal_execSync } from "@whop/react-native";

const { apiOrigin } = __internal_execSync("getAppApiOrigin", {});
const result = await fetch(`${apiOrigin}/api/generate`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ prompt: "Summarize this document" }),
});
```

Configure the Whop Developer Dashboard **Base URL** to the domain that hosts those API routes, e.g. `https://smartlibrary-content-engine.vercel.app`.

Do **not** put Google/Gemini API keys inside React Native client code.

## Whop dashboard configuration checklist

For an experience/member app:

- Base URL: your API origin hostname only, e.g. `https://smartlibrary-content-engine.vercel.app`
- Experience View: handled by the uploaded React Native build; for web iframe fallback use `/experiences/[experienceId]`
- Dashboard View: handled by the uploaded React Native build; for web iframe fallback use `/dashboard/[companyId]`
- Do not configure an IP address as a URL anywhere.
- Do not use a Cloudflare IP or copied DNS-resolved IP as a host.

## Files to keep from the old app

If your existing Google Stitch UI has React components, migrate the actual logic/design into these RN files. React DOM-only items must be replaced:

- `<div>`, `<span>`, `<button>` → `View`, `Text`, `Pressable`
- CSS/Tailwind classes → `StyleSheet.create(...)`
- Browser APIs (`window`, `document`, DOM refs) → Whop RN APIs / React Native APIs
- External web fonts/material symbols → text, SVG-compatible assets, or RN-safe icon libraries only
