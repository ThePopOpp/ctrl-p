# AI Agent Project Operations

## Purpose

This document defines how the ControlP.io AI Agent connects to projects, tasks, Gantt, Kanban, Calendar, users, customers, vendors, payments, bookings, messages, notifications, products, and files.

The AI Agent is the cherry on top of the project management system.

It should understand context, summarize work, suggest next steps, and assist with operational tasks.

## AI Agent Role

The AI Agent should act as a controlled assistant inside ControlP.io.

It can help with:

- Project summaries
- Task summaries
- Daily production digest
- Overdue task review
- Blocker detection
- Customer update drafts
- Vendor update drafts
- Payment reminder drafts
- Appointment reminders
- Proof approval follow-ups
- Product/material checks
- Schedule conflict detection
- Export preparation
- Activity log summaries
- Suggested next actions

## Connected Context

The AI Agent should be able to read safe, permissioned context from:

- Projects
- Tasks
- Orders
- Customers
- Contacts
- Vendors
- Users
- Bookings
- Calendar items
- Messages
- Notifications
- Files
- Proofs
- Product selections
- Materials
- Payments
- Quotes
- Invoices
- Activity logs
- Gantt dependencies
- Kanban status
- Calendar schedules

## AI Agent Actions

The AI Agent may suggest or perform actions depending on permissions.

Suggested actions:

- Summarize project status
- Draft customer message
- Draft internal update
- Draft vendor message
- Create follow-up task
- Suggest task priority
- Suggest reschedule
- Identify overdue items
- Identify blockers
- Create daily digest
- Create weekly report
- Prepare export summary
- Generate invoice/payment reminder text

Controlled actions requiring approval:

- Send message
- Notify customer
- Notify vendor
- Delete records
- Cancel project/task
- Change payment status
- Modify invoice/quote data
- Move large groups of tasks
- Export sensitive data

## AI Agent UI Locations

The AI Agent should be available in:

- Project detail page
- Task detail drawer
- Gantt timeline
- Kanban board
- Calendar view
- Messages
- Customer profile
- Order detail
- Production dashboard
- Admin dashboard

## AI Agent FAB Actions

From a project/task FAB, include optional AI actions:

- Ask AI for summary
- Ask AI for next steps
- Draft customer update
- Draft internal note
- Draft vendor update
- Identify blockers
- Create follow-up task
- Explain timeline changes
- Prepare export summary

## AI Agent Guardrails

The AI Agent should:

- Respect user permissions.
- Respect customer/internal visibility.
- Not expose internal notes to customers.
- Not expose financial data to unauthorized users.
- Not send messages without approval unless explicitly configured.
- Not delete or cancel records without approval.
- Log AI-generated actions in the activity log.

## Example AI Prompts

### Project Summary

"Summarize this project, including current status, overdue tasks, blockers, upcoming milestones, payment status, and customer-facing next steps."

### Customer Update

"Draft a friendly customer update for this project using only customer-visible information."

### Production Digest

"Create a production team digest for today, grouped by priority, due date, blockers, and assigned user."

### Blocker Review

"Review all blocked projects and tasks. Explain the blocker, who owns it, and the next recommended action."

### Payment Follow-Up

"Draft a payment reminder for projects where final payment is due before pickup or shipping."

## Acceptance Criteria

AI Agent integration is complete when:

- AI can access permissioned project/task context.
- AI can summarize project status.
- AI can draft messages.
- AI can identify blockers and overdue work.
- AI can suggest next actions.
- AI actions are logged.
- Destructive actions require approval.
