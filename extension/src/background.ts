// ─── Service worker ─────────────────────────────────────────────────────────
//
// Two jobs a content script cannot do itself:
//   · chrome.tabs.captureVisibleTab — screenshots are privileged
//   · injecting the content script on demand under `activeTab`
//
// activeTab grants access to the current page only when the user clicks the
// toolbar icon. Requesting <all_urls> instead would trigger an alarming install
// warning and a heavier Web Store review for no benefit — click-to-activate is
// the intended interaction anyway.
//
// Note: MV3 service workers have no DOM, so no <canvas>. Cropping happens in
// the panel, which does. This worker only ever returns the full viewport shot.

import type { ContentToWorker, PanelToWorker, WorkerToContent, WorkerToPanel } from "./messages";

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
  // Older Chrome builds reject this; the action listener below covers them.
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId === undefined) return;
  void chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handle(message as PanelToWorker | ContentToWorker, sendResponse);
  // Keeps the message channel open for the async reply.
  return true;
});

async function handle(
  message: PanelToWorker | ContentToWorker,
  sendResponse: (response?: unknown) => void,
): Promise<void> {
  try {
    switch (message.type) {
      case "HARVEST_ACTIVE_TAB": {
        const tab = await activeTab();
        await inject(tab.id as number);
        const result = await send<ContentToWorker>(tab.id as number, { type: "HARVEST_PAGE" });
        sendResponse(
          result?.type === "HARVEST_PAGE_RESULT"
            ? ({ type: "HARVEST_RESULT", harvest: result.harvest } satisfies WorkerToPanel)
            : failure("The page did not return anything to capture."),
        );
        return;
      }

      case "CAPTURE_VIEWPORT": {
        const tab = await activeTab();
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId as number, {
          format: "png",
        });
        sendResponse({ type: "SCREENSHOT_RESULT", dataUrl, devicePixelRatio: 1 } satisfies WorkerToPanel);
        return;
      }

      case "START_ELEMENT_PICK":
      case "START_REGION_PICK": {
        const tab = await activeTab();
        await inject(tab.id as number);
        await send(tab.id as number, {
          type: message.type === "START_ELEMENT_PICK" ? "PICK_ELEMENT" : "PICK_REGION",
        } satisfies WorkerToContent);
        sendResponse({ ok: true });
        return;
      }

      case "CANCEL_PICK": {
        const tab = await activeTab();
        await send(tab.id as number, { type: "CANCEL_PICK" } satisfies WorkerToContent);
        sendResponse({ ok: true });
        return;
      }

      // Messages coming FROM the content script are relayed to the panel, which
      // listens on the same runtime channel.
      case "ELEMENT_PICKED":
      case "REGION_PICKED":
      case "PICK_CANCELLED":
      case "HARVEST_PAGE_RESULT":
        sendResponse({ ok: true });
        return;

      default:
        sendResponse(failure("Unrecognised message."));
    }
  } catch (error) {
    sendResponse(failure(error instanceof Error ? error.message : "Capture failed."));
  }
}

function failure(message: string): WorkerToPanel {
  return { type: "CAPTURE_ERROR", message };
}

async function activeTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab to capture.");
  if (tab.url && /^(chrome|edge|about|chrome-extension):/i.test(tab.url)) {
    throw new Error("Browser pages cannot be captured. Open the vendor's product page first.");
  }
  return tab;
}

/**
 * Injected as a classic script, so content.js must have no imports — that is
 * why its harvest helpers live in the same file rather than being imported.
 * Re-injection is guarded inside the script itself.
 */
async function inject(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["dist/extension/src/content.js"],
  });
}

async function send<R>(tabId: number, message: WorkerToContent): Promise<R | undefined> {
  try {
    return await chrome.tabs.sendMessage<WorkerToContent, R>(tabId, message);
  } catch {
    return undefined;
  }
}
