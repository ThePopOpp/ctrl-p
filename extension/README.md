# CTRL+P Product Capture — Chrome extension

Captures a vendor's product page into a CTRL+P Product Card: title, images,
specs and wholesale cost, in one click.

## Why an extension

Capturing from *any* URL means running on pages Control P does not control. A
web app cannot reach into a third-party page — vendor sites send
`X-Frame-Options: DENY` or a CSP `frame-ancestors` directive, which blocks
embedding them in an iframe. There is no workaround worth building.

An extension runs *inside* the page: DOM access, structured-data reads, hover
highlighting, and viewport screenshots. It is the only architecture that
delivers "works on any site".

It also solves authentication for free. Most trade printers show dealer pricing
only to signed-in accounts. The extension borrows the staff member's own live
browser session, so gated cost is visible without the app ever storing a vendor
portal credential. The server-side fallback (`POST /api/capture/url`) cannot see
those prices, and says so in its response rather than returning a silent blank.

## Build and install

```bash
npm run build:extension        # compiles extension/ + lib/capture into extension/dist
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load
unpacked** → select the `extension/` directory.

Chrome 114+ is required for `chrome.sidePanel`.

Add an `icon128.png` to this directory before packing for the Web Store; the
manifest references it and Chrome tolerates it missing when loading unpacked.

## Layout

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest, permission set |
| `panel.html` / `panel.css` | Side panel shell |
| `src/background.ts` | Service worker — screenshots, content-script injection |
| `src/content.ts` | On-page overlay: hover highlight, click-select, drag-region, DOM harvest |
| `src/panel.ts` | Capture + review UI, screenshot cropping, saves the draft |
| `src/messages.ts` | The message contract between all three contexts |
| `src/harvest.d.ts` | Ambient types the content script uses (see below) |
| `src/chrome.d.ts` | Local Chrome API declarations — no `@types/chrome` install needed |

## Permissions, and why each one

- `activeTab` — grants access to the current page **only when the user clicks
  the toolbar icon**. Requesting `<all_urls>` instead would trigger an alarming
  install warning and heavier Web Store review, for no benefit: click-to-activate
  is the intended interaction anyway.
- `scripting` — injects the content script on that click.
- `sidePanel` — hosts the review UI outside the page's DOM, so vendor CSS cannot
  touch it and ours cannot leak into theirs.
- `storage` — panel state between opens.
- `cookies` + `https://controlp.io/*` — lets the panel call
  `GET /api/capture/session` with the staff member's existing Supabase session,
  so nobody signs in twice.

## Shared code, and the one place it cannot be shared

`buildDraft` — the whole Tier 1–2 extraction pipeline — is imported directly
from `lib/capture/extract.ts` and compiled into `dist/lib/capture/extract.js`.
The panel and the web app therefore run *the same code* when deciding what a
price table means. That module's imports are all `import type`, which TypeScript
erases, so it compiles to a standalone browser module with no bundler.

The one exception is `src/content.ts`. It is injected with
`chrome.scripting.executeScript({ files })`, which loads a **classic script** —
any import, even a type-only one, makes TypeScript emit `export {}`, and a
top-level `export` in a classic script is a `SyntaxError` that kills the
injection. So its types are declared ambiently in `src/harvest.d.ts`.

`src/messages.ts` holds two compile-time assignments proving those ambient types
are still assignable to the shared ones. If they drift, `npm run build:extension`
fails there rather than the extension failing quietly in someone's browser.

## Two things that silently produce wrong output if missed

1. **`captureVisibleTab` captures at the device pixel ratio.** The selection rect
   is in CSS pixels. Multiply by `window.devicePixelRatio` before cropping, or
   every capture is offset and mis-sized on any retina display. `crop()` in
   `panel.ts` does this.
2. **MV3 service workers have no DOM**, so no `<canvas>` for cropping. The crop
   happens in the panel, which does have one. The worker only ever returns the
   full viewport shot.

## Scope, deliberately

Single page, staff-initiated, on a page the user is already looking at. There is
no crawler, no link-following, and **no bulk importer** — see
`reference/vendors.md`: 4Over and B2Sign are reseller partners, and those
relationships matter more than a faster catalog.

Captured images are stored as `scraped_reference`, which is fine for internal
reference on a draft and is **blocked from being a published card's featured
image**. Get a dealer asset pack, shoot your own, or obtain written permission
before publishing. Vendor descriptions land in `captured_description` and are
never republished; the card needs a CTRL+P-written one to pass the publish
checklist.

## Swapping the panel to the shared React components

The panel is dependency-free DOM rather than React, because the repo has no
bundler and an extension that loads unpacked from a clean checkout is worth more
than component reuse in one form.

To use the dashboard's `CaptureReviewForm`, `MarkupControl` and `VariantTable`
instead: add a bundler (esbuild or Vite) that emits an IIFE to
`extension/dist/panel.js`, point `panel.html` at it, and replace `render()` in
`src/panel.ts` with a React root. Nothing else changes — the API calls and the
extraction pipeline are already the shared ones.
