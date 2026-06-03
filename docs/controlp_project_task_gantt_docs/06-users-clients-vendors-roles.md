# Users, Clients, Vendors, and Roles

## Purpose

This document defines how ControlP.io project/task management connects to users, customers, contacts, vendors, and role-based access.

The system should support internal users, customers, vendors, subcontractors, production staff, designers, sales/admin users, and AI Agent-controlled workflows.

## User Types

Recommended user/contact types:

- Super Admin
- Admin
- Production Manager
- Production Staff
- Designer
- Sales Rep
- Customer Service
- Installer
- Shipping / Fulfillment
- Vendor
- Subcontractor
- Customer
- Customer Contact
- Viewer
- AI Agent

## Role-Based Permissions

Each role should control which actions are visible.

Examples:

### Super Admin / Admin

Can:

- View all projects/tasks/orders
- Manage users
- Manage customers
- Manage vendors
- Edit all tasks
- Delete records
- Export CSV/PDF
- Manage payments/invoices
- Configure workflows
- Use AI Agent advanced actions

### Production Staff

Can:

- View assigned production tasks
- Update task status
- Add photos/videos
- Add production notes
- Mark task complete
- View product/material details
- See relevant order details

### Designer

Can:

- View design/artwork tasks
- Upload artwork
- Upload proofs
- Request approval
- Add design notes
- Update proof status

### Sales / Customer Service

Can:

- View customer/order/project context
- Send messages
- Create tasks
- Update customer-facing details
- Manage quotes and invoices where permitted
- Schedule appointments

### Vendor / Subcontractor

Can:

- View assigned vendor tasks
- Upload files/photos
- Add vendor notes
- Update status on assigned work
- See only approved related data

### Customer

Can:

- View customer-facing project milestones
- View approved tasks
- Upload files/artwork
- Review proofs
- Approve/reject proof
- Send messages
- View invoices/payments
- Book appointments
- See order/project status

## Project Participants

Projects and tasks should support multiple participants.

Participant fields:

- user_id
- contact_id
- vendor_id
- role_type
- permission_level
- notification preference
- visibility
- assigned_by
- assigned_at

## FAB Role Visibility

The Gantt FAB/action dock should show actions based on role.

Examples:

- Customers should not see Delete, internal notes, admin exports, or hidden internal tasks.
- Vendors should not see unrelated customer payment data.
- Production staff should not see admin-only billing settings unless allowed.
- Admins should see all available actions.

## Notifications by Role

Notifications should target:

- Assigned user
- Project owner
- Customer contact
- Vendor
- Admin
- AI Agent
- Team channel, if supported

Notification examples:

- Task assigned
- Task overdue
- Proof ready
- Customer approved proof
- Payment due
- Appointment booked
- Install scheduled
- Project completed
- Blocker added

## AI Agent as a Participant

The AI Agent should be able to act as a system participant.

The AI Agent may:

- Summarize project status
- Draft messages
- Suggest next tasks
- Identify blockers
- Create reminders
- Prepare reports
- Assist with scheduling
- Generate customer updates
- Review project history

The AI Agent should not perform destructive actions unless explicitly approved or permissioned.
