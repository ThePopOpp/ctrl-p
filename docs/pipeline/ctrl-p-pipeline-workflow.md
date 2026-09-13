# Ctrl+P Sales Pipeline — Workflow & Setup

The Pipeline tracks **potential sales** for print, design, signage, apparel and vehicle-wrap work from first inquiry to a confirmed order. Each **opportunity is one potential job** (a banner run, a fleet wrap, a design package), not a customer's whole relationship. The Pipeline ends at **Closed Won**; fulfillment continues on the linked order through the existing Orders / Production / Artwork / Projects workflow.

Functional reference: Channel Cast `components/crm/pipeline-page.tsx`, `opportunity-detail.tsx`, `lib/crm/deals.ts`, `stage-config.ts`, `pipeline-guidance.ts`, `to-pipeline.ts`. Ctrl+P re-implements that behavior on its own database, auth, permissions and UI — Channel Cast's generic JSON store, demo seeding and dashboard shell were not carried over.

## Where things live

| Area | Location |
|---|---|
| Navigation | `lib/admin/navigation.ts` — **Pipeline** (`/admin/pipeline`) |
| Pipeline page (Board, List, Table, Cards, Calendar) | `app/admin/pipeline/page.tsx` → `components/admin/pipeline/admin-pipeline.tsx` |
| Opportunity workspace | `app/admin/pipeline/[id]/page.tsx` → `components/admin/pipeline/opportunity-workspace.tsx` |
| Stage-change dialog (shared by every view) | `components/admin/pipeline/transition-dialog.tsx` |
| Stage settings editor | `components/admin/pipeline/stage-config-dialog.tsx` |
| Stages, vocabularies | `lib/pipeline/stages.ts` |
| Guidance & checklists | `lib/pipeline/guidance.ts` |
| Transition rules (single source) | `lib/pipeline/transition.ts` |
| Forecast math | `lib/pipeline/forecast.ts` |
| Closed Won → customer + order | `lib/pipeline/conversion.ts` |
| Server access helpers | `lib/pipeline/server.ts`, `lib/pipeline/validation.ts` |
| API | `app/api/admin/pipeline/**` |
| Migration | `supabase/migrations/20260913000001_sales_pipeline.sql` |
| Tests | `lib/pipeline/transition.test.ts`, `lib/pipeline/forecast.test.ts` |

## Stages

Probabilities are **configurable starting values** for the weighted forecast, not measured conversion rates.

| Stage | Default % | Purpose | Required to leave (default checklist) | Entry rule (always enforced) |
|---|---|---|---|---|
| New Inquiry | 10 | Request captured | Salesperson assigned; contact details; project summary or service; next action scheduled | Assigned salesperson |
| Discovery & Specifications | 25 | Confirm the job | ≥1 line item; relevant specs for every line; artwork supplied vs. design confirmed; pickup/shipping/delivery/installation confirmed | — |
| Estimating | 40 | Price in existing quoting (Orders → Quote requested) | Quote linked; costs (materials, design labor, finishing, vendor, shipping, install) accounted for | — |
| Quote Sent | 60 | Quote delivered | Quote marked sent with date; follow-up scheduled | Current quote exists and is marked sent |
| Follow-Up & Revisions | 75 | Questions, revisions, decision | Next action scheduled | Current quote exists and is marked sent |
| Approved / Order Setup | 90 | Customer accepted; set up the order | Accepted quote; billing confirmed; deposit received **or** approved terms | Current quote marked accepted |
| Closed Won | 100 | Sale confirmed | — | Accepted quote; billing confirmed; deposit or terms; linked customer or contact email. Links/creates customer and order |
| Closed Lost | 0 | Will not proceed | — | **Loss reason required** (price, timing, competitor, canceled, no response, unsuitable requirements, budget, other) |
| On Hold / Nurture | 0 | May proceed later | — | **Reason and follow-up date required**. Excluded from the active forecast |

**Specifications are service-aware.** Each service category declares which specs it needs (`SERVICE_CATEGORIES` in `stages.ts`): banners and signage need dimensions with units and material; apparel needs quantity and material; *Graphic Design (design only)* and *Installation Service* need none. Design-only and repeat orders are never forced through print specs.

### Movement rules

