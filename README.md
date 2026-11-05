# BlinkID + Angular — proof of concept

A minimal Angular 22 app that scans an ID card or passport with the browser camera
(using Microblink's `@microblink/blinkid` SDK) and fills a registration form automatically.

## Requirements

- Node.js `^22.22.3`, `^24.15.0` or `>=26` (Angular 22 requirement). With nvm:

  ```sh
  nvm install 26 && nvm use 26
  ```

- [pnpm](https://pnpm.io) 10 (the exact version is pinned in `package.json` under
  `packageManager`). Each Node version in nvm has its own global packages, so install it once
  per Node version:

  ```sh
  npm install -g pnpm@10.34.9
  ```

  (On Node 22/24 you can use `corepack enable` instead. Node 25+ no longer ships Corepack.)

  Use pnpm only. Do not run `npm install` or `yarn` here: the lockfile is `pnpm-lock.yaml`.

## Run it

1. Get a free trial license key: https://developer.microblink.com/register
   (register `localhost` as the domain for development).
2. Create your local license file and paste the key into it:

   ```sh
   cp src/app/blinkid.license.example.ts src/app/blinkid.license.ts
   ```

   `blinkid.license.ts` is git-ignored, so the key is never committed.
3. Install and start:

   ```sh
   pnpm install
   pnpm start         # http://localhost:4200
   ```

4. Click **Scan ID with camera**, allow camera access, and hold a document in front of it.
   The form below fills in by itself; every field stays editable.

### Other commands

```sh
pnpm build         # production build in dist/
pnpm watch         # development build, rebuilt on change
pnpm test          # unit tests (Vitest)
pnpm ng <command>  # any Angular CLI command, e.g. `pnpm ng generate component foo`
pnpm add <pkg>     # add a dependency (use -D for a dev dependency)
```

### pnpm notes

- **Build scripts.** pnpm 10 does not run dependency install scripts unless they are allowed.
  The ones the Angular build needs (`esbuild`, `@parcel/watcher`, `lmdb`, `msgpackr-extract`)
  are listed in `pnpm.onlyBuiltDependencies` in `package.json`. If a new dependency needs its
  install script, add it there (or run `pnpm approve-builds`).
- **Symlinked `node_modules`.** pnpm stores packages in `node_modules/.pnpm` and symlinks them.
  The `angular.json` asset path `node_modules/@microblink/blinkid/dist/resources` follows that
  symlink, so no extra configuration is needed.

## What's where

| File | Purpose |
| --- | --- |
| `src/app/id-scanner/id-scanner.ts` | Reusable standalone component. Lazy-loads the SDK, mounts the camera UI, emits a `scanned` event with a flat `ScannedId` object, and cleans up (camera, worker, Wasm) on destroy. |
| `src/app/app.ts` / `app.html` | Demo page: an onboarding form that is filled from the `scanned` event. |
| `src/app/blinkid.config.ts` | Re-exports the license key from the git-ignored `blinkid.license.ts` (template: `blinkid.license.example.ts`). |
| `angular.json` | Copies the SDK's Wasm/worker files to `/resources`, and adds the cross-origin isolation headers to the dev server. |

To reuse the scanner in another app, copy the `id-scanner` folder and use:

```html
<app-id-scanner (scanned)="onScanned($event)" />
```

## Integration notes (the things that bite)

- **`/resources` folder.** The SDK downloads its Wasm and worker files at runtime from a folder
  that must be named exactly `resources`. `angular.json` copies it from
  `node_modules/@microblink/blinkid/dist/resources`. The folder is ~150 MB on disk because it
  contains several build variants, but a browser only downloads one of them.
- **`resourcesLocation`** is set explicitly to the app's base URL. The SDK default is the current
  page URL, which breaks on nested routes like `/onboarding/step-2`.
- **HTTPS.** Camera access only works on HTTPS or `localhost`.
- **Cross-origin isolation.** With these headers the browser uses the faster multi-threaded
  Wasm build; without them the SDK falls back to the single-threaded build automatically.
  Production servers need them too:

  ```http
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  ```

  Note: `require-corp` blocks third-party resources (fonts, images, analytics scripts) that are
  not served with CORP/CORS headers, so check the rest of the app before enabling it.
- **Lazy loading.** The SDK JS (~615 kB, ~140 kB gzipped) is a separate chunk that only loads
  when the user starts a scan, so it does not slow down app start.
- **Browser support.** Chrome/Edge 96+, Safari 16.4+ (macOS and iOS), Firefox 132+ desktop.
  Firefox for Android is not supported for camera scanning.
- **Pin the version.** `package.json` uses `~` so minor upgrades are a deliberate choice;
  read the SDK changelog before upgrading.
- **Text in several alphabets.** BlinkID returns each text field per alphabet
  (latin / arabic / cyrillic / greek). The component prefers Latin and falls back to Arabic;
  adjust `text()` in `id-scanner.ts` if you need the Arabic values specifically.

## Production / KYC

This scan runs entirely on the user's device. That is fine for auto-filling a form, but if the
result is used for identity verification (KYC), do not trust data coming from the client.
Use Microblink's server-side option (BlinkID Cloud API or Self-hosted API) to extract and verify
the document on your backend.
