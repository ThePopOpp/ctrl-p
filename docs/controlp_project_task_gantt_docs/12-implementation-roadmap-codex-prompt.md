# ControlP.io Project Management Implementation Roadmap and Codex Prompt

## Purpose

Use this document as the main Codex implementation prompt for the ControlP.io project/task/Gantt enhancement.

## Codex Prompt

You are working inside the existing ControlP.io application.

The current Gantt Chart Project Manager / Production Schedule is already mostly built. Do not rebuild the app from scratch.

Your job is to extend the existing project/task management system so it supports:

- Interactive Gantt timeline FAB/action dock
- Left/center/right timeline bar interaction zones
- Project parent and task child structure
- List View
- Table View
- Kanban View
- Calendar View
- Users, clients, vendors, and role connections
- Bookings and appointments
- Orders and production jobs
- Payments, costs, quotes, invoices, and billing milestones
- Messages and notifications
- Products, materials, files, artwork, photos, videos, and proofs
- AI Agent context and actions

## First Inspect the Current App

Before coding, inspect and summarize:

1. Where the current Gantt/timeline component lives.
2. How projects are modeled.
3. How tasks or schedule items are modeled.
4. How orders and production jobs connect to tasks.
5. How customers/users/vendors are modeled.
6. How dates/status/priority are stored.
7. How Gantt bars are rendered.
8. How timeline drag/drop currently works, if present.
9. How filters currently work.
10. How API routes/server actions are structured.
11. How permissions are handled.
12. How messages/notifications are handled.
13. How files/media are stored.
14. How payments/orders/quotes/invoices are stored.
15. What can be implemented with existing schema.
16. What requires a migration or new relationship table.

Do not start with assumptions. Inspect the existing architecture first.

## Phase 1: Gantt Interaction Zones

Implement timeline bar interaction zones:

- Left edge = resize start date/time.
- Center = drag whole item while preserving duration.
- Center click = open FAB/action dock.
- Right edge = resize end date/time.

Requirements:

- Dragging center must not open FAB.
- Resize handles must not open FAB.
- Use pointer events where appropriate.
- Show live tooltip feedback.
- Save on release.
- Revert on failed save.
- Preserve all relationships.

## Phase 2: FAB / Action Dock

Add compact icon-based FAB/action dock near the selected timeline bar.

Core actions:

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

Use existing UI components and permissions.

## Phase 3: Multi-View Project Workspace

Add or improve project/task views:

- Gantt Timeline View
- List View
- Table View
- Kanban View
- Calendar View

All views must use the same project/task records.

Updates in one view must sync with all others.

## Phase 4: Kanban Drag-and-Drop

Implement status-based Kanban.

Dragging cards between columns updates status.

Recommended columns:

- New
- Intake
- Waiting on Customer
- Artwork Review
- Proofing
- Approved
- Production
- Quality Control
- Ready for Pickup / Shipping
- Complete
- Blocked
- Canceled

Status updates must sync to Gantt, List, Table, Calendar, notifications, and AI Agent context.

## Phase 5: Calendar and Booking Connection

Calendar View should show:

- Appointments
- Bookings
- Task start/end dates
- Due dates
- Installs
- Deliveries
- Pickups
- Payment deadlines
- Proof deadlines

Bookings should connect to:

- Customer
- Project
- Task
- Order
- Assigned user
- Vendor, if applicable
- Messages and notifications

## Phase 6: Data Relationships

Ensure projects/tasks connect to:

- Users
- Customers
- Vendors
- Orders
- Production jobs
- Products
- Materials
- Files
- Proofs
- Photos/videos
- Payments
- Quotes
- Invoices
- Messages
- Notifications
- Bookings
- AI Agent actions

Preserve relationships during all updates.

## Phase 7: AI Agent Integration

Add AI Agent context and controlled actions.

AI should be able to:

- Summarize project status.
- Identify blockers.
- Identify overdue tasks.
- Draft customer updates.
- Draft internal updates.
- Suggest next actions.
- Create follow-up task suggestions.
- Summarize daily production schedule.
- Explain timeline changes.
- Prepare export summaries.

Destructive or sensitive actions should require approval.

## Phase 8: Testing and Polish

Test:

- Gantt drag/resize
- FAB open/close
- Dependency line recalculation
- Kanban drag status update
- Calendar sync
- List/table sync
- Permissions
- Customer-visible vs internal-only data
- File/media upload
- Product/material attachment
- Payment status visibility
- Notifications
- AI Agent context
- Mobile/touch behavior
- Light/dark mode

## Acceptance Criteria

The feature is complete when:

- Existing ControlP.io patterns are preserved.
- Gantt bars support left/center/right interaction zones.
- FAB/action dock works from center click only.
- Drag/resize saves and reverts safely.
- List/Table/Kanban/Calendar views use the same records.
- Kanban drag-and-drop updates status.
- Calendar connects to bookings and schedule dates.
- Projects/tasks connect to users, clients, vendors, payments, orders, products, files, messages, and notifications.
- AI Agent can read permissioned context and assist with project operations.
- No unrelated rebuilds are introduced.
