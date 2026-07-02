# AGENTS.md

This file gives coding agents the working rules for this repository. Follow it before making changes.

## Project

Henguren Toolbox v3 is a Next.js App Router + TypeScript rewrite of the older Vue toolbox. It is a normal learning toolbox, not a cloud console. The current `main` branch is v3.0.0; the historical Vue version is preserved on the `v2` branch.

Core goals:

- Keep Chinese and English learning tools usable locally.
- Use Material Design 3 via Material Web and local Material icon fonts.
- Keep wrongbook data local-first, with explicit cloud sync after login.
- Use LSCube OAuth for login and Cloudflare R2 for JSON snapshot storage.

## Do Not Read

- Do not inspect `node_modules`, `.next`, generated caches, or build output unless diagnosing dependency/build internals.
- Prefer `rg --files -g "!node_modules/**" -g "!.next/**"` for file discovery.

## Stack

- Package manager: `pnpm`.
- Framework: Next.js 16 App Router.
- React: React 19.
- UI: official `@material/web` custom elements plus project CSS in `src/app/globals.css`.
- Icons: local `@fontsource-variable/material-symbols-rounded` with the Material Symbols `FILL` axis for state changes.
- Color: `@material/material-color-utilities`.
- Storage: browser IndexedDB/localStorage/Cache Storage locally; Cloudflare R2 via AWS S3 client on server routes.

## Important Paths

- `src/app/layout.tsx`: root layout, theme provider, service worker registration, app shell.
- `src/app/components/AppShell.tsx`: rail, footer, shell-less onboarding route handling.
- `src/app/components/ThemePicker.tsx`: shared MD3 theme picker, Pride Color picker, HCT custom color dialog, color mode selector.
- `src/app/onboarding/`: first-use full-screen onboarding route.
- `src/app/settings/`: settings page.
- `src/app/user/`: login state and cloud sync UI.
- `src/app/vocab/`: vocabulary test and wrongbook UI.
- `src/lib/client-wrongbook.ts`: local IndexedDB wrongbook operations.
- `src/lib/client-sync.ts`: client wrongbook cloud sync operations.
- `src/lib/r2.ts`: R2 JSON helpers and object key conventions.
- `src/lib/session.ts`: signed session cookie helpers.
- `src/lib/theme-presets.ts`: theme presets and Pride Color definitions.
- `src/assets/js/`: source JSON data for vocabulary, text, shici, and wenchang.
- `public/sw.js`: custom service worker for app shell and data caching.

## Commands

Use these commands for validation:

```bash
pnpm run lint
pnpm run typecheck
pnpm run build
```

Development:

```bash
pnpm dev
```

Dependency changes:

```bash
pnpm install --no-frozen-lockfile
```

When running `pnpm install` or adding dependencies in this environment, request network permission first.

## Environment

Copy `.env.example` to local env and configure:

- OAuth: `OAUTH_AUTHORIZE_URL`, `OAUTH_TOKEN_URL`, `OAUTH_USERINFO_URL`, `OAUTH_CLIENT_ID`, optional `OAUTH_CLIENT_SECRET`, optional `OAUTH_CLIENT_AUTH_METHOD`, `OAUTH_REDIRECT_URI`, `OAUTH_SCOPE`.
- Session: `SESSION_SECRET`.
- R2: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.

OAuth uses PKCE S256. `/api/auth/login` supports a safe same-site `returnTo`; callback clears temporary OAuth cookies.

## Data And Sync Rules

- Do not add a database for v3.0.0 unless explicitly requested.
- Wrongbook cloud sync stores whole JSON snapshots in R2.
- Current R2 paths:
  - `wrongbooks/{userId}/current.json`
  - `wrongbooks/{userId}/backups/{timestamp}.json`
  - `settings/{userId}/current.json`
- Cloud sync must remain explicit. Do not automatically overwrite local or cloud data.
- Offline mode must keep local learning tools usable and show cloud sync as unavailable/offline.
- Secrets must only be read in server-side code or route handlers. Never expose R2 or OAuth secrets to client bundles.

## UI Rules

- Use Material Web custom elements for controls where practical.
- Keep complex layout, cards, rail, footer, tables, and print layout in project CSS.
- Do not reintroduce MUI/Emotion.
- Preserve the product tone: learning toolbox, not cloud platform/account admin console.
- Rail behavior:
  - Icon state layer is `56px x 32px`.
  - Hover range matches selected range.
  - Hover must not make icons bold.
  - Rail labels are 12px.
  - Selected rail item uses Material Symbols `FILL 1`; unselected uses `FILL 0`.
  - If not logged in, do not render a user avatar image; use the person icon fallback.
- Onboarding:
  - `/onboarding` is a full-screen shell-less route.
  - First use redirects there until `henguren-v3-onboarding.completed === true`.
  - Login may be skipped only after the user explicitly chooses to skip.
  - Theme appearance includes seed color, Pride Color, custom HCT color, and color mode.
  - Default color mode is `system`.

## Frontend State

Known localStorage/sessionStorage keys:

- `henguren-v3-settings`: `ToolboxSettings`.
- `henguren-v3-edition`: `"junior" | "senior"`.
- `henguren-v3-onboarding`: onboarding completion state.
- `henguren-v3-onboarding-step`: current onboarding step.
- `henguren-v3-dev-sync-source`: developer-mode custom R2 sync source; contains browser-stored credentials and must never be uploaded to cloud settings.

Settings are local-first. Upload to cloud only through explicit settings sync.

## PWA / Offline

- Custom service worker is in `public/sw.js`.
- Do not replace it with `next-pwa` unless explicitly requested.
- App shell routes and static assets are cached.
- `/api/auth/*`, `/api/me`, and wrongbook cloud APIs should not be cached.
- Vocab JSON may be cached manually or automatically when selected for testing/printing.

## Coding Rules

- Prefer small Client Components for browser-heavy interactions.
- Browser APIs (`localStorage`, `indexedDB`, `caches`, `window`) must stay in Client Components or client-only modules.
- Route Handlers are the place for OAuth, sessions, R2 reads/writes, and data file serving.
- Keep JSON data formats compatible with existing vocabulary/wrongbook imports where possible.
- Do not use `dangerouslySetInnerHTML` for shici highlighting; keep the safe React-node rendering model.
- Avoid invalid HTML nesting, especially nested buttons/links and nested `<main>`.
- `AppShell` owns the main landmark except shell-less routes such as `/onboarding`.
- If `next build` rewrites `next-env.d.ts` from `.next/dev/types/routes.d.ts` to `.next/types/routes.d.ts`, do not commit that generated side effect unless intentionally changing build artifacts.

## Git And Validation

- The working tree may be dirty. Do not revert unrelated user changes.
- Before finishing substantial changes, run:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run build`
- After `next build`, check `git status --short` and restore unintended generated-file changes if needed.
- Do not push unless explicitly asked.
