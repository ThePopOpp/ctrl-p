import type { AppRole } from "@/lib/rbac/roles";

export type Order = {
  id: string;
  order_number: string | null;
  user_id?: string | null;
  status: string;
  production_status: string;
  payment_status: string;
  subtotal?: number | string | null;
  discount_amount?: number | string | null;
  coupon_id?: string | null;
  total: number | string | null;
  company: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_notes: string | null;
  internal_notes: string | null;
  due_at: string | null;
  users?: {
    full_name: string | null;
    company: string | null;
  } | null;
};

export type OrderItem = {
  id: string;
  order_id: string;
  quantity: number | null;
  unit_price: number | string | null;
  line_total: number | string | null;
  proof_required: boolean | null;
  products?: {
    id: string;
    name: string | null;
    category: string | null;
  } | null;
};

export type ProductionJob = {
  id: string;
  order_id: string;
  order_item_id?: string | null;
  status: string;
  priority: number | null;
  assigned_staff_id?: string | null;
  station: string | null;
  due_at: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  orders?: { order_number: string | null } | null;
  order_items?: {
    quantity: number | null;
    products?: { id?: string | null; name: string | null; category?: string | null } | null;
  } | null;
};

export type ArtworkFile = {
  id: string;
  user_id: string | null;
  order_id?: string | null;
  order_item_id: string | null;
  storage_path: string;
  bucket: string;
  filename: string;
  mime_type: string;
  file_size_bytes: number | string | null;
  thumbnail_url: string | null;
  width_px: number | null;
  height_px: number | null;
  dpi: number | null;
  color_mode: string | null;
  review_status?: string | null;
  proof_version?: number | null;
  uploaded_by?: string | null;
  admin_comments?: string | null;
  customer_comments?: string | null;
  final_approved_file_id?: string | null;
  created_at: string | null;
};

export type Proof = {
  id: string;
  order_item_id: string;
  storage_path: string;
  proof_url: string;
  revision_number: number | null;
  status?: string | null;
  uploaded_by?: string | null;
  customer_comments?: string | null;
  admin_comments?: string | null;
  sent_at: string | null;
  customer_approved_at: string | null;
  rejected_at?: string | null;
  revisions?: unknown;
  created_at: string | null;
};

export type DesignDraft = {
  id: string;
  user_id: string | null;
  product_id: string | null;
  product_key: string | null;
  product_label: string | null;
  title: string | null;
  status: string | null;
  state?: unknown;
  artwork_file_id?: string | null;
  preview_image_url?: string | null;
  order_id?: string | null;
  notes?: string | null;
  last_saved_at: string | null;
  created_at: string | null;
  updated_at?: string | null;
};

export type Shipment = {
  id: string;
  order_id: string;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  status: string | null;
  shipped_at: string | null;
  estimated_delivery_at: string | null;
  delivered_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type Payment = {
  id: string;
  order_id: string;
  user_id?: string | null;
  amount: number | string | null;
  status: string;
  provider: string | null;
  method: string | null;
  currency?: string | null;
  notes?: string | null;
  invoice_number?: string | null;
  invoice_due_at?: string | null;
  invoice_terms?: string | null;
  billing_contact?: unknown;
  line_items?: unknown;
  subtotal?: number | string | null;
  tax_amount?: number | string | null;
  discount_amount?: number | string | null;
  balance_due?: number | string | null;
  payment_link_url?: string | null;
  document_status?: string | null;
  delivery_status?: string | null;
  received_at: string | null;
  created_at: string | null;
};

export type Message = {
  id: string;
  user_id?: string | null;
  order_id: string | null;
  subject: string | null;
  body?: string | null;
  channel: string;
  direction: string;
  internal_only?: boolean | null;
  read_at: string | null;
  sent_at?: string | null;
  created_at: string | null;
};

export type Product = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  category: string;
  tagline?: string | null;
  description: string | null;
  short_description?: string | null;
  product_type?: string | null;
  base_cost: number | string | null;
  base_price?: number | string | null;
  sale_price?: number | string | null;
  vendor: string;
  active: boolean;
  status?: string | null;
  stock_status?: string | null;
  featured?: boolean | null;
  customizer_enabled?: boolean | null;
  alternate_skus?: unknown;
  tags?: unknown;
  brands?: unknown;
  tax_status?: string | null;
  tax_class?: string | null;
  coupon_code?: string | null;
  accessories?: unknown;
  specifications?: unknown;
  image_url?: string | null;
  video_url?: string | null;
  photo_gallery?: unknown;
  faqs?: unknown;
  tips?: unknown;
  attributes?: unknown;
  similar_products?: unknown;
  linked_products?: unknown;
  weight_lbs?: number | string | null;
  dimension_length_in?: number | string | null;
  dimension_width_in?: number | string | null;
  dimension_height_in?: number | string | null;
  shipping_class?: string | null;
  template_files?: unknown;
  import_sources?: unknown;
  woo_product_id?: string | null;
  woo_permalink?: string | null;
  woo_sync_enabled?: boolean | null;
  woo_sync_status?: string | null;
  woo_last_synced_at?: string | null;
  gallery?: unknown;
  sizes?: unknown;
  materials?: unknown;
  print_options?: unknown;
  finishing_options?: unknown;
  quantity_tiers?: unknown;
  turnaround_times?: unknown;
  shipping_options?: unknown;
  file_upload_requirements?: unknown;
  price_rules?: unknown;
  designer_template?: unknown;
  designer_surfaces?: unknown;
  designer_constraints?: unknown;
  personalization_schema?: unknown;
  proofing_settings?: unknown;
  production_requirements?: unknown;
  product_assets?: unknown;
  meta?: unknown;
  created_at: string | null;
};

export type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone?: string | null;
  company: string | null;
  role: AppRole;
  status: string;
  created_at: string | null;
  last_login_at?: string | null;
  deleted_at?: string | null;
};

export type AdminProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole;
  status: string;
  deleted_at?: string | null;
};

export type ActivityLog = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type AdminDashboardData = {
  orders: Order[];
  orderItems: OrderItem[];
  productionJobs: ProductionJob[];
  artworkFiles: ArtworkFile[];
  proofs: Proof[];
  designDrafts: DesignDraft[];
  shipments: Shipment[];
  payments: Payment[];
  messages: Message[];
  users: AdminUser[];
  activityLogs: ActivityLog[];
  products: Product[];
};
