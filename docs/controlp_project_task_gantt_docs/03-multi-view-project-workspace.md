# Multi-View Project Workspace

## Purpose

This document defines the required project/task views for ControlP.io.

The Gantt timeline is one view, not the entire project management system.

ControlP.io should support:

- Gantt Timeline View
- List View
- Table View
- Kanban View
- Calendar View

All views should use the same underlying records.

## Shared View Requirements

Every view should support:

- Project filtering
- Customer filtering
- Assigned user filtering
- Vendor filtering
- Status filtering
- Priority filtering
- Date range filtering
- Search
- Sort
- Grouping where useful
- Quick edit where appropriate
- Role-based visibility
- Customer-facing visibility rules
- AI Agent context

## Gantt Timeline View

Best for:

- Scheduling
- Dependencies
- Start/end movement
- Timeline visibility
- Production flow
- Install/delivery scheduling
- Identifying blockers and overlaps

Core features:

- Drag to move
- Resize start/end
- Dependency connectors
- FAB/action dock
- Timeline scale
- Horizontal scroll
- Today marker
- Status colors
- Customer-visible milestones
- Hidden/internal-only tasks
- Export CSV/PDF

## List View

Best for:

- Simple task review
- Parent/child hierarchy
- Fast updates
- Project checklists
- Customer-friendly summaries

Recommended layout:

- Project parent row
- Nested child tasks
- Status badge
- Assigned user/avatar
- Due date
- Priority
- Quick actions
- Expand/collapse
- Completion indicator

List View should support:

- Drag reorder within a project
- Expand/collapse parent projects
- Inline status updates
- Quick add child task
- Bulk complete
- Hide/show completed tasks

## Table View

Best for:

- Admin operations
- Bulk editing
- Export preparation
- Filtering and sorting
- Financial visibility
- Production operations

Recommended columns:

- Project
- Task
- Customer
- Order
- Assigned user
- Vendor
- Status
- Priority
- Start date
- End date
- Due date
- Duration
- Cost
- Invoice
- Payment status
- Product/material
- Visibility
- Last updated
- Actions

Table View should support:

- Column visibility
- Column sorting
- Column filtering
- Bulk actions
- Inline editing
- CSV export
- PDF export
- Saved views, if supported by the app

## Kanban View

Best for:

- Status workflow
- Drag-and-drop production movement
- Team operations
- Visual pipeline

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

Kanban cards should show:

- Project/task title
- Customer
- Status
- Priority
- Due date
- Assigned users
- Order number
- Product/material indicator
- File/proof indicator
- Message indicator
- Payment status indicator
- Warning badge for blockers/overdue

Kanban drag behavior:

- Dragging a card to a new column updates status.
- Status updates should reflect across Gantt, List, Table, Calendar, and AI Agent context.
- If moving into Complete, set completed_at.
- If moving into Canceled, set canceled_at and optionally ask for cancel reason.
- If moving into Blocked, prompt for blocked reason.

## Calendar View

Best for:

- Bookings
- Appointments
- Install dates
- Delivery dates
- Pickup dates
- Production schedule
- Due dates
- Staff availability

Calendar item types:

- Project start
- Project due date
- Task start/end
- Appointment
- Customer meeting
- Install
- Delivery
- Pickup
- Proof deadline
- Payment deadline
- Internal production milestone

Calendar requirements:

- Month view
- Week view
- Day view
- Agenda view
- Click to view/edit task
- Drag to reschedule, if supported
- Connect to booking system
- Show assigned user availability where available
- Respect visibility and permissions

## View Sync Rules

When a user updates a record in any view:

- Gantt dates update Calendar dates.
- Kanban status updates Table/List/Gantt status.
- Table edits update all other views.
- Calendar date changes update Gantt and List.
- List completion updates Kanban and Table.
- AI Agent can read the latest state.

## Acceptance Criteria

The multi-view system is complete when:

- All views use the same records.
- Updates in one view appear in all other views.
- Status changes sync correctly.
- Date changes sync correctly.
- Filters work consistently.
- Permissions are respected.
- Customer-facing data remains protected.
