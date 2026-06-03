# Calendar and Booking Integration

## Purpose

This document defines how ControlP.io project and task management should integrate with calendar and booking features.

The Calendar View should not be separate from the project system. Project dates, task dates, appointments, installs, deliveries, pickups, and bookings should all work together.

## Calendar Item Types

ControlP.io should support calendar visibility for:

- Project start date
- Project due date
- Task start date
- Task end date
- Appointment
- Customer consultation
- Design review
- Proof review
- Production slot
- Installation
- Delivery
- Pickup
- Payment due date
- Vendor deadline
- Internal meeting
- AI Agent reminder

## Booking Connections

Bookings should connect to:

- Project
- Task
- Customer
- Contact
- Assigned user/staff
- Vendor, if applicable
- Order
- Product/material, if applicable
- Location
- Meeting link, if applicable
- Messages and notifications

## Calendar Views

Support:

- Month
- Week
- Day
- Agenda/List

## Calendar Event Display

Each event should show:

- Title
- Type
- Time
- Customer
- Project/order
- Assigned user
- Status
- Location or meeting link
- Related task
- Color/status indicator

## Rescheduling Behavior

If the app supports drag-to-reschedule:

- Moving a task date on Calendar updates the task date.
- Moving an install updates the install task.
- Moving a booking updates the booking record.
- Changes sync back to Gantt, List, Table, Kanban, notifications, and AI Agent context.

## Booking Workflow

Recommended booking flow:

1. Customer or staff books appointment.
2. Booking creates or links to customer/contact.
3. Booking links to project/order/task where applicable.
4. Notifications are sent.
5. Calendar View displays the booking.
6. Project/task detail displays the booking.
7. AI Agent can summarize booking context.

## Appointment Types

Suggested appointment types:

- New customer consultation
- Design consultation
- Artwork review
- Proof review
- Production review
- Install appointment
- Pickup appointment
- Delivery appointment
- Vendor meeting
- Internal production meeting

## Notifications

Calendar/booking events should be able to trigger:

- Email reminders
- SMS reminders, if consent exists
- In-app notifications
- Staff notifications
- Customer confirmations
- Vendor reminders

## Permissions

Calendar visibility should respect roles:

- Admins see all events.
- Staff see assigned and team-visible events.
- Vendors see assigned vendor events.
- Customers see approved customer-facing appointments and milestones.

## AI Agent Integration

The AI Agent should be able to:

- Summarize today's bookings.
- Identify schedule conflicts.
- Suggest follow-ups.
- Draft appointment reminders.
- Create project tasks from bookings.
- Connect appointments to the correct customer/project/order.
