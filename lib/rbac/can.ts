import { isAppRole, type AppRole } from "@/lib/rbac/roles";
import { ROLE_PERMISSIONS, type Permission } from "@/lib/rbac/permissions";

export type RbacUser = {
  role?: string | null;
  status?: string | null;
  deleted_at?: string | null;
};

export function isActiveUser(user: RbacUser | null | undefined): user is RbacUser {
  return Boolean(user && user.status === "active" && !user.deleted_at);
}

export function permissionsForRole(role: string | null | undefined): readonly Permission[] {
  if (!isAppRole(role)) return [];
  return ROLE_PERMISSIONS[role as AppRole];
}

export function can(user: RbacUser | null | undefined, permission: Permission) {
  if (!isActiveUser(user)) return false;
  return permissionsForRole(user.role).includes(permission);
}

export function canAny(user: RbacUser | null | undefined, permissions: readonly Permission[]) {
  return permissions.some((permission) => can(user, permission));
}

export function hasRole(user: RbacUser | null | undefined, roles: readonly AppRole[]) {
  if (!isActiveUser(user) || !isAppRole(user.role)) return false;
  return roles.includes(user.role);
}
