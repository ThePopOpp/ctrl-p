# Controlp.io — Gantt Timeline Workflow Templates

## File Purpose

This document is the source-of-truth planning file for repeatable Gantt timeline workflow templates inside Controlp.io.

These templates define pre-built print, design, approval, payment, production, shipping, delivery, installation, and closeout workflows that can be automatically added to the Production Schedule / Gantt timeline when a new job, order, or project is created.

Recommended location:

`/docs/gantt-timeline-templates.md`

## How Codex Should Use This File

Codex should review this document before adding or modifying Gantt workflow template logic.

The Controlp.io Gantt Timeline Print Project Manager is already mostly built. This document is intended to extend the existing code by adding reusable workflow templates, not rebuilding the entire project management system.

Codex should:

1. Inspect the existing Gantt / Production Schedule implementation first.
2. Reuse existing schedule item, phase, dependency, task, status, priority, customer visibility, and dashboard patterns wherever possible.
3. Add workflow template support in the smallest clean way possible.
4. Avoid duplicating existing schedule item logic.
5. Avoid hardcoding every workflow directly into UI components.
6. Prefer database-backed templates, seed data, or a clean reusable constants/config layer that can later become Super Admin editable.
7. Keep this feature practical for Controlp.io print, design, fulfillment, shipping, install, and customer approval workflows.

---

# Core Concept

Controlp.io should support repeatable workflow templates that can be applied when creating a job, order, or production schedule.

When a staff/admin user selects a workflow template, the system should automatically create the related Gantt timeline items for that job/order.

A template can include:

- Phases
- Tasks
- Milestones
- Approvals
- Payment checkpoints
- Deposit checkpoints
- Customer actions
- Internal production steps
- Shipping steps
- Local pickup steps
- Delivery steps
- Installation steps
- Dependencies
- Customer-visible items
- Internal-only items
- Blockers
- Approval gates
- Payment gates
- Default owner roles
- Default durations
- Default priorities
- Display order

---

# Recommended Template Categories

## Print

- Standard Print Order
- Large Format Signage
- Rush Print Order
- Reprint / Revision

## Design

- Design + Print Order
- Artwork Cleanup
- Logo / Brand Design
- Proof-Only Design Review

## Apparel

- Embroidery Order
- Screen Printing / Apparel
- Team Apparel Order

## Digital / NFC / QR

- Business Card + Digital Card
- Digital Business Card Only
- NFC Product Setup
- QR Product Setup
- Team Digital Cards

## Installation

- Vehicle Wrap / Fleet Graphics
- Window Tint / Film Installation
- Installation Job

## Fabrication

- CNC / Laser Engraving
- Custom Sign Fabrication
- Acrylic / Metal / Wood Product

## Fulfillment

- Shipping / Fulfillment
- Local Pickup
- Delivery

---

# Recommended Data Model

Codex should adapt these fields to the existing database and ORM/API patterns.

## workflow_templates

Purpose: Stores reusable workflow templates that can be applied to jobs/orders/projects.

Suggested fields:

- id
- template_name
- template_slug
- template_category
- description
- product_type
- is_active
- is_system_template
- created_by
- created_at
- updated_at

Suggested template_category values:

- print
- design
- apparel
- digital_nfc_qr
- installation
- fabrication
- fulfillment
- custom

## workflow_template_items

Purpose: Stores reusable timeline items inside a workflow template.

Suggested fields:

- id
- workflow_template_id
- item_key
- item_name
- item_description
- item_type
- phase_name
- default_duration_days
- default_start_offset_days
- default_owner_role
- default_status
- default_priority
- customer_visible
- internal_only
- blocks_production
- requires_approval
- requires_payment
- requires_deposit
- dependency_key
- dependency_type
- display_order
- created_at
- updated_at

Suggested item_type values:

- phase
- task
- milestone
- approval
- payment
- deposit
- customer_action
- production_step
- shipping
- delivery
- installation
- quality_control
- closeout

Suggested dependency_type values:

- finish_to_start
- start_to_start
- finish_to_finish
- start_to_finish

## Optional future table: workflow_template_applications

Purpose: Tracks when a workflow template is applied to a job/order/project.

Suggested fields:

- id
- workflow_template_id
- order_id
- job_id
- project_id
- applied_by
- applied_at
- created_schedule_item_count
- notes

---

# Template Application Behavior

When a template is selected and applied to a job/order:

1. Create schedule items from the selected workflow template items.
2. Attach all generated schedule items to the selected job/order/project.
3. Convert default offsets and durations into real start/end dates.
4. Preserve display order.
5. Preserve phase groupings.
6. Preserve customer visibility settings.
7. Preserve item types.
8. Preserve default owner roles when actual assignees are not selected yet.
9. Preserve approval/payment/deposit gates.
10. Create dependencies between generated items when dependency keys are present.
11. Allow staff/admin to edit generated schedule items after creation.
12. Do not modify the original template when a generated schedule item is edited.

---

# Standard Field Definitions

## Item Statuses

Recommended statuses:

- Not Started
- Waiting on Customer
- Waiting on Payment
- Waiting on Approval
- Ready
- In Progress
- Needs Review
- Completed
- Approved
- Blocked
- Reopened
- Canceled

## Item Priorities

Recommended priorities:

- Low
- Normal
- High
- Critical
- Blocking Production
- Blocking Release

## Owner Roles

Recommended owner roles:

- System
- Admin
- Sales
- Billing
- Customer
- Design
- Prepress
- Production
- Production Manager
- Fulfillment
- Installer
- Vendor
- Shipping

## Customer Visibility

Customer-visible items may include:

- Order created
- Deposit/payment required
- Artwork requested
- Artwork uploaded
- Proof sent
- Proof approval
- Production started
- Ready for pickup
- Shipping status
- Installation scheduled
- Completion/warranty info

Internal-only items may include:

- Internal prepress notes
- Material checks
- Vendor notes
- Cost-sensitive production issues
- Staff-only blockers
- Machine setup
- Internal quality control notes

---

# Workflow Templates

## 1. Standard Print Order

Best for business cards, flyers, brochures, postcards, stickers, labels, posters, simple signs, and standard print products.

