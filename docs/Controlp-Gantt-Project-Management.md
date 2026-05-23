# Controlp.io — Gantt Project Management Feature

## File Purpose

This document retrofits the original **Constructed Matter CRM — Gantt Project Management Feature** planning document into a **Controlp.io production, order, design, print, fabrication, installation, and customer-approval project management module**.

Use this as the source-of-truth planning document for Codex when adding the Gantt-based project management feature into the Controlp.io web app / website.

Recommended file name:

`Controlp-Gantt-Project-Management.md`

Recommended location:

`/docs/Controlp-Gantt-Project-Management.md`

Alternative location:

`/docs/features/Controlp-Gantt-Project-Management.md`

---

## Controlp.io Use Case

Controlp.io is moving toward a modern ShadCN UI / Next.js / React business platform for print, design, product customization, production workflows, customer dashboards, admin dashboards, file review, orders, payments, customer communication, and fulfillment.

This Gantt project management feature should become the scheduling and production-control layer for Controlp.io.

It should help the internal team manage:

- Customer orders
- Design requests
- Artwork proofing
- File review
- Product customization
- Print production
- Fabrication
- Vendor/subcontractor work
- Installation scheduling
- Delivery / pickup / shipping
- Customer approvals
- Revisions
- Production blockers
- Project closeout

The experience should feel like a modern production management dashboard, not a construction dashboard.

---

## Feature Overview

The Gantt Chart Project Management feature gives Controlp.io a clear visual way to manage jobs from intake to completion.

Each customer order or production project should be broken into phases, tasks, milestones, approvals, deadlines, dependencies, assigned team members, production steps, and customer-facing updates.

The goal is to give Admins, Production Managers, Designers, Installers, Vendors, and Customers the correct level of visibility into what is happening, when it is happening, who is responsible, and what still needs approval.

The feature should work inside the Controlp.io Admin Dashboard first and later connect to the Customer Dashboard where selected project milestones, proofs, approvals, order status updates, and installation/delivery information can be shared with customers.

---

## Primary Goals

The Gantt Project Management feature should help Controlp.io:

- Manage full project/order timelines from quote approval to final delivery or installation.
- Track every job by phase, task, milestone, owner, due date, and dependency.
- Give production managers a visual Gantt-style timeline.
- Assign design, proofing, print, fabrication, installation, fulfillment, and support work.
- Identify delays, bottlenecks, missing files, missing approvals, and blocked jobs.
- Connect customer proof approvals to production readiness.
- Connect production tasks to order status.
- Give customers a simplified, polished project status view.
- Improve team communication and accountability.
- Reduce missed deadlines, unclear handoffs, and production confusion.
- Create a scalable foundation for future SaaS-style print shop / product customization management features.

---

## Admin Dashboard Placement

Add this feature to the **Controlp.io Admin Dashboard** as a major dashboard module.

Suggested navigation label:

`Project Management`

Alternative navigation labels:

- Production Schedule
- Job Timeline
- Orders & Projects
- Production Manager

Suggested sub-navigation:

- Overview
- Gantt Chart
- Jobs / Orders
- Tasks
- Proofs & Approvals
- Production Queue
- Installation / Delivery
- Vendors
- Customer Visibility
- Reports

---

## Recommended Dashboard Pages

### 1. Project Management Overview

A high-level project and production landing page for admins and production managers.

Should include:

- Active jobs / orders
- Job status
- Customer name
- Assigned project manager
- Assigned designer
- Assigned production lead
- Start date
- Target completion date
- Days remaining
- Production health
- Open tasks
- Overdue tasks
- Pending proofs
- Pending customer approvals
- Jobs blocked by missing files
- Jobs blocked by customer approval
- Upcoming installs / deliveries
- Rush jobs

Suggested UI components:

- Job cards
- Order/project status badges
- Production health indicators
- Quick action buttons
- Search and filters
- Table/list toggle
- Kanban-style production queue in a future phase

---

### 2. Project Gantt Chart Page

The main visual scheduling page.

Should include:

- Project/order phases
- Tasks
- Milestones
- Proof approvals
- Production dependencies
- Date ranges
- Drag-and-drop date adjustments if supported
- Status colors
- Assigned users
- Customer visibility indicators
- Rush job indicators
- Dependency lines if supported
- Zoom controls: day, week, month, quarter

Suggested controls:

