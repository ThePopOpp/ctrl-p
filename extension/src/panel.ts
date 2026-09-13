// ─── Side panel ─────────────────────────────────────────────────────────────
//
// chrome.sidePanel (Chrome 114+) hosts the capture and review UI. It is a
// native Chrome panel living outside the page's DOM, so vendor CSS cannot touch
// it and its styles cannot leak into theirs.
//
// It runs the SAME extraction module the server runs — `buildDraft` is imported
// from lib/capture/extract, compiled into this bundle by extension/tsconfig.
// The panel and the web app therefore cannot disagree about what a price table
// means, which is the failure mode worth engineering against.
//
// The panel is dependency-free DOM rather than React: the repo has no bundler,
// and an extension that loads unpacked from a clean checkout is worth more than
// component reuse in the review form. Swapping this for the shared
// CaptureReviewForm is a bundler config away — see extension/README.md.

// Relative, with the .js extension the browser will actually request — tsc does
// not rewrite path aliases in its output, so `@/…` would ship unresolvable.
import { buildDraft } from "../../lib/capture/extract.js";
import type { CaptureDraft } from "../../lib/capture/types.js";
import type { ContentToWorker, PanelToWorker, Rect, WorkerToPanel } from "./messages";

const APP_ORIGIN = "https://controlp.io";

type Session = { accessToken: string; user: { email: string; name: string | null; role: string } };

type State = {
  session: Session | null;
  draft: CaptureDraft | null;
  screenshot: string | null;
  categories: Array<{ id: string; name: string }>;
  busy: boolean;
  error: string | null;
  notice: string | null;
};

const state: State = {
  session: null,
  draft: null,
  screenshot: null,
  categories: [],
  busy: false,
  error: null,
  notice: null,
};

const root = document.getElementById("app") as HTMLElement;

// ─── Boot ───────────────────────────────────────────────────────────────────

void signIn().then(render);

chrome.runtime.onMessage.addListener((message) => {
  const event = message as ContentToWorker;
  switch (event.type) {
    case "ELEMENT_PICKED":
      void onRegionCaptured(event.rect, event.devicePixelRatio, event.harvest ? event : null);
      break;
    case "REGION_PICKED":
      void onRegionCaptured(event.rect, event.devicePixelRatio, null);
      break;
    case "PICK_CANCELLED":
      setState({ notice: "Selection cancelled.", busy: false });
      break;
  }
});

function setState(patch: Partial<State>): void {
  Object.assign(state, patch);
  render();
}

// ─── Auth ───────────────────────────────────────────────────────────────────

/**
 * Borrows the staff member's existing controlp.io session rather than asking
 * them to sign in a second time. The cookie travels because of the
 * controlp.io host permission plus credentials: "include"; the extension never
 * sees or stores a password.
 */