| Order | Item Name | Type | Phase | Owner Role | Duration | Customer Visible | Gate / Dependency Notes |
|---:|---|---|---|---|---:|---|---|
| 1 | Customer Order Created | Milestone | Intake | System / Sales | 0 | Yes | Starts workflow |
| 2 | Payment Received or Deposit Paid | Payment | Billing | Billing | 0 | Yes | Depends on order creation |
| 3 | Artwork Uploaded | Customer Action | Artwork | Customer | 1 | Yes | Depends on order creation |
| 4 | Artwork / File Review | Task | Prepress | Design / Prepress | 1 | Yes | Depends on artwork upload |
| 5 | Artwork Corrections Needed | Task | Prepress | Customer / Design | 1 | Yes | Conditional if artwork is not print-ready |
| 6 | Proof Created | Task | Proofing | Design / Prepress | 1 | Yes | Depends on file review |
| 7 | Customer Proof Approval | Approval | Proofing | Customer | 1 | Yes | Blocks production |
| 8 | Print Pre-Production | Task | Production Prep | Production | 1 | Optional | Depends on proof approval |
| 9 | Material / Stock Check | Task | Production Prep | Production | 1 | No | Depends on pre-production |
| 10 | Print Production | Production Step | Production | Production | 1 | Yes | Depends on stock check |
| 11 | Finishing | Production Step | Finishing | Production | 1 | Optional | Cutting, trimming, folding, laminating, mounting |
| 12 | Quality Control | Quality Control | QC | Production Manager | 1 | Optional | Depends on finishing |
| 13 | Final Payment Due | Payment | Billing | Billing | 0 | Yes | Conditional if balance remains |
| 14 | Ready for Pickup / Shipping | Milestone | Fulfillment | Fulfillment | 0 | Yes | Depends on QC and final payment if required |
| 15 | Pickup / Shipping Completed | Shipping | Fulfillment | Fulfillment | 1 | Yes | Depends on ready status |
| 16 | Order Closed | Closeout | Closeout | Admin / System | 0 | Optional | Depends on fulfillment completion |

## 2. Design + Print Order

Best for customers who need design help before printing.

| Order | Item Name | Type | Phase | Owner Role | Duration | Customer Visible | Gate / Dependency Notes |
|---:|---|---|---|---|---:|---|---|
| 1 | Customer Order Created | Milestone | Intake | System / Sales | 0 | Yes | Starts workflow |
| 2 | Deposit Paid | Deposit | Billing | Billing | 0 | Yes | Required before design kickoff |
| 3 | Design Brief Submitted | Customer Action | Design Intake | Customer | 1 | Yes | Depends on order creation |
| 4 | Customer Assets Uploaded | Customer Action | Design Intake | Customer | 1 | Yes | Logos, images, brand files, copy |
| 5 | Design Kickoff | Task | Design | Design | 1 | Optional | Depends on deposit and assets |
| 6 | Initial Design Concept | Task | Design | Design | 2 | Optional | Depends on kickoff |
| 7 | Internal Design Review | Task | Design | Design / Admin | 1 | No | Depends on initial concept |
| 8 | Design Proof Sent to Customer | Milestone | Proofing | Design | 0 | Yes | Depends on internal review |
| 9 | Customer Design Review | Approval | Proofing | Customer | 1 | Yes | Blocks final file prep |
| 10 | Revision Round 1 | Task | Revisions | Design | 1 | Yes | Conditional if revisions are needed |
| 11 | Revised Proof Sent | Milestone | Proofing | Design | 0 | Yes | Conditional |
| 12 | Final Design Approval | Approval | Proofing | Customer | 1 | Yes | Blocks production |
| 13 | Print-Ready File Prep | Task | Prepress | Prepress | 1 | Optional | Depends on final approval |
| 14 | Production Preflight | Task | Prepress | Prepress | 1 | No | Depends on print-ready file prep |
| 15 | Material / Stock Check | Task | Production Prep | Production | 1 | No | Depends on preflight |
| 16 | Print Production | Production Step | Production | Production | 1 | Yes | Depends on stock check |
| 17 | Finishing | Production Step | Finishing | Production | 1 | Optional | Depends on print production |
| 18 | Quality Control | Quality Control | QC | Production Manager | 1 | Optional | Depends on finishing |
| 19 | Final Payment Due | Payment | Billing | Billing | 0 | Yes | Conditional if balance remains |
| 20 | Ready for Pickup / Shipping | Milestone | Fulfillment | Fulfillment | 0 | Yes | Depends on QC and final payment |
| 21 | Pickup / Shipping Completed | Shipping | Fulfillment | Fulfillment | 1 | Yes | Depends on ready status |
| 22 | Order Closed | Closeout | Closeout | Admin / System | 0 | Optional | Ends workflow |

## 3. Business Card + Digital Card

Best for printed business cards, NFC business cards, QR business cards, premium cards, team cards, and digital business card subscriptions.

| Order | Item Name | Type | Phase | Owner Role | Duration | Customer Visible | Gate / Dependency Notes |
|---:|---|---|---|---|---:|---|---|
| 1 | Customer Order Created | Milestone | Intake | System / Sales | 0 | Yes | Starts workflow |
| 2 | Product Package Selected | Task | Intake | Sales | 0 | Yes | Select print/digital/NFC package |
| 3 | Monthly Digital Card Access Created | Task | Digital Card | System / Admin | 1 | Yes | If digital card hosting included or purchased |
| 4 | Deposit / Payment Received | Payment | Billing | Billing | 0 | Yes | Required before production |
| 5 | Customer Business Card Details Submitted | Customer Action | Content | Customer | 1 | Yes | Name, title, phone, email, address |
| 6 | Logo / Photo / Brand Assets Uploaded | Customer Action | Content | Customer | 1 | Yes | Depends on content request |
| 7 | Digital Business Card Draft Created | Task | Digital Card | Design / Admin | 1 | Yes | Depends on customer details |
| 8 | QR Code Generated | Task | QR / NFC | System / Design | 1 | Yes | Depends on public digital card URL |
| 9 | Business Card Artwork Created | Task | Design | Design | 2 | Yes | Includes QR code if applicable |
| 10 | Internal Artwork Review | Task | Design | Design / Admin | 1 | No | Depends on artwork |
| 11 | Customer Proof Sent | Milestone | Proofing | Design | 0 | Yes | Depends on internal review |
| 12 | Customer Proof Approval | Approval | Proofing | Customer | 1 | Yes | Blocks production |
| 13 | Digital Card Public URL Confirmed | Milestone | Digital Card | Admin / System | 0 | Yes | Required before final QR/NFC linking |
| 14 | QR Code Linked to Digital Card | Task | QR / NFC | Design / System | 1 | Optional | Depends on public URL |
| 15 | NFC Destination URL Prepared | Task | QR / NFC | Admin / Production | 1 | Optional | If NFC product is included |
| 16 | Print Pre-Production | Task | Production Prep | Production | 1 | Optional | Depends on proof approval |
| 17 | Business Card Production | Production Step | Production | Production | 1 | Yes | Depends on pre-production |
| 18 | NFC Encoding / Assignment | Task | QR / NFC | Admin / Production | 1 | Optional | If NFC product is included |
| 19 | Quality Control | Quality Control | QC | Production Manager | 1 | Optional | Depends on production |
| 20 | Subscription / Hosting Status Confirmed | Task | Digital Card | Billing / Admin | 0 | Yes | Must be active before digital card activation |
| 21 | Final Payment Due | Payment | Billing | Billing | 0 | Yes | Conditional if balance remains |
| 22 | Ready for Pickup / Shipping | Milestone | Fulfillment | Fulfillment | 0 | Yes | Depends on QC and payment |
| 23 | Pickup / Shipping Completed | Shipping | Fulfillment | Fulfillment | 1 | Yes | Depends on ready status |
| 24 | Customer Digital Card Activated | Milestone | Digital Card | System / Admin | 0 | Yes | Depends on hosting status |
| 25 | Order Closed | Closeout | Closeout | Admin / System | 0 | Optional | Ends workflow |

