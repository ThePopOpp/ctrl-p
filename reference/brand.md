# controlp.io — Brand & Design Reference

This file is the authoritative source for all design tokens, typography rules, and styling patterns used across the controlp.io application.

The HTML mockups in `mockups/` are the visual reference. This document is the values reference — when the two agree, follow them. If they disagree, follow this file and flag the discrepancy.

---

## Color tokens

### Light theme (storefront + customer account)

```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --accent: 240 4.8% 95.9%;
  --accent-foreground: 240 5.9% 10%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 240 5.9% 10%;
  --radius: 0.625rem;
}
```

### Dark theme (super-admin only)

```css
.admin {
  --bg: #0a0d12;
  --panel: #11161d;
  --panel-2: #151b23;
  --border: #1f2833;
  --border-soft: #161c25;
  --text: #e6edf5;
  --text-dim: #9aa7b8;
  --text-dimmer: #6a7586;
  --accent: #3b82f6;
  --accent-2: #0ea5e9;
  --gold: #d4a84b;
}
```

### Status colors (both themes)

Used for order statuses, alerts, and feedback:

- **Success / delivered:** `#10b981` (emerald-500)
- **Warning / proof pending:** `#f59e0b` (amber-500)
- **Info / shipped:** `#3b82f6` (blue-500)
- **Error / overdue:** `#ef4444` (red-500)
- **Neutral / new:** `#71717a` (zinc-500)

---

## Typography

### Font loading

Two Google Fonts, loaded via `next/font`:

```typescript
// app/fonts.ts
import { Inter, Geist } from 'next/font/google';

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
});

export const geist = Geist({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '800'],
});
```

### Usage rules

- **Inter** is the body font. Applied by default to `<body>` via CSS: `font-family: var(--font-sans), system-ui, sans-serif;`
- **Geist** is for display — headings, hero text, numeric stats, price amounts. Applied via the `.font-display` class.
- **Geist always uses `letter-spacing: -0.02em`.** This is non-negotiable. It's what makes the display type feel tight and editorial.

### Utility class

```css
.font-display {
  font-family: var(--font-display), 'Inter', system-ui, sans-serif;
  letter-spacing: -0.02em;
}
```

### Type scale (used in mockups)

| Use                     | Class or size | Weight |
|-------------------------|---------------|--------|
| Hero headline           | text-[56px]   | 700    |
| H1 page title           | text-[44–48px] | 700  |
| H2 section heading      | text-[32–36px] | 700  |
| H3 subsection           | text-[22–24px] | 700  |
| Card title              | text-[16–18px] | 600  |
| Body                    | text-[14–15px] | 400  |
| Small / label           | text-[12–13px] | 500  |
| Micro (uppercase meta)  | text-[11px], uppercase, tracking-wider | 600 |

---

## Icons

### Rule: Lucide React only. No emojis. Ever.

Install: `lucide-react`

Import per-icon only — never the whole library:

```typescript
// ✅ Correct
import { ShoppingCart, User, Search } from 'lucide-react';

// ❌ Wrong — bloats the bundle
import * as Icons from 'lucide-react';
```

### Sizes

Match the stroke-widths and sizing used in the mockups:

| Context                      | Size  | Stroke |
|------------------------------|-------|--------|
| Inline in body text (`.icon-sm`) | 14px | 2 |
| Default UI icons (`.icon`)       | 16px | 2 |
| Buttons, menus (`.icon-lg`)      | 20px | 2 |
| Feature cards (`.icon-display`)  | 40–64px | 1.2–1.5 |
| Hero illustrations (`.icon-display-xl`) | 100–180px | 0.8–1 |

Thinner strokes on bigger icons — it's what gives the line-icon aesthetic its elegance.

---

## Spacing & layout

