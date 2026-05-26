# Controlp.io — Booking System

## File Purpose

This document is the source-of-truth planning file for building a booking and appointment scheduling system inside the Controlp.io web app.

The booking system should work similarly to Cal.com or Fluent Booking Pro, but be built directly into the existing Controlp.io stack:

- TypeScript
- Next.js
- HTML
- ShadCN UI
- Supabase database
- Coolify-managed VPS deployment

Recommended location:

`/docs/booking-system.md`

## Feature Overview

Controlp.io needs a full booking system that allows customers to schedule appointments from the frontend while giving admins/staff a backend appointment management system inside the existing dashboard.

The system should sync with Jeremy's existing calendar and support adding additional connected calendars later. It should respect availability, blocked times, buffers, appointment types, staff schedules, customer notifications, admin notifications, email, SMS, and multiple management views.

The booking system should connect with the existing Controlp.io web app, customer records, orders, production jobs, payments, messages, and future CRM/automation features.

## Primary Goals

The booking system should allow Controlp.io to:

- Let customers book appointments from a public frontend booking page.
- Show available days and times based on staff/admin availability.
- Sync with an existing calendar to prevent double bookings.
- Support additional calendars in the future.
- Manage appointments from the backend dashboard.
- Customize working hours, blocked dates, buffers, and appointment types.
- Send confirmation, reminder, cancellation, and reschedule notifications.
- Notify both the customer and Controlp.io staff.
- Support email and SMS notifications.
- Provide Kanban, list, calendar, and Gantt-style appointment views.
- Connect appointment records to customers, orders, jobs, products, services, and production schedules.
- Support future payment/deposit requirements for certain booking types.
- Support future customer dashboard appointment history.

---

# Recommended Navigation Placement

## Admin / Staff Dashboard

Add this as a first-class dashboard module.

Suggested sidebar label:

`Bookings`

Alternative labels:

- Appointments
- Scheduling
- Calendar
- Booking Manager

Preferred label:

`Bookings`

Suggested admin dashboard order:

```text
Dashboard
Analytics
Orders
Production Schedule
Production
Bookings
Payments
Messages
Customers
Users
Settings
```

## Customer Dashboard

Later, add a customer-facing appointment area.

Suggested customer dashboard label:

`Appointments`

Suggested customer dashboard order:

```text
Dashboard
Orders
Artwork / Files
Proofs
Digital Cards
Appointments
Messages
Payments
Settings
```

---

# Public Frontend Booking Page

Create a customer-facing booking page where customers can select appointment type, day, time, and provide required information.

Suggested routes:

```text
/book
/book/[appointmentTypeSlug]
/schedule
/schedule/[appointmentTypeSlug]
```

Preferred route:

```text
/book
```

## Frontend Booking Flow

1. Customer lands on booking page.
2. Customer selects appointment type/service.
3. Customer selects date.
4. System shows available times based on availability and connected calendars.
5. Customer selects time.
6. Customer enters contact information.
7. Customer answers appointment-specific questions.
8. Customer confirms booking.
9. System creates appointment.
10. Customer receives confirmation by email and/or SMS.
11. Admin/staff receives notification by email and/or SMS.
12. Appointment is added to internal booking calendar.
13. Appointment syncs to connected external calendar if configured.

## Customer Booking Fields

Recommended default fields:

- First name
- Last name
- Email
- Phone
- Company name
- Appointment type
- Preferred date
- Preferred time
- Project/order number if applicable
- Service/product interest
- Message / notes
- SMS consent checkbox
- Email consent checkbox
- Terms/booking policy agreement checkbox

Optional fields by appointment type:

- Upload artwork/file
- Vehicle year/make/model
- Installation address
- Desired product type
- Design service needed
- Budget range
- Deadline/event date
- Existing customer toggle
- Order number
- Website URL
- Business name
- Number of attendees
- Meeting location preference
- In-person / phone / video meeting preference

## Public Booking Page UI

The public page should include:

- Appointment type cards
- Calendar date picker
- Available time buttons
- Timezone display
- Booking form
- Summary panel
- Confirmation screen
- Error state if no availability
- Reschedule/cancel links if implemented
- Mobile-first responsive layout
- Clean ShadCN UI styling
- Controlp.io branding

---

# Appointment Types

The system should support multiple appointment types.