async function signIn(): Promise<void> {
  try {
    const response = await fetch(`${APP_ORIGIN}/api/capture/session`, { credentials: "include" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      state.session = null;
      state.error =
        payload.reason === "not_staff"
          ? "That controlp.io account is not a staff account."
          : null;
      return;
    }
    const payload = await response.json();
    state.session = { accessToken: payload.accessToken, user: payload.user };
    await loadCategories();
  } catch {
    state.session = null;
  }
}

async function loadCategories(): Promise<void> {
  if (!state.session) return;
  try {
    const response = await fetch(`${APP_ORIGIN}/api/pricing/tiers`, { headers: authHeaders() });
    if (!response.ok) return;
    const payload = await response.json();
    state.categories = (payload.categories ?? []).map((category: { id: string; name: string }) => ({
      id: category.id,
      name: category.name,
    }));
  } catch {
    // A missing category list is not fatal — staff can assign one in the
    // dashboard on the next pass.
  }
}

function authHeaders(): Record<string, string> {
  return { "content-type": "application/json", authorization: `Bearer ${state.session?.accessToken ?? ""}` };
}

// ─── Capture ────────────────────────────────────────────────────────────────

async function capturePage(): Promise<void> {
  setState({ busy: true, error: null, notice: null });

  try {
    const harvestResult = await toWorker({ type: "HARVEST_ACTIVE_TAB" });
    if (harvestResult.type === "CAPTURE_ERROR") throw new Error(harvestResult.message);
    if (harvestResult.type !== "HARVEST_RESULT") throw new Error("Nothing came back from the page.");

    lastHarvest = harvestResult.harvest;
    const draft = buildDraft(harvestResult.harvest);
    const screenshot = await captureViewport();

    setState({ draft, screenshot, busy: false });

    // Persist to the server so the capture is auditable and searchable, and so
    // Tier 3 vision can fill whatever tiers 1-2 missed.
    await persistCapture(draft, screenshot);
  } catch (error) {
    setState({ busy: false, error: error instanceof Error ? error.message : "Capture failed." });
  }
}

async function captureViewport(): Promise<string | null> {
  const shot = await toWorker({ type: "CAPTURE_VIEWPORT" });
  return shot.type === "SCREENSHOT_RESULT" ? shot.dataUrl : null;
}

async function pick(mode: "element" | "region"): Promise<void> {
  setState({ busy: true, error: null, notice: `Switch to the page and ${mode === "element" ? "click an element" : "drag a region"}.` });
  await toWorker({ type: mode === "element" ? "START_ELEMENT_PICK" : "START_REGION_PICK" });
}

/**
 * Crop the viewport screenshot to the selected rect.
 *
 * captureVisibleTab returns an image at the DEVICE pixel ratio, while the rect
 * is in CSS pixels. Multiplying by devicePixelRatio is not optional — skip it
 * and every capture is offset and mis-sized on any retina display.
 */
async function onRegionCaptured(
  rect: Rect,
  devicePixelRatio: number,
  elementEvent: { harvest: Parameters<typeof buildDraft>[0] } | null,
): Promise<void> {
  setState({ busy: true, notice: null });

  try {
    const full = await captureViewport();
    if (!full) throw new Error("The screenshot came back empty.");

    const cropped = await crop(full, rect, devicePixelRatio);

    if (elementEvent) {
      lastHarvest = elementEvent.harvest;
      const draft = buildDraft(elementEvent.harvest);
      setState({ draft, screenshot: cropped, busy: false });
      await persistCapture(draft, cropped);
    } else {
      setState({ screenshot: cropped, busy: false, notice: "Region captured." });
    }
  } catch (error) {
    setState({ busy: false, error: error instanceof Error ? error.message : "Could not crop that region." });
  }
}

/** Cropping needs a canvas, which an MV3 service worker does not have — so it happens here. */
async function crop(dataUrl: string, rect: Rect, devicePixelRatio: number): Promise<string> {
  const ratio = devicePixelRatio || 1;
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);

  const sx = Math.max(0, Math.round(rect.x * ratio));
  const sy = Math.max(0, Math.round(rect.y * ratio));
  const sw = Math.min(bitmap.width - sx, Math.round(rect.width * ratio));
  const sh = Math.min(bitmap.height - sy, Math.round(rect.height * ratio));
  if (sw <= 0 || sh <= 0) throw new Error("That region is outside the visible page.");

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not open a canvas to crop with.");

  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  bitmap.close();
  return canvas.toDataURL("image/png");
}

async function persistCapture(draft: CaptureDraft, screenshot: string | null): Promise<void> {
  if (!state.session) return;
  try {
    const response = await fetch(`${APP_ORIGIN}/api/capture`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        harvest: { ...rawHarvestFor(draft), url: draft.sourceUrl },
        screenshot,
        capture_method: "extension",
      }),
    });
    if (!response.ok) return;

    const payload = await response.json();
    // The server may have filled gaps with Tier 3 vision; take its draft back.
    if (payload.draft) setState({ draft: payload.draft, notice: payload.visionUsed ? "Vision filled some gaps — check anything badged Extracted." : null });
    captureId = payload.capture?.id ?? null;
  } catch {
    setState({ notice: "Saved locally — the server copy failed, so re-capture before publishing." });
  }
}

