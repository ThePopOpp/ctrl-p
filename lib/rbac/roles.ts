export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  EMPLOYEE: "employee",
  STAFF: "staff",
  CUSTOMER: "customer",
  VENDOR: "vendor",
  DESIGNER: "designer",
  REFERRAL: "referral",
  RESELLER: "reseller",
  PRODUCTION_MANAGER: "production_manager",
  INSTALLER: "installer",
  CUSTOMER_SUPPORT: "customer_support",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export const CANONICAL_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.CUSTOMER,
  ROLES.VENDOR,
  ROLES.DESIGNER,
  ROLES.REFERRAL,
  ROLES.RESELLER,
  ROLES.EMPLOYEE,
] as const;

export const LEGACY_INTERNAL_ROLES = [
  ROLES.ADMIN,
  ROLES.STAFF,
  ROLES.PRODUCTION_MANAGER,
  ROLES.INSTALLER,
  ROLES.CUSTOMER_SUPPORT,
] as const;

export const ADMIN_CONSOLE_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.EMPLOYEE,
  ROLES.STAFF,
  ROLES.PRODUCTION_MANAGER,
  ROLES.INSTALLER,
  ROLES.CUSTOMER_SUPPORT,
] as const satisfies readonly AppRole[];

export const INTERNAL_ROLES = [
  ...ADMIN_CONSOLE_ROLES,
  ROLES.DESIGNER,
] as const satisfies readonly AppRole[];

export function isAppRole(role: string | null | undefined): role is AppRole {
  return Object.values(ROLES).includes(role as AppRole);
}

export function isAdminConsoleRole(role: string | null | undefined) {
  return isAppRole(role) && (ADMIN_CONSOLE_ROLES as readonly AppRole[]).includes(role);
}

export function isInternalRole(role: string | null | undefined) {
  return isAppRole(role) && (INTERNAL_ROLES as readonly AppRole[]).includes(role);
}

export function defaultDashboardPathForRole(role: string | null | undefined) {
  switch (role) {
    case ROLES.SUPER_ADMIN:
    case ROLES.ADMIN:
      return "/admin";
    case ROLES.EMPLOYEE:
    case ROLES.STAFF:
    case ROLES.PRODUCTION_MANAGER:
    case ROLES.INSTALLER:
    case ROLES.CUSTOMER_SUPPORT:
      return "/admin";
    case ROLES.VENDOR:
      return "/dashboard/vendor";
    case ROLES.DESIGNER:
      return "/dashboard/designer";
    case ROLES.REFERRAL:
      return "/dashboard/referral";
    case ROLES.RESELLER:
      return "/dashboard/reseller";
    case ROLES.CUSTOMER:
    default:
      return "/dashboard/customer";
  }
}