- Filter by customer
- Filter by project/order
- Filter by phase
- Filter by assignee
- Filter by status
- Filter by product type
- Filter by due date
- Filter by customer-visible items
- Export schedule
- Add phase
- Add task
- Add milestone
- Add proof approval
- Add production blocker

---

### 3. Jobs / Orders Page

A list/table view of production projects and customer orders connected to the Gantt schedule.

Should include:

- Job / order name
- Order number
- Customer
- Product type
- Project manager
- Designer
- Production lead
- Start date
- Due date
- Rush status
- Order status
- Production status
- Payment status
- Proof status
- Files status
- Customer visibility
- Last updated

---

### 4. Task List Page

A list/table view of all tasks connected to project schedules.

Should include:

- Task name
- Job / order
- Customer
- Phase
- Assigned user
- Assigned department
- Start date
- Due date
- Priority
- Status
- Percent complete
- Dependency/blocker
- Customer visibility
- Last updated

---

### 5. Proofs & Approvals Page

A dedicated page for artwork, design, proofing, mockups, and customer sign-off.

Should include:

- Proof title
- Related job / order
- Related product
- Customer
- Designer
- Proof version
- Uploaded proof file
- Customer approval status
- Internal approval status
- Revision requested status
- Approval due date
- Notes
- Approved date
- Approved by
- Customer-visible toggle

Approval statuses:

- Not Sent
- Sent to Customer
- Viewed
- Changes Requested
- Approved
- Internally Approved
- Ready for Production
- Rejected
- Archived

---

### 6. Production Queue Page

A production-focused task board/list for printing, fabrication, customization, and finishing.

Should include:

- Job / order
- Product type
- Production method
- Material
- Quantity
- Assigned production team member
- Machine / equipment
- Start date
- Due date
- Production status
- File status
- Proof status
- Material status
- Notes
- Attachments
- Priority / rush flag

Production methods may include:

- Screen Printing
- Embroidery
- DTF / DTG
- Vinyl
- Vehicle Wrap
- Window Tint
- Large Format Print
- CNC Cut
- Laser Engraving
- Signage
- Acrylic / Metal / Wood Fabrication
- 3D Print
- Apparel Decoration
- Product Customization
- Installation Prep

---

### 7. Installation / Delivery Page

Used to schedule jobs that require pickup, shipping, delivery, or onsite installation.

Should include:

- Job / order
- Customer
- Install / delivery type
- Location
- Assigned installer / driver
- Scheduled date
- Arrival window
- Required materials
- Required tools
- Access instructions
- Customer contact
- Status
- Completion photos
- Customer sign-off
- Internal notes

---

### 8. Schedule Updates Page

Used to log timeline changes, delay reasons, customer/team notifications, and production impact.

Should include:

- Job / order
- Related task/phase/milestone/proof
- Previous date
- Updated date
- Reason for schedule change
- Impact notes
- Notify team toggle
- Notify customer toggle
- Updated by
- Updated date/time

---

## User Roles and Permissions

The feature should respect Controlp.io user roles.

### Super Admin

Can:

- View all jobs, orders, customers, files, and schedules.
- Create/edit/delete phases.
- Create/edit/delete tasks.
- Manage milestones.
- Manage proofs and approvals.
- Assign users.
- Assign departments.
- Change customer visibility settings.
- View all internal and customer-visible items.
- Export reports.
- Manage templates.
- Manage system-wide settings.

### Admin

Can:

- View all or assigned jobs depending on permissions.
- Create/edit jobs and tasks.
- Update order/project status.
- Manage customer communications.
- Manage proof workflow.
- Add schedule updates.
- Upload files.
- Add internal notes.
- View reports if allowed.

### Production Manager

Can:

- Manage full schedule for assigned jobs.
- Assign designers, production staff, installers, vendors, and subcontractors.
- Create phases, tasks, and milestones.
- Approve production readiness.
- Control customer visibility.
- Send schedule updates.
- Move work through production.
- Manage production queue.

### Designer

Can:

- View assigned design/proof tasks.
- Upload artwork/proof files.
- Update proof status.
- Add internal notes.
- Mark design work ready for internal review.
- Respond to revision requests.

### Production Staff

Can:

- View assigned production tasks.
- Update production task status.
- Add notes.
- Upload completion photos.
- Flag blockers.
- Mark work complete or ready for QC.

