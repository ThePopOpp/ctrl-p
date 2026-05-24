export type GanttWorkflowTemplateItem = {
  key: string;
  title: string;
  description?: string;
  item_type: "phase" | "task" | "milestone" | "approval" | "artwork_review" | "proof" | "production_step" | "qc_check" | "delivery" | "installation" | "customer_action";
  phase: string;
  owner_role: string;
  duration_days: number;
  start_offset_days: number;
  status?: string;
  priority?: string;
  customer_visible?: boolean;
  internal_only?: boolean;
  blocks_production?: boolean;
  requires_approval?: boolean;
  requires_payment?: boolean;
  requires_deposit?: boolean;
  depends_on?: string;
  dependency_type?: "finish_to_start" | "start_to_start" | "finish_to_finish" | "start_to_finish";
};

export type GanttWorkflowTemplate = {
  name: string;
  slug: string;
  category: "print" | "design" | "apparel" | "digital_nfc_qr" | "installation" | "fabrication" | "fulfillment" | "custom";
  description: string;
  product_type?: string;
  items: GanttWorkflowTemplateItem[];
};

const standardPrintItems: GanttWorkflowTemplateItem[] = [
  item("order_created", "Customer Order Created", "milestone", "Intake", "System / Sales", 0, 0, { customer_visible: true }),
  item("payment_received", "Payment Received or Deposit Paid", "milestone", "Billing", "Billing", 0, 0, { customer_visible: true, requires_payment: true, depends_on: "order_created" }),
  item("artwork_uploaded", "Artwork Uploaded", "customer_action", "Artwork", "Customer", 1, 0, { customer_visible: true, depends_on: "order_created" }),
  item("file_review", "Artwork / File Review", "artwork_review", "Prepress", "Design / Prepress", 1, 1, { customer_visible: true, depends_on: "artwork_uploaded" }),
  item("proof_created", "Proof Created", "proof", "Proofing", "Design / Prepress", 1, 2, { customer_visible: true, depends_on: "file_review" }),
  item("proof_approval", "Customer Proof Approval", "approval", "Proofing", "Customer", 1, 3, { customer_visible: true, blocks_production: true, requires_approval: true, depends_on: "proof_created" }),
  item("pre_production", "Print Pre-Production", "task", "Production Prep", "Production", 1, 4, { depends_on: "proof_approval" }),
  item("stock_check", "Material / Stock Check", "task", "Production Prep", "Production", 1, 4, { depends_on: "pre_production" }),
  item("print_production", "Print Production", "production_step", "Production", "Production", 1, 5, { customer_visible: true, depends_on: "stock_check" }),
  item("finishing", "Finishing", "production_step", "Finishing", "Production", 1, 6, { depends_on: "print_production" }),
  item("quality_control", "Quality Control", "qc_check", "QC", "Production Manager", 1, 7, { depends_on: "finishing" }),
  item("final_payment", "Final Payment Due", "milestone", "Billing", "Billing", 0, 8, { customer_visible: true, requires_payment: true, depends_on: "quality_control" }),
  item("ready", "Ready for Pickup / Shipping", "milestone", "Fulfillment", "Fulfillment", 0, 8, { customer_visible: true, depends_on: "final_payment" }),
  item("fulfilled", "Pickup / Shipping Completed", "delivery", "Fulfillment", "Fulfillment", 1, 9, { customer_visible: true, depends_on: "ready" }),
  item("closed", "Order Closed", "milestone", "Closeout", "Admin / System", 0, 10, { depends_on: "fulfilled" }),
];