let captureId: string | null = null;
let lastHarvest: Parameters<typeof buildDraft>[0] | null = null;

function rawHarvestFor(draft: CaptureDraft) {
  return lastHarvest ?? { url: draft.sourceUrl, pageTitle: draft.title.value, jsonLd: [], openGraph: {}, microdata: {}, tables: [], definitions: [], images: [], selects: [], text: "" };
}

// ─── Save ───────────────────────────────────────────────────────────────────

async function saveDraft(form: HTMLFormElement): Promise<void> {
  if (!state.draft || !state.session) return;
  setState({ busy: true, error: null });

  const data = new FormData(form);

  try {
    const response = await fetch(`${APP_ORIGIN}/api/cards`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        title: String(data.get("title") ?? "").trim(),
        subtitle: String(data.get("subtitle") ?? "").trim() || null,
        captured_description: state.draft.capturedDescription.value,
        spec_table: state.draft.specTable.value,
        vendor_sku: String(data.get("vendor_sku") ?? "").trim() || null,
        category_id: String(data.get("category_id") ?? "") || null,
        lead_time_days: state.draft.leadTimeDays.value,
        source_url: state.draft.sourceUrl,
        capture_id: captureId,
        variants: state.draft.variants.map((variant, index) => ({
          label: variant.label,
          quantity: variant.quantity,
          spec: variant.spec,
          unit_cost: variant.unit_cost,
          is_default: index === 0,
        })),
        images: state.draft.images.map((image, index) => ({
          storage_path: image.url,
          alt_text: image.alt,
          image_source: "scraped_reference",
          is_primary: index === 0,
        })),
      }),
    });

    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Could not save the draft.");

    setState({
      busy: false,
      draft: null,
      screenshot: null,
      notice: `Saved as a draft. Finish the description, images and pricing in the dashboard before publishing.`,
    });
  } catch (error) {
    setState({ busy: false, error: error instanceof Error ? error.message : "Could not save the draft." });
  }
}

// ─── Messaging ──────────────────────────────────────────────────────────────

async function toWorker(message: PanelToWorker): Promise<WorkerToPanel> {
  const response = await chrome.runtime.sendMessage<PanelToWorker, WorkerToPanel>(message);
  return response ?? { type: "CAPTURE_ERROR", message: "The background worker did not respond." };
}

// ─── Render ─────────────────────────────────────────────────────────────────

function render(): void {
  root.replaceChildren();

  if (!state.session) {
    root.append(
      section(
        el("h1", { class: "title" }, "CTRL+P Product Capture"),
        el("p", { class: "muted" }, state.error ?? "Sign in to controlp.io in this browser, then reopen this panel."),
        button("Open controlp.io", () => window.open(`${APP_ORIGIN}/admin`, "_blank"), "primary"),
        button("I've signed in — retry", () => void signIn().then(render)),
      ),
    );
    return;
  }

  root.append(
    el(
      "header",
      { class: "header" },
      el("span", { class: "brand" }, "CTRL+P Capture"),
      el("span", { class: "muted small" }, state.session.user.email),
    ),
  );

  if (state.error) root.append(el("p", { class: "alert error" }, state.error));
  if (state.notice) root.append(el("p", { class: "alert notice" }, state.notice));

  if (!state.draft) {
    root.append(
      section(
        el("p", { class: "muted" }, "Open a vendor's product page, then capture it."),
        button(state.busy ? "Reading the page…" : "Capture this page", () => void capturePage(), "primary", state.busy),
        el("div", { class: "row" }, button("Pick an element", () => void pick("element"), "", state.busy), button("Drag a region", () => void pick("region"), "", state.busy)),
        el(
          "p",
          { class: "muted small" },
          "Capture reads the page you are already looking at. It does not crawl, and there is no bulk mode.",
        ),
      ),
    );
    if (state.screenshot) root.append(el("img", { class: "shot", src: state.screenshot, alt: "Captured region" }));
    return;
  }

  root.append(reviewForm(state.draft));
}

