// ─── Content script — on-page interaction only ──────────────────────────────
//
// Runs inside the vendor's page. Its whole job is:
//   · document.elementFromPoint() on mousemove to identify the hovered element
//   · getBoundingClientRect() to position a highlight outline
//   · click to select, Escape to cancel
//   · drag to define a custom capture region
//   · read the page's structured data and DOM, and hand it to the panel
//
// EVERY node this injects lives inside a Shadow DOM with its styles scoped to
// the shadow root. Without that, vendor stylesheets break the overlay on
// roughly half of all sites — and ours would leak into theirs, which is worse.
//
// This file deliberately has no value imports: it is injected with
// chrome.scripting.executeScript, which loads a classic script, not a module.
// Type-only imports are erased by the compiler and are safe.

// The harvest and message types are declared ambiently in harvest.d.ts, not
// imported — see the note there. messages.ts asserts they still match the
// shared definitions, so a divergence fails the build rather than the browser.
type RawHarvest = CtrlpRawHarvest;
type RawImage = CtrlpRawImage;
type RawTable = CtrlpRawTable;
type ContentToWorker = CtrlpContentToWorker;
type WorkerToContent = CtrlpWorkerToContent;

type Rect = CtrlpRect;
type Mode = "idle" | "element" | "region";

// Re-injection on a second capture would double every listener.
const FLAG = "__ctrlpCaptureInstalled";
type FlaggedWindow = Window & { [FLAG]?: boolean };

if (!(window as FlaggedWindow)[FLAG]) {
  (window as FlaggedWindow)[FLAG] = true;
  install();
}