export const ganttWorkflowTemplates: GanttWorkflowTemplate[] = [
  template("Standard Print Order", "standard-print-order", "print", "Business cards, flyers, stickers, posters, labels, and standard print jobs.", standardPrintItems),
  template("Design + Print Order", "design-print-order", "design", "Adds design intake, concept, revisions, approval, print production, and fulfillment.", [
    item("order_created", "Customer Order Created", "milestone", "Intake", "System / Sales", 0, 0, { customer_visible: true }),
    item("deposit_paid", "Deposit Paid", "milestone", "Billing", "Billing", 0, 0, { customer_visible: true, requires_deposit: true, depends_on: "order_created" }),
    item("brief", "Design Brief Submitted", "customer_action", "Design Intake", "Customer", 1, 0, { customer_visible: true, depends_on: "order_created" }),
    item("assets", "Customer Assets Uploaded", "customer_action", "Design Intake", "Customer", 1, 1, { customer_visible: true, depends_on: "brief" }),
    item("kickoff", "Design Kickoff", "task", "Design", "Design", 1, 2, { depends_on: "deposit_paid" }),
    item("concept", "Initial Design Concept", "task", "Design", "Design", 2, 3, { depends_on: "assets" }),
    item("internal_review", "Internal Design Review", "task", "Design", "Design / Admin", 1, 5, { depends_on: "concept" }),
    item("proof_sent", "Design Proof Sent to Customer", "proof", "Proofing", "Design", 0, 6, { customer_visible: true, depends_on: "internal_review" }),
    item("design_approval", "Final Design Approval", "approval", "Proofing", "Customer", 1, 6, { customer_visible: true, requires_approval: true, blocks_production: true, depends_on: "proof_sent" }),
    item("file_prep", "Print-Ready File Prep", "artwork_review", "Prepress", "Prepress", 1, 7, { depends_on: "design_approval" }),
    ...standardPrintItems.slice(8).map((row, index) => ({ ...row, key: `print_${row.key}`, start_offset_days: 8 + index, depends_on: index === 0 ? "file_prep" : `print_${standardPrintItems.slice(8)[index - 1]?.key}` })),
  ]),
  template("Business Card + Digital Card", "business-card-digital-card", "digital_nfc_qr", "Printed cards with QR/NFC and hosted digital business card access.", [
    item("order_created", "Customer Order Created", "milestone", "Intake", "System / Sales", 0, 0, { customer_visible: true }),
    item("package_selected", "Product Package Selected", "task", "Intake", "Sales", 0, 0, { customer_visible: true, depends_on: "order_created" }),
    item("digital_access", "Monthly Digital Card Access Created", "task", "Digital Card", "System / Admin", 1, 0, { customer_visible: true, depends_on: "package_selected" }),
    item("payment", "Deposit / Payment Received", "milestone", "Billing", "Billing", 0, 0, { customer_visible: true, requires_payment: true, depends_on: "order_created" }),
    item("details", "Customer Business Card Details Submitted", "customer_action", "Content", "Customer", 1, 1, { customer_visible: true, depends_on: "payment" }),
    item("digital_draft", "Digital Business Card Draft Created", "task", "Digital Card", "Design / Admin", 1, 2, { customer_visible: true, depends_on: "details" }),
    item("public_url", "Digital Card Public URL Confirmed", "milestone", "Digital Card", "Admin / System", 0, 3, { customer_visible: true, depends_on: "digital_draft" }),
    item("qr_generated", "QR Code Generated", "task", "QR / NFC", "System / Design", 1, 3, { customer_visible: true, depends_on: "public_url" }),
    item("artwork", "Business Card Artwork Created", "task", "Design", "Design", 2, 4, { customer_visible: true, depends_on: "qr_generated" }),
    item("proof", "Customer Proof Sent", "proof", "Proofing", "Design", 0, 6, { customer_visible: true, depends_on: "artwork" }),
    item("approval", "Customer Proof Approval", "approval", "Proofing", "Customer", 1, 6, { customer_visible: true, requires_approval: true, blocks_production: true, depends_on: "proof" }),
    item("nfc_url", "NFC Destination URL Prepared", "task", "QR / NFC", "Admin / Production", 1, 7, { depends_on: "public_url" }),
    item("production", "Business Card Production", "production_step", "Production", "Production", 1, 8, { customer_visible: true, depends_on: "approval" }),
    item("nfc_encoding", "NFC Encoding / Assignment", "task", "QR / NFC", "Admin / Production", 1, 9, { depends_on: "nfc_url" }),
    item("hosting_confirmed", "Subscription / Hosting Status Confirmed", "task", "Digital Card", "Billing / Admin", 0, 9, { customer_visible: true, requires_payment: true, depends_on: "digital_access" }),
    item("qc", "Quality Control", "qc_check", "QC", "Production Manager", 1, 10, { depends_on: "production" }),
    item("ready", "Ready for Pickup / Shipping", "milestone", "Fulfillment", "Fulfillment", 0, 11, { customer_visible: true, depends_on: "qc" }),
    item("activated", "Customer Digital Card Activated", "milestone", "Digital Card", "System / Admin", 0, 11, { customer_visible: true, depends_on: "hosting_confirmed" }),
    item("closed", "Order Closed", "milestone", "Closeout", "Admin / System", 0, 12, { depends_on: "ready" }),
  ]),
  template("Vehicle Wrap / Fleet Graphics", "vehicle-wrap-fleet-graphics", "installation", "Wrap design, print, lamination, installation, walkthrough, and warranty handoff.", [
    item("quote_approved", "Customer Order / Quote Approved", "milestone", "Intake", "Sales", 0, 0, { customer_visible: true }),
    item("deposit", "Deposit Paid", "milestone", "Billing", "Billing", 0, 0, { customer_visible: true, requires_deposit: true, depends_on: "quote_approved" }),
    item("vehicle_info", "Vehicle Information Collected", "customer_action", "Intake", "Customer / Sales", 1, 0, { customer_visible: true, depends_on: "quote_approved" }),
    item("photos", "Vehicle Photos Uploaded", "customer_action", "Intake", "Customer", 1, 1, { customer_visible: true, depends_on: "vehicle_info" }),
    item("design", "Initial Wrap Design", "task", "Design", "Design", 3, 2, { depends_on: "photos" }),
    item("proof", "Customer Proof Sent", "proof", "Proofing", "Design", 0, 5, { customer_visible: true, depends_on: "design" }),
    item("approval", "Customer Proof Approval", "approval", "Proofing", "Customer", 1, 5, { customer_visible: true, requires_approval: true, blocks_production: true, depends_on: "proof" }),
    item("print", "Print Production", "production_step", "Production", "Production", 2, 6, { customer_visible: true, depends_on: "approval" }),
    item("lamination", "Lamination", "production_step", "Finishing", "Production", 1, 8, { depends_on: "print" }),
    item("install_scheduled", "Installation Scheduled", "task", "Installation", "Admin / Installer", 1, 9, { customer_visible: true, depends_on: "lamination" }),
    item("install", "Installation", "installation", "Installation", "Installer", 2, 10, { customer_visible: true, depends_on: "install_scheduled" }),
    item("walkthrough", "Customer Walkthrough", "approval", "Closeout", "Customer / Installer", 1, 12, { customer_visible: true, requires_approval: true, depends_on: "install" }),
    item("warranty", "Warranty Info Sent", "milestone", "Closeout", "Admin", 0, 13, { customer_visible: true, depends_on: "walkthrough" }),
    item("closed", "Project Closed", "milestone", "Closeout", "Admin / System", 0, 13, { depends_on: "warranty" }),
  ]),
  simpleFulfillment("Local Pickup", "local-pickup", "Customer pickup workflow for completed orders.", "Customer Pickup Completed"),
  simpleFulfillment("Delivery", "delivery", "Local delivery workflow with address confirmation and delivery completion.", "Delivered"),
  simpleFulfillment("Shipping / Fulfillment", "shipping-fulfillment", "Carrier shipping workflow for package prep, tracking, and closeout.", "Shipment Delivered"),
  template("Digital Business Card Only", "digital-business-card-only", "digital_nfc_qr", "Monthly digital card setup, QR generation, customer approval, and publish.", [
    item("subscription", "Digital Card Subscription Started", "milestone", "Intake", "System / Billing", 0, 0, { customer_visible: true }),
    item("payment", "Monthly Payment Confirmed", "milestone", "Billing", "Billing / System", 0, 0, { customer_visible: true, requires_payment: true, depends_on: "subscription" }),
    item("details", "Customer Profile Details Submitted", "customer_action", "Content", "Customer", 1, 0, { customer_visible: true, depends_on: "payment" }),
    item("links", "Links / Social Profiles Added", "customer_action", "Content", "Customer", 1, 1, { customer_visible: true, depends_on: "details" }),
    item("draft", "Digital Card Draft Created", "task", "Digital Card", "System / Admin", 1, 2, { customer_visible: true, depends_on: "links" }),
    item("qr", "QR Code Generated", "task", "QR / NFC", "System", 0, 3, { customer_visible: true, depends_on: "draft" }),
    item("approval", "Customer Preview / Approval", "approval", "Review", "Customer", 1, 3, { customer_visible: true, requires_approval: true, depends_on: "qr" }),
    item("published", "Digital Card Published", "milestone", "Launch", "System / Admin", 0, 4, { customer_visible: true, depends_on: "approval" }),
    item("closed", "Setup Closed", "milestone", "Closeout", "Admin / System", 0, 4, { depends_on: "published" }),
  ]),
  compact("Embroidery Order", "embroidery-order", "apparel", "Digitizing, sew-out, approval, embroidery production, QC, and fulfillment.", ["Deposit Paid", "Logo / Artwork Received", "Digitizing", "Sample Sew-Out", "Customer Approval", "Embroidery Production", "Quality Control", "Ready for Pickup / Shipping", "Order Closed"]),
  compact("Screen Printing / Apparel", "screen-printing-apparel", "apparel", "Apparel artwork, screens/transfers, production, curing, QC, and fulfillment.", ["Payment Received", "Artwork / Sizing Confirmed", "Mockup Proof", "Customer Approval", "Screens / Transfers Prepared", "Print Production", "Curing / Finishing", "Quality Control", "Order Closed"]),
  compact("Large Format Signage", "large-format-signage", "print", "Large format print, mounting, lamination, finishing, QC, and fulfillment.", ["Order Created", "Artwork Uploaded", "File Review", "Proof Approval", "Material Check", "Print Production", "Lamination / Mounting", "Quality Control", "Ready for Pickup / Shipping", "Order Closed"]),
  compact("CNC / Laser Engraving", "cnc-laser-engraving", "fabrication", "Material prep, file setup, machine production, finishing, QC, and closeout.", ["Order Created", "Material Confirmed", "Vector File Review", "Customer Approval", "Machine Setup", "CNC / Laser Production", "Finishing", "Quality Control", "Order Closed"]),
  compact("Installation Job", "installation-job", "installation", "Schedule, prep, install, QC, walkthrough, sign-off, and closeout.", ["Install Scheduled", "Customer Reminder Sent", "Materials Prepared", "Site Arrival Confirmed", "Surface Prep", "Installation", "Install Quality Control", "Customer Sign-Off", "Installation Closed"]),
  compact("Deposit + Approval Controlled Job", "deposit-approval-controlled-job", "custom", "High-value job gates for quote approval, deposit, proof approval, production payment, final payment, and release.", ["Quote Sent", "Quote Approved", "Deposit Invoice Sent", "Deposit Paid", "Customer Files / Details Submitted", "Proof Created", "Customer Proof Approval", "Production Payment Confirmed", "Production Started", "Final Payment Confirmed", "Order Closed"]),
  compact("Rush Print Order", "rush-print-order", "print", "Compressed same-day/next-day print workflow with rush payment, immediate review, production, and pickup.", ["Rush Order Created", "Rush Fee Confirmed", "Full Payment Received", "Artwork Uploaded", "Immediate File Review", "Customer Approval Deadline", "Rush Production", "Ready for Pickup / Shipping", "Order Closed"], "rush"),
  compact("Reprint / Revision", "reprint-revision", "print", "Reorder or corrected file workflow with original order lookup, updated proof, production, and closeout.", ["Reprint / Revision Request Created", "Original Order Located", "Updated Artwork / Details Confirmed", "Payment Confirmed", "Updated Proof Created", "Customer Approval", "Reprint Production", "Quality Control", "Order Closed"]),
  compact("Team Business Card Order", "team-business-card-order", "digital_nfc_qr", "Multi-person business card or digital card workflow with data upload, batch proofs, production, and activation.", ["Company Order Created", "Employee Data Requested", "Employee Data Uploaded", "Data Review / Cleanup", "Individual Card Proofs Generated", "Customer Batch Approval", "Digital Cards Created", "Card Production", "Cards Sorted by Employee / Department", "Digital Card Access Activated", "Order Closed"]),
  compact("Window Tint / Film Installation", "window-tint-film-installation", "installation", "Film type, measurements, material check, install schedule, installation, and warranty closeout.", ["Order / Appointment Created", "Film Type Selected", "Measurements Confirmed", "Material Availability Check", "Installation Scheduled", "Surface Prep", "Film Cutting / Plotting", "Installation", "Curing Instructions Provided", "Order Closed"]),
];

