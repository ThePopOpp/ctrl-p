"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";

import { FormLabel } from "@/components/admin/pipeline/pipeline-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, pipelineRequest } from "@/lib/pipeline/client";
import { defaultStageConfig, isAutoItem } from "@/lib/pipeline/guidance";
import { ACTIVE_STAGES, STAGE_META, STAGE_ORDER, type PipelineStage } from "@/lib/pipeline/stages";
import type { StageConfigMap, StoredStageConfig } from "@/lib/pipeline/types";
import { cn } from "@/lib/utils";

type Draft = Record<PipelineStage, StoredStageConfig>;

function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const fullDraft = (initial: StageConfigMap): Draft =>
  Object.fromEntries(STAGE_ORDER.map((stage) => [stage, initial[stage] ?? defaultStageConfig(stage)])) as Draft;

/**
 * Pipeline administrators edit each stage's probability, goal, guidance and
 * checklist here. Changes apply to every opportunity once saved.
 */
export function StageConfigDialog({
  open,
  initial,
  startStage,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: StageConfigMap;
  startStage?: PipelineStage;
  onClose: () => void;
  onSaved: (config: StageConfigMap) => void;
}) {
  const [stage, setStage] = useState<PipelineStage>(startStage ?? "new_inquiry");
  const [draft, setDraft] = useState<Draft>(() => fullDraft(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStage(startStage ?? "new_inquiry");
    setDraft(fullDraft(initial));
    setError(null);
  }, [open, initial, startStage]);

  const current = draft[stage];
  const patch = (next: Partial<StoredStageConfig>) => setDraft((all) => ({ ...all, [stage]: { ...all[stage], ...next } }));
  const setItem = (index: number, next: Partial<StoredStageConfig["items"][number]>) =>
    patch({ items: current.items.map((item, i) => (i === index ? { ...item, ...next } : item)) });

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const stages = Object.fromEntries(
        STAGE_ORDER.map((key) => {
          const value = draft[key];
          return [key, {
            probability: value.probability,
            goal: value.goal.trim(),
            actions: value.actions.map((action) => action.trim()).filter(Boolean),
            items: value.items.filter((item) => item.label.trim()).map((item) => ({ ...item, label: item.label.trim() })),
          }];
        }),
      );
      const result = await pipelineRequest<{ stageConfig: StageConfigMap }>("/stage-config", { method: "PUT", body: { stages } });
      onSaved(result.stageConfig);
      onClose();
    } catch (saveError) {
      setError(errorMessage(saveError, "Stage settings were not saved."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !saving && onClose()}>
      <DialogContent className="max-h-[92vh] gap-4 overflow-hidden sm:max-w-[60rem]">
        <DialogHeader>
          <DialogTitle>Pipeline stage settings</DialogTitle>
          <DialogDescription>Forecast probability, guidance and required checklist items for each stage. Changes apply to every opportunity.</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
          <div className="flex gap-1 overflow-x-auto sm:max-h-[62vh] sm:flex-col sm:overflow-y-auto">
            {STAGE_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setStage(key)}
                aria-pressed={stage === key}
                className={cn(
                  "flex shrink-0 items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm",
                  stage === key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="truncate">{STAGE_META[key].label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{draft[key].items.length}</span>
              </button>
            ))}
          </div>

          <div className="min-h-0 space-y-4 overflow-y-auto pr-1 sm:max-h-[62vh]">
            {ACTIVE_STAGES.includes(stage) ? (
              <FormLabel label="Forecast probability (%)" hint="A starting value for weighted forecasting, not a measured conversion rate.">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={current.probability}
                  onChange={(event) => patch({ probability: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })}
                  className="w-32"
                />
              </FormLabel>
            ) : (
              <p className="text-xs text-muted-foreground">Probability is fixed for this outcome ({STAGE_META[stage].probability}%).</p>
            )}

            <FormLabel label="Goal">
              <Textarea rows={2} value={current.goal} onChange={(event) => patch({ goal: event.target.value })} />
            </FormLabel>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Guidance</span>
                <Button size="sm" variant="ghost" onClick={() => patch({ actions: [...current.actions, ""] })}><Plus className="h-3.5 w-3.5" /> Add</Button>
              </div>
              <div className="space-y-1.5">
                {current.actions.map((action, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <Input aria-label={`Guidance ${index + 1}`} value={action} onChange={(event) => patch({ actions: current.actions.map((a, i) => (i === index ? event.target.value : a)) })} />
                    <Button size="icon" variant="ghost" aria-label="Remove guidance" onClick={() => patch({ actions: current.actions.filter((_, i) => i !== index) })}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Checklist</span>
                <Button size="sm" variant="ghost" onClick={() => patch({ items: [...current.items, { id: `item_${Math.random().toString(36).slice(2, 8)}`, label: "", required: false }] })}>
                  <Plus className="h-3.5 w-3.5" /> Add item
                </Button>
              </div>
              <div className="space-y-1.5">
                {current.items.map((item, index) => {
                  const auto = isAutoItem(stage, item.id);
                  return (
                    <div key={item.id} className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap">
                      <Input aria-label={`Checklist item ${index + 1}`} value={item.label} onChange={(event) => setItem(index, { label: event.target.value })} />
                      <button
                        type="button"
                        onClick={() => setItem(index, { required: !item.required })}
                        aria-pressed={Boolean(item.required)}
                        className={cn(
                          "shrink-0 rounded-md border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide",
                          item.required ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300" : "text-muted-foreground",
                        )}
                      >
                        {item.required ? "Required" : "Optional"}
                      </button>
                      <Button size="icon" variant="ghost" aria-label="Move up" disabled={index === 0} onClick={() => patch({ items: move(current.items, index, index - 1) })}><ArrowUp className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" aria-label="Move down" disabled={index === current.items.length - 1} onClick={() => patch({ items: move(current.items, index, index + 1) })}><ArrowDown className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" aria-label={auto ? "Remove (this item ticks itself from the record)" : "Remove"} onClick={() => patch({ items: current.items.filter((_, i) => i !== index) })}>
                        <Trash2 className={cn("h-4 w-4", auto ? "text-amber-600" : "text-muted-foreground")} />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Required items block moving forward. Built-in items tick themselves from the record while they are kept. Closed Lost and On Hold
                never require other stages&apos; checklists, and entering Quote Sent, Approved and Closed Won always needs the quote and billing basics.
              </p>
            </div>

            <Button variant="outline" size="sm" onClick={() => patch(defaultStageConfig(stage))}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset {STAGE_META[stage].label} to defaults
            </Button>
          </div>
        </div>

        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save stage settings"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
