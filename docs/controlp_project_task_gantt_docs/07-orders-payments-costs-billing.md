# Orders, Payments, Costs, and Billing Integration

## Purpose

This document defines how ControlP.io project/task management connects to orders, payments, quotes, invoices, costs, materials, and billing.

Every project can include costs. Many projects are connected to orders, quotes, invoices, deposits, final payments, materials, production labor, vendor costs, shipping, and installation costs.

## Core Requirement

Projects and tasks should connect to financial data where available.

The project/task system should not replace the accounting system, but it should provide operational visibility into costs, payment status, and billing-related milestones.

## Related Records

Projects and tasks may connect to:

- Order
- Order item
- Quote
- Estimate
- Invoice
- Payment
- Deposit
- Final balance
- Refund
- Product
- Material
- Vendor cost
- Shipping cost
- Installation cost
- Labor cost
- SOW
- Contract
- Approval

## Project Financial Fields

Recommended fields:

- estimated_cost
- actual_cost
- estimated_revenue
- actual_revenue
- deposit_required
- deposit_paid
- final_payment_due
- final_payment_paid
- invoice_id
- quote_id
- payment_status
- margin
- billing_status

## Payment Status Examples

- Not invoiced
- Quote sent
- Awaiting deposit
- Deposit paid
- In production
- Final payment due
- Paid in full
- Overdue
- Refunded
- Canceled

## Timeline Payment Tasks

Common Gantt/payment milestones:

- Quote created
- Quote approved
- Invoice sent
- Deposit due
- Deposit paid
- Final payment due
- Final payment paid
- Order closed

## Payment-Based Automation

Payment status can trigger:

- Start production only after deposit is paid
- Notify customer when payment is due
- Notify admin if payment is overdue
- Block task if payment is missing
- Release project to production when approved
- Notify shipping/pickup when final payment is complete

## FAB Financial Actions

Where permissions allow, FAB/action dock can include:

- View order
- View quote
- View invoice
- Add cost
- Add product/material cost
- Mark deposit paid
- Mark final payment due
- Send payment reminder
- Export project financial summary

## Cost Visibility

Financial information should be role-based.

Examples:

- Admin sees all financials.
- Sales can see quotes/invoices depending on permissions.
- Production may see material/product requirements but not profit margin.
- Vendor sees vendor-specific cost details only if allowed.
- Customer sees approved quotes, invoices, payment status, and receipts only.

## AI Agent Integration

The AI Agent should be able to:

- Identify unpaid projects.
- Summarize payment status.
- Draft payment reminder messages.
- Flag projects blocked by payment.
- Summarize project cost variance.
- Suggest next billing action.
- Prepare payment-related project updates.

## Acceptance Criteria

This integration is complete when:

- Projects/tasks can link to orders and payments.
- Payment milestones appear in relevant views.
- Payment status can block or unlock production workflows where configured.
- Financial fields are role-protected.
- AI Agent can read and summarize payment context.