### Installer / Field Tech

Can:

- View assigned installation/delivery tasks.
- View location and access instructions.
- Update install status.
- Upload completion photos.
- Add notes.
- Capture customer sign-off if enabled.

### Vendor / Subcontractor

Can:

- View assigned procurement, production, or delivery tasks only.
- Confirm delivery dates.
- Upload documents.
- Add status updates.
- View limited project/order details.

### Customer

Can:

- View customer-visible project/order milestones.
- View approved schedule updates.
- View proof files sent for approval.
- Approve proofs.
- Request revisions.
- View selected task/status updates if enabled.
- View installation/delivery schedule.
- Submit comments or final approval if enabled.

---

## Core Data Models

Codex should adapt these models to the existing Controlp.io app architecture, database, ORM, API routes, auth system, order system, file system, dashboard components, and naming conventions.

Do not duplicate existing order, customer, user, product, file, payment, or communication models if they already exist. Extend or relate to existing models where appropriate.

---

### Customer

Represents a Controlp.io customer or company.

Suggested fields only if not already present:

- id
- customer_name
- company_name
- primary_contact_id
- email
- phone
- billing_address
- shipping_address
- customer_type
- customer_status
- created_at
- updated_at

---

### Project / Job

Represents a Controlp.io production project, job, or order-based project.

Suggested fields:

- id
- job_name
- order_id
- order_number
- customer_id
- project_manager_id
- production_manager_id
- designer_id
- production_lead_id
- job_type
- product_type
- start_date
- target_completion_date
- actual_completion_date
- job_status
- production_status
- proof_status
- file_status
- payment_status
- schedule_health
- rush_job
- customer_visibility
- internal_notes
- created_at
- updated_at

Recommended job statuses:

- Draft
- Quote Requested
- Quote Sent
- Quote Approved
- Deposit Paid
- Files Needed
- Design In Progress
- Proof Sent
- Awaiting Approval
- Approved for Production
- In Production
- Quality Check
- Ready for Pickup
- Scheduled for Delivery
- Scheduled for Install
- Completed
- On Hold
- Canceled

---

### Project Phase / Production Phase

Represents a major section of the job/order timeline.

Suggested fields:

- id
- job_id
- phase_name
- phase_description
- start_date
- end_date
- phase_status
- assigned_manager_id
- display_order
- customer_visible
- internal_notes
- created_at
- updated_at

Example phase names:

- Intake / Quote
- Artwork / Design
- File Review
- Proofing / Approval
- Materials / Procurement
- Pre-Production
- Print Production
- Fabrication
- Finishing
- Quality Check
- Packaging
- Pickup / Shipping / Delivery
- Installation
- Customer Sign-Off
- Closeout

---

### Project Task / Production Task

Represents a scheduled task inside a job/order phase.

Suggested fields:

- id
- job_id
- phase_id
- task_name
- task_description
- assigned_to_user_id
- assigned_to_department
- assigned_to_company_id
- start_date
- due_date
- estimated_duration
- percent_complete
- task_status
- task_priority
- dependency_task_id
- is_blocked
- blocker_reason
- customer_visible
- attachments
- internal_notes
- created_by
- created_at
- updated_at

Recommended statuses:

- Not Started
- In Progress
- Waiting on Customer
- Waiting on Artwork
- Waiting on Proof Approval
- Waiting on Materials
- Waiting on Vendor
- Needs Internal Review
- Needs Customer Review
- Ready for Production
- In Production
- Quality Check
- Completed
- Approved
- Reopened
- Blocked
- On Hold

Recommended priorities:

- Low
- Normal
- High
- Rush
- Critical
- Blocking Production
- Blocking Delivery / Install

---

### Project Milestone

Represents a key project/order checkpoint.

Suggested fields:

- id
- job_id
- phase_id
- milestone_name
- target_date
- actual_completion_date
- milestone_status
- customer_visible
- notes
- created_at
- updated_at

Example milestones:

- Quote Approved
- Deposit Paid
- Artwork Received
- Proof Sent
- Proof Approved
- Materials Received
- Production Started
- Production Complete
- Quality Check Passed
- Ready for Pickup
- Delivery Scheduled
- Install Scheduled
- Customer Approved
- Job Complete

---

### Proof / Approval

Represents artwork proofs, mockups, design files, print approvals, and customer approval checkpoints.

Suggested fields:

- id
- job_id
- order_id
- customer_id
- product_id
- proof_title
- proof_version
- proof_file_id
- proof_preview_url
- designer_id
- internal_status
- customer_status
- revision_requested
- revision_notes
- sent_to_customer_at
- viewed_by_customer_at
- approved_by_customer_at
- approved_by_user_id
- approval_due_date
- customer_visible
- internal_notes
- created_at
- updated_at

Recommended customer statuses:

- Not Sent
- Sent
- Viewed
- Changes Requested
- Approved
- Rejected

Recommended internal statuses:

- Draft
- Needs Internal Review
- Internally Approved
- Sent to Customer
- Customer Approved
- Ready for Production
- Archived

---

### Task Dependency

Represents a relationship between two tasks.

Suggested fields:

- id
- job_id
- parent_task_id
- dependent_task_id
- dependency_type
- required_completion_date
- delay_impact_notes
- auto_shift_schedule
- created_at
- updated_at

Example dependency types:

- Finish to Start
- Start to Start
- Finish to Finish
- Start to Finish

Controlp.io examples:

- Proof must be approved before production starts.
- Materials must be received before fabrication starts.
- Print production must finish before finishing starts.
- Quality check must pass before delivery or pickup.
- Install prep must finish before installation.

---

### Schedule Update

Tracks timeline changes and schedule communication.

Suggested fields:

- id
- job_id
- related_type
- related_id
- previous_start_date
- previous_due_date
- updated_start_date
- updated_due_date
- status_update
- reason_for_change
- schedule_impact
- notify_customer
- notify_team
- created_by
- created_at

Reason examples:

- Customer requested revision
- Customer approval delayed
- Artwork missing or incorrect
- File issue
- Material delay
- Vendor delay
- Machine downtime
- Rush job reprioritization
- Installation rescheduled
- Shipping delay
- Internal production delay
- Payment pending

---

### Production Blocker

Represents an issue preventing a job or task from moving forward.

Suggested fields:

- id
- job_id
- task_id
- blocker_type
- blocker_title
- blocker_description
- responsible_party
- assigned_to_user_id
- status
- priority
- customer_visible
- resolution_notes
- created_by
- resolved_by
- resolved_at
- created_at
- updated_at

Example blocker types:

- Missing Artwork
- Low Resolution File
- Proof Not Approved
- Payment Pending
- Material Out of Stock
- Vendor Delay
- Equipment Issue
- Customer Response Needed
- Install Access Issue
- Shipping Issue
- Internal Review Needed

---

### Installation / Delivery Task

Represents scheduled delivery, pickup, shipping, or onsite installation work.

Suggested fields:

- id
- job_id
- customer_id
- install_or_delivery_type
- location
- scheduled_start
- scheduled_end
- assigned_user_id
- assigned_company_id
- access_instructions
- customer_contact_name
- customer_contact_phone
- required_tools
- required_materials
- status
- completion_photos
- customer_signature
- customer_approval_status
- internal_notes
- created_at
- updated_at

---

### Quality Check Item

Represents quality control steps before final fulfillment.

Suggested fields:

- id
- job_id
- task_id
- qc_title
- qc_description
- inspected_by_user_id
- inspection_status
- issue_found
- issue_notes
- photo_uploads
- approved_for_delivery
- approved_for_install
- created_at
- updated_at

---

## Forms Required

### 1. Project / Job Setup Form

Purpose:

Used to create the initial project/order timeline.

Fields:

- Job Name
- Related Order
- Customer
- Product Type
- Project Manager
- Production Manager
- Designer
- Production Lead
- Start Date
- Target Completion Date
- Job Type
- Production Template
- Rush Job Toggle
- Internal Notes
- Customer Visibility Toggle

---

### 2. Production Phase Form

Purpose:

Used to create major timeline sections inside the Gantt chart.

Fields:

- Phase Name
- Phase Description
- Phase Start Date
- Phase End Date
- Phase Status
- Assigned Manager
- Display Order
- Customer Visible / Internal Only
- Phase Notes

---

### 3. Task Creation Form

Purpose:

Used to add individual tasks to the project/order timeline.

Fields:

- Task Name
- Task Description
- Related Job / Order
- Related Phase
- Start Date
- Due Date
- Assigned To
- Assigned Department
- Task Priority
- Task Status
- Dependency / Blocking Task
- Estimated Duration
- Percent Complete
- Attachments
- Internal Notes
- Customer Visibility Toggle