## 4. Vehicle Wrap / Fleet Graphics

Best for vehicle wraps, partial wraps, decals, fleet graphics, window graphics, and branded vehicle installs.

| Order | Item Name | Type | Phase | Owner Role | Duration | Customer Visible | Gate / Dependency Notes |
|---:|---|---|---|---|---:|---|---|
| 1 | Customer Order / Quote Approved | Milestone | Intake | Sales | 0 | Yes | Starts workflow |
| 2 | Deposit Paid | Deposit | Billing | Billing | 0 | Yes | Required before design |
| 3 | Vehicle Information Collected | Customer Action | Intake | Customer / Sales | 1 | Yes | Year, make, model, trim |
| 4 | Vehicle Photos Uploaded | Customer Action | Intake | Customer | 1 | Yes | Required for design |
| 5 | Measurements / Template Confirmed | Task | Design Prep | Design / Installer | 1 | Optional | Depends on vehicle info |
| 6 | Design Brief Submitted | Customer Action | Design Intake | Customer | 1 | Yes | Depends on order |
| 7 | Initial Wrap Design | Task | Design | Design | 3 | Optional | Depends on brief/photos |
| 8 | Internal Design Review | Task | Design | Design / Admin | 1 | No | Depends on design |
| 9 | Customer Proof Sent | Milestone | Proofing | Design | 0 | Yes | Depends on internal review |
| 10 | Customer Proof Approval | Approval | Proofing | Customer | 1 | Yes | Blocks print production |
| 11 | Print-Ready File Prep | Task | Prepress | Prepress | 1 | Optional | Depends on proof approval |
| 12 | Material Check / Vinyl Stock Confirmed | Task | Production Prep | Production | 1 | No | Depends on file prep |
| 13 | Print Production | Production Step | Production | Production | 2 | Yes | Depends on material check |
| 14 | Lamination | Production Step | Finishing | Production | 1 | Optional | Depends on printing |
| 15 | Trim / Panel Prep | Production Step | Finishing | Production | 1 | Optional | Depends on lamination |
| 16 | Installation Scheduled | Task | Installation | Admin / Installer | 1 | Yes | Depends on production readiness |
| 17 | Vehicle Drop-Off Confirmed | Customer Action | Installation | Customer | 0 | Yes | Depends on schedule |
| 18 | Surface Prep / Cleaning | Task | Installation | Installer | 1 | Optional | Depends on vehicle arrival |
| 19 | Installation | Installation | Installation | Installer | 2 | Yes | Depends on surface prep |
| 20 | Installation Quality Control | Quality Control | QC | Production Manager | 1 | Optional | Depends on install |
| 21 | Customer Walkthrough | Approval | Closeout | Customer / Installer | 1 | Yes | Depends on QC |
| 22 | Final Payment Due | Payment | Billing | Billing | 0 | Yes | Conditional |
| 23 | Vehicle Pickup / Delivery | Delivery | Fulfillment | Customer / Installer | 0 | Yes | Depends on final payment if required |
| 24 | Warranty Info Sent | Milestone | Closeout | Admin | 0 | Yes | Depends on pickup/delivery |
| 25 | Project Closed | Closeout | Closeout | Admin / System | 0 | Optional | Ends workflow |

## 5. Window Tint / Film Installation

Best for vehicle tint, office window film, privacy film, decorative glass film, commercial window film, and residential installs.

| Order | Item Name | Type | Phase | Owner Role | Duration | Customer Visible | Gate / Dependency Notes |
|---:|---|---|---|---|---:|---|---|
| 1 | Customer Order / Appointment Created | Milestone | Intake | Sales / System | 0 | Yes | Starts workflow |
| 2 | Deposit Paid if Required | Deposit | Billing | Billing | 0 | Yes | Conditional |
| 3 | Film Type Selected | Customer Action | Product Selection | Customer / Sales | 1 | Yes | Required before material check |
| 4 | Vehicle / Window Details Collected | Customer Action | Intake | Customer / Sales | 1 | Yes | Vehicle or building details |
| 5 | Measurements Confirmed | Task | Prep | Installer / Production | 1 | Optional | Depends on details |
| 6 | Material Availability Check | Task | Prep | Production | 1 | No | Depends on film type |
| 7 | Installation Scheduled | Task | Scheduling | Admin / Installer | 1 | Yes | Depends on material availability |
| 8 | Customer Reminder Sent | Milestone | Scheduling | System / Admin | 0 | Yes | Depends on install date |
| 9 | Vehicle / Site Arrival Confirmed | Customer Action | Installation | Customer / Installer | 0 | Yes | Depends on schedule |
| 10 | Surface Prep | Task | Installation | Installer | 1 | Optional | Depends on arrival |
| 11 | Film Cutting / Plotting | Production Step | Installation | Installer / Production | 1 | Optional | Depends on measurements |
| 12 | Installation | Installation | Installation | Installer | 1 | Yes | Depends on prep/cutting |
| 13 | Curing Instructions Provided | Milestone | Closeout | Installer / Admin | 0 | Yes | Depends on install |
| 14 | Quality Control | Quality Control | QC | Production Manager | 1 | Optional | Depends on install |
| 15 | Final Payment Due | Payment | Billing | Billing | 0 | Yes | Conditional |
| 16 | Customer Pickup / Job Completion | Delivery | Fulfillment | Customer / Installer | 0 | Yes | Depends on payment if required |
| 17 | Warranty Info Sent | Milestone | Closeout | Admin | 0 | Yes | Depends on completion |
| 18 | Order Closed | Closeout | Closeout | Admin / System | 0 | Optional | Ends workflow |

## 6. Embroidery Order

Best for hats, shirts, polos, jackets, uniforms, bags, patches, and apparel embroidery.