function install(): void {
  let mode: Mode = "idle";
  let hovered: Element | null = null;
  let dragStart: { x: number; y: number } | null = null;

  // ─── Shadow-DOM overlay ───
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .outline {
      position: fixed;
      border: 2px solid #2563eb;
      background: rgba(37, 99, 235, 0.08);
      border-radius: 3px;
      pointer-events: none;
      transition: all 60ms linear;
    }
    .region {
      position: fixed;
      border: 2px dashed #2563eb;
      background: rgba(37, 99, 235, 0.12);
      pointer-events: none;
    }
    .hint {
      position: fixed;
      left: 50%;
      top: 16px;
      transform: translateX(-50%);
      background: #0f172a;
      color: #fff;
      font: 500 12px/1.4 ui-sans-serif, system-ui, -apple-system, sans-serif;
      padding: 8px 14px;
      border-radius: 999px;
      box-shadow: 0 4px 14px rgba(0,0,0,.25);
      pointer-events: none;
      white-space: nowrap;
    }
    .hint kbd {
      background: rgba(255,255,255,.15);
      border-radius: 3px;
      padding: 1px 5px;
      font: inherit;
    }
    .label {
      position: fixed;
      background: #2563eb;
      color: #fff;
      font: 500 11px/1 ui-sans-serif, system-ui, sans-serif;
      padding: 3px 6px;
      border-radius: 3px;
      pointer-events: none;
      white-space: nowrap;
    }
  `;

  const outline = document.createElement("div");
  outline.className = "outline";
  const label = document.createElement("div");
  label.className = "label";
  const region = document.createElement("div");
  region.className = "region";
  const hint = document.createElement("div");
  hint.className = "hint";

  shadow.append(style, outline, label, region, hint);
  hideAll();

  function hideAll(): void {
    for (const node of [outline, label, region, hint]) node.style.display = "none";
  }

  function mount(): void {
    if (!host.isConnected) document.documentElement.appendChild(host);
  }

  function unmount(): void {
    hideAll();
    host.remove();
  }

  // ─── Picking ───

  function start(next: Mode): void {
    mode = next;
    mount();
    hint.style.display = "";
    hint.innerHTML =
      next === "element"
        ? 'Click an element to capture it · <kbd>Esc</kbd> to cancel'
        : 'Drag to select a region · <kbd>Esc</kbd> to cancel';
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    if (next === "region") {
      document.addEventListener("mousedown", onMouseDown, true);
      document.addEventListener("mouseup", onMouseUp, true);
    }
  }

  function stop(): void {
    mode = "idle";
    hovered = null;
    dragStart = null;
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("mousedown", onMouseDown, true);
    document.removeEventListener("mouseup", onMouseUp, true);
    unmount();
  }

  function onMouseMove(event: MouseEvent): void {
    if (mode === "region") {
      if (!dragStart) return;
      drawRegion(dragStart, { x: event.clientX, y: event.clientY });
      return;
    }

    // The overlay host is pointer-events:none, so elementFromPoint returns the
    // page's own element rather than our outline.
    const element = document.elementFromPoint(event.clientX, event.clientY);
    if (!element || element === hovered || host.contains(element)) return;

    hovered = element;
    const rect = element.getBoundingClientRect();
    outline.style.display = "";
    outline.style.left = `${rect.left}px`;
    outline.style.top = `${rect.top}px`;
    outline.style.width = `${rect.width}px`;
    outline.style.height = `${rect.height}px`;

    label.style.display = "";
    label.textContent = describe(element);
    // Flip the label below the element when there is no room above it.
    const above = rect.top > 22;
    label.style.left = `${rect.left}px`;
    label.style.top = above ? `${rect.top - 20}px` : `${rect.bottom + 4}px`;
  }

  function onMouseDown(event: MouseEvent): void {
    if (mode !== "region") return;
    event.preventDefault();
    event.stopPropagation();
    dragStart = { x: event.clientX, y: event.clientY };
    region.style.display = "";
  }

  function onMouseUp(event: MouseEvent): void {
    if (mode !== "region" || !dragStart) return;
    event.preventDefault();
    event.stopPropagation();

    const rect = normalise(dragStart, { x: event.clientX, y: event.clientY });
    stop();

    // Ignore an accidental click-without-drag rather than capturing a 1px crop.
    if (rect.width < 12 || rect.height < 12) {
      post({ type: "PICK_CANCELLED" });
      return;
    }
    post({ type: "REGION_PICKED", rect, devicePixelRatio: window.devicePixelRatio });
  }

  function onClick(event: MouseEvent): void {
    if (mode !== "element") return;
    event.preventDefault();
    event.stopPropagation();

    const element = document.elementFromPoint(event.clientX, event.clientY);
    const rect = element?.getBoundingClientRect();
    stop();

    if (!element || !rect) {
      post({ type: "PICK_CANCELLED" });
      return;
    }

    post({
      type: "ELEMENT_PICKED",
      harvest: harvest(element),
      rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      devicePixelRatio: window.devicePixelRatio,
    });
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    stop();
    post({ type: "PICK_CANCELLED" });
  }

  function drawRegion(from: { x: number; y: number }, to: { x: number; y: number }): void {
    const rect = normalise(from, to);
    region.style.left = `${rect.x}px`;
    region.style.top = `${rect.y}px`;
    region.style.width = `${rect.width}px`;
    region.style.height = `${rect.height}px`;
  }

  function normalise(from: { x: number; y: number }, to: { x: number; y: number }): Rect {
    return {
      x: Math.min(from.x, to.x),
      y: Math.min(from.y, to.y),
      width: Math.abs(to.x - from.x),
      height: Math.abs(to.y - from.y),
    };
  }

  function describe(element: Element): string {
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : "";
    const cls = typeof element.className === "string" && element.className
      ? `.${element.className.trim().split(/\s+/).slice(0, 2).join(".")}`
      : "";
    return `${tag}${id}${cls}`.slice(0, 60);
  }

  function post(message: ContentToWorker): void {
    void chrome.runtime.sendMessage(message);
  }

  // ─── Messages from the service worker ───
  //
  // HARVEST_PAGE answers on the response channel because the worker awaits it.
  // The pick events cannot — they resolve whenever the user clicks, which may be
  // minutes later — so those go back over chrome.runtime.sendMessage, which the
  // panel is also listening on.
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const command = message as WorkerToContent;
    switch (command?.type) {
      case "HARVEST_PAGE":
        sendResponse({
          type: "HARVEST_PAGE_RESULT",
          harvest: harvest(document.body),
          devicePixelRatio: window.devicePixelRatio,
        } satisfies ContentToWorker);
        return true;
      case "PICK_ELEMENT":
        start("element");
        sendResponse({ ok: true });
        return true;
      case "PICK_REGION":
        start("region");
        sendResponse({ ok: true });
        return true;
      case "CANCEL_PICK":
        stop();
        sendResponse({ ok: true });
        return true;
      default:
        return false;
    }
  });
}

// ─── Harvest ────────────────────────────────────────────────────────────────
//
// Collects raw page data. It does NOT interpret it — buildDraft() in the panel
// does that, using the same module the server uses, so the two paths cannot
// disagree about what a price table means.

function harvest(root: Element): RawHarvest {
  return {
    url: location.href,
    pageTitle: document.title,
    jsonLd: readJsonLd(),
    openGraph: readMeta(),
    microdata: readMicrodata(root),
    tables: readTables(root),
    definitions: readDefinitions(root),
    images: readImages(root),
    selects: readSelects(root),
    text: (root.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 200_000),
  };
}

function readJsonLd(): unknown[] {
  const blocks: unknown[] = [];
  for (const script of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      blocks.push(JSON.parse(script.textContent ?? ""));
    } catch {
      // A malformed block on a vendor page is not ours to fix.
    }
  }
  return blocks;
}

function readMeta(): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const tag of Array.from(document.querySelectorAll("meta"))) {
    const key = (tag.getAttribute("property") ?? tag.getAttribute("name") ?? "").toLowerCase();
    const content = tag.getAttribute("content");
    if (!key || !content) continue;

    if (key.startsWith("og:") || key.startsWith("twitter:") || key.startsWith("product:")) {
      const normalised = key.replace(/^(og|twitter|product):/, "");
      if (!meta[normalised]) meta[normalised] = content;
    } else if (key === "description" && !meta.description) {
      meta.description = content;
    }
  }
  return meta;
}

function readMicrodata(root: Element): Record<string, string> {
  const data: Record<string, string> = {};
  for (const node of Array.from(root.querySelectorAll("[itemprop]"))) {
    const key = node.getAttribute("itemprop");
    if (!key || data[key]) continue;
    const value =
      node.getAttribute("content") ??
      node.getAttribute("href") ??
      (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (value) data[key] = value.slice(0, 400);
  }
  return data;
}

function readTables(root: Element): RawTable[] {
  const tables: RawTable[] = [];

  for (const table of Array.from(root.querySelectorAll("table"))) {
    const rows = Array.from(table.rows).map((row) =>
      Array.from(row.cells).map((cell) => (cell.textContent ?? "").replace(/\s+/g, " ").trim()),
    );
    if (rows.length < 2) continue;

    // A row of <th> is the header; otherwise the first row usually is, which is
    // what most vendor price tables actually do.
    const firstIsHeader = Array.from(table.rows[0].cells).some((cell) => cell.tagName === "TH");
    const headers = rows[0];
    const body = rows.slice(1);
    if (!headers.length || !body.length) continue;

    tables.push({
      headers,
      rows: body,
      caption: table.caption?.textContent?.trim() || precedingHeading(table) || undefined,
    });

    void firstIsHeader;
  }

  return tables;
}

/** The nearest heading above a table — usually what the table prices. */
function precedingHeading(table: Element): string | null {
  let node: Element | null = table.previousElementSibling;
  let hops = 0;
  while (node && hops < 4) {
    if (/^H[1-6]$/.test(node.tagName)) return (node.textContent ?? "").trim().slice(0, 60);
    node = node.previousElementSibling;
    hops += 1;
  }
  return null;
}

function readDefinitions(root: Element): Array<{ term: string; definition: string }> {
  const pairs: Array<{ term: string; definition: string }> = [];

  for (const list of Array.from(root.querySelectorAll("dl"))) {
    const children = Array.from(list.children);
    for (let i = 0; i < children.length - 1; i += 1) {
      if (children[i].tagName !== "DT" || children[i + 1].tagName !== "DD") continue;
      const term = (children[i].textContent ?? "").replace(/[:\s]+$/, "").trim();
      const definition = (children[i + 1].textContent ?? "").replace(/\s+/g, " ").trim();
      if (term && definition) pairs.push({ term, definition });
    }
  }

  // "Material: 16pt C2S" list items are the other common spec shape.
  for (const item of Array.from(root.querySelectorAll("li")).slice(0, 200)) {
    const text = (item.textContent ?? "").replace(/\s+/g, " ").trim();
    const colon = text.indexOf(":");
    if (colon <= 0 || colon > 40 || text.length > 240) continue;
    pairs.push({ term: text.slice(0, colon).trim(), definition: text.slice(colon + 1).trim() });
  }

  return pairs.slice(0, 60);
}

function readImages(root: Element): RawImage[] {
  const images: RawImage[] = [];

  for (const img of Array.from(root.querySelectorAll("img")).slice(0, 120)) {
    // naturalWidth is the real asset size; width/height are the CSS box, which
    // says nothing about the resolution actually available.
    const src = bestSrc(img);
    if (!src) continue;
    images.push({
      src,
      alt: img.alt || undefined,
      width: img.naturalWidth || img.width || undefined,
      height: img.naturalHeight || img.height || undefined,
    });
  }

  return images;
}

function bestSrc(img: HTMLImageElement): string | null {
  const srcset = img.getAttribute("srcset");
  if (srcset) {
    const best = srcset
      .split(",")
      .map((entry) => entry.trim().split(/\s+/))
      .map(([url, descriptor]) => ({ url, weight: Number.parseFloat(descriptor ?? "0") || 0 }))
      .filter((candidate) => candidate.url)
      .reduce<{ url: string; weight: number } | null>(
        (top, candidate) => (!top || candidate.weight > top.weight ? candidate : top),
        null,
      );
    if (best) return absolute(best.url);
  }
  const lazy = img.getAttribute("data-src") ?? img.getAttribute("data-lazy-src");
  return absolute(img.currentSrc || img.src || lazy || "");
}

function absolute(url: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, location.href).toString();
  } catch {
    return null;
  }
}

function readSelects(root: Element): Array<{ label: string; options: string[] }> {
  const selects: Array<{ label: string; options: string[] }> = [];

  for (const select of Array.from(root.querySelectorAll("select")).slice(0, 30)) {
    const options = Array.from(select.options)
      .map((option) => option.textContent?.trim() ?? "")
      .filter((text) => text && !/^(choose|select|please|--)/i.test(text));
    if (!options.length) continue;

    selects.push({ label: humanise(labelFor(select)), options });
  }

  return selects;
}

function labelFor(select: HTMLSelectElement): string {
  if (select.id) {
    const label = document.querySelector(`label[for="${CSS.escape(select.id)}"]`);
    if (label?.textContent?.trim()) return label.textContent.trim();
  }
  const wrapping = select.closest("label");
  if (wrapping?.textContent?.trim()) {
    return wrapping.textContent.replace(select.textContent ?? "", "").trim();
  }
  return select.getAttribute("aria-label") || select.name || select.id || "";
}

function humanise(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[:*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .slice(0, 40);
}