## Print Consultation

Purpose: Print products, quotes, materials, timelines, and production planning.

Suggested duration: 30 minutes

## Design Consultation

Purpose: Graphic design, branding, artwork cleanup, business cards, signage, apparel design, or custom product setup.

Suggested duration: 30 or 60 minutes

## Vehicle Wrap Consultation

Purpose: Vehicle wraps, decals, fleet graphics, measurements, design planning, and installation details.

Suggested duration: 45 or 60 minutes

## Window Tint / Film Appointment

Purpose: Vehicle tint, office film, privacy film, architectural film, or installation scheduling.

Suggested duration: 30 or 60 minutes

## Installation Appointment

Purpose: Installs, onsite work, delivery, walkthroughs, and completion sign-offs.

Suggested duration: 60, 90, or 120 minutes

## Pickup Appointment

Purpose: Customers scheduling pickup of completed print or product orders.

Suggested duration: 15 minutes

## File Review / Proof Review

Purpose: Reviewing artwork, proofs, production requirements, or file issues with the customer.

Suggested duration: 15 or 30 minutes

## Digital Business Card Setup

Purpose: Helping customers configure NFC/QR digital business cards, profile links, QR codes, and product options.

Suggested duration: 30 minutes

---

# Backend Appointment Management

Create a backend page inside the Controlp.io dashboard for appointment management.

## Backend Page Sections

Suggested sections/tabs:

```text
Overview
Calendar
List
Kanban
Gantt
Appointment Types
Availability
Calendars
Notifications
Settings
```

## Overview

The overview page should show:

- Today's appointments
- Upcoming appointments
- Pending appointments
- Confirmed appointments
- Canceled appointments
- No-show appointments
- Completed appointments
- Appointments needing follow-up
- Booking conversion metrics if available
- Quick actions: Add appointment, block time, create appointment type, manage availability

## List View

A searchable/filterable table of appointments.

Fields:

- Appointment title
- Customer name
- Customer email
- Customer phone
- Appointment type
- Date
- Start time
- End time
- Status
- Assigned staff
- Location / meeting type
- Related order/job/customer
- Payment/deposit status if applicable
- Created date
- Last updated

Filters:

- Status
- Appointment type
- Staff member
- Date range
- Customer
- Related order/job
- Location type
- Payment status

## Calendar View

A calendar UI showing appointments by day, week, and month.

Calendar item display:

- Appointment type
- Customer name
- Time
- Status
- Assigned staff
- Location type

Calendar actions:

- Click to view appointment
- Drag/reschedule if feasible
- Create appointment from calendar slot
- Block time
- Filter by staff/appointment type/status

## Kanban View

Suggested columns:

```text
New Request
Pending Confirmation
Confirmed
In Progress
Completed
Follow-Up Needed
Canceled / No-Show
```

Kanban cards should show:

- Customer name
- Appointment type
- Date/time
- Status
- Assigned staff
- Contact buttons
- Related order/job
- Notes indicator

## Gantt View

The Gantt-style view should connect with the existing Controlp.io Gantt / Production Schedule system where appropriate.

Use cases:

- Installation scheduling
- Vehicle wrap appointments
- Window tint appointments
- Multi-step jobs
- Booking tied to production timelines
- Appointment windows that affect job scheduling

Gantt items may include:

- Consultation
- Artwork review
- Production review
- Installation appointment
- Pickup appointment
- Delivery appointment
- Final walkthrough
- Follow-up

## Appointment Detail Drawer / Modal

Fields:

- Appointment title
- Appointment type
- Customer
- Date/time
- Timezone
- Duration
- Status
- Assigned staff
- Location type
- Meeting link
- Address/location
- Customer message
- Internal notes
- Related order/job/project
- Related product/service
- Notification history
- Reschedule history
- Cancellation reason
- Files/uploads if supported
- Created date
- Updated date

Actions:

- Confirm
- Reschedule
- Cancel
- Mark completed
- Mark no-show
- Send reminder
- Send message
- Link to customer
- Link to order/job
- Add internal note
- Create order/job from appointment if useful

---

# Availability Management

Create a backend availability settings page.

## Availability Rules

The user/admin should be able to customize:

- Working days
- Working hours
- Lunch breaks
- Blocked days
- Vacation days
- Holidays
- Buffer before appointment
- Buffer after appointment
- Minimum notice period
- Maximum booking window
- Appointment duration
- Appointment capacity per slot
- Staff-specific schedules
- Appointment-type-specific schedules

Example availability settings:

```text
Monday: 9:00 AM - 5:00 PM
Tuesday: 9:00 AM - 5:00 PM
Wednesday: 9:00 AM - 5:00 PM
Thursday: 9:00 AM - 5:00 PM
Friday: 9:00 AM - 4:00 PM
Saturday: Closed
Sunday: Closed
```

## Blocked Time

Admins/staff should be able to block time for:

- Personal appointments
- Production work
- Install days
- Travel time
- Meetings
- Holidays
- Unavailable days
- Lunch
- Internal work blocks

Blocked time should prevent public booking.

## Timezone

Default timezone should support Arizona/Phoenix local time.

Suggested timezone:

```text
America/Phoenix
```

The system should be designed so timezone can be customized later.

---

# Calendar Sync

The booking system must sync with Jeremy's existing calendar and support additional calendars later.

## Calendar Connection Goals

The system should support:

- Connecting one primary calendar
- Adding multiple additional calendars later
- Reading busy/free availability from connected calendars
- Writing confirmed bookings to a selected calendar
- Preventing double booking
- Showing connected calendar status
- Choosing which calendar gets new appointments
- Choosing which calendars block availability

## Initial Calendar Integration

Codex should inspect the current app to see if any calendar integration already exists.

Possible calendar providers:

- Google Calendar
- Microsoft Outlook / Office 365
- Apple Calendar via ICS subscription where feasible
- CalDAV in a future phase
- Manual ICS export in a future phase

Recommended Phase 1 approach:

- Build the internal appointment database and UI first.
- Add data structures for external calendar connections.
- If OAuth/calendar integration already exists, reuse it.
- If no calendar integration exists, prepare the model and service layer so Google Calendar can be added next.
- Add manual blocked time support to prevent double booking before full external calendar sync is finished.

## Calendar Sync Behavior

When an appointment is booked:

1. Check internal availability.
2. Check blocked time.
3. Check existing appointments.
4. Check connected calendar busy times if integration exists.
5. Create appointment in Controlp.io.
6. Create event in connected calendar if enabled.
7. Save external calendar event ID.
8. Send notifications.

When an appointment is rescheduled:

1. Update Controlp.io appointment.
2. Update connected calendar event if synced.
3. Send reschedule notifications.

When an appointment is canceled:

1. Mark appointment canceled in Controlp.io.
2. Delete or update connected calendar event if synced.
3. Send cancellation notifications.

---

# Notifications

The system should send notifications to both Controlp.io staff/admin and the customer.

Notification channels:

- Email
- SMS
- In-app notification if available
- Future Slack/Telegram if useful

## Customer Notifications

Customer should receive:

- Booking confirmation
- Reminder before appointment
- Reschedule confirmation
- Cancellation confirmation
- Follow-up message
- No-show follow-up if needed

## Admin / Staff Notifications

Admin/staff should receive:

- New booking notification
- Booking rescheduled notification
- Booking canceled notification
- Reminder before appointment
- Customer reply or notes notification
- Follow-up task notification

## Notification Timing

Recommended reminder options:

- Immediately after booking
- 24 hours before
- 2 hours before
- 30 minutes before
- Custom reminder timing later

## Email Integration

Use existing Controlp.io email provider if available.

If no email provider exists, structure the notification service so it can support:

- Resend
- SMTP
- SendGrid
- Postmark
- Other provider later

## SMS Integration

Use existing SMS provider if available.

Expected provider:

- Twilio

SMS should respect consent rules.

SMS booking messages should include:

- Business name
- Appointment date/time
- Appointment type
- Location or meeting link
- Reply/cancel/reschedule instructions if supported
- STOP/HELP language where appropriate

Example SMS confirmation:

```text
Controlp.io: Your Print Consultation is confirmed for {{date}} at {{time}}. Reply HELP for help or STOP to opt out.
```

---

# Appointment Statuses

Recommended statuses:

- Pending
- Confirmed
- Rescheduled
- Canceled
- Completed
- No Show
- Follow-Up Needed

Optional statuses:

- Awaiting Payment
- Awaiting Deposit
- Awaiting Customer Info
- Awaiting Approval