---

### 4. Milestone Form

Purpose:

Used to define important project/order checkpoints.

Fields:

- Milestone Name
- Target Date
- Actual Completion Date
- Related Job / Order
- Related Phase
- Milestone Status
- Notes
- Customer Visible Toggle

---

### 5. Proof / Approval Form

Purpose:

Used to manage artwork, design proofing, mockups, revisions, and customer approvals.

Fields:

- Proof Title
- Related Job / Order
- Related Product
- Proof Version
- Proof File Upload
- Designer
- Internal Approval Status
- Customer Approval Status
- Revision Notes
- Approval Due Date
- Send to Customer Toggle
- Customer Visible Toggle
- Internal Notes

---

### 6. Task Dependency Form

Purpose:

Used to connect tasks that rely on each other.

Fields:

- Parent Task
- Dependent Task
- Dependency Type
- Required Completion Date
- Delay Impact Notes
- Auto-Shift Schedule Toggle

---

### 7. Schedule Update Form

Purpose:

Used by production managers/admins to update dates, statuses, progress, delays, and schedule impact.

Fields:

- Related Job / Order
- Related Task / Phase / Milestone / Proof
- Current Status
- Previous Start Date
- Previous Due Date
- Updated Start Date
- Updated Due Date
- Percent Complete
- Reason for Change
- Schedule Impact
- Notify Customer Toggle
- Notify Team Toggle

---

### 8. Vendor / Subcontractor Assignment Form

Purpose:

Used to assign outside production, fabrication, materials, installation, or delivery work.

Fields:

- Job / Order
- Task / Scope of Work
- Vendor / Subcontractor
- Contact Person
- Start Date
- Due Date
- Required Documents
- Access Instructions
- Notes
- Confirmation Status

---

### 9. Customer Schedule View Settings Form

Purpose:

Used to control what the customer can see.

Fields:

- Job / Order
- Visible Phases
- Visible Milestones
- Visible Proofs
- Hidden Internal Tasks
- Show Completion Percent
- Show Delays
- Show Notes
- Customer Notification Preferences

---

### 10. Installation / Delivery Form

Purpose:

Used to schedule pickup, shipping, delivery, or installation.

Fields:

- Job / Order
- Customer
- Type: Pickup, Shipping, Delivery, Installation
- Location
- Scheduled Date
- Arrival Window
- Assigned Installer / Driver
- Customer Contact
- Access Instructions
- Required Tools
- Required Materials
- Completion Photos
- Customer Signature / Approval
- Internal Notes

---

### 11. Quality Check Form

Purpose:

Used before pickup, delivery, shipping, or installation.

Fields:

- Job / Order
- Related Task
- QC Checklist
- Inspected By
- Inspection Status
- Issues Found
- Issue Notes
- Photos
- Approved for Fulfillment Toggle
- Internal Notes

---

## Task Categories

Recommended categories:

- Quote
- Intake
- Design
- Artwork
- File Review
- Proofing
- Revision
- Customer Approval
- Payment
- Materials
- Procurement
- Print Production
- Fabrication
- Finishing
- Quality Check
- Packaging
- Pickup
- Shipping
- Delivery
- Installation
- Customer Support
- Warranty
- Closeout

---

## Gantt Chart Behavior

The Gantt chart should visually represent the relationship between jobs, phases, tasks, proofs, approvals, production steps, milestones, and schedule changes.

Required behavior:

- Show project/job phases as grouped timeline sections.
- Show individual tasks as timeline bars.
- Show milestones as fixed date markers.
- Show proof approval deadlines.
- Show dependencies between tasks.
- Show overdue tasks clearly.
- Show blocked tasks clearly.
- Show rush jobs clearly.
- Allow filtering by job/order, customer, phase, assignee, department, task status, priority, product type, and due date.
- Allow staff to update task status.
- Allow production managers to adjust dates.
- Keep a history of schedule changes.
- Respect customer visibility settings.
- Support a simplified customer-facing timeline view.

Preferred behavior:

- Drag-and-drop task rescheduling.
- Auto-shift dependent tasks when a blocking task moves.
- Critical path highlighting.
- Color-coded statuses.
- Progress percentage on task bars.
- Expand/collapse phases.
- Export to PDF or CSV.
- Calendar sync in a future phase.
- Order status sync in a future phase.
- Customer email/SMS notifications in a future phase.