- **One transition path.** Board drag-and-drop, the per-card stage menu, list/table stage selects, quick view, and the workspace stage path all call `POST /api/admin/pipeline/opportunities/:id/transition`, which runs `evaluateTransition`. The same rules apply everywhere, including direct API calls.
- **Forward moves** check the required checklist items of the current stage and of every stage jumped over, except **Follow-Up & Revisions, which may be skipped** for a straightforward approval, plus the target's entry rule.
- **Backward moves** between active stages are allowed without checklists.
- **Closed Lost and On Hold** are reachable from any active stage and never require unrelated checklists.
- **Reopening** Closed Won or Closed Lost requires a reason; the previous outcome is recorded in history and cleared from the live record. **Reactivating** On Hold returns to the stage it was held from.
- **Authorized exceptions.** Users with `pipeline.manage` may move past unmet requirements by entering an exception reason. The reason and the bypassed requirements are stored on the stage-change event and in `activity_logs` (`pipeline_stage_override`). Loss/hold reasons cannot be bypassed.
- **Concurrency.** The stage update is conditional on the stage that was evaluated; if someone else moved the card first, the request returns 409 and nothing is overwritten.

### Editable guidance

Pipeline administrators open **Stage settings** (Pipeline header or workspace checklist) to change per-stage probability, goal, guidance and checklist items (add, rename, reorder, required/optional, reset to defaults). Stored in `pipeline_stage_settings`; stages without a row use the defaults in `guidance.ts`. Built-in items with automatic checks keep ticking themselves as long as the item is kept. Entry rules above are not editable. Individual opportunities can also have their own extra steps.

## Value and forecasting

- **Value** = the **current** quote version's amount when one is linked; otherwise the manual estimated value. Superseded versions are never summed (`opportunityValue`).
- **Open pipeline** = sum of value for active stages (New Inquiry → Approved).
- **Weighted forecast** = Σ value × probability / 100 over active stages.
- **Won value** = sum of Closed Won value with `closed_at` in the selected reporting period.
- **Win rate** = Won / (Won + Lost) for opportunities closed in the selected period.
- On Hold is excluded from open and weighted totals (shown separately). Closed Lost never counts toward open totals.
- Stats respect the page filters (salesperson, service, stage, date range); the reporting period applies to won value and win rate.

## Dates

