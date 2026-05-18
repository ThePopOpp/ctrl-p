-- ============================================================
-- controlp.io - RBAC phase 1/2 foundation
-- Adds canonical SaaS roles from the RBAC brief and centralizes
-- database helper functions for role and permission checks.
-- ============================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'employee';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'vendor';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'referral';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'reseller';

COMMENT ON TYPE user_role IS
  'Application role for ControlP.io users. Canonical SaaS roles include super_admin, customer, vendor, designer, referral, reseller, employee; legacy/internal roles remain for operational compatibility.';

CREATE OR REPLACE FUNCTION app_has_role(role_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users
    WHERE id = auth.uid()
      AND role::text = role_name
      AND status = 'active'
      AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION app_has_any_role(role_names text[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users
    WHERE id = auth.uid()
      AND role::text = ANY(role_names)
      AND status = 'active'
      AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION is_internal_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_has_any_role(ARRAY[
    'super_admin',
    'admin',
    'employee',
    'staff',
    'production_manager',
    'designer',
    'installer',
    'customer_support'
  ]);
$$;

CREATE OR REPLACE FUNCTION can_access_admin_console()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_has_any_role(ARRAY[
    'super_admin',
    'admin',
    'employee',
    'staff',
    'production_manager',
    'installer',
    'customer_support'
  ]);
$$;

-- Keep the legacy helper name for existing policies, but align it with
-- the new employee/admin console foundation. Designers are internal users,
-- but they should move to assigned-record policies in later RBAC phases.
CREATE OR REPLACE FUNCTION is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT can_access_admin_console();
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_has_any_role(ARRAY['admin', 'super_admin']);
$$;

CREATE OR REPLACE FUNCTION app_user_has_permission(permission_key text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_has_any_role(ARRAY['super_admin', 'admin'])
    OR (
      permission_key = ANY(ARRAY[
      'profile.view',
      'profile.edit',
      'messages.view',
      'messages.send',
      'notifications.view',
      'files.view'
      ])
      AND app_has_any_role(ARRAY[
        'customer',
        'vendor',
        'designer',
        'referral',
        'reseller',
        'employee',
        'staff',
        'production_manager',
        'installer',
        'customer_support'
      ])
    )
    OR (
      permission_key = ANY(ARRAY[
        'customers.view_assigned',
        'customers.edit',
        'orders.view_assigned',
        'orders.edit',
        'projects.view_assigned',
        'projects.edit',
        'quotes.view',
        'quotes.edit',
        'files.upload',
        'activity.view'
      ])
      AND app_has_any_role(ARRAY[
        'employee',
        'staff',
        'production_manager',
        'customer_support'
      ])
    )
    OR (
      permission_key = ANY(ARRAY[
        'orders.view_assigned',
        'projects.view_assigned',
        'projects.edit',
        'files.upload'
      ])
      AND app_has_role('installer')
    )
    OR (
      permission_key = ANY(ARRAY[
        'orders.view_assigned',
        'orders.create',
        'projects.view_assigned',
        'projects.create',
        'quotes.create',
        'invoices.view',
        'files.upload'
      ])
      AND app_has_role('customer')
    )
    OR (
      permission_key = ANY(ARRAY[
        'vendors.view_own',
        'vendors.edit_own',
        'orders.view_assigned',
        'projects.view_assigned',
        'quotes.view',
        'files.upload'
      ])
      AND app_has_role('vendor')
    )
    OR (
      permission_key = ANY(ARRAY[
        'designers.view_assigned',
        'customers.view_assigned',
        'orders.view_assigned',
        'projects.view_assigned',
        'projects.edit',
        'files.upload'
      ])
      AND app_has_role('designer')
    )
    OR (
      permission_key = ANY(ARRAY[
        'referrals.view_own',
        'customers.view_assigned'
      ])
      AND app_has_role('referral')
    )
    OR (
      permission_key = ANY(ARRAY[
        'resellers.view_own',
        'customers.view_assigned',
        'customers.create',
        'orders.view_assigned',
        'projects.view_assigned',
        'reports.view'
      ])
      AND app_has_role('reseller')
    );
$$;

COMMENT ON FUNCTION app_user_has_permission(text) IS
  'Central database-side RBAC permission helper. This mirrors the app permission map and is intended for future granular RLS policies.';
