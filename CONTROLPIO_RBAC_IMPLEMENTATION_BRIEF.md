You are helping expand the ControlP.io app into a scalable role-based SaaS-style platform.

Before making code changes, inspect the current codebase and identify what already exists related to authentication, users, roles, permissions, protected routes, dashboards, navigation, database models, and data access.

Do not rebuild the app from scratch. Extend the current app cleanly and reuse existing components, layouts, auth flow, database tables/models, dashboard structure, API patterns, and UI conventions where possible.

Company/App Context:
ControlP.io is a SaaS-style platform that needs a scalable user management and access control system. The platform should support different user types with different dashboards, navigation, permissions, and record visibility.

Primary Goal:
Build a scalable role-based access control system that supports:

- Super Admin
- Customers
- Vendors
- Designers
- Referrals
- Resellers
- Employees

Each role should have its own dashboard experience, navigation, permissions, and data visibility rules. Build this with long-term SaaS scalability in mind, including centralized permissions, secure data access, role-based routing, future multi-tenant flexibility, and the ability to add more roles later.

Initial Codebase Review:
Before building anything, inspect the current codebase and identify:

1. Existing user model/schema
2. Existing authentication flow
3. Existing role or permission logic
4. Existing dashboard routes/pages
5. Existing navigation structure
6. Existing protected routes or middleware
7. Existing customer/vendor/designer/referral/reseller/employee data relationships
8. Existing admin settings or user management screens
9. Current limitations, duplicated logic, or security gaps

Do not immediately build everything at once.

First, provide a phased implementation plan:

Phase 1: Audit and Cleanup
Phase 2: User Role Model and Permissions
Phase 3: Route Protection and Middleware
Phase 4: Role-Based Dashboard Routing
Phase 5: Role-Based Navigation
Phase 6: Dashboard Features by User Type
Phase 7: Data Visibility and Record-Level Access
Phase 8: Testing, QA, and Security Review

For each phase, include:

- Objective
- Files or app areas likely involved
- Recommended implementation steps
- Risks or dependencies
- What should be tested before moving to the next phase

User Role Requirements:

1. Super Admin

Super Admin has full platform access.

Permissions:
- View, create, edit, and delete all users
- Manage all roles and permissions
- Access all dashboards
- Access all customers, vendors, designers, referrals, resellers, and employees
- Manage global settings
- View reporting, activity, notifications, and system logs
- Manage billing/subscription settings if applicable
- Control integrations and platform configuration

2. Customers

Customers should only see their own account, orders, requests, projects, files, communications, billing, and support history.

Permissions:
- View and edit their profile
- View their own orders/projects/requests
- Submit new requests
- View messages and notifications
- Upload files if applicable
- View invoices/payments if applicable
- Access customer support or account history

Customers should not see internal notes, vendor pricing, other customers, employee dashboards, reseller data, or admin settings.

3. Vendors

Vendors should manage their own vendor profile, products/services, requests, pricing, files, and communications.

Permissions:
- View and edit vendor profile
- Manage own products/services
- View assigned or related requests only
- Respond to quote/order/project requests
- Upload files/specs/documents
- View messages and notifications
- View limited payment/order status if applicable

Vendors should not see all customers, all platform financials, other vendors, employee-only tools, or admin settings.

4. Designers

Designers should manage design-related work assigned to them.

Permissions:
- View assigned customers/projects/orders
- View and upload design files
- Manage design drafts/proofs/revisions
- Communicate with employees/customers where allowed
- View assigned tasks
- Update design status
- View relevant notifications

Designers should not see unrelated customer records, vendor financials, reseller dashboards, or system settings.

5. Referrals

Referral users should see referral links, referred leads/customers, status, and earned rewards/commissions if applicable.

Permissions:
- View referral profile
- View referral link/code
- View referred contacts/customers
- View referral status
- View eligible rewards/commissions
- View messages and notifications

Referrals should not see customer private data beyond referral attribution/status, internal notes, vendor data, reseller data, or admin settings.

6. Resellers

Resellers should manage their own reseller account, customers/leads tied to them, sales pipeline, commissions, and related communications.

Permissions:
- View reseller profile
- View assigned customers/leads
- Create or submit customer leads
- View reseller orders/projects where applicable
- View commission/revenue status if applicable
- View messages and notifications
- Access reseller-specific resources

Resellers should not see all platform customers, other resellers, vendor internals, designer internals, or global settings.

7. Employees

Employees are internal ControlP.io team members. They need access to operational tools but not full system administration unless granted.

Permissions:
- View operational dashboards
- Manage customers as assigned
- Manage orders/projects/requests as assigned
- View communications
- Manage support tasks
- Work with vendors/designers/resellers as needed
- Add internal notes
- Upload/manage documents
- View notifications

Employees should not have full user/role/global settings access unless specifically granted by Super Admin.

Technical Requirements:

- Create or update the user role model/schema to support these roles.
- Add centralized role-based permissions.
- Add protected routes or middleware so users cannot access pages outside their role or permissions.
- Add dashboard routing based on user role.
- Add role-based navigation menus.
- Add permission checks on sensitive actions: create, read, update, delete.
- Make sure users only see records assigned to them or allowed by their role.
- Super Admin should be able to manage user roles and access.
- Keep the system flexible so permissions can expand later.
- Avoid hardcoding permission checks everywhere.
- Use a centralized permission map, helper function, middleware, policy system, or equivalent.

Suggested Permission Structure:

- users.view
- users.create
- users.edit
- users.delete
- roles.manage
- settings.manage
- customers.view_all
- customers.view_assigned
- customers.create
- customers.edit
- vendors.view_all
- vendors.view_own
- vendors.edit_own
- designers.view_all
- designers.view_assigned
- referrals.view_all
- referrals.view_own
- resellers.view_all
- resellers.view_own
- employees.view
- employees.manage
- projects.view_all
- projects.view_assigned
- projects.create
- projects.edit
- orders.view_all
- orders.view_assigned
- orders.create
- orders.edit
- quotes.view
- quotes.create
- quotes.edit
- invoices.view
- invoices.create
- invoices.edit
- messages.view
- messages.send
- notifications.view
- files.view
- files.upload
- profile.view
- profile.edit
- reports.view
- activity.view

Dashboard Routing Example:

- Super Admin → /dashboard/admin
- Customer → /dashboard/customer
- Vendor → /dashboard/vendor
- Designer → /dashboard/designer
- Referral → /dashboard/referral
- Reseller → /dashboard/reseller
- Employee → /dashboard/employee

Recommended Implementation Approach:

Start by auditing what already exists. Then provide the phased implementation plan before writing code. Once approved, begin implementation in phases.

When implementation begins, prioritize:

1. Centralized roles and permissions
2. Secure route protection
3. Role-based dashboard routing
4. Role-based navigation
5. Record-level access rules
6. User-specific dashboard experiences
7. Testing and QA

Deliverables:

1. Review the current app structure.
2. Identify what already exists related to roles, permissions, authentication, dashboards, and routing.
3. Provide a phased implementation plan.
4. After approval, add or update the user role structure.
5. Add centralized permissions.
6. Add role-based route protection.
7. Add role-based dashboard routing.
8. Add role-based navigation.
9. Add or update dashboard pages for each role.
10. Make sure each role only sees the correct records and actions.
11. Add concise comments where needed so future developers understand the permission logic.

Important SaaS Direction:

This should be structured as a long-term SaaS platform, not a one-off admin panel. The role system should make the app easier to scale, easier to secure, and easier to extend. It should support future multi-tenant access, subscriptions, teams/companies, expanded billing, partner channels, reporting, and additional user types.