| Order | Item Name | Type | Phase | Owner Role | Duration | Customer Visible | Gate / Dependency Notes |
|---:|---|---|---|---|---:|---|---|
| 1 | Customer Order Created | Milestone | Intake | System / Sales | 0 | Yes | Starts workflow |
| 2 | Deposit / Payment Received | Payment | Billing | Billing | 0 | Yes | Required before production |
| 3 | Apparel / Product Selection Confirmed | Customer Action | Product Selection | Customer / Sales | 1 | Yes | Hats, shirts, bags, etc. |
| 4 | Sizes / Quantities Confirmed | Customer Action | Product Selection | Customer | 1 | Yes | Depends on product selection |
| 5 | Logo / Artwork Uploaded | Customer Action | Artwork | Customer | 1 | Yes | Required before digitizing |
| 6 | Artwork Review | Task | Prepress | Design / Prepress | 1 | Yes | Depends on upload |
| 7 | Digitizing Required | Milestone | Digitizing | Design | 0 | Optional | Conditional |
| 8 | Embroidery Digitizing | Task | Digitizing | Design / Vendor | 2 | Optional | Depends on artwork review |
| 9 | Sew-Out Sample | Task | Sample | Production | 1 | Yes | Depends on digitizing |
| 10 | Internal Sample Review | Task | Sample | Production Manager | 1 | No | Depends on sew-out |
| 11 | Customer Sample Approval | Approval | Proofing | Customer | 1 | Yes | Blocks production |
| 12 | Thread Colors Confirmed | Task | Production Prep | Production | 1 | Optional | Depends on sample approval |
| 13 | Garments Received / Pulled | Task | Production Prep | Production | 1 | Optional | Depends on product selection |
| 14 | Production Scheduled | Task | Scheduling | Production Manager | 1 | Yes | Depends on garments and approval |
| 15 | Embroidery Production | Production Step | Production | Production | 2 | Yes | Depends on schedule |
| 16 | Trimming / Cleanup | Production Step | Finishing | Production | 1 | Optional | Depends on embroidery |
| 17 | Quality Control | Quality Control | QC | Production Manager | 1 | Optional | Depends on cleanup |
| 18 | Folding / Packaging | Task | Fulfillment | Fulfillment | 1 | Optional | Depends on QC |
| 19 | Final Payment Due | Payment | Billing | Billing | 0 | Yes | Conditional |
| 20 | Ready for Pickup / Shipping | Milestone | Fulfillment | Fulfillment | 0 | Yes | Depends on payment/QC |
| 21 | Pickup / Shipping Completed | Shipping | Fulfillment | Fulfillment | 1 | Yes | Depends on ready status |
| 22 | Order Closed | Closeout | Closeout | Admin / System | 0 | Optional | Ends workflow |

## 7. Screen Printing / Apparel

Best for T-shirts, hoodies, uniforms, event shirts, merch drops, and bulk apparel.

| Order | Item Name | Type | Phase | Owner Role | Duration | Customer Visible | Gate / Dependency Notes |
|---:|---|---|---|---|---:|---|---|
| 1 | Customer Order Created | Milestone | Intake | System / Sales | 0 | Yes | Starts workflow |
| 2 | Deposit Paid | Deposit | Billing | Billing | 0 | Yes | Required before garments are ordered |
| 3 | Apparel Style Selected | Customer Action | Product Selection | Customer / Sales | 1 | Yes | Product style and color |
| 4 | Sizes / Quantities Confirmed | Customer Action | Product Selection | Customer | 1 | Yes | Required before ordering |
| 5 | Artwork Uploaded | Customer Action | Artwork | Customer | 1 | Yes | Required before proof |
| 6 | Artwork Review | Task | Prepress | Design / Prepress | 1 | Yes | Depends on artwork upload |
| 7 | Colors / Print Locations Confirmed | Task | Prepress | Customer / Design | 1 | Yes | Front, back, sleeve, etc. |
| 8 | Proof Created | Task | Proofing | Design | 1 | Yes | Depends on artwork review |
| 9 | Customer Proof Approval | Approval | Proofing | Customer | 1 | Yes | Blocks screens/setup |
| 10 | Screens / Setup Prep | Production Step | Production Prep | Production | 1 | No | Depends on approval |
| 11 | Garments Ordered | Task | Procurement | Production / Sales | 2 | Optional | Depends on deposit and quantities |
| 12 | Garments Received | Milestone | Procurement | Production | 0 | Optional | Blocks production |
| 13 | Production Scheduled | Task | Scheduling | Production Manager | 1 | Yes | Depends on garments and setup |
| 14 | Screen Printing Production | Production Step | Production | Production | 2 | Yes | Depends on schedule |
| 15 | Curing / Drying | Production Step | Finishing | Production | 1 | Optional | Depends on printing |
| 16 | Quality Control | Quality Control | QC | Production Manager | 1 | Optional | Depends on curing |
| 17 | Folding / Packaging | Task | Fulfillment | Fulfillment | 1 | Optional | Depends on QC |
| 18 | Final Payment Due | Payment | Billing | Billing | 0 | Yes | Conditional |
| 19 | Ready for Pickup / Shipping | Milestone | Fulfillment | Fulfillment | 0 | Yes | Depends on payment/QC |
| 20 | Pickup / Shipping Completed | Shipping | Fulfillment | Fulfillment | 1 | Yes | Depends on ready status |
| 21 | Order Closed | Closeout | Closeout | Admin / System | 0 | Optional | Ends workflow |

## 8. Large Format Signage

Best for banners, yard signs, wall graphics, posters, mounted signs, acrylic signs, aluminum signs, PVC signs, and trade show displays.

| Order | Item Name | Type | Phase | Owner Role | Duration | Customer Visible | Gate / Dependency Notes |
|---:|---|---|---|---|---:|---|---|
| 1 | Customer Order Created | Milestone | Intake | System / Sales | 0 | Yes | Starts workflow |
| 2 | Deposit Paid | Deposit | Billing | Billing | 0 | Yes | Required before production |
| 3 | Product Type / Size Confirmed | Customer Action | Product Selection | Customer / Sales | 1 | Yes | Size, material, quantity |
| 4 | Artwork Uploaded | Customer Action | Artwork | Customer | 1 | Yes | Required before file review |
| 5 | Artwork Review | Task | Prepress | Design / Prepress | 1 | Yes | Depends on upload |
| 6 | Design / Layout Adjustments | Task | Design | Design | 1 | Yes | Conditional |
| 7 | Proof Created | Task | Proofing | Design | 1 | Yes | Depends on artwork review |
| 8 | Customer Proof Approval | Approval | Proofing | Customer | 1 | Yes | Blocks production |
| 9 | Material Availability Check | Task | Production Prep | Production | 1 | No | Depends on product type |
| 10 | Print Pre-Production | Task | Production Prep | Production | 1 | Optional | Depends on approval/materials |
| 11 | Large Format Printing | Production Step | Production | Production | 1 | Yes | Depends on pre-production |
| 12 | Lamination if Required | Production Step | Finishing | Production | 1 | Optional | Conditional |
| 13 | Mounting if Required | Production Step | Finishing | Production | 1 | Optional | Conditional |
| 14 | Cutting / Routing / Finishing | Production Step | Finishing | Production | 1 | Optional | Depends on print/mount |
| 15 | Hardware / Grommets / Stand Prep | Task | Finishing | Production | 1 | Optional | Conditional |
| 16 | Quality Control | Quality Control | QC | Production Manager | 1 | Optional | Depends on finishing |
| 17 | Final Payment Due | Payment | Billing | Billing | 0 | Yes | Conditional |
| 18 | Ready for Pickup / Shipping / Install | Milestone | Fulfillment | Fulfillment | 0 | Yes | Depends on payment/QC |
| 19 | Pickup / Shipping / Install Completed | Delivery | Fulfillment | Fulfillment / Installer | 1 | Yes | Depends on ready status |
| 20 | Order Closed | Closeout | Closeout | Admin / System | 0 | Optional | Ends workflow |

