"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type DateInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/**
 * Branded date input that uses the native browser picker styled to match the
 * design system. `color-scheme: dark` is applied in dark mode so the browser
 * renders its calendar popup with dark colours instead of a jarring white box.
 */
const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, ...props }, ref) => (
    <div className="relative">
      <input
        type="date"
        ref={ref}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pr-9 text-sm text-foreground shadow-sm transition-colors",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // color-scheme controls both the popup theme and the native spinner icon;
          // hide the native icon so only our CalendarIcon shows
          "[color-scheme:light] dark:[color-scheme:dark]",
          "[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute",
          className,
        )}
        {...props}
      />
      <CalendarIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  ),
);
DateInput.displayName = "DateInput";

export { DateInput };