function reviewForm(draft: CaptureDraft): HTMLElement {
  const form = el("form", { class: "form" }) as HTMLFormElement;

  form.append(
    el("p", { class: "source" }, draft.sourceUrl),
    ...(draft.unresolved.length
      ? [el("p", { class: "alert warn" }, `Needs your input: ${draft.unresolved.join(", ")}`)]
      : []),
    field("Title", "title", draft.title.value, draft.title.source),
    field("Subtitle", "subtitle", draft.subtitle.value ?? "", draft.subtitle.source),
    field("Vendor SKU", "vendor_sku", draft.vendorSku.value ?? "", draft.vendorSku.source),
    categoryField(),
  );

  if (draft.variants.length) {
    const rows = draft.variants
      .slice(0, 12)
      .map((variant) =>
        el(
          "tr",
          {},
          el("td", {}, variant.label || String(variant.quantity)),
          el("td", { class: "num" }, `$${variant.unit_cost.toFixed(2)}`),
          el("td", { class: `badge ${variant.source === "vision" ? "extracted" : "verified"}` }, variant.source === "vision" ? "Extracted" : "Verified"),
        ),
      );

    form.append(
      el("h2", { class: "subtitle" }, `${draft.variants.length} price row${draft.variants.length === 1 ? "" : "s"} — wholesale cost`),
      el("table", { class: "variants" }, el("tbody", {}, ...rows)),
    );

    if (draft.variants.some((variant) => variant.source === "vision")) {
      form.append(
        el(
          "p",
          { class: "alert warn" },
          "At least one cost was read from a screenshot. Check it against the vendor's own table before saving.",
        ),
      );
    }
  } else {
    form.append(el("p", { class: "alert warn" }, "No cost found. Add it in the dashboard, or drag-select the price table and capture again."));
  }

  if (state.screenshot) form.append(el("img", { class: "shot", src: state.screenshot, alt: "Captured page" }));

  const save = button(state.busy ? "Saving…" : "Save as draft", () => undefined, "primary", state.busy) as HTMLButtonElement;
  save.type = "submit";

  form.append(
    el("div", { class: "row" }, save, button("Discard", () => setState({ draft: null, screenshot: null }))),
    el(
      "p",
      { class: "muted small" },
      "Saves as a Draft. The description has to be written in our own words and the images need a licence before it can publish.",
    ),
  );

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveDraft(form);
  });

  return form;
}

function field(label: string, name: string, value: string, source: string): HTMLElement {
  const input = el("input", { class: "input", name, value }) as HTMLInputElement;
  return el(
    "label",
    { class: "field" },
    el("span", { class: "label" }, label, el("span", { class: `badge ${badgeClass(source)}` }, badgeLabel(source))),
    input,
  );
}

function categoryField(): HTMLElement {
  const select = el("select", { class: "input", name: "category_id" }) as HTMLSelectElement;
  select.append(el("option", { value: "" }, "Choose a category — sets the pricing tier"));
  for (const category of state.categories) {
    select.append(el("option", { value: category.id }, category.name));
  }
  return el("label", { class: "field" }, el("span", { class: "label" }, "Category"), select);
}

function badgeClass(source: string): string {
  if (source === "vision") return "extracted";
  if (source === "manual") return "manual";
  return "verified";
}

function badgeLabel(source: string): string {
  if (source === "vision") return "Extracted";
  if (source === "manual") return "Manual";
  return "Verified";
}

// ─── Tiny DOM helpers ───────────────────────────────────────────────────────

function el(tag: string, attrs: Record<string, string> = {}, ...children: Array<Node | string>): HTMLElement {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "value" && node instanceof HTMLInputElement) node.value = value;
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

function section(...children: Array<Node | string>): HTMLElement {
  return el("section", { class: "section" }, ...children);
}

function button(label: string, onClick: () => void, variant = "", disabled = false): HTMLElement {
  const node = el("button", { class: `button ${variant}`.trim(), type: "button" }, label) as HTMLButtonElement;
  node.disabled = disabled;
  node.addEventListener("click", onClick);
  return node;
}