## 9. CNC / Laser Engraving

Best for wood, acrylic, metal, aluminum, plastic, signs, plaques, awards, tags, labels, and custom cut products.

| Order | Item Name | Type | Phase | Owner Role | Duration | Customer Visible | Gate / Dependency Notes |
|---:|---|---|---|---|---:|---|---|
| 1 | Customer Order Created | Milestone | Intake | System / Sales | 0 | Yes | Starts workflow |
| 2 | Deposit Paid | Deposit | Billing | Billing | 0 | Yes | Required before production |
| 3 | Material Selected | Customer Action | Product Selection | Customer / Sales | 1 | Yes | Wood, acrylic, metal, etc. |
| 4 | Dimensions Confirmed | Customer Action | Product Selection | Customer / Sales | 1 | Yes | Required for file prep |
| 5 | Artwork / Vector File Uploaded | Customer Action | Artwork | Customer | 1 | Yes | Required |
| 6 | File Review | Task | Prepress | Design / Prepress | 1 | Yes | Depends on vector upload |
| 7 | Design / Vector Cleanup | Task | Design | Design | 1 | Optional | Conditional |
| 8 | Proof Created | Task | Proofing | Design | 1 | Yes | Depends on file review |
| 9 | Customer Proof Approval | Approval | Proofing | Customer | 1 | Yes | Blocks production |
| 10 | Material Availability Check | Task | Production Prep | Production | 1 | No | Depends on material selection |
| 11 | Machine Setup | Production Step | Production Prep | Production | 1 | No | Depends on approval/material |
| 12 | Test Cut / Test Engrave | Production Step | Testing | Production | 1 | Optional | Depends on machine setup |
| 13 | Internal Review | Quality Control | Testing | Production Manager | 1 | No | Depends on test |
| 14 | CNC Cutting / Laser Engraving | Production Step | Production | Production | 2 | Yes | Depends on internal review |
| 15 | Cleanup / Edge Finishing | Production Step | Finishing | Production | 1 | Optional | Depends on production |
| 16 | Assembly if Required | Production Step | Finishing | Production | 1 | Optional | Conditional |
| 17 | Quality Control | Quality Control | QC | Production Manager | 1 | Optional | Depends on finishing |
| 18 | Final Payment Due | Payment | Billing | Billing | 0 | Yes | Conditional |
| 19 | Ready for Pickup / Shipping | Milestone | Fulfillment | Fulfillment | 0 | Yes | Depends on payment/QC |
| 20 | Pickup / Shipping Completed | Shipping | Fulfillment | Fulfillment | 1 | Yes | Depends on ready status |
| 21 | Order Closed | Closeout | Closeout | Admin / System | 0 | Optional | Ends workflow |

## 10. Shipping / Fulfillment

Best for any order that ships to the customer after production.

| Order | Item Name | Type | Phase | Owner Role | Duration | Customer Visible | Gate / Dependency Notes |
|---:|---|---|---|---|---:|---|---|
| 1 | Production Completed | Milestone | Production | Production | 0 | Yes | Starting point if added after production |
| 2 | Quality Control Completed | Quality Control | QC | Production Manager | 0 | Optional | Required before packing |
| 3 | Final Payment Confirmed | Payment | Billing | Billing | 0 | Yes | Required before shipment if balance remains |
| 4 | Shipping Address Confirmed | Customer Action | Fulfillment | Customer / Fulfillment | 1 | Yes | Required before label |
| 5 | Shipping Method Selected | Task | Fulfillment | Customer / Fulfillment | 1 | Yes | Pickup, USPS, UPS, courier, freight |
| 6 | Package Dimensions / Weight Entered | Task | Fulfillment | Fulfillment | 1 | No | Required for label |
| 7 | Shipping Label Created | Shipping | Fulfillment | Fulfillment | 0 | Optional | Depends on address/method |
| 8 | Package Packed | Shipping | Fulfillment | Fulfillment | 1 | Optional | Depends on QC |
| 9 | Tracking Number Added | Shipping | Fulfillment | Fulfillment | 0 | Yes | Depends on label |
| 10 | Customer Shipping Notification Sent | Milestone | Fulfillment | System / Fulfillment | 0 | Yes | Depends on tracking |
| 11 | Carrier Pickup / Drop-Off | Shipping | Fulfillment | Fulfillment | 0 | Yes | Depends on packing |
| 12 | In Transit | Shipping | Fulfillment | Carrier / System | 1 | Yes | Optional status |
| 13 | Delivered | Milestone | Fulfillment | Carrier / System | 0 | Yes | Optional status |
| 14 | Order Closed | Closeout | Closeout | Admin / System | 0 | Optional | Ends workflow |

## 11. Installation Job

Best for vehicle wraps, signs, wall graphics, window film, office branding, decals, displays, and onsite installs.

| Order | Item Name | Type | Phase | Owner Role | Duration | Customer Visible | Gate / Dependency Notes |
|---:|---|---|---|---|---:|---|---|
| 1 | Production Completed | Milestone | Production | Production | 0 | Yes | Starting point if added post-production |
| 2 | Quality Control Completed | Quality Control | QC | Production Manager | 0 | Optional | Required before install prep |
| 3 | Install Site / Vehicle Details Confirmed | Customer Action | Installation Prep | Customer / Installer | 1 | Yes | Address, access, vehicle, site info |
| 4 | Install Deposit / Balance Confirmed | Payment | Billing | Billing | 0 | Yes | Conditional |
| 5 | Installation Scheduled | Task | Scheduling | Admin / Installer | 1 | Yes | Depends on production complete |
| 6 | Installer Assigned | Task | Scheduling | Admin | 1 | Optional | Depends on schedule |
| 7 | Customer Reminder Sent | Milestone | Scheduling | System / Admin | 0 | Yes | Depends on schedule |
| 8 | Materials Loaded / Prepared | Task | Installation Prep | Installer / Production | 1 | No | Depends on installer assigned |
| 9 | Installer En Route | Milestone | Installation | Installer | 0 | Optional | Optional customer-visible status |
| 10 | Site Arrival / Vehicle Drop-Off Confirmed | Customer Action | Installation | Customer / Installer | 0 | Yes | Depends on schedule |
| 11 | Surface Prep | Task | Installation | Installer | 1 | Optional | Depends on arrival |
| 12 | Installation | Installation | Installation | Installer | 1 | Yes | Depends on prep |
| 13 | Install Quality Control | Quality Control | QC | Installer / Manager | 1 | Optional | Depends on install |
| 14 | Customer Walkthrough | Approval | Closeout | Customer / Installer | 1 | Yes | Depends on QC |
| 15 | Customer Approval / Sign-Off | Approval | Closeout | Customer | 0 | Yes | Blocks closeout |
| 16 | Final Payment Due | Payment | Billing | Billing | 0 | Yes | Conditional |
| 17 | Warranty / Care Instructions Sent | Milestone | Closeout | Admin | 0 | Yes | Depends on sign-off |
| 18 | Installation Closed | Closeout | Closeout | Admin / System | 0 | Optional | Ends workflow |

