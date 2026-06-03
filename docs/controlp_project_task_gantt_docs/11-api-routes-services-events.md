# API Routes, Services, and Events

## Purpose

This document defines the recommended backend/API structure for ControlP.io project/task management enhancements.

Use the existing ControlP.io architecture first. This document is a guide, not a command to rebuild.

## Inspect First

Before coding, inspect:

- Current project/task schema
- Current Gantt/timeline component
- Current API routes
- Current server actions/services
- Current auth/session patterns
- Current permission system
- Current order/payment/customer/vendor/product models
- Current file/media upload flow
- Current notification/message system
- Current export utilities

## Recommended Service Areas

### Project Service

Responsibilities:

- Create project
- Update project
- Archive project
- Delete project, if permitted
- Fetch project with relationships
- Fetch project summary
- Link customer/order/payment records

### Task Service

Responsibilities:

- Create task
- Update task
- Delete task, if permitted
- Update status
- Update dates
- Update assignment
- Move task
- Resize task
- Hide from Gantt
- Mark complete
- Cancel task
- Create child task

### Timeline Service

Responsibilities:

- Fetch timeline items
- Move item
- Resize item start
- Resize item end
- Save timeline position
- Recalculate dependency lines
- Return timeline range data
- Apply filters

### Dependency Service

Responsibilities:

- Create dependency
- Delete dependency
- Fetch dependencies
- Validate dependency cycles
- Recalculate connector paths
- Preserve parent/child relationships

### File/Media Service

Responsibilities:

- Upload file
- Attach existing file
- Capture photo/video where supported
- Update visibility
- Attach file to project/task/order
- Fetch related media

### Product Selection Service

Responsibilities:

- Attach product/material
- Update selection
- Remove selection
- Update approval status
- Update availability/delivery status
- Connect vendor/product/order/task

### Calendar/Booking Service

Responsibilities:

- Fetch calendar events
- Link booking to project/task/customer
- Reschedule event
- Create appointment
- Update booking status
- Trigger reminders

### Payment/Billing Service

Responsibilities:

- Link payment records
- Fetch payment status
- Update project billing milestones
- Trigger payment-related tasks
- Prepare financial summary, role-permitted only

### Notification Service

Responsibilities:

- Send in-app notification
- Send email notification
- Send SMS notification where consent exists
- Log notification
- Respect role/visibility settings

### AI Agent Service

Responsibilities:

- Fetch permissioned context
- Generate summaries
- Draft messages
- Suggest actions
- Log AI actions
- Require approval for sensitive/destructive actions

## Event Names

Recommended internal event names:

- project.created
- project.updated
- project.completed
- project.canceled
- task.created
- task.updated
- task.moved
- task.resized
- task.status_changed
- task.completed
- task.canceled
- task.blocked
- dependency.created
- dependency.deleted
- file.uploaded
- proof.approved
- proof.rejected
- product_selection.added
- payment.status_changed
- booking.created
- booking.updated
- message.sent
- notification.sent
- ai.summary_created
- ai.action_suggested
- export.created

## API Design Notes

Every mutation should:

1. Check authentication.
2. Check authorization.
3. Validate input.
4. Preserve relationships.
5. Write changes.
6. Write activity log event.
7. Trigger notifications if configured.
8. Return updated record/context.

## Timeline Mutation Payloads

### Move Item

Expected payload:

- item_id
- item_type
- new_start_at
- new_end_at
- adjustment_minutes
- preserve_duration = true

### Resize Start

Expected payload:

- item_id
- item_type
- new_start_at
- current_end_at
- adjustment_minutes

### Resize End

Expected payload:

- item_id
- item_type
- current_start_at
- new_end_at
- adjustment_minutes

## Error Handling

If a save fails:

- Return a clear error.
- Do not partially update relationships.
- Allow UI to revert optimistic update.
- Log error where appropriate.

## Acceptance Criteria

Backend support is complete when:

- Timeline move/resize mutations work.
- Status updates work.
- Dependencies can be created and fetched.
- Files/products/bookings/payments can connect to projects/tasks where supported.
- Activity logs are written.
- Permissions are enforced.
- AI Agent can fetch permissioned context.