---

## Customer Visibility Rules

Not everything in the Gantt chart should be visible to customers.

Customer-visible items may include:

- Major project/order phases
- Key milestones
- Proof approval requests
- Approved schedule updates
- Delivery / pickup / installation dates
- Customer decision deadlines
- Customer action items
- Final approval / sign-off items

Internal-only items may include:

- Staff notes
- Vendor/subcontractor comments
- Internal task assignments
- Cost-sensitive work
- Production conflicts
- Machine/equipment issues
- Internal blockers
- Management notes
- Margin/pricing notes
- Rework notes unless explicitly shared

Every phase, task, milestone, proof, production blocker, installation/delivery task, quality check item, and schedule update should include a customer visibility setting.

---

## Notifications

This feature should eventually support notifications.

Potential notification triggers:

- New task assigned
- Task due soon
- Task overdue
- Task completed
- Task blocked
- Proof sent to customer
- Proof viewed
- Proof approved
- Revision requested
- Milestone reached
- Schedule changed
- Production started
- Production completed
- Quality check failed
- Quality check passed
- Delivery scheduled
- Installation scheduled
- Customer approval requested
- Customer approved job/proof
- Customer requested changes

Possible notification channels:

- In-app notification
- Email
- SMS in a future phase
- Dashboard alert

---

## Reports and Exports

Future reporting options:

- Production schedule report
- Open task report
- Overdue task report
- Blocked jobs report
- Proof approval report
- Customer-visible timeline export
- Vendor/subcontractor task report
- Installation/delivery report
- Production delay report
- Rush job report
- Job closeout report
- Revenue by project/order in a future phase
- Production capacity report in a future phase

---

## Production Templates

The feature should eventually support reusable project templates.

Example templates:

### Apparel Order Template

Phases:

- Intake / Quote
- Artwork / Design
- Proofing
- Materials
- Production
- Quality Check
- Packaging
- Pickup / Delivery
- Closeout

Common tasks:

- Confirm garment type and quantity
- Confirm sizes
- Review artwork
- Create mockup
- Send proof
- Receive approval
- Order blanks
- Print / embroider
- QC finished items
- Package order
- Notify customer

---

### Vehicle Wrap Template

Phases:

- Intake / Quote
- Vehicle Measurements
- Design
- Proofing
- Print Production
- Lamination / Finishing
- Install Prep
- Installation
- Customer Sign-Off
- Closeout

Common tasks:

- Confirm vehicle information
- Collect photos/measurements
- Create design
- Send proof
- Receive approval
- Print panels
- Laminate panels
- Schedule install
- Install wrap
- Upload completion photos
- Customer sign-off

---

### Signage / Large Format Template

Phases:

- Intake / Quote
- Artwork / File Review
- Proofing
- Materials
- Print / Fabrication
- Finishing
- Installation / Delivery
- Closeout

Common tasks:

- Confirm sign size/material
- Review file resolution
- Create proof
- Receive approval
- Order substrate
- Print graphics
- Mount/finish sign
- Schedule install/delivery
- Complete QC
- Close job

---

### Window Tint Template

Phases:

- Intake / Quote
- Scheduling
- Materials
- Prep
- Installation
- Quality Check
- Customer Sign-Off
- Warranty / Closeout

Common tasks:

- Confirm vehicle/building details
- Confirm film type
- Schedule install
- Prepare surface
- Install film
- Inspect install
- Customer approval
- Send warranty information

---

## Suggested Implementation Phases

### Phase 1 — Data Review and Basic UI

Build the foundation.

Tasks:

- Review existing Controlp.io app architecture, routes, database, ORM, auth, user roles, order model, product model, customer model, file model, payment model, and dashboard layout.
- Do not duplicate existing models.
- Create or extend data models for project/jobs, phases, tasks, milestones, proofs, schedule updates, production blockers, installation/delivery tasks, and quality check items.
- Add Project Management / Production Schedule navigation to the Admin Dashboard.
- Build basic Project Management overview page.
- Build basic jobs/orders schedule page.
- Build task list page.
- Build phase and milestone forms.
- Add customer visibility toggles.
- Add mock data only if database/API is not ready yet.

---

### Phase 2 — Gantt Timeline View

Build the visual scheduling interface.

Tasks:

- Add Gantt chart component.
- Display phases, tasks, milestones, proofs, and production blockers.
- Add filters and date controls.
- Add status colors.
- Add task details drawer/modal.
- Add proof approval detail drawer/modal.
- Add basic dependency display.
- Add rush job indicators.
- Add customer-visible markers.

---

### Phase 3 — Proofs, Approvals, and Production Queue

Connect Gantt scheduling to real production workflow.

Tasks:

- Add proof/approval model and forms.
- Add proof versioning.
- Add customer approval workflow.
- Add revision request workflow.
- Add production queue.
- Add material/file/proof status badges.
- Prevent production from starting if required proof approval is missing, when enabled.
- Connect proof approval to job/order status.

---

### Phase 4 — Installation, Delivery, QC, and Closeout

Build fulfillment and job completion workflows.

Tasks:

- Add installation/delivery scheduling.
- Add quality check items.
- Add completion photo uploads.
- Add customer sign-off workflow.
- Add order closeout status.
- Add final customer-visible updates.
- Add warranty/aftercare task category if needed.

---

### Phase 5 — Notifications and Customer Dashboard Visibility

Improve communication.

Tasks:

- Add notification triggers.
- Add customer-visible timeline view.
- Add proof approval requests in Customer Dashboard.
- Add customer action items.
- Add internal vs customer-visible schedule updates.
- Add activity log.
- Add email notifications.
- Add SMS notifications later if Twilio is connected.

---

### Phase 6 — Advanced Production Management

Add deeper scheduling, automation, and reporting.

Tasks:

- Add drag-and-drop rescheduling.
- Add auto-shift dependent tasks.
- Add schedule impact logging.
- Add critical path indicators.
- Add production capacity view.
- Add equipment/machine scheduling.
- Add PDF/CSV exports.
- Add reporting dashboard.
- Add future calendar sync.
- Add future order/payment automation hooks.
- Add future customer communication automation.

---

## Suggested UI Style

Follow the existing Controlp.io dashboard design system.

Preferred style direction:

- Modern ShadCN UI dashboard layout
- Clean cards, tables, drawers, badges, tabs, and dialogs
- Light/dark mode support
- Clear visual hierarchy
- Soft borders
- Rounded cards
- Useful status badges
- Minimal but practical color coding
- Desktop-first production workflow
- Mobile-friendly customer-facing views where practical

Controlp.io styling should support:

- Admin Dashboard
- Customer Dashboard
- Product Customizer
- Orders
- File Review
- Communications
- Payments
- Reviews
- Production Management

---

## Suggested Components

Potential components:

- ProjectManagementOverview
- ProductionScheduleOverview
- ProjectGanttChart
- JobTimeline
- JobPhaseList
- JobPhaseForm
- ProductionTaskList
- ProductionTaskForm
- ProductionTaskDrawer
- ProjectMilestoneList
- ProjectMilestoneForm
- ProofApprovalList
- ProofApprovalForm
- ProofApprovalDrawer
- TaskDependencyForm
- ScheduleUpdateForm
- VendorAssignmentForm
- ProductionQueue
- ProductionBlockerList
- ProductionBlockerForm
- InstallationDeliveryList
- InstallationDeliveryForm
- QualityCheckList
- QualityCheckForm
- CustomerScheduleVisibilitySettings
- ScheduleHealthBadge
- ProductionStatusBadge
- ProofStatusBadge
- TaskStatusBadge
- TaskPriorityBadge
- RushJobBadge
- CustomerVisibleBadge

---

## Codex Instructions

When implementing this feature:

1. Review the current Controlp.io codebase before creating new files.
2. Review existing Admin Dashboard and Customer Dashboard structures.
3. Review existing routes, components, models, database schema, API routes, auth, user roles, product/order/customer/file/payment systems, and styling system.
4. Do not duplicate existing customer, order, product, user, file, payment, review, communication, vendor, or task models if they already exist.
5. Extend existing models when appropriate.
6. Build this feature in phases.
7. Start with the Admin Dashboard internal production management experience before the Customer Dashboard.
8. Keep customer visibility settings in place from the beginning.
9. Make the UI clean, practical, and production/order focused.
10. Use reusable components.
11. Add mock data only if the database/API is not ready yet.
12. Clearly document any assumptions before making structural changes.
13. If a Gantt chart library is needed, recommend one before installing it.
14. Prioritize working functionality over visual polish in the first pass.
15. Keep the feature scalable for future SaaS-style print shop / production management features.
16. Ensure the feature can later connect to product customizer jobs, customer proofs, file uploads, payments, order status, and customer communications.