function template(name: string, slug: string, category: GanttWorkflowTemplate["category"], description: string, items: GanttWorkflowTemplateItem[]): GanttWorkflowTemplate {
  return { name, slug, category, description, items };
}

function item(
  key: string,
  title: string,
  item_type: GanttWorkflowTemplateItem["item_type"],
  phase: string,
  owner_role: string,
  duration_days: number,
  start_offset_days: number,
  patch: Partial<GanttWorkflowTemplateItem> = {},
): GanttWorkflowTemplateItem {
  return {
    key,
    title,
    item_type,
    phase,
    owner_role,
    duration_days,
    start_offset_days,
    status: patch.status || "not_started",
    priority: patch.priority || "normal",
    customer_visible: patch.customer_visible || false,
    internal_only: !patch.customer_visible,
    dependency_type: patch.dependency_type || "finish_to_start",
    ...patch,
  };
}

function compact(name: string, slug: string, category: GanttWorkflowTemplate["category"], description: string, titles: string[], priority = "normal") {
  const generated = titles.map((title, index) => {
    const approval = /approval|sign-off/i.test(title);
    const payment = /payment|deposit|fee|invoice/i.test(title);
    const production = /production|print|embroidery|cnc|laser|installation/i.test(title);
    const qc = /quality control/i.test(title);
    const closeout = /closed|closeout/i.test(title);
    return item(
      title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
      title,
      closeout ? "milestone" : approval ? "approval" : qc ? "qc_check" : production ? "production_step" : payment ? "milestone" : index === 0 ? "milestone" : "task",
      phaseForTitle(title),
      ownerForTitle(title),
      closeout || payment ? 0 : 1,
      index,
      {
        priority,
        customer_visible: index === 0 || approval || payment || production || closeout,
        requires_approval: approval,
        requires_payment: payment,
        requires_deposit: /deposit/i.test(title),
        depends_on: index > 0 ? titles[index - 1].toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") : undefined,
      },
    );
  });
  return template(name, slug, category, description, generated);
}

