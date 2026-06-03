# ControlP.io Project / Task Management Source of Truth

## Purpose

This document defines the source of truth for the ControlP.io project, task, production schedule, and Gantt timeline system.

ControlP.io is not just a Gantt chart. The Gantt timeline is one view inside a larger project, order, production, customer, vendor, booking, payment, messaging, notification, and AI-assisted operations system.

The goal is to create a unified project management layer that connects:

- Projects
- Parent projects
- Child tasks
- Production jobs
- Orders
- Customers
- Users
- Vendors
- Products
- Product selections
- Materials
- Files
- Artwork
- Proofs
- Photos
- Videos
- Bookings
- Payments
- Quotes
- Invoices
- Messages
- Notifications
- AI Agent actions

## Core Principle

Every project/task record should be reusable across multiple views:

- Gantt Timeline View
- List View
- Table View
- Kanban View
- Calendar View
- Detail Drawer / Detail Page
- Customer-facing portal view, where appropriate
- AI Agent context

The Gantt timeline should not be the only way to manage projects and tasks.

## Primary Record Types

### Project

A project is the parent container for work.

Examples:

- Vehicle wrap project
- Business card print order
- Signage installation
- Apparel order
- Large-format print job
- Design project
- Fulfillment project
- Customer onboarding project
- Internal ControlP.io task group

A project can connect to:

- Customer/client
- Order
- Quote
- Invoice
- Payment
- Product(s)
- Product selections
- Tasks
- Files
- Artwork
- Proofs
- Messages
- Notifications
- Bookings
- Vendors
- Production jobs
- AI Agent summary/actions

### Task

A task is a child item under a project.

Examples:

- Customer order created
- Payment received
- Artwork uploaded
- Artwork review
- Proof created
- Customer proof approval
- Print pre-production
- Material/stock check
- Print production
- Finishing
- Quality control
- Final payment due
- Ready for pickup/shipping
- Pickup/shipping completed
- Order closed

A task can connect to:

- Parent project
- Parent task
- Phase/stage
- Assigned users
- Customer contacts
- Vendors
- Due date
- Start/end dates
- Status
- Priority
- Dependencies
- Files
- Photos/videos
- Products/materials
- Messages
- Notifications
- Cost/billing records
- AI Agent activity

## View Types

### Gantt Timeline View

Used for scheduling, dependencies, production flow, date movement, start/end resizing, and timeline visualization.

### List View

Used for quick scanning parent projects and child tasks in a clean grouped list format.

### Table View

Used for admin-heavy operations, filtering, sorting, bulk updates, export prep, and structured field management.

### Kanban View

Used for status-based drag-and-drop workflows.

Example columns:

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

### Calendar View

Used for date-based scheduling, appointments, due dates, installs, deliveries, pickup dates, production dates, and booking visibility.

## Key Requirement

All views must read from and update the same project/task records.

Changing status in Kanban should update the same record shown in Gantt, List, Table, Calendar, customer portal, and AI Agent context.

Moving a task in the Gantt should update the same date fields used in Calendar, Table, List, and notifications.

## Relationship Rules

Every task should always preserve:

- Parent project ID
- Task ID
- Phase/stage
- Order ID, if applicable
- Customer/client ID, if applicable
- Assigned user IDs
- Vendor IDs, if applicable
- Dependency IDs
- Related file/media IDs
- Product/material IDs
- Payment/quote/invoice references, if applicable
- Booking references, if applicable
- Activity history

Never break these relationships when dragging, resizing, editing, filtering, duplicating, exporting, or hiding records.

## Implementation Rule

Use the existing ControlP.io architecture and patterns.

Do not rebuild the app from scratch.

Before coding:

1. Inspect the existing Gantt/project/task implementation.
2. Locate the current schemas and API routes.
3. Identify the existing UI component system.
4. Identify current user/customer/vendor/product/order/payment relationships.
5. Add the smallest safe implementation.
6. Avoid unnecessary migrations unless required.
7. Preserve existing working features.
