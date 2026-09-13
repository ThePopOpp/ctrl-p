// Minimal ambient declarations for the Chrome APIs this extension actually
// uses. Narrower than @types/chrome on purpose: it keeps the build dependency
// free, and it documents the extension's exact API surface in one screen.

declare namespace chrome {
  namespace runtime {
    const id: string;
    const lastError: { message?: string } | undefined;
    function sendMessage<T = unknown, R = unknown>(message: T): Promise<R>;
    function getURL(path: string): string;

    const onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: { tab?: tabs.Tab; frameId?: number },
          sendResponse: (response?: unknown) => void,
        ) => boolean | void,
      ): void;
    };
  }

  namespace tabs {
    type Tab = { id?: number; url?: string; title?: string; windowId?: number; active?: boolean };
    function query(query: { active?: boolean; currentWindow?: boolean }): Promise<Tab[]>;
    function captureVisibleTab(windowId: number, options: { format: "png" | "jpeg"; quality?: number }): Promise<string>;
    function sendMessage<T = unknown, R = unknown>(tabId: number, message: T): Promise<R>;
  }

  namespace scripting {
    function executeScript<T = unknown>(injection: {
      target: { tabId: number; allFrames?: boolean };
      files?: string[];
      func?: (...args: never[]) => T;
      args?: unknown[];
      world?: "ISOLATED" | "MAIN";
    }): Promise<Array<{ result: T; frameId: number }>>;
  }

  namespace sidePanel {
    function setPanelBehavior(behavior: { openPanelOnActionClick: boolean }): Promise<void>;
    function open(options: { windowId?: number; tabId?: number }): Promise<void>;
  }

  namespace storage {
    type Area = {
      get<T = Record<string, unknown>>(keys?: string | string[] | null): Promise<T>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
    };
    const local: Area;
    const session: Area;
  }

  namespace action {
    const onClicked: {
      addListener(callback: (tab: tabs.Tab) => void): void;
    };
  }
}
