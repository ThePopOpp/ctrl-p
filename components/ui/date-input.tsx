"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type DateInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement>(null);

    function mergeRef(node: HTMLInputElement | null) {
      (innerRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
    }

    function openPicker() {
      const el = innerRef.current;
      if (!el) return;
      try {
        (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
      } catch {
        el.focus();
      }
    }

    return (
      <div className="relative">
        <input
          type="date"
          ref={mergeRef}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pr-9 text-sm text-foreground shadow-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "[color-scheme:light] dark:[color-scheme:dark]",
            // Hide browser's native calendar icon — our button below is the trigger
            "[&::-webkit-calendar-picker-indicator]:hidden",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={openPicker}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
          aria-label="Open date picker"
        >
          <CalendarIcon className="h-4 w-4" />
        </button>
      </div>
    );
  },
);
DateInput.displayName = "DateInput";

export { DateInput };