---

# Appointment Location / Meeting Types

Supported meeting types:

- Phone Call
- Video Meeting
- In-Person
- Onsite Installation
- Vehicle Drop-Off
- Pickup
- Delivery
- Custom Location

Fields:

- location_type
- location_name
- location_address
- meeting_url
- phone_number
- onsite_address
- internal_location_notes

---

# Suggested Data Model

Codex should adapt these to the existing app architecture, database naming conventions, Supabase policies, and API patterns.

## booking_appointment_types

Purpose: Defines bookable services/appointment types.

Suggested fields:

- id
- name
- slug
- description
- duration_minutes
- buffer_before_minutes
- buffer_after_minutes
- min_notice_minutes
- max_days_in_advance
- location_type
- meeting_url
- is_active
- requires_payment
- requires_deposit
- deposit_amount
- color
- display_order
- created_at
- updated_at

## booking_appointments

Purpose: Stores booked appointments.

Suggested fields:

- id
- appointment_type_id
- customer_id
- user_id
- assigned_staff_id
- related_order_id
- related_job_id
- related_project_id
- title
- customer_first_name
- customer_last_name
- customer_email
- customer_phone
- company_name
- start_time
- end_time
- timezone
- status
- location_type
- location_name
- location_address
- meeting_url
- customer_notes
- internal_notes
- sms_consent
- email_consent
- external_calendar_provider
- external_calendar_id
- external_event_id
- cancellation_reason
- reschedule_reason
- completed_at
- canceled_at
- created_at
- updated_at

## booking_availability_rules

Purpose: Stores default working hours and appointment availability rules.

Suggested fields:

- id
- user_id
- appointment_type_id
- day_of_week
- start_time
- end_time
- timezone
- is_available
- created_at
- updated_at

## booking_blocked_times

Purpose: Stores manual blocked/unavailable time.

Suggested fields:

- id
- user_id
- title
- start_time
- end_time
- timezone
- reason
- blocks_public_booking
- created_at
- updated_at

## booking_calendar_connections

Purpose: Stores connected calendar provider details.

Important: Do not expose secrets. Tokens should be encrypted or stored using the app's existing secure secret storage pattern.

Suggested fields:

- id
- user_id
- provider
- provider_account_email
- calendar_id
- calendar_name
- sync_direction
- blocks_availability
- write_events
- is_primary
- is_active
- last_synced_at
- created_at
- updated_at

Suggested provider values:

- google
- microsoft
- apple_ics
- caldav
- manual

Suggested sync_direction values:

- read_only
- write_only
- two_way

## booking_notifications

Purpose: Tracks notifications sent for appointments.

Suggested fields:

- id
- appointment_id
- recipient_type
- recipient_email
- recipient_phone
- channel
- notification_type
- status
- provider_message_id
- error_message
- scheduled_for
- sent_at
- created_at

## booking_question_fields

Purpose: Defines custom form questions per appointment type.

Suggested fields:

- id
- appointment_type_id
- label
- field_key
- field_type
- placeholder
- help_text
- is_required
- options
- display_order
- created_at
- updated_at

## booking_question_answers

Purpose: Stores customer answers from the public booking form.

Suggested fields:

- id
- appointment_id
- field_id
- field_key
- answer
- created_at
- updated_at

---

# Supabase / Security Notes

Use Supabase migrations.

Do not edit production schema directly.

Recommended security requirements:

- Public users can only create bookings through validated public booking endpoints.
- Public users cannot list all appointments.
- Public users cannot view private appointment data.
- Customers can view only their own appointments if logged in.
- Staff/admin can manage appointments based on role permissions.
- Connected calendar tokens must never be exposed to the client.
- SMS consent should be stored and respected.
- Email/SMS notification actions should be handled server-side.
- Use Row Level Security policies if the project uses Supabase RLS.
- Validate all form fields server-side.
- Rate-limit public booking endpoint if feasible.

---

# API Routes / Server Actions

Codex should follow the existing app convention.

## Public

- `GET /api/booking/appointment-types`
- `GET /api/booking/availability`
- `POST /api/booking/appointments`

## Staff/Admin