---

## Starter Prompt for Codex

Use the following prompt when starting this feature:

```text
Review the Controlp.io codebase and the documentation file located at /docs/Controlp-Gantt-Project-Management.md.

I want to add a Project Management / Production Schedule module to the Controlp.io Admin Dashboard that includes a Gantt-style project timeline, jobs/orders, production phases, milestones, task management, proof approvals, production queue, schedule updates, vendor/subcontractor assignments, installation/delivery scheduling, quality check, and customer visibility controls.

Before writing code, review the existing dashboard structure, routes, components, models, database schema, user roles, order model, product model, customer model, file upload/review system, payment system, and styling system. Then provide a phased implementation plan based on the Controlp-Gantt-Project-Management.md document.

Start with Phase 1: data structure review, navigation placement, basic Project Management overview page, jobs/orders schedule page, task list page, phase form, milestone form, proof approval status support, and customer visibility toggles.

Do not duplicate existing models. Extend the existing architecture where appropriate. Use the existing Controlp.io design system and dashboard UI patterns. Use mock data only if the database/API is not ready yet.
```

---

## Codex Migration Prompt From Constructed Matter Version

Use this when copying files/components from the Constructed Matter project into Controlp.io:

```text
I am copying an existing Gantt Chart Project Management feature from another VS Code/Codex project into Controlp.io.

Your job is to retrofit the copied files so they work for Controlp.io instead of the original construction CRM.

Before changing code, inspect the copied files and identify:
1. Hardcoded Constructed Matter, CMI, construction, subcontractor, punch list, Buildertrend, project address, room/area, permitting, inspection, or closeout language.
2. Components, routes, models, mock data, enums, forms, labels, badges, and seed data that need to be renamed for Controlp.io.
3. Any imports, paths, aliases, environment assumptions, auth assumptions, or database model names that do not match this Controlp.io project.
4. Any UI components that duplicate existing Controlp.io dashboard components.
5. Any places where the feature should connect to existing Controlp.io orders, customers, products, files, payments, communications, and customer dashboard systems.

Then refactor the feature for Controlp.io with these terminology changes:

- CMI / Constructed Matter → Controlp.io
- Construction Project → Job / Order / Production Project
- Project Address → Customer / Delivery / Install Location
- Subcontractor → Vendor / Subcontractor / Production Partner
- Punch List → Quality Check / Rework / Customer Sign-Off
- Room / Area → Product / Production Area / Install Location
- Permitting → File Review / Customer Approval / Production Readiness
- Inspection → Quality Check
- Final Walkthrough → Final Approval / Customer Sign-Off
- Client → Customer
- Staff Dashboard → Admin Dashboard
- Client Dashboard → Customer Dashboard
- Project Manager → Project Manager / Production Manager
- Schedule Health → Production Health

Prioritize making the copied feature compile and run inside Controlp.io first. After it works, improve labels, data models, and UI polish.
```

---

## Suggested Gantt Library Review

Before installing a new dependency, Codex should review the existing project dependencies.

Potential options:

- If the app already uses a chart/timeline library, extend the existing one first.
- For React/Next.js, consider a lightweight Gantt/timeline library only after checking compatibility.
- If no library is ideal, build a simple first-pass timeline grid using existing table/card components and CSS grid.
- Avoid over-engineering Phase 1.
- Prioritize working CRUD, routing, and schedule data first.

---

## Success Criteria

This feature is successful when:

- Controlp.io admins can create a job/order production schedule.
- Production managers can add phases, tasks, proofs, milestones, blockers, and installation/delivery tasks.
- Designers can manage assigned design/proof tasks.
- Production staff can view and update assigned production tasks.
- Proofs can be sent, reviewed, approved, or marked for revision.
- Production blockers can be created and tracked.
- Schedule changes can be logged.
- Customer visibility can be controlled per item.
- The Gantt chart clearly shows job timing, progress, blockers, milestones, proof approval deadlines, and production status.
- The system supports future customer-facing project/order schedule views.
- The feature can eventually become part of a scalable SaaS-style production management system for print, signage, customization, installation, and fulfillment businesses.
