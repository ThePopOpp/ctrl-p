# Acceptance Criteria and Testing Plan

## Purpose

This document defines the acceptance criteria and testing plan for the ControlP.io project/task/Gantt/FAB/multi-view system.

## Gantt Timeline Tests

### Interaction Zones

Confirm:

- Left edge resizes start date/time.
- Center drag moves entire bar while preserving duration.
- Center click opens FAB/action dock.
- Right edge resizes end date/time.
- Resize handles do not trigger FAB.
- Dragging does not trigger FAB.
- Touch interactions work where supported.

### Tooltip Feedback

Confirm tooltip displays:

- Updated start date/time
- Updated end date/time
- Adjustment amount
- Duration
- Item title
- Status, if useful

### Save/Revert

Confirm:

- Save happens on release.
- Saving state is shown.
- Success state is shown.
- Error state is shown.
- Failed save reverts visual position.
- Relationships remain intact.

## FAB / Action Dock Tests

Confirm actions appear based on permissions:

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
- Edit
- Hide from Gantt
- Mark complete
- Cancel
- Export CSV
- Export PDF
- Delete

Confirm:

- FAB opens near selected bar.
- FAB closes on outside click.
- FAB closes on Escape.
- FAB does not cover critical data.
- Tooltips are clear.

## Dependency Tests

Confirm connector lines recalculate after:

- Drag
- Resize
- Filter
- Sort
- Search
- Scroll
- Timeline scale change
- Window resize
- Data refresh

Confirm connected task creation:

- Creates task.
- Preserves project/order context.
- Creates dependency record.
- Updates connector lines.
- Appears in all relevant views.

## Multi-View Tests

Confirm all views use same records:

- Gantt Timeline
- List View
- Table View
- Kanban View
- Calendar View

Update tests:

- Change status in Kanban and verify Gantt/List/Table update.
- Change date in Gantt and verify Calendar/Table/List update.
- Change assignment in Table and verify all views update.
- Mark complete in List and verify Kanban/Gantt update.
- Hide from Gantt and verify record still appears where appropriate.

## Calendar / Booking Tests

Confirm:

- Appointments appear in Calendar.
- Bookings link to projects/tasks/customers.
- Install/delivery/pickup dates appear.
- Due dates appear.
- Rescheduling syncs where supported.
- Notifications trigger where configured.

## User / Role Tests

Confirm:

- Admin sees all actions.
- Production staff sees assigned production actions.
- Designers see artwork/proof actions.
- Vendors see only assigned vendor data.
- Customers see only customer-visible data.
- Financial fields are protected.
- Internal notes are not exposed to customers.

## Orders / Payments Tests

Confirm:

- Project links to order.
- Project links to quote/invoice/payment.
- Payment milestones appear where configured.
- Payment status can trigger/block production where configured.
- Financial data respects permissions.

## Files / Media / Product Tests

Confirm:

- Photos can attach to project/task.
- Videos can attach to project/task.
- Artwork/proofs can attach to project/task/order.
- Product/material selections attach correctly.
- Visibility settings are respected.
- Customer approval status works where applicable.

## Messages / Notifications Tests

Confirm:

- Messages link to project/task/order/customer.
- Internal notes remain internal.
- Customer messages are customer-visible.
- Notifications send to correct users.
- Activity log records important changes.

## AI Agent Tests

Confirm AI Agent can:

- Summarize project status.
- Summarize task status.
- Identify overdue tasks.
- Identify blockers.
- Draft customer update.
- Draft internal update.
- Draft vendor update.
- Suggest next actions.
- Read only permissioned context.
- Log AI-generated actions.

Confirm AI Agent cannot:

- Send messages without approval unless configured.
- Delete records without approval.
- Expose internal notes to customers.
- Expose financial data to unauthorized users.

## Performance Tests

Confirm:

- Gantt remains responsive with many tasks.
- Kanban drag remains responsive.
- Calendar loads efficiently.
- Filters do not break connector lines.
- Large projects do not freeze the browser.
- Exports complete successfully.

## Final Acceptance

The system is accepted when:

- Gantt timeline interactions work cleanly.
- FAB/action dock is functional and permission-aware.
- List/Table/Kanban/Calendar views are connected.
- Users, clients, vendors, bookings, payments, orders, messages, notifications, products, files, and AI Agent context are tied together.
- Existing ControlP.io architecture remains intact.
- No unnecessary rewrites were introduced.