- `GET /api/admin/bookings`
- `GET /api/admin/bookings/:id`
- `POST /api/admin/bookings`
- `PATCH /api/admin/bookings/:id`
- `DELETE /api/admin/bookings/:id`
- `POST /api/admin/bookings/:id/reschedule`
- `POST /api/admin/bookings/:id/cancel`
- `POST /api/admin/bookings/:id/complete`
- `POST /api/admin/bookings/:id/send-reminder`

## Appointment Types

- `GET /api/admin/booking/appointment-types`
- `POST /api/admin/booking/appointment-types`
- `PATCH /api/admin/booking/appointment-types/:id`
- `DELETE /api/admin/booking/appointment-types/:id`

## Availability

- `GET /api/admin/booking/availability`
- `POST /api/admin/booking/availability`
- `PATCH /api/admin/booking/availability/:id`
- `DELETE /api/admin/booking/availability/:id`

## Blocked Time

- `GET /api/admin/booking/blocked-times`
- `POST /api/admin/booking/blocked-times`
- `PATCH /api/admin/booking/blocked-times/:id`
- `DELETE /api/admin/booking/blocked-times/:id`

## Calendar Connections

- `GET /api/admin/booking/calendar-connections`
- `POST /api/admin/booking/calendar-connections`
- `PATCH /api/admin/booking/calendar-connections/:id`
- `DELETE /api/admin/booking/calendar-connections/:id`

---

# UI Components

Suggested components:

- BookingPublicPage
- AppointmentTypeSelector
- BookingDatePicker
- AvailableTimeSlots
- BookingCustomerForm
- BookingConfirmation
- BookingManagerPage
- BookingOverviewCards
- BookingListView
- BookingCalendarView
- BookingKanbanView
- BookingGanttView
- AppointmentDrawer
- AppointmentForm
- AppointmentStatusBadge
- AppointmentTypeBadge
- AppointmentTypeForm
- AvailabilitySettings
- WeeklyAvailabilityEditor
- BlockedTimeForm
- CalendarConnectionsSettings
- NotificationSettings
- BookingFilters
- BookingEmptyState
- BookingLoadingState
- BookingErrorState

---

# Existing App Integrations

The booking system should connect with existing Controlp.io areas where possible.

## Customers

- Link appointment to an existing customer if email/phone matches.
- Create a new customer record if needed and the app supports this.
- Show appointment history on customer record later.

## Orders

- Allow appointment to link to an existing order.
- Allow future order creation from appointment.
- Show related appointments on order detail later.

## Production Schedule / Gantt

- Allow certain appointments to appear on the Production Schedule / Gantt.
- Installation, pickup, delivery, wrap consultation, and file review appointments may become schedule items.

## Messages

- Booking notifications and appointment-related messages should be compatible with the existing messaging system if present.

## Payments

- Appointment types should be able to require payment or deposit later.
- Do not implement full payment logic in Phase 1 unless payment patterns already exist.

## Digital Business Cards

- Digital Business Card Setup can be an appointment type.
- QR/NFC setup appointments can link back to digital card orders or product purchases later.

---

# Booking Rules

## Availability Calculation

Available time slots should consider:

- Appointment type duration
- Buffer before
- Buffer after
- Staff working hours
- Staff blocked time
- Existing appointments
- Connected calendar busy events if integration exists
- Minimum notice period
- Maximum days in advance
- Appointment-specific availability rules
- Timezone

## Preventing Double Booking

The system must prevent double booking by checking:

- Existing confirmed appointments
- Pending appointments if desired
- Manual blocked times
- Connected external calendar busy times if available
- Appointment duration plus buffer

## Rescheduling

Rescheduling should:

- Recalculate availability
- Update appointment time
- Update connected calendar event if synced
- Notify customer
- Notify staff
- Log change if activity/audit system exists

## Cancellation

Cancellation should:

- Mark status as canceled
- Store cancellation reason
- Update connected calendar event if synced
- Notify customer
- Notify staff

---

# Notification Templates

## Customer Booking Confirmation Email

Subject:

```text
Your Controlp.io appointment is confirmed
```

Body concept:

```text
Hi {{customer_first_name}},

Your {{appointment_type}} appointment with Controlp.io is confirmed for {{appointment_date}} at {{appointment_time}}.

Location / Meeting:
{{location_details}}

If you need to reschedule or cancel, use the link below:
{{manage_booking_link}}

Thank you,
Controlp.io
```

## Admin New Booking Email

Subject:

