# Gantt Timeline FAB Interaction System

## Purpose

This document defines the interactive Gantt timeline behavior for ControlP.io projects, tasks, orders, production jobs, and milestones.

The current Gantt schedule is mostly built. This enhancement adds professional interaction behavior, including timeline drag/resize controls and contextual FAB action buttons.

## Goal

Each project, task, order, production job, or milestone bar/card inside the Gantt timeline should behave as an interactive timeline item with three zones:

1. Left edge
2. Center area
3. Right edge

## Interaction Zones

### Left Edge: Start Resize Handle

The left edge of the timeline bar should resize the start date/time.

Behavior:

- Drag left to move the start earlier.
- Drag right to move the start later.
- End date/time remains unchanged unless minimum duration rules require adjustment.
- Tooltip should show updated start date/time, end date/time, adjustment amount, and duration.
- On release, save the new start date/time.
- If save fails, revert the visual change.

### Center Area: Move + FAB Trigger

The center area supports two behaviors:

#### Drag

Dragging the center should move the whole item earlier or later while preserving duration.

Behavior:

- Start and end move together.
- Duration stays the same.
- Dependencies stay visually attached.
- No blocking confirm, alert, or modal should open while dragging.
- Tooltip should show the updated start/end and adjustment amount.
- On release, save the new dates.
- If save fails, revert the visual change.

#### Click

Clicking the center without dragging should open a compact FAB/action dock near the selected bar.

Behavior:

- FAB opens only from center click.
- FAB does not open from resize handles.
- FAB does not open during drag.
- FAB should close when clicking outside, pressing Escape, selecting an action, or selecting another item.

### Right Edge: End Resize Handle

The right edge should resize the end date/time.

Behavior:

- Drag right to extend the task.
- Drag left to shorten the task.
- Start date/time remains unchanged unless minimum duration rules require adjustment.
- Tooltip should show updated start date/time, end date/time, adjustment amount, and duration.
- On release, save the new end date/time.
- If save fails, revert the visual change.

## FAB / Action Dock Buttons

The FAB/action dock should be compact, icon-first, and near the selected timeline item.

Include the following actions where permissions allow:

- Connect / add new task
- Add user / participant
- Add customer contact
- Add role type
- Add photo
- Add video
- Add file / proof / artwork
- Add product
- Add product selection
- Add material
- Add vendor
- Add production note
- Add building code / jurisdiction code reference, when applicable
- Edit
- Hide from Gantt
- Mark complete
- Cancel
- Export CSV
- Export PDF
- Delete

## UX Requirements

The dock should:

- Use existing ControlP.io/ShadCN-style components.
- Respect light and dark mode.
- Use clear tooltips on icons.
- Be compact enough not to cover timeline data.
- Support keyboard focus.
- Support mobile/touch as reasonably as possible.
- Show only actions the current user is allowed to perform.

## Tooltip Feedback

While dragging or resizing, show live feedback:

- Item title
- Updated start date/time
- Updated end date/time
- Adjustment amount
- Duration
- Status, if useful

Examples of adjustment amount:

- `+15 min`
- `-30 min`
- `+1 hr`
- `+2 hr 30 min`
- `+1 day`

## Save Behavior

On pointer release:

1. Optimistically show the updated position.
2. Save via the existing API/update pattern.
3. Show saving state.
4. Show success state when saved.
5. If save fails:
   - Revert visual position to previous saved values.
   - Show an error toast or inline error.
   - Do not corrupt relationships.

## Dependency Connector Lines

Connector lines must stay attached to the correct timeline bars.

Recalculate connector paths after:

- Dragging
- Resizing
- Filtering
- Searching
- Sorting
- Horizontal scrolling
- Vertical scrolling
- Timeline scale changes
- Window resize
- Collapsing or expanding rows
- Data refresh

## Connected Task Creation

When the user clicks "Connect / add new task":

1. Open a compact create task flow.
2. Pre-fill the parent project/order context.
3. Create the task.
4. Create a dependency record between the source item and the new task.
5. Recalculate connector lines.
6. Refresh all relevant views.

## Acceptance Criteria

The feature is complete when:

- Left edge resizes start date/time.
- Center drag moves the whole timeline item.
- Right edge resizes end date/time.
- Center click opens the FAB/action dock.
- Dragging does not open the FAB.
- Resize handles do not open the FAB.
- Tooltip feedback updates live.
- Updates save on release.
- Failed saves revert safely.
- Dependency lines stay attached.
- Connected tasks can be created from the FAB.