function simpleFulfillment(name: string, slug: string, description: string, completionTitle: string) {
  return compact(name, slug, "fulfillment", description, ["Production Completed", "Quality Control Completed", "Final Payment Confirmed", name.includes("Delivery") ? "Delivery Scheduled" : "Pickup / Shipping Location Confirmed", "Customer Notification Sent", completionTitle, "Order Closed"]);
}

function phaseForTitle(title: string) {
  if (/payment|deposit|fee|invoice|billing/i.test(title)) return "Billing";
  if (/artwork|proof|approval|design|file|mockup/i.test(title)) return "Proofing / Approval";
  if (/production|print|embroidery|cnc|laser|screen|machine/i.test(title)) return "Production";
  if (/shipping|pickup|delivery|fulfilled|notification/i.test(title)) return "Fulfillment";
  if (/install|site|surface|warranty/i.test(title)) return "Installation";
  if (/closed|closeout/i.test(title)) return "Closeout";
  return "Intake";
}

function ownerForTitle(title: string) {
  if (/payment|deposit|fee|invoice/i.test(title)) return "Billing";
  if (/customer|approval|uploaded|submitted/i.test(title)) return "Customer";
  if (/design|artwork|proof|file/i.test(title)) return "Design / Prepress";
  if (/shipping|pickup|delivery/i.test(title)) return "Fulfillment";
  if (/install|site|surface/i.test(title)) return "Installer";
  return "Admin / System";
}