```text
New Controlp.io booking: {{appointment_type}}
```

Body concept:

```text
A new appointment has been booked.

Customer:
{{customer_name}}

Appointment:
{{appointment_type}}

Date/Time:
{{appointment_date}} at {{appointment_time}}

Phone:
{{customer_phone}}

Email:
{{customer_email}}

Notes:
{{customer_notes}}
```

## Customer SMS Confirmation

```text
Controlp.io: Your {{appointment_type}} is confirmed for {{appointment_date}} at {{appointment_time}}. Reply HELP for help or STOP to opt out.
```

## Customer SMS Reminder

```text
Reminder from Controlp.io: Your {{appointment_type}} is scheduled for {{appointment_date}} at {{appointment_time}}. Reply HELP for help or STOP to opt out.
```

---

# Phase 1 Scope

Phase 1 should build a working internal booking system foundation and public booking flow.

## Phase 1 Should Include

- Supabase migrations for core booking tables.
- Appointment type model/table.
- Appointment model/table.
- Availability rules table.
- Blocked times table.
- Notification tracking table if practical.
- Public booking page.
- Appointment type selection.
- Date/time availability display.
- Booking form.
- Appointment creation.
- Backend Bookings navigation item.
- Backend bookings overview.
- Backend list view.
- Backend calendar view if feasible.
- Basic appointment detail drawer/modal.
- Basic appointment status updates.
- Basic availability settings.
- Manual blocked time support.
- Email notification hooks using existing provider if available.
- SMS notification hooks using existing provider if available.
- Future-ready calendar connection data model.
- Loading, empty, success, and error states.

## Phase 1 Should Not Include Unless Easy

- Full Google Calendar OAuth.
- Full Microsoft Calendar OAuth.
- Two-way calendar sync.
- Full payment/deposit collection.
- Advanced Kanban drag/drop.
- Advanced Gantt rescheduling.
- Automated recurring appointments.
- Customer dashboard appointment history.
- Complex reporting.
- Full template automation.

---

# Phase 2 Scope

Phase 2 can include:

- Google Calendar OAuth integration.
- Microsoft Outlook integration.
- Two-way calendar sync.
- Multiple calendar connections.
- Staff-specific booking pages.
- Customer dashboard appointment history.
- Reschedule/cancel customer links.
- Email/SMS reminder scheduling.
- Payment/deposit collection.
- Appointment-specific form fields.
- Kanban drag/drop.
- Gantt integration with production schedule.
- Appointment-to-order conversion.
- Appointment-to-production-job conversion.
- Analytics and reporting.
- Webhook automation.
- Slack/Telegram notifications if useful.

---

# Phase 3 Scope

Phase 3 can include:

- Team scheduling.
- Round-robin assignment.
- Group appointments.
- Multi-location support.
- Recurring availability rules.
- Holiday calendars.
- Resource booking such as install bays, printers, machines, or conference rooms.
- Automated follow-up campaigns.
- AI booking assistant.
- No-show automation.
- Advanced appointment workflows.
- Customer self-service portal.
- Public staff booking pages.
- Embedded booking widgets for external sites.

---

# Codex Instructions

When implementing this feature:

1. Review this document first.
2. Inspect the existing Controlp.io repo before editing.
3. Follow the current Next.js, TypeScript, Supabase, ShadCN UI, and routing conventions.
4. Reuse existing dashboard layout and UI components.
5. Reuse existing customer, user, order, payment, messaging, and notification patterns where possible.
6. Add Supabase migrations instead of editing schema directly.
7. Protect public booking endpoints from leaking appointment/customer data.
8. Do not expose calendar OAuth tokens or secrets to the frontend.
9. Add loading, empty, success, and error states.
10. Keep Phase 1 practical and shippable.
11. Document assumptions and any missing integrations.
12. Run available checks after implementation.

---

# Success Criteria

The booking feature is successful when:

- A customer can visit a frontend booking page.
- A customer can select an appointment type.
- A customer can select an available date and time.
- A customer can submit booking details.
- The appointment appears in the backend dashboard.
- Staff/admin can view and manage appointments.
- Availability prevents obvious double bookings.
- Manual blocked times work.
- Notifications are prepared or sent through existing email/SMS providers.
- The system is ready for external calendar sync.
- The system fits naturally inside the existing Controlp.io dashboard.
