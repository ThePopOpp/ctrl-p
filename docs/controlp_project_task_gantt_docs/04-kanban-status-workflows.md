# Kanban Status Workflows

## Purpose

This document defines the Kanban workflow behavior for ControlP.io projects, tasks, orders, and production jobs.

Kanban should be a status-based drag-and-drop view that keeps the entire project management system in sync.

## Core Requirement

Dragging a card from one column to another updates the status of the underlying record.

This update must sync with:

- Gantt Timeline View
- List View
- Table View
- Calendar View
- Customer portal, where applicable
- Notifications
- Messages
- AI Agent context

## Recommended Status Columns

Default columns:

1. New
2. Intake
3. Waiting on Customer
4. Artwork Review
5. Proofing
6. Approved
7. Production
8. Quality Control
9. Ready for Pickup / Shipping
10. Complete
11. Blocked
12. Canceled

## Print Production Workflow Example

Suggested flow:

1. Customer Order Created
2. Payment Received or Deposit Paid
3. Artwork Uploaded
4. Artwork / File Review
5. Proof Created
6. Customer Proof Approval
7. Print Pre-Production
8. Material / Stock Check
9. Print Production
10. Finishing
11. Quality Control
12. Final Payment Due
13. Ready for Pickup / Shipping
14. Pickup / Shipping Completed
15. Order Closed

## Card Content

Each Kanban card should display:

- Task/project title
- Parent project name
- Customer/client
- Order number
- Status
- Priority
- Due date
- Assigned user avatar(s)
- Vendor indicator, if applicable
- Product/material indicator
- Proof/file indicator
- Message/comment indicator
- Payment status indicator
- Overdue or blocker badge
- Customer-visible badge, if applicable

## Drag and Drop Behavior

When a card is moved:

1. Optimistically update the card position.
2. Save the new status.
3. Show saving state.
4. Show success state.
5. If save fails:
   - Return the card to the previous column.
   - Show an error message.
   - Preserve all relationships.

## Status-Specific Actions

### Move to Waiting on Customer

Optional prompts:

- What is needed from the customer?
- Send notification?
- Add reminder date?

### Move to Blocked

Prompt for:

- Blocked reason
- Assigned owner
- Follow-up date
- Whether to notify admin/team

### Move to Complete

Set:

- status = complete
- completed_at = current timestamp
- percent_complete = 100

Optional actions:

- Notify customer
- Trigger invoice/payment check
- Create pickup/shipping task
- Ask AI Agent to summarize completion

### Move to Canceled

Set:

- status = canceled
- canceled_at = current timestamp

Optional prompt:

- Cancellation reason
- Notify customer?
- Stop reminders?
- Close dependencies?

## Kanban FAB / Quick Actions

Each card should support contextual actions:

- Open details
- Edit
- Add child task
- Assign user
- Add customer contact
- Add product/material
- Add photo/video
- Add file/proof
- Send message
- Create notification
- Export
- Mark complete
- Block
- Cancel
- Delete

## Filters

Kanban should support:

- Project
- Customer
- Order
- Assigned user
- Vendor
- Priority
- Due date
- Overdue
- Blocked
- Payment status
- Product/category
- Customer-visible/internal
- Search

## Permissions

Only show columns/actions the current user can access.

Examples:

- Customers should not see internal production-only statuses unless explicitly customer-visible.
- Vendors should only see assigned vendor tasks.
- Production staff should see production statuses and tasks.
- Admins should see all statuses and actions.

## AI Agent Integration

The AI Agent should be able to:

- Summarize what changed in Kanban.
- Identify blocked cards.
- Identify overdue cards.
- Suggest next actions.
- Draft customer updates.
- Notify assigned staff.
- Create follow-up tasks.
