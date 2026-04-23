# controlp.io — Rebuild

You are Cowork, building a production Next.js ecommerce + operations platform for **controlp.io** — a Chandler, Arizona print, signs, and vehicle wrap shop owned by Jeremy Waters (Qallus LLC).

---

## Read these files first, in this order. Do not skip.

1. **`BUILD_PROMPT.md`** — authoritative build plan, tech stack, 4 phases, and gating rules
2. **`reference/brand.md`** — design tokens, fonts, colors, icon rules
3. **`reference/vendors.md`** — how to integrate 4Over and B2Sign
4. **`reference/pricing-strategy.md`** — margin rules and pricing engine spec
5. **`reference/env.example`** — every environment variable you'll need
6. **`mockups/`** — 19 HTML mockups, numbered in intended build order

Do not write code before reading all of the above.

---

## Hard rules

- **Follow the 4 phases and 4 gates in `BUILD_PROMPT.md` exactly.** Stop at each gate and wait for my approval before proceeding.
- **The tech stack is locked.** Do not substitute libraries. No Framer Motion, Zustand, TanStack Query, React Hook Form, or other dependencies unless I explicitly approve.
- **Match the mockups.** They are the design source of truth. Do not invent UI.
- **No emojis in the UI.** Use Lucide React icons only.
- **Ship quality over speed.** One correct page beats three rushed ones.

---

## Mockup note

The HTML mockups in `mockups/` use Tailwind CSS via CDN (`<script src="https://cdn.tailwindcss.com">`) for visual preview only. **The production build must use Tailwind v4 via PostCSS** — not the CDN. Port the design tokens and component patterns, not the delivery mechanism.

---

## Mockup index

| # | File | Purpose |
|---|---|---|
| 01 | `home.html` | Marketing homepage with Tesla wraps section |
| 02 | `shop.html` | Collection/browse with sidebar filters |
| 03 | `product.html` | Product detail with configurator + live pricing |
| 04 | `templates.html` | Template marketplace |
| 05 | `about.html` | About us / team / story |
| 06 | `contact.html` | Contact form + map |
| 07 | `faq.html` | Searchable FAQ with category accordions |
| 08 | `blog-archive.html` | Blog index with category filter |
| 09 | `blog-post.html` | Single article with TOC sidebar |
| 10 | `cart.html` | Shopping cart with promo codes |
| 11 | `checkout.html` | Multi-step checkout |
| 12 | `thankyou.html` | Order confirmation + timeline |
| 13 | `customer-dashboard.html` | Logged-in customer account (light theme) |
| 14 | `admin.html` | Super-admin dashboard (dark theme) |
| — | `auth/login.html` | Sign in with split-screen layout |
| — | `auth/register.html` | Create account |
| — | `auth/forgot-password.html` | Request password reset |
| — | `auth/reset-password.html` | Set new password |
| — | `auth/logout.html` | Logout confirmation with redirect |

---

## Start here

Produce the **Phase 1 self-check summary** using the template in `BUILD_PROMPT.md` (under "Self-check format"). Do not write any code yet. Wait for my "go" before proceeding.

---

## Context about me

- I'm Jeremy Waters, CTO. My dev firm is Qallus LLC.
- I prefer practical over over-engineered. Direct DB queries over ORM abstractions when troubleshooting.
- I use WP Codebox, Bricks Builder, WS Form, JetEngine, Fluent CRM on other projects — but this project is Next.js, not WordPress.
- I deploy on Coolify on my Hostinger VPS (31.97.12.201). Supabase is self-hosted at supabase.cueallus.com.
- When in doubt, ask. I'd rather answer a clarifying question than rewrite your work.