## 12. Deposit + Approval Controlled Job

Best for high-value print jobs, vehicle wraps, custom fabrication, large signage, team apparel, and jobs requiring multiple approval/payment gates.

| Order | Item Name | Type | Phase | Owner Role | Duration | Customer Visible | Gate / Dependency Notes |
|---:|---|---|---|---|---:|---|---|
| 1 | Quote Sent | Milestone | Sales | Sales | 0 | Yes | Starts workflow |
| 2 | Quote Approved | Approval | Sales | Customer | 0 | Yes | Required before deposit |
| 3 | Deposit Invoice Sent | Deposit | Billing | Billing | 0 | Yes | Depends on quote approval |
| 4 | Deposit Paid | Deposit | Billing | Billing | 0 | Yes | Blocks kickoff |
| 5 | Customer Files / Details Submitted | Customer Action | Intake | Customer | 1 | Yes | Depends on deposit |
| 6 | Internal Kickoff | Task | Intake | Admin / Production Manager | 1 | Optional | Depends on deposit/files |
| 7 | Design / File Review | Task | Prepress | Design / Prepress | 1 | Yes | Depends on kickoff |
| 8 | Proof Created | Task | Proofing | Design | 1 | Yes | Depends on review |
| 9 | Customer Proof Approval | Approval | Proofing | Customer | 1 | Yes | Blocks production |
| 10 | Production Invoice / Balance Sent | Payment | Billing | Billing | 0 | Yes | Conditional before production |
| 11 | Production Payment Confirmed | Payment | Billing | Billing | 0 | Yes | Conditional gate |
| 12 | Production Scheduled | Task | Scheduling | Production Manager | 1 | Yes | Depends on proof/payment gate |
| 13 | Production Started | Production Step | Production | Production | 1 | Yes | Depends on schedule |
| 14 | Production Completed | Milestone | Production | Production | 0 | Yes | Depends on production |
| 15 | Quality Control | Quality Control | QC | Production Manager | 1 | Optional | Depends on completion |
| 16 | Final Balance Sent | Payment | Billing | Billing | 0 | Yes | Conditional |
| 17 | Final Payment Confirmed | Payment | Billing | Billing | 0 | Yes | Required before release if balance remains |
| 18 | Pickup / Shipping / Install Scheduled | Task | Fulfillment | Fulfillment / Installer | 1 | Yes | Depends on final payment/QC |
| 19 | Pickup / Shipping / Install Completed | Delivery | Fulfillment | Fulfillment / Installer | 1 | Yes | Depends on schedule |
| 20 | Order Closed | Closeout | Closeout | Admin / System | 0 | Optional | Ends workflow |

## 13. Rush Print Order

Best for same-day print, next-day print, emergency signage, event materials, last-minute business cards, and urgent apparel.

| Order | Item Name | Type | Phase | Owner Role | Duration | Customer Visible | Gate / Dependency Notes |
|---:|---|---|---|---|---:|---|---|
| 1 | Rush Order Created | Milestone | Intake | Sales / System | 0 | Yes | Starts workflow |
| 2 | Rush Fee Confirmed | Payment | Billing | Sales / Billing | 0 | Yes | Required |
| 3 | Full Payment Received | Payment | Billing | Billing | 0 | Yes | Blocks production |
| 4 | Artwork Uploaded | Customer Action | Artwork | Customer | 0 | Yes | Immediate need |
| 5 | Immediate File Review | Task | Prepress | Design / Prepress | 0 | Yes | Depends on artwork |
| 6 | Artwork Approved or Corrections Needed | Approval | Prepress | Design / Customer | 0 | Yes | Blocks proof/production |
| 7 | Proof Sent if Required | Milestone | Proofing | Design | 0 | Yes | Conditional |
| 8 | Customer Approval Deadline | Approval | Proofing | Customer | 0 | Yes | Time-sensitive blocking gate |
| 9 | Production Slot Reserved | Task | Scheduling | Production Manager | 0 | Optional | Depends on payment/approval |
| 10 | Rush Production | Production Step | Production | Production | 1 | Yes | Depends on slot |
| 11 | Quality Control | Quality Control | QC | Production Manager | 0 | Optional | Depends on production |
| 12 | Ready for Pickup / Shipping | Milestone | Fulfillment | Fulfillment | 0 | Yes | Depends on QC |
| 13 | Customer Notification Sent | Milestone | Fulfillment | System / Fulfillment | 0 | Yes | Depends on ready status |
| 14 | Pickup / Shipping Completed | Shipping | Fulfillment | Fulfillment | 0 | Yes | Depends on notification |
| 15 | Order Closed | Closeout | Closeout | Admin / System | 0 | Optional | Ends workflow |

## 14. Reprint / Revision

Best for reorders, revisions, replacement prints, corrected files, updated business cards, updated stickers, and updated signage.

| Order | Item Name | Type | Phase | Owner Role | Duration | Customer Visible | Gate / Dependency Notes |
|---:|---|---|---|---|---:|---|---|
| 1 | Reprint / Revision Request Created | Milestone | Intake | Customer / Sales | 0 | Yes | Starts workflow |
| 2 | Original Order Located | Task | Intake | Admin / Sales | 1 | Optional | Required before reuse |
| 3 | Updated Artwork / Details Confirmed | Customer Action | Artwork | Customer / Design | 1 | Yes | Depends on original order |
| 4 | Price Difference / Payment Confirmed | Payment | Billing | Billing | 0 | Yes | Conditional |
| 5 | Updated Proof Created if Needed | Task | Proofing | Design | 1 | Yes | Conditional |
| 6 | Customer Approval if Needed | Approval | Proofing | Customer | 1 | Yes | Conditional blocking gate |
| 7 | Production Scheduled | Task | Scheduling | Production Manager | 1 | Yes | Depends on payment/approval |
| 8 | Reprint Production | Production Step | Production | Production | 1 | Yes | Depends on schedule |
| 9 | Quality Control | Quality Control | QC | Production Manager | 1 | Optional | Depends on production |
| 10 | Ready for Pickup / Shipping | Milestone | Fulfillment | Fulfillment | 0 | Yes | Depends on QC/payment |
| 11 | Pickup / Shipping Completed | Shipping | Fulfillment | Fulfillment | 1 | Yes | Depends on ready status |
| 12 | Order Closed | Closeout | Closeout | Admin / System | 0 | Optional | Ends workflow |