- **Expected close date** — when the *sale* is expected to close (forecasting).
- **Requested completion date** — when the *customer needs the job* (production planning; carried to the order's `due_at`).
- **Next action due** — the salesperson's next follow-up; missing or past-due dates are flagged on cards and in the workspace.
- The **Calendar view** always states which date it is placing opportunities by, with a selector (expected close, requested completion, next follow-up).

## Leads, contacts, customers and opportunities

Ctrl+P's records map as follows:

| Concept | Ctrl+P record |
|---|---|
| Inbound lead / inquiry | `contact_submissions` (website contact form) |
| Prospect contact | Contact snapshot on the opportunity (`contact_name/email/phone`, `company`) |
| Customer | `users` row with `role = 'customer'` |
| Opportunity | `pipeline_opportunities` |

Rules:

- **Leads are added intentionally.** Use *Add to Pipeline* on a form submission (Communications → Email → Form Submissions) or *New opportunity* on the Pipeline. Imported or new submissions never become opportunities automatically.
- **No duplicate contacts.** Creating from an inquiry links the submission (`source_submission_id`, unique) and, when the email matches an existing customer account, links that customer instead of copying them. Repeat clicks return the same opportunity.
- **An owner is required** on creation and on every reassignment; owner changes are recorded with who and when. Assigned-only staff can only create opportunities for themselves.
- **Source, inquiry message and history are retained** — the inquiry text becomes the project summary, the submission stays linked and visible in the workspace, and the submission is assigned to the owner if it had no assignee.
- **Relationship status ≠ stage.** Customer-ness lives on `users.role`; stage lives on the opportunity. Linking or creating a customer never resets or duplicates an opportunity.
- **Existing customers can have many opportunities** (different jobs, reorders). Requesting another quote never downgrades a customer.
- **Login roles are never changed.** Linking an existing user leaves their role untouched; a new customer is created only when no user exists for the contact email.

### Closed Won conversion (idempotent)

When an opportunity moves to Closed Won, `ensureWonRecords` runs **before** the stage is saved (if it fails, the stage does not change):

1. Claims the opportunity with a conversion token so only one request converts at a time (stale after 2 minutes).
2. **Customer:** uses the linked customer; else finds a user by email (`users.email`, then `get_auth_user_id_by_email`); else creates one auth user + customer profile (no invite email). A duplicate-email race falls back to linking.
3. **Order:** if the accepted quote version links an order, that order is linked; an order still in `quote_requested` moves to `new` with a status-history note. Otherwise a new order is created from the opportunity (customer, contact, accepted amount, specs in internal notes, requested completion as `due_at`, one `order_items` row per line item with specs in `options`, and `production_jobs` rows in `new`, mirroring the admin order-creation flow).
4. Every created id is written back immediately (`customer_user_id`, `won_order_id`, unique per order), so retries, double clicks and reopen-then-win-again reuse the same customer and order.

## Production handoff

- The sales Pipeline **ends at Closed Won**. Design, proof approval, prepress, printing, finishing, installation and delivery continue in Orders, Production, Artwork and Projects. No production stages exist in the Pipeline.
- Accepted quote, specifications, customer, dates, fulfillment, PO/terms and internal notes are carried onto the order so they aren't re-entered. Linked files remain on the opportunity; proofs of record are uploaded on the order.
- **Closed Won is not production authorization.** Production status is left at `new`, `proof_required` is set on order lines (except reorders of existing artwork), and order notes state that artwork approval and payment requirements still apply.
- The workspace shows the linked order's real order, payment and production status from Orders/Payments — never an assumed "paid" or "approved".

## Workspace

Header (value, weighted, owner, dates, overdue flags, Won/Lost/Hold/Reopen), stage path with *Advance*, customer or prospect contact, originating inquiry, project details, order setup (billing, deposit, terms, PO), stage guidance and checklist, next action, line items (multiple products per opportunity with service-aware specs), quote versions, activity timeline, tasks, related orders/payments/appointments, file links, stage history, and assignment history.

**Activity timeline.** One stream, tabbed to match the quick actions: All, Calls, Email, Text, Appointments, Notes, Voice notes, AI Agent, Projects, Plans, Contracts, SOW, Quotes, Invoices, Payments and Updates (stage, owner and other changes). Each tab shows its count, highlighted when something arrived since you last opened that tab (remembered per browser). It merges pipeline events, `messages` for the linked customer and orders, `booking_appointments`, and `payments` on linked orders; a message or booking made from the workspace appears once. Entries show their real provider status (for example *Twilio · delivered* or *Email · failed*). *Add* on a tab logs that kind by hand or opens the matching quick action; hand-logged entries are always labelled **Logged manually** and never send anything.

## Quick actions

The workspace's action menu sits under the header while the main sidebar is expanded. Collapse the sidebar (bottom of the rail; remembered per browser) and the menu moves to a vertical rail beside the content. Contact panels also carry Call, Text and Email shortcuts. Every tool opens in a modal that can be expanded to full screen.

| Action | What it really does | Recorded as |
|---|---|---|
| Call | Twilio browser dialer (same TwiML app as Communications; does not register, so it never takes incoming calls). After hang-up the server fetches the call from Twilio and records its real status and duration. A call that never connected is not recorded. | `communication` / `call` with CallSid; de-duplicated |
| Email | Sends plain text through the SMTP settings used by Messages (`SMTP_*`, `EMAIL_FROM`). Saves a `messages` row for the linked customer/won order. A rejected send is recorded as failed and reported as an error. | `communication` / `email` |
| Text | Sends through Twilio from an allowed SMS number (`TWILIO_SMS_NUMBERS`, else the main number). Saves a `messages` row. Status shown is Twilio's (queued/sent/delivered/failed). | `communication` / `sms` |
| Schedule | Uses the public booking flow: appointment types, real open slots, and `POST /api/booking/appointments`, which sends the customer's normal confirmation. The booking is then attached. | `communication` / `meeting` with appointment id |
| Note | Internal note on the opportunity. | `manual_log` / `note` |
| Voice note | Records in the browser, stores the audio in the private `pipeline-voice-notes` bucket (≤10 MB), and optionally transcribes with OpenAI Whisper. Played back through short-lived signed links. | `communication` / `voice_note` |
| AI Agent | Summaries, next steps, follow-up email/text drafts and questions, generated only from the opportunity record (Anthropic if `ANTHROPIC_API_KEY`, else OpenAI). Nothing is sent; drafts can be copied into Email/Text or saved to the timeline. AI phone calling is not available in Ctrl+P. | `communication` / `ai_agent` (only when saved) |
| Project | Creates an item in Projects (`/api/admin/production-schedule`) on the won order, or links an existing one. | `record_linked` / `project` |
| Plan, Contract, SOW | Records in `pipeline_opportunity_documents` with title, status, amount, dates, terms and an optional file link. Status is staff-recorded; there is no e-signature. | `document_updated` |
| Quote | Opens the Quote panel's link/new-version dialog (quotes are built in Orders). | `quote_linked` / `quote_revised` |
| Invoice | Creates an invoice in Payments on the won order or a linked quote order, and optionally sends it through the existing invoice delivery (email/text). Payment status always comes from Payments. | `record_linked` / `invoice` |

All quick-action routes require `pipeline.edit` and record access to the opportunity; calls to other modules (token, bookings, projects, payments) keep those modules' own role checks.

## Permissions

New keys in `lib/rbac/permissions.ts`, mirrored in the database function `app_user_has_permission`:

| Role | Permissions |
|---|---|
| super_admin, admin | `pipeline.view_all`, `pipeline.view_assigned`, `pipeline.edit`, `pipeline.manage` |
| employee, staff | `pipeline.view_all`, `pipeline.edit` |
| customer_support | `pipeline.view_assigned`, `pipeline.edit` (own opportunities only) |
| production_manager | `pipeline.view_all` (read only) |
| installer, designer, customer, vendor, referral, reseller | none |

- API routes authenticate with `verifyAdminRequest` and then enforce these permissions plus **record access** (assigned-only users get 404 for others' opportunities).
- Reassigning to someone else requires `pipeline.view_all` or `pipeline.manage`. Stage settings and authorized exceptions require `pipeline.manage`.
- RLS on every pipeline table enforces the same rules for direct client access; events are append-only (an update trigger blocks edits) and opportunities have no delete path.

## Data model

`pipeline_opportunities`, `pipeline_opportunity_line_items`, `pipeline_opportunity_quotes` (one `is_current` per opportunity; links `orders`), `pipeline_opportunity_events` (append-only history: created, stage and owner changes with reasons/exceptions, quote changes, conversion, tasks, files, manual logs), `pipeline_opportunity_tasks`, `pipeline_opportunity_files`, `pipeline_stage_settings`. All additive; no existing tables are altered except replacing `app_user_has_permission` with the same body plus `pipeline.*` keys. Ctrl+P had no prior pipeline stages, so no stage data migration was required; `IMPORTED_STAGE_MAP` in `stages.ts` maps other CRMs' keys (including Channel Cast's) for future imports.

## Setup

1. **Apply the migrations** in order, each on its own (SQL editor or psql): `supabase/migrations/20260913000001_sales_pipeline.sql`, then `supabase/migrations/20260914000001_pipeline_quick_actions.sql` (event types, documents table, private voice-note bucket). Both are safe to re-run. Avoid a blanket `supabase db push` unless every pending migration is intended.
   - Quick actions use existing environment variables: Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_TWIML_APP_SID`, `TWILIO_PHONE_NUMBER(S)`, `TWILIO_SMS_NUMBERS`), SMTP (`SMTP_*`, `EMAIL_FROM`), and `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` for AI drafts (`OPENAI_API_KEY` also enables voice-note transcription). A tool whose provider isn't configured says so instead of pretending to work.
2. **Environment:** no new variables. Uses existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. **Roles:** confirm sales staff have `employee`/`staff` (or `customer_support` for own-records-only) and are `active`.
4. **Optional:** tune probabilities and checklists in *Stage settings*.
5. **Quotes:** keep building quotes in Orders (status *Quote requested*), then link them from the opportunity's Quote panel.

## Known limitations

- Files are **links** (Drive, Dropbox, artwork bucket URLs); there is no upload control on the opportunity. Proofs of record remain on the order.
- Emails are plain text (no templates yet). Inbound replies appear only when they land in `messages` for the linked customer.
- Call recordings are not played back in the workspace; use Communications.
- AI Agent drafts and answers only; there is no AI voice calling.
- Plans, contracts and SOWs have no e-signature or document sending; status is recorded by staff.
- The collapsible sidebar exists on the Pipeline pages; other admin pages keep their fixed sidebar.
- Won conversion creates order lines without catalog product ids when line items weren't matched to products, and line prices use the planning estimates; the order total is the accepted quote amount.
- Quote status (sent, accepted) is recorded by staff; Ctrl+P has no customer-facing quote acceptance flow to read it from.
- The admin console has no shared layout; the Pipeline shell mirrors the existing per-page sidebar/header pattern.

## Manual verification checklist

1. Communications → Email → Form Submissions → *Add to Pipeline* → create; click again → same opportunity opens (no duplicate).
2. Try to advance New Inquiry without a next action → blocked with the list; set it → advances.
3. Add two line items (banner with dimensions, design-only without) → Discovery checklist passes.
4. Link a *Quote requested* order in Estimating → value switches to the quote amount; issue v2 → v1 shows as superseded and value uses v2.
5. Quote Sent → mark accepted → move directly to Approved (Follow-Up skipped).
6. Confirm billing + "Net 30" terms (no deposit) → Closed Won → order linked/created; click Won again or retry → same order and customer.
7. Reopen with a reason → history shows the won event and reopen; win again → still one order.
8. Another opportunity for the same customer → both listed on that customer.
9. Closed Lost without a reason → blocked; with reason → excluded from open totals, history intact.
10. On Hold with reason + date → excluded from forecast; reactivate → returns to prior stage.
11. Refresh in a second browser as another staff user → changes visible. Sign in as `installer` → Pipeline API returns 403; as `customer_support` → only own opportunities.
