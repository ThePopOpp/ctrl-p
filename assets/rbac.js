(function () {
  'use strict';

  window.ControlP = window.ControlP || {};

  var ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    EMPLOYEE: 'employee',
    STAFF: 'staff',
    CUSTOMER: 'customer',
    VENDOR: 'vendor',
    DESIGNER: 'designer',
    REFERRAL: 'referral',
    RESELLER: 'reseller',
    PRODUCTION_MANAGER: 'production_manager',
    INSTALLER: 'installer',
    CUSTOMER_SUPPORT: 'customer_support'
  };

  var ADMIN_CONSOLE_ROLES = [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.EMPLOYEE,
    ROLES.STAFF,
    ROLES.PRODUCTION_MANAGER,
    ROLES.INSTALLER,
    ROLES.CUSTOMER_SUPPORT
  ];

  function isActiveUser(user) {
    return Boolean(user && user.status === 'active' && !user.deleted_at);
  }

  function isAdminConsoleRole(role) {
    return ADMIN_CONSOLE_ROLES.indexOf(role) !== -1;
  }

  function canAccessAdminConsole(user) {
    return isActiveUser(user) && isAdminConsoleRole(user.role);
  }

  function nextUrlForRole(role) {
    switch (role) {
      case ROLES.SUPER_ADMIN:
      case ROLES.ADMIN:
      case ROLES.EMPLOYEE:
      case ROLES.STAFF:
      case ROLES.PRODUCTION_MANAGER:
      case ROLES.INSTALLER:
      case ROLES.CUSTOMER_SUPPORT:
        return 'admin-dashboard.html';
      case ROLES.VENDOR:
      case ROLES.DESIGNER:
      case ROLES.REFERRAL:
      case ROLES.RESELLER:
      case ROLES.CUSTOMER:
      default:
        return 'dashboard.html';
    }
  }

  window.ControlP.rbac = {
    roles: ROLES,
    adminConsoleRoles: ADMIN_CONSOLE_ROLES,
    canAccessAdminConsole: canAccessAdminConsole,
    isAdminConsoleRole: isAdminConsoleRole,
    nextUrlForRole: nextUrlForRole
  };
})();