## 15. Team Business Card Order

Best for companies ordering business cards, digital cards, QR/NFC cards, or ID cards for multiple team members.

| Order | Item Name | Type | Phase | Owner Role | Duration | Customer Visible | Gate / Dependency Notes |
|---:|---|---|---|---|---:|---|---|
| 1 | Company Order Created | Milestone | Intake | System / Sales | 0 | Yes | Starts workflow |
| 2 | Deposit / Payment Received | Payment | Billing | Billing | 0 | Yes | Required before processing |
| 3 | Employee Data Requested | Customer Action | Content | Customer / Admin | 0 | Yes | Depends on order |
| 4 | Employee Data Uploaded | Customer Action | Content | Customer | 2 | Yes | CSV, spreadsheet, or form |
| 5 | Data Review / Cleanup | Task | Content | Admin / Design | 1 | Optional | Depends on upload |
| 6 | Template Selected | Customer Action | Design | Customer / Design | 1 | Yes | Depends on package |
| 7 | Individual Card Proofs Generated | Task | Proofing | Design / System | 2 | Yes | Depends on data cleanup |
| 8 | Internal Proof Review | Task | Proofing | Design / Admin | 1 | No | Depends on proofs |
| 9 | Customer Batch Proof Sent | Milestone | Proofing | Design | 0 | Yes | Depends on internal review |
| 10 | Customer Batch Approval | Approval | Proofing | Customer | 2 | Yes | Blocks production |
| 11 | Digital Cards Created if Included | Task | Digital Card | System / Admin | 2 | Yes | Conditional |
| 12 | QR Codes Generated if Included | Task | QR / NFC | System / Design | 1 | Yes | Conditional |
| 13 | NFC URLs Prepared if Included | Task | QR / NFC | Admin / Production | 1 | Optional | Conditional |
| 14 | Print Pre-Production | Task | Production Prep | Production | 1 | Optional | Depends on approval |
| 15 | Card Production | Production Step | Production | Production | 2 | Yes | Depends on pre-production |
| 16 | NFC Encoding / Assignment if Applicable | Task | QR / NFC | Admin / Production | 1 | Optional | Conditional |
| 17 | Quality Control | Quality Control | QC | Production Manager | 1 | Optional | Depends on production |
| 18 | Cards Sorted by Employee / Department | Task | Fulfillment | Fulfillment | 1 | Optional | Depends on QC |
| 19 | Final Payment Due | Payment | Billing | Billing | 0 | Yes | Conditional |
| 20 | Ready for Pickup / Shipping | Milestone | Fulfillment | Fulfillment | 0 | Yes | Depends on payment/QC |
| 21 | Pickup / Shipping Completed | Shipping | Fulfillment | Fulfillment | 1 | Yes | Depends on ready status |
| 22 | Digital Card Access Activated | Milestone | Digital Card | System / Admin | 0 | Yes | Conditional |
| 23 | Order Closed | Closeout | Closeout | Admin / System | 0 | Optional | Ends workflow |

## 16. Local Pickup

Best for orders picked up by the customer at a Controlp.io location.

| Order | Item Name | Type | Phase | Owner Role | Duration | Customer Visible | Gate / Dependency Notes |
|---:|---|---|---|---|---:|---|---|
| 1 | Production Completed | Milestone | Production | Production | 0 | Yes | Starting point |
| 2 | Quality Control Completed | Quality Control | QC | Production Manager | 0 | Optional | Required before pickup |
| 3 | Final Payment Confirmed | Payment | Billing | Billing | 0 | Yes | Required if balance remains |
| 4 | Pickup Location Confirmed | Task | Fulfillment | Fulfillment | 0 | Yes | Depends on ready status |
| 5 | Customer Pickup Notification Sent | Milestone | Fulfillment | System / Fulfillment | 0 | Yes | Depends on QC/payment |
| 6 | Order Staged for Pickup | Task | Fulfillment | Fulfillment | 1 | Optional | Depends on notification |
| 7 | Customer Pickup Completed | Milestone | Fulfillment | Customer / Fulfillment | 0 | Yes | Depends on staging |
| 8 | Order Closed | Closeout | Closeout | Admin / System | 0 | Optional | Ends workflow |

## 17. Delivery

Best for local delivery by staff/courier rather than carrier shipping.

| Order | Item Name | Type | Phase | Owner Role | Duration | Customer Visible | Gate / Dependency Notes |
|---:|---|---|---|---|---:|---|---|
| 1 | Production Completed | Milestone | Production | Production | 0 | Yes | Starting point |
| 2 | Quality Control Completed | Quality Control | QC | Production Manager | 0 | Optional | Required before delivery |
| 3 | Final Payment Confirmed | Payment | Billing | Billing | 0 | Yes | Required if balance remains |
| 4 | Delivery Address Confirmed | Customer Action | Fulfillment | Customer / Fulfillment | 1 | Yes | Required |
| 5 | Delivery Scheduled | Task | Fulfillment | Fulfillment | 1 | Yes | Depends on address/payment |
| 6 | Delivery Driver / Courier Assigned | Task | Fulfillment | Fulfillment | 1 | Optional | Depends on schedule |
| 7 | Package Prepared for Delivery | Task | Fulfillment | Fulfillment | 1 | Optional | Depends on QC |
| 8 | Out for Delivery | Delivery | Fulfillment | Driver / Courier | 0 | Yes | Depends on package prep |
| 9 | Delivered | Milestone | Fulfillment | Driver / Courier | 0 | Yes | Depends on delivery |
| 10 | Delivery Confirmation Uploaded | Task | Fulfillment | Driver / Fulfillment | 0 | Optional | Photo/signature if available |
| 11 | Order Closed | Closeout | Closeout | Admin / System | 0 | Optional | Ends workflow |

## 18. Digital Business Card Only

Best for monthly digital card subscriptions, QR-only profiles, NFC profile setup, and customers who are not currently ordering printed cards.

