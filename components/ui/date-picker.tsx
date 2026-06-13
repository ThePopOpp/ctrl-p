"use client";

import * as React from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  ({ value, onChange, placeholder = "Select date", className, disabled }, ref) => {
    const [open, setOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const selected = value ? new Date(`${value}T12:00:00`) : null;
    const [visibleMonth, setVisibleMonth] = React.useState(() => {
      const base = selected || new Date();
      return new Date(base.getFullYear(), base.getMonth(), 1);
    });

    React.useEffect(() => {
      if (value) {
        const d = new Date(`${value}T12:00:00`);
        setVisibleMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      }
    }, [value]);

    const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(visibleMonth);
    const firstDay = visibleMonth.getDay();
    const gridStart = addDays(visibleMonth, -firstDay);
    const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    const today = dateOnly(new Date());

    const displayLabel = selected
      ? new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }).format(selected)
      : "";

    React.useEffect(() => {
      if (!open) return;
      function handleOutside(event: MouseEvent) {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setOpen(false);
        }
      }
      document.addEventListener("mousedown", handleOutside);
      return () => document.removeEventListener("mousedown", handleOutside);
    }, [open]);

    function choose(day: Date) {
      onChange(dateOnly(day));
      setVisibleMonth(new Date(day.getFullYear(), day.getMonth(), 1));
      setOpen(false);
    }

    return (
      <div ref={containerRef} className={cn("relative", className)}>
        <button
          ref={ref}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-left text-sm shadow-sm transition-colors",
            "hover:border-primary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            displayLabel ? "text-foreground" : "text-muted-foreground",
          )}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span>{displayLabel || placeholder}</span>
          <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        {open && (
          <div
            role="dialog"
            className="absolute left-0 top-[calc(100%+4px)] z-[70] w-[300px] rounded-lg border bg-card p-3 text-card-foreground shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Month nav */}
            <div className="mb-3 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-semibold">{monthLabel}</div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const key = dateOnly(day);
                const isSelected = value === key;
                const inMonth = day.getMonth() === visibleMonth.getMonth();
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => choose(day)}
                    className={cn(
                      "grid h-9 place-items-center rounded-md text-sm transition-colors",
                      "hover:bg-primary hover:text-primary-foreground",
                      !inMonth && "text-muted-foreground/40",
                      key === today && !isSelected && "border border-primary/50",
                      isSelected && "bg-primary font-semibold text-primary-foreground shadow-sm",
                    )}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(""); setOpen(false); }}>
                Clear
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => choose(new Date())}>
                Today
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  },
);
DatePicker.displayName = "DatePicker";

export { DatePicker };