- **Container max-width:** `1400px` for marketing pages, `1200px` for account/admin inner content
- **Card border radius:** `0.625rem` (from `--radius` token, or use Tailwind's `rounded-md`)
- **Button border radius:** `calc(var(--radius) - 2px)` — slightly tighter than cards
- **Page horizontal padding:** `px-6` (24px) on mobile/tablet, applied at container level

---

## Component patterns

### Buttons

Three variants, three sizes — exactly matching the mockups:

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;
  border-radius: calc(var(--radius) - 2px);
  font-weight: 500;
  transition: all 0.15s;
  cursor: pointer;
}

.btn-primary  { background: hsl(var(--primary)); color: white; padding: 10px 20px; font-size: 14px; }
.btn-outline  { border: 1px solid hsl(var(--border)); background: transparent; padding: 10px 20px; font-size: 14px; }
.btn-ghost    { background: transparent; padding: 8px 12px; font-size: 14px; }

.btn-sm       { padding: 6px 12px; font-size: 13px; }
.btn-lg       { padding: 13px 26px; font-size: 15px; }
```

### Cards

```css
.card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  transition: all 0.2s;
}

.card-hover:hover {
  border-color: hsl(240 5.9% 65%);
  transform: translateY(-2px);
  box-shadow: 0 10px 30px -12px rgba(0,0,0,0.08);
}
```

### Product image placeholders

Every product card and configurator image uses a consistent gradient-on-gradient placeholder with a centered line icon. Never use actual product photos in the UI code — load those from Supabase Storage URLs instead.

```css
.product-img {
  background: linear-gradient(135deg, hsl(240 4.8% 95.9%) 0%, hsl(240 4.8% 98%) 100%);
  position: relative;
  overflow: hidden;
  color: hsl(240 3.8% 60%);
}

.product-img::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5) 0%, transparent 50%);
  pointer-events: none;
}
```

### Badges

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 500;
}
```

Color variants for status badges follow the status colors above — use Tailwind classes like `bg-emerald-50 text-emerald-700`, `bg-amber-50 text-amber-700`, etc.

---

## Motion & transitions

- **Default transition:** `transition: all 0.15s;` on buttons and interactive elements
- **Card hover:** `transition: all 0.2s;`
- **Page transitions:** none in v1 — instant navigation feels more reliable for an ecommerce context
- **Loading states:** use skeleton placeholders, not spinners, for content that takes > 300ms

No Framer Motion, no Lottie, no custom animation libraries. If an animation gets more complex than a CSS transition or a single `keyframes` rule, stop and ask before adding a library.

---

## Responsive breakpoints

Tailwind defaults apply:

- `sm:` 640px
- `md:` 768px
- `lg:` 1024px
- `xl:` 1280px
- `2xl:` 1536px

**Mobile-first.** Write base styles for mobile, add breakpoint modifiers for larger screens. The mockups are desktop-first (`1400px` container) but every page must work cleanly on a 375px iPhone.

---

## Accessibility baseline

- **Color contrast:** body text ≥ 4.5:1, large text ≥ 3:1
- **Focus rings:** every interactive element must have a visible focus state. Use `focus-visible:ring-2 ring-zinc-900 ring-offset-2`.
- **Form labels:** always paired with inputs via `<label htmlFor>` or by wrapping
- **Alt text:** every `<img>` and `<Image>` needs alt text. Decorative images use `alt=""`.
- **Keyboard navigation:** every drawer, modal, dropdown, and menu must be operable with Tab + Enter + Escape.
- **ARIA:** use native HTML semantics first. Only add ARIA when there's no semantic alternative.

---

## Do-not list

Things that would break the design language:

- ❌ No emojis in any UI text or icon position
- ❌ No stock photo imagery — use Supabase-hosted original photography or line-icon placeholders
- ❌ No Google Material Icons, Font Awesome, Heroicons, or any icon library other than Lucide
- ❌ No gradient buttons, glassmorphism, or drop shadows beyond the subtle hover state on cards
- ❌ No serif fonts (Geist is a sans display)
- ❌ No font-weight < 400 (too thin for readability at our sizes)
- ❌ No pure black (`#000`) — use the zinc-950 (`#09090b`) or the `--foreground` token
- ❌ No pure white on light backgrounds for text — use the `--foreground` token