| Order | Item Name | Type | Phase | Owner Role | Duration | Customer Visible | Gate / Dependency Notes |
|---:|---|---|---|---|---:|---|---|
| 1 | Digital Card Subscription Started | Milestone | Intake | System / Billing | 0 | Yes | Starts workflow |
| 2 | Monthly Payment Confirmed | Payment | Billing | Billing / System | 0 | Yes | Required before publishing |
| 3 | Customer Profile Details Submitted | Customer Action | Content | Customer | 1 | Yes | Name, company, contact info |
| 4 | Profile Photo / Logo Uploaded | Customer Action | Content | Customer | 1 | Yes | Optional but recommended |
| 5 | Links / Social Profiles Added | Customer Action | Content | Customer | 1 | Yes | Unlimited links |
| 6 | Digital Card Draft Created | Task | Digital Card | System / Admin | 1 | Yes | Depends on details |
| 7 | QR Code Generated | Task | QR / NFC | System | 0 | Yes | Depends on public URL |
| 8 | Customer Preview / Approval | Approval | Review | Customer | 1 | Yes | Blocks publishing |
| 9 | Digital Card Published | Milestone | Launch | System / Admin | 0 | Yes | Depends on payment/approval |
| 10 | QR Download Available | Milestone | Launch | System | 0 | Yes | Depends on publish |
| 11 | NFC Setup Instructions Sent | Milestone | QR / NFC | System / Admin | 0 | Yes | Optional |
| 12 | Setup Closed | Closeout | Closeout | Admin / System | 0 | Optional | Ends setup workflow |

---

# Implementation Notes

## Admin Selection Flow

When creating or editing a job/order schedule, staff/admin should be able to:

1. Select a workflow template.
2. Preview the template items.
3. Choose a start date.
4. Choose whether to include optional items.
5. Apply the template.
6. Review generated schedule items on the Gantt timeline.
7. Edit individual generated items as needed.

## Template Item Generation

Generated items should inherit:

- Item name
- Item type
- Phase
- Display order
- Default duration
- Start offset
- Owner role
- Status
- Priority
- Customer visibility
- Approval/payment/deposit flags
- Dependency relationships

## Date Calculation

Basic date calculation:

- Template start date = selected job/order schedule start date.
- Item start date = template start date + default_start_offset_days.
- Item end date = item start date + default_duration_days.
- Milestones can have duration of 0.
- Rush workflows may use 0-day or same-day durations.

## Dependencies

Dependency keys should allow template items to reference other template items before they become real schedule item IDs.

Example:

- `customer_proof_approval` depends on `proof_created`
- `print_production` depends on `customer_proof_approval`
- `ready_for_pickup_shipping` depends on `quality_control`

When applying a template:

1. Create all schedule items first.
2. Store a map of `item_key -> generated_schedule_item_id`.
3. Create dependency records after schedule items are created.

## Customer Visibility

Every generated item should retain its default customer visibility setting, but staff/admin should be able to override it after the template is applied.

## Optional Items

Some items should be conditional or optional, such as:

- Artwork Corrections Needed
- Revision Round 1
- NFC Encoding
- Lamination
- Mounting
- Final Payment Due
- Installation
- Shipping
- Delivery
- Warranty Info Sent

If the existing app does not support optional template items yet, include them as regular generated items for Phase 1 or mark them as optional in the data model for future filtering.

---

# Phase 1 Scope

Phase 1 should extend the existing Gantt Timeline Print Project Manager by adding reusable workflow templates.

Phase 1 should include:

- Workflow template data structure.
- Workflow template item data structure.
- Starter templates from this document.
- Ability to select a workflow template when creating a schedule/job/order if feasible.
- Automatic creation of schedule items from a selected template.
- Support for default phase, item type, owner role, duration, display order, customer visibility, approval gates, payment gates, deposit gates, and dependencies.
- Clear loading, empty, success, and error states.

Phase 1 should not include:

- Full Super Admin template editor unless already easy.
- Complex drag/drop template builder.
- Advanced auto-shifting dependencies unless already present.
- Advanced billing automation.
- Customer-facing workflow template controls.
- Complex reporting.

---

# Phase 2 Ideas

- Super Admin workflow template manager.
- Create/edit/delete templates in the dashboard.
- Enable/disable templates.
- Optional item toggles before applying template.
- Product-to-template mapping.
- Automatically apply a template based on product category.
- Automatically apply a template based on checkout/order type.
- Customer-visible timeline preview.
- Notifications tied to template items.
- Email/SMS automation triggers.
- Payment reminders.
- Approval reminders.
- Delayed schedule item alerts.
- Template analytics.
- Duplicate/customize templates.
- Import/export templates.
- Team/user assignment rules.
- Vendor assignment rules.

---

# Suggested Product-to-Template Mapping

| Product / Service | Recommended Template |
|---|---|
| Business Cards | Standard Print Order or Business Card + Digital Card |
| NFC Business Cards | Business Card + Digital Card |
| Digital Business Card Subscription | Digital Business Card Only |
| Flyers / Brochures / Postcards | Standard Print Order |
| Stickers / Labels | Standard Print Order |
| Posters | Standard Print Order or Large Format Signage |
| Banners | Large Format Signage |
| Yard Signs | Large Format Signage |
| Wall Graphics | Large Format Signage or Installation Job |
| Vehicle Wraps | Vehicle Wrap / Fleet Graphics |
| Window Tint / Film | Window Tint / Film Installation |
| Hats | Embroidery Order |
| Shirts | Screen Printing / Apparel |
| Hoodies | Screen Printing / Apparel |
| Uniforms | Screen Printing / Apparel or Embroidery Order |
| Acrylic Signs | CNC / Laser Engraving or Large Format Signage |
| Metal Signs | CNC / Laser Engraving or Large Format Signage |
| Wood Signs | CNC / Laser Engraving |
| Dog Tags | CNC / Laser Engraving or Business Card + Digital Card |
| ID Cards | Team Business Card Order |
| Luggage Tags | CNC / Laser Engraving or Business Card + Digital Card |
| QR Shirts / QR Hats | Screen Printing / Apparel + Digital Business Card Only |
| NFC Rings / Bracelets / Necklaces | Business Card + Digital Card or Digital Business Card Only |
| Shipping-only Orders | Shipping / Fulfillment |
| Local Pickup Orders | Local Pickup |
| Local Delivery Orders | Delivery |

---

# Success Criteria

This workflow template feature is successful when:

- Staff/admin can apply a repeatable workflow template to a job/order/project.
- The selected template creates real schedule items in the existing Gantt timeline.
- Schedule items are grouped by phases.
- Payment, deposit, approval, production, shipping, delivery, and install steps appear in the right order.
- Dependencies are created or preserved when feasible.
- Customer visibility defaults are applied.
- The generated schedule can still be edited manually after creation.
- The template system does not break the existing Gantt Timeline Print Project Manager.
- The structure can later support Super Admin template editing and product-to-template automation.
