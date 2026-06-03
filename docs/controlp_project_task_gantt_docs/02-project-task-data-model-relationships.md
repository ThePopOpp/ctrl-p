# Project / Task Data Model and Relationships

## Purpose

This document defines the recommended relationship model for ControlP.io projects, tasks, schedule items, production jobs, orders, customers, vendors, files, products, payments, messages, bookings, and AI Agent actions.

The exact implementation should follow the existing ControlP.io schema. Do not add new tables or migrations unless the current model cannot support the required relationship.

## Core Entities

### Project

A project is the parent work container.

Recommended fields:

- id
- title
- description
- project_number
- customer_id
- primary_contact_id
- order_id
- quote_id
- invoice_id
- payment_status
- status
- priority
- visibility
- start_at
- end_at
- due_at
- budget_total
- estimated_cost
- actual_cost
- margin
- created_by
- assigned_owner_id
- created_at
- updated_at
- archived_at

### Task

A task is a child record under a project.

Recommended fields:

- id
- project_id
- parent_task_id
- order_id
- production_job_id
- title
- description
- task_type
- phase
- status
- priority
- visibility
- start_at
- end_at
- due_at
- duration_minutes
- percent_complete
- sort_order
- hidden_from_gantt
- blocked_reason
- created_by
- assigned_owner_id
- created_at
- updated_at
- completed_at
- canceled_at

### Schedule Item

If the current app uses a separate schedule item model, it should remain connected to the parent task/project.

Recommended fields:

- id
- project_id
- task_id
- order_id
- production_job_id
- item_type
- title
- start_at
- end_at
- all_day
- status
- visibility
- calendar_sync_id
- created_at
- updated_at

### Dependency

Used for Gantt connector lines and dependency logic.

Recommended fields:

- id
- project_id
- source_item_id
- source_item_type
- target_item_id
- target_item_type
- dependency_type
- lag_minutes
- created_by
- created_at
- updated_at

Dependency types:

- finish_to_start
- start_to_start
- finish_to_finish
- start_to_finish

### Participant / Assignment

Used to connect users, staff, vendors, customers, and role types.

Recommended fields:

- id
- project_id
- task_id
- user_id
- contact_id
- vendor_id
- role_type
- permission_level
- notification_preference
- created_at
- updated_at

Role type examples:

- Admin
- Production Manager
- Designer
- Installer
- Sales Rep
- Customer
- Vendor
- Subcontractor
- Approver
- Viewer

### Media / File Attachment

Used for photos, videos, artwork, proofs, documents, and customer uploads.

Recommended fields:

- id
- project_id
- task_id
- order_id
- production_job_id
- file_type
- file_name
- file_url
- thumbnail_url
- mime_type
- size
- uploaded_by
- visibility
- approval_status
- notes
- created_at
- updated_at

File types:

- Photo
- Video
- Artwork
- Proof
- PDF
- Invoice
- Contract
- SOW
- Spec Sheet
- Install Photo
- Completion Photo

### Product / Material Selection

Used to attach products, materials, and production selections.

Recommended fields:

- id
- project_id
- task_id
- order_id
- product_id
- vendor_id
- name
- category
- manufacturer
- sku
- model
- material_type
- print_method
- finish
- size
- color
- image_url
- price
- quantity
- subtotal
- availability_status
- delivery_status
- delivery_date
- client_approval_status
- internal_approval_status
- production_status
- notes
- created_at
- updated_at

### Code / Jurisdiction Reference

Useful for signage, installs, wraps, permits, ADA signage, fabrication, HOA requirements, and jurisdiction-specific installs.

Recommended fields:

- id
- project_id
- task_id
- jurisdiction_type
- jurisdiction_name
- code_title
- code_section
- source_url
- code_text
- compliance_status
- required_inspection
- permit_reference
- internal_notes
- customer_visible
- created_at
- updated_at

## Relationship Rules

A project can have many:

- Tasks
- Schedule items
- Orders
- Files
- Products/selections
- Users/participants
- Vendors
- Messages
- Payments
- Quotes/invoices
- Bookings
- Dependencies
- AI Agent actions

A task can have many:

- Child tasks
- Dependencies
- Assigned users
- Contacts
- Vendors
- Files/media
- Product selections
- Notes
- Messages
- Notifications
- Calendar items
- AI Agent actions

## Cross-View Consistency

The following fields must update across all views:

- title
- status
- priority
- start_at
- end_at
- due_at
- assigned users
- customer/contact
- vendor
- hidden_from_gantt
- percent_complete
- dependencies
- project/task hierarchy

## Important

Before adding schema changes, inspect the existing ControlP.io database and APIs.

Prefer:

- Existing project table
- Existing task table
- Existing order table
- Existing user/contact/vendor tables
- Existing attachment/file table
- Existing product table
- Existing invoice/payment table

Only add new tables for missing relationships that cannot be safely handled by existing patterns.
