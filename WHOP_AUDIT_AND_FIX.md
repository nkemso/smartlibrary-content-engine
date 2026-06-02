# SmartLibrary Content Engine — Whop audit and fix

Audit/fix date: 2026-06-02

## Summary

The deployed Vercel app is a working Vite/React web app, but it is not a Whop React Native app. To support Whop mobile/native app builds, this repo now includes a Whop React Native project in [`whop-native/`](./whop-native).

## Findings

### 1. Vercel root URL works

`https://smartlibrary-content-engine.vercel.app/` returns HTTP 200 and serves the Vite web app.

Deep SPA paths such as these also return the SPA shell:

- `/experiences/exp_test`
- `/dashboard/biz_test`

### 2. The original app was React DOM/Vite, not Whop React Native

The original app used:

- `src/main.tsx`
- `src/App.tsx`
- React DOM via `createRoot(...)`
- browser DOM elements such as `div`, `header`, `button`, `input`
- Tailwind/CSS web styling

That app can run as a browser/Vercel app, but it cannot be uploaded as a Whop React Native mobile build.

### 3. Cloudflare Error 1003 likely indicates a Whop URL/config issue

The screenshot showed:

> Error 1003 — Direct IP access not allowed

This usually happens when a request hits a Cloudflare IP address directly instead of a hostname with a valid Host header.

Because the Vercel URL works normally, check the Whop Developer Dashboard for stale/incorrect URLs. Do **not** paste a Cloudflare/Vercel IP address anywhere. Use a hostname only:

```txt
https://smartlibrary-content-engine.vercel.app
```

## Fix applied

### Added Whop React Native app

New folder:

```txt
whop-native/
```

Key files:

```txt
whop-native/package.json
whop-native/.env.example
whop-native/src/views/experience-view.tsx
whop-native/src/views/dashboard-view.tsx
whop-native/src/views/discover-view.tsx
whop-native/src/components/ui.tsx
whop-native/src/lib/whop-host.ts
whop-native/src/lib/design.ts
```

The Whop RN views export the functions expected by Whop:

```ts
export function ExperienceView(props: ExperienceViewProps) {}
export function DashboardView(props: DashboardViewProps) {}
export function DiscoverView(props: DiscoverViewProps) {}
```

### Added root helper scripts

Root `package.json` now includes:

```json
{
  "whop:install": "npm --prefix whop-native install --legacy-peer-deps",
  "whop:typecheck": "npm --prefix whop-native run typecheck",
  "whop:build": "npm --prefix whop-native run build",
  "whop:ship": "npm --prefix whop-native run ship",
  "whop:preview": "npm --prefix whop-native run preview"
}
```

## Validation performed

From the root project:

```bash
npm install --legacy-peer-deps --ignore-scripts
npm run build
```

Result: Vite web build passed.

For Whop native:

```bash
npm run whop:install
npm run whop:typecheck
cd whop-native
WHOP_API_KEY=dummy NEXT_PUBLIC_WHOP_APP_ID=app_dummy NEXT_PUBLIC_WHOP_AGENT_USER_ID=user_dummy NEXT_PUBLIC_WHOP_COMPANY_ID=biz_dummy npm run build -- --web
```

Result:

- TypeScript check passed.
- Whop React Native web bundle build passed.

Note: The Whop RN tooling requires Node 22+ for production use. This sandbox uses Node 20, so npm prints engine warnings, but the web bundle validation still completed.

## Deployment instructions

### Web/Vercel deployment

The existing Vite app still works:

```bash
npm install
npm run build
```

### Whop React Native deployment

Use Node.js 22+ and pnpm 9.15+ as recommended by Whop:

```bash
cd whop-native
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install
cp .env.example .env.local
```

Fill `.env.local` from the Whop Developer Dashboard:

```env
WHOP_API_KEY="..."
NEXT_PUBLIC_WHOP_APP_ID="app_..."
NEXT_PUBLIC_WHOP_AGENT_USER_ID="user_..."
NEXT_PUBLIC_WHOP_COMPANY_ID="biz_..."
```

Upload a development build:

```bash
pnpm ship
```

Preview on phone:

```bash
pnpm preview
```

Then shake the phone inside the Whop app to enable dev mode.

After testing, promote the build from Whop Developer Dashboard → App → Builds.

## Recommended Whop dashboard settings

- Base URL/API origin: `https://smartlibrary-content-engine.vercel.app`
- Do not use an IP address.
- For React Native, rely on Whop uploaded builds for the mobile frontend.
- Use Vercel only for API routes/server-side AI operations.

## Deployment performed on 2026-06-02

A Whop React Native development build was uploaded for all platforms:

- Web build: `apbu_mcrrwq38aLJaa`
- iOS build: `apbu_SLh5eCpHijNhE`
- Android build: `apbu_z9XOlG1j2duHV`

Supported view types uploaded:

- `dashboard`
- `discover`
- `hub`

Promote/test builds from:

```txt
https://whop.com/dashboard/biz_NmM39BeWPkA2dn/developer/apps/app_CRHI4R4jykDetI/builds/
```

## Future work

- Move Gemini/Google AI calls into server-side API routes only.
- Never expose Gemini or Whop secret keys in client/mobile code.
- Replace placeholder metrics with real API-backed data once access/auth routes are implemented.
