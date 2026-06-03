# Messages, Notifications, and Activity Log

## Purpose

This document defines how ControlP.io project/task management connects to messages, notifications, and activity history.

Every important project/task action should be traceable.

## Core Requirement

Projects and tasks should maintain a reliable activity log.

Actions in Gantt, List, Table, Kanban, Calendar, booking, payments, files, and AI Agent workflows should write meaningful activity events.

## Activity Events

Track events such as:

- Project created
- Task created
- Task moved on Gantt
- Task resized on Gantt
- Status changed
- Kanban card moved
- Due date changed
- Assignment changed
- Customer added
- Vendor added
- File uploaded
- Photo uploaded
- Video uploaded
- Proof uploaded
- Proof approved
- Proof rejected
- Product/material attached
- Payment status changed
- Invoice connected
- Booking created
- Booking rescheduled
- Message sent
- Notification sent
- AI Agent action suggested
- AI Agent action completed
- Export generated
- Task hidden from Gantt
- Task deleted
- Project completed
- Project canceled

## Activity Log Fields

Recommended fields:

- id
- project_id
- task_id
- order_id
- actor_user_id
- actor_type
- event_type
- event_title
- event_description
- previous_value
- new_value
- metadata
- visibility
- created_at

Actor types:

- User
- Customer
- Vendor
- System
- AI Agent

## Messages

Messages should connect to:

- Project
- Task
- Customer
- Vendor
- User
- Order
- File/proof
- Invoice/payment
- Booking

Message types:

- Internal note
- Customer message
- Vendor message
- System message
- AI drafted message
- Approval request
- Payment reminder
- Appointment reminder

## Notifications

Notification channels may include:

- In-app
- Email
- SMS, where consent exists
- Push, if available
- Staff dashboard
- Customer portal
- AI Agent digest

## Notification Triggers

Suggested triggers:

- Task assigned
- Task due soon
- Task overdue
- Status changed
- Proof ready
- Proof approved/rejected
- File uploaded
- Customer message received
- Payment due
- Deposit paid
- Booking created
- Booking rescheduled
- Project blocked
- Project completed

## FAB Notification Actions

FAB/action dock actions can include:

- Send message
- Add internal note
- Notify assigned user
- Notify customer
- Notify vendor
- Request approval
- Send payment reminder
- Ask AI Agent to draft update

## AI Agent Integration

The AI Agent should be able to:

- Read activity history.
- Summarize recent changes.
- Draft customer updates.
- Draft internal team updates.
- Identify stale projects.
- Identify unanswered messages.
- Recommend notifications.
- Create a daily project digest.

## Acceptance Criteria

This system is complete when:

- Important actions write activity records.
- Messages can connect to projects/tasks/orders/customers.
- Notifications can be triggered from project/task events.
- Visibility rules are respected.
- AI Agent can summarize activity safely.
