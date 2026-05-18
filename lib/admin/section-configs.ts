import type { AdminDashboardData } from "@/lib/admin/types";

export type AdminSectionConfig = {
  title: string;
  eyebrow: string;
  description: string;
  searchPlaceholder: string;
  primaryAction: string;
  secondaryAction: string;
  stats: (data: AdminDashboardData) => { label: string; value: string; hint: string }[];
  panels: { title: string; description: string; items: string[] }[];
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function numberValue(value: number | string | null | undefined) {
  return Number(value || 0);
}

export const adminSectionConfigs = {
  analytics: {
    title: "Analytics",
    eyebrow: "Analytics",
    description: "Track revenue, order volume, production health, customer behavior, and operational trends across ControlP.",
    searchPlaceholder: "Search reports, orders, customers...",
    primaryAction: "Create report",
    secondaryAction: "Export CSV",
    stats: (data) => {
      const revenue = data.payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + numberValue(payment.amount), 0);
      return [
        { label: "Revenue", value: money.format(revenue), hint: "Paid payment records" },
        { label: "Orders", value: String(data.orders.length), hint: "Visible order records" },
        { label: "AOV", value: money.format(data.orders.length ? revenue / data.orders.length : 0), hint: "Average order value" },
        { label: "Jobs", value: String(data.productionJobs.length), hint: "Production records" },
        { label: "Messages", value: String(data.messages.length), hint: "Unread conversations" },
      ];
    },
    panels: [
      { title: "Revenue reporting", description: "Sales, payments, refunds, and margin views", items: ["Daily revenue", "Payment processor mix", "Refund trend", "Product revenue"] },
      { title: "Operational analytics", description: "Production and fulfillment performance", items: ["Queue aging", "Proof approval time", "Print readiness", "Shipment velocity"] },
      { title: "Customer analytics", description: "Account activity and purchase behavior", items: ["Top customers", "Repeat buyers", "Dormant accounts", "Customer segments"] },
    ],
  },
  orders: {
    title: "Orders",
    eyebrow: "Orders",
    description: "Manage customer orders from intake through payment, proofing, production, pickup, delivery, and closeout.",
    searchPlaceholder: "Search orders, customers, order numbers...",
    primaryAction: "New order",
    secondaryAction: "Import orders",
    stats: (data) => [
      { label: "Total orders", value: String(data.orders.length), hint: "Visible order records" },
      { label: "In production", value: String(data.orders.filter((order) => order.status === "in_production").length), hint: "Active fulfillment" },
      { label: "Proofing", value: String(data.orders.filter((order) => order.status === "proofing").length), hint: "Awaiting approval" },
      { label: "Payment holds", value: String(data.orders.filter((order) => ["unpaid", "pending", "partially_paid"].includes(order.payment_status)).length), hint: "Needs billing follow-up" },
      { label: "Revenue", value: money.format(data.orders.reduce((sum, order) => sum + numberValue(order.total), 0)), hint: "Order totals" },
    ],
    panels: [
      { title: "Order desk", description: "Daily command lane for active work", items: ["New order intake", "Order detail drawer", "Customer notes", "Internal handoff"] },
      { title: "Approvals", description: "Proofing and file review checkpoints", items: ["File review", "Proof pending", "Needs changes", "Approved to print"] },
      { title: "Closeout", description: "Payment, delivery, receipts, and archive", items: ["Collect balance", "Generate receipt", "Mark delivered", "Archive order"] },
    ],
  },
  production: {
    title: "Production",
    eyebrow: "Production",
    description: "Coordinate file checks, design work, print readiness, finishing, installs, and order production status.",
    searchPlaceholder: "Search jobs, stations, products...",
    primaryAction: "Create job",
    secondaryAction: "Queue view",
    stats: (data) => [
      { label: "Jobs", value: String(data.productionJobs.length), hint: "Production records" },
      { label: "Active", value: String(data.productionJobs.filter((job) => !["completed", "ready"].includes(job.status)).length), hint: "Open work" },
      { label: "Print ready", value: String(data.productionJobs.filter((job) => job.status === "print_ready").length), hint: "Next queue" },
      { label: "Proof pending", value: String(data.productionJobs.filter((job) => job.status === "proof_pending").length), hint: "Customer checkpoint" },
      { label: "On hold", value: String(data.productionJobs.filter((job) => job.status === "on_hold").length), hint: "Needs triage" },
    ],
    panels: [
      { title: "Prepress", description: "Artwork, files, proofs, and print readiness", items: ["File check", "Design needed", "Proof pending", "Print ready"] },
      { title: "Shop floor", description: "Production stations and job progression", items: ["Printing", "Finishing", "Install scheduled", "Ready for pickup"] },
      { title: "Automation", description: "Routing and alerts for the queue", items: ["Priority rules", "Due date alerts", "Station assignment", "Completion logging"] },
    ],
  },
  messages: {
    title: "Messages",
    eyebrow: "Messages",
    description: "Centralize customer conversations, internal notes, SMS, SMTP email, IMAP inbox sync, notifications, and order communication history.",
    searchPlaceholder: "Search messages, customers, orders...",
    primaryAction: "New message",
    secondaryAction: "Messaging setup",
    stats: (data) => [
      { label: "Unread", value: String(data.messages.length), hint: "Needs response" },
      { label: "Inbound", value: String(data.messages.filter((message) => message.direction === "inbound").length), hint: "Customer sent" },
      { label: "Orders", value: String(new Set(data.messages.map((message) => message.order_id).filter(Boolean)).size), hint: "Linked conversations" },
      { label: "Dashboard", value: String(data.messages.filter((message) => message.channel === "dashboard").length), hint: "Portal channel" },
      { label: "Users", value: String(data.users.length), hint: "Reachable accounts" },
    ],
    panels: [
      { title: "Twilio SMS", description: "Outbound and inbound SMS channel", items: ["TWILIO_PHONE_NUMBER", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "SMS order alerts", "SMS payment reminders"] },
      { title: "SMTP email", description: "Outbound email from hello@controlp.io", items: ["EMAIL_FROM", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"] },
      { title: "IMAP inbox", description: "Inbound email sync for customer replies", items: ["IMAP_HOST", "IMAP_PORT", "IMAP_USER", "IMAP_PASSWORD", "Thread replies to orders"] },
      { title: "Inbox", description: "Messages that need attention", items: ["Unread queue", "Assigned replies", "Customer updates", "Internal comments"] },
      { title: "Notifications", description: "Automated email, SMS, and dashboard notices", items: ["Proof ready", "Payment due", "Order complete", "Pickup reminder"] },
      { title: "Templates", description: "Reusable customer communication", items: ["Quote follow-up", "Artwork issue", "Approval request", "Delivery notice"] },
    ],
  },
  customers: {
    title: "Customers",
    eyebrow: "Customers",
    description: "Manage customer accounts, company profiles, order history, billing relationships, and support context.",
    searchPlaceholder: "Search customers, companies, emails...",
    primaryAction: "Add customer",
    secondaryAction: "Import list",
    stats: (data) => [
      { label: "Customers", value: String(data.users.filter((user) => user.role === "customer").length), hint: "Customer role accounts" },
      { label: "Companies", value: String(new Set(data.users.map((user) => user.company).filter(Boolean)).size), hint: "Known organizations" },
      { label: "Orders", value: String(data.orders.length), hint: "Linked order records" },
      { label: "Messages", value: String(data.messages.length), hint: "Unread support context" },
      { label: "Revenue", value: money.format(data.payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + numberValue(payment.amount), 0)), hint: "Collected payments" },
    ],
    panels: [
      { title: "Customer profile", description: "Identity, company, billing, and contact details", items: ["Primary contacts", "Company profile", "Saved addresses", "Billing terms"] },
      { title: "Customer work", description: "Orders, files, designs, and support history", items: ["Order history", "Uploaded files", "Proof approvals", "Support notes"] },
      { title: "Segments", description: "Customer groups and lifecycle actions", items: ["Repeat customers", "High value accounts", "Dormant customers", "Reseller-owned customers"] },
    ],
  },
  products: {
    title: "Products",
    eyebrow: "Products",
    description: "Manage catalog products, categories, pricing, production metadata, product templates, and storefront visibility.",
    searchPlaceholder: "Search products, SKUs, categories...",
    primaryAction: "Add product",
    secondaryAction: "Categories",
    stats: (data) => [
      { label: "Line items", value: String(data.orderItems.length), hint: "Products ordered" },
      { label: "Categories", value: String(new Set(data.orderItems.map((item) => item.products?.category).filter(Boolean)).size), hint: "Selling categories" },
      { label: "Proof required", value: String(data.orderItems.filter((item) => item.proof_required).length), hint: "Design checkpoint" },
      { label: "Units", value: String(data.orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)), hint: "Ordered quantity" },
      { label: "Revenue", value: money.format(data.orderItems.reduce((sum, item) => sum + numberValue(item.line_total), 0)), hint: "Line item total" },
    ],
    panels: [
      { title: "Catalog", description: "Products, categories, options, and pricing", items: ["Product list", "Category manager", "Price rules", "Option sets"] },
      { title: "Production metadata", description: "What the shop needs to fulfill the item", items: ["Proof required", "Vendor routing", "Station defaults", "Turnaround rules"] },
      { title: "Storefront", description: "How products appear to customers", items: ["Published status", "Product media", "SEO content", "Template links"] },
    ],
  },
  artwork: {
    title: "Artwork",
    eyebrow: "Artwork",
    description: "Review customer uploads, proofs, design requests, file readiness, and reusable design assets.",
    searchPlaceholder: "Search artwork, proofs, customers...",
    primaryAction: "Upload proof",
    secondaryAction: "Design queue",
    stats: (data) => [
      { label: "Proof orders", value: String(data.orders.filter((order) => ["file_review", "proofing"].includes(order.status)).length), hint: "Needs design attention" },
      { label: "Proof items", value: String(data.orderItems.filter((item) => item.proof_required).length), hint: "Proof required" },
      { label: "File check", value: String(data.productionJobs.filter((job) => job.status === "file_check").length), hint: "Prepress lane" },
      { label: "Design needed", value: String(data.productionJobs.filter((job) => job.status === "design_needed").length), hint: "Designer queue" },
      { label: "Approved", value: String(data.productionJobs.filter((job) => job.status === "proof_approved").length), hint: "Ready to move" },
    ],
    panels: [
      { title: "File review", description: "Validate uploads before production", items: ["Resolution check", "Bleed and safe area", "Color mode", "Missing assets"] },
      { title: "Proofing", description: "Customer-facing approvals and revisions", items: ["Create proof", "Send approval", "Needs changes", "Approved to print"] },
      { title: "Design library", description: "Reusable assets and generated PDFs", items: ["Templates", "Brand assets", "PDFX proofs", "Download packets"] },
    ],
  },
  shipments: {
    title: "Shipments",
    eyebrow: "Shipments",
    description: "Coordinate shipping, pickup, delivery, install logistics, tracking, and fulfillment handoff.",
    searchPlaceholder: "Search shipments, orders, tracking...",
    primaryAction: "Create shipment",
    secondaryAction: "Pickup queue",
    stats: (data) => [
      { label: "Ready", value: String(data.productionJobs.filter((job) => job.status === "ready").length), hint: "Awaiting handoff" },
      { label: "Completed", value: String(data.productionJobs.filter((job) => job.status === "completed").length), hint: "Closed jobs" },
      { label: "Install scheduled", value: String(data.productionJobs.filter((job) => job.status === "install_scheduled").length), hint: "Field work" },
      { label: "Orders", value: String(data.orders.length), hint: "Potential fulfillment" },
      { label: "Customers", value: String(data.users.filter((user) => user.role === "customer").length), hint: "Delivery recipients" },
    ],
    panels: [
      { title: "Fulfillment", description: "Pickup, local delivery, shipping, and install", items: ["Ready for pickup", "Local delivery", "Carrier shipment", "Install schedule"] },
      { title: "Tracking", description: "Labels, tracking numbers, and delivery events", items: ["Create label", "Tracking sync", "Delivery status", "Exception handling"] },
      { title: "Closeout", description: "Customer notices and records", items: ["Pickup notice", "Delivery receipt", "Install photos", "Archive fulfillment"] },
    ],
  },
  marketing: {
    title: "Marketing",
    eyebrow: "Marketing",
    description: "Manage campaigns, referrals, reseller programs, customer segments, promotions, and outbound messaging.",
    searchPlaceholder: "Search campaigns, referrals, customers...",
    primaryAction: "New campaign",
    secondaryAction: "Segments",
    stats: (data) => [
      { label: "Customers", value: String(data.users.filter((user) => user.role === "customer").length), hint: "Campaign audience" },
      { label: "Referrals", value: String(data.users.filter((user) => user.role === "referral").length), hint: "Referral partners" },
      { label: "Resellers", value: String(data.users.filter((user) => user.role === "reseller").length), hint: "Reseller accounts" },
      { label: "Messages", value: String(data.messages.length), hint: "Open communication" },
      { label: "Revenue", value: money.format(data.payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + numberValue(payment.amount), 0)), hint: "Campaign outcome input" },
    ],
    panels: [
      { title: "Campaigns", description: "Promotions, announcements, and lifecycle campaigns", items: ["Promo campaigns", "Winback flow", "New customer series", "Order follow-up"] },
      { title: "Partner growth", description: "Referral and reseller program operations", items: ["Referral links", "Reseller onboarding", "Commission tracking", "Partner assets"] },
      { title: "Segments", description: "Audience lists and targeting rules", items: ["Top customers", "Product buyers", "Dormant accounts", "Local businesses"] },
    ],
  },
  settings: {
    title: "Settings",
    eyebrow: "Settings",
    description: "Configure account settings, RBAC defaults, payment processors, document templates, notifications, and system preferences.",
    searchPlaceholder: "Search settings, roles, integrations...",
    primaryAction: "Save changes",
    secondaryAction: "Audit log",
    stats: (data) => [
      { label: "Users", value: String(data.users.length), hint: "Accounts governed" },
      { label: "Internal", value: String(data.users.filter((user) => ["super_admin", "admin", "employee", "staff"].includes(user.role)).length), hint: "Admin access roles" },
      { label: "Payments", value: String(data.payments.length), hint: "Billing records" },
      { label: "Messages", value: String(data.messages.length), hint: "Notification context" },
      { label: "Orders", value: String(data.orders.length), hint: "Workflow records" },
    ],
    panels: [
      { title: "Access and security", description: "RBAC, user defaults, sessions, and admin controls", items: ["Default roles", "Permission map", "2FA policy", "Session rules"] },
      { title: "Integrations", description: "Processors, PDFs, email, and shipping services", items: ["Stripe", "PayPal", "Square", "PDFX documents"] },
      { title: "Operations", description: "Business defaults and workflow preferences", items: ["Order statuses", "Production lanes", "Notification templates", "Tax and billing"] },
    ],
  },
} satisfies Record<string, AdminSectionConfig>;
