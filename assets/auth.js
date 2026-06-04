(function () {
  'use strict';

  var FALLBACK_ADMIN_ROLES = [
    'super_admin',
    'admin',
    'employee',
    'staff',
    'production_manager',
    'installer',
    'customer_support'
  ];

  function client() {
    return window.ControlP && window.ControlP.getSupabase ? window.ControlP.getSupabase() : null;
  }

  function field(root, name, fallbackIndex) {
    return root.querySelector('[name="' + name + '"]') || root.querySelectorAll('input')[fallbackIndex];
  }

  function setMessage(root, message, tone) {
    var el = root.querySelector('[data-auth-message]');
    if (!el) {
      el = document.createElement('div');
      el.setAttribute('data-auth-message', '');
      el.className = 'text-[12.5px] mt-3';
      root.appendChild(el);
    }
    el.textContent = message;
    el.className = 'text-[12.5px] mt-3 ' + (tone === 'error' ? 'text-red-600' : 'text-emerald-600');
  }

  function nextUrlForRole(role) {
    if (window.ControlP && window.ControlP.rbac) return window.ControlP.rbac.nextUrlForRole(role);
    return FALLBACK_ADMIN_ROLES.indexOf(role) !== -1 ? '/admin' : '/dashboard/customer';
  }

  async function profileForUser(db, userId) {
    var result = await db.from('users').select('id, email, full_name, role, status, deleted_at').eq('id', userId).maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }

  function canAccessAdmin(profile) {
    if (window.ControlP && window.ControlP.rbac) return window.ControlP.rbac.canAccessAdminConsole(profile);
    return Boolean(profile && profile.status === 'active' && !profile.deleted_at && FALLBACK_ADMIN_ROLES.indexOf(profile.role) !== -1);
  }

  async function protectAdminPage() {
    if (!document.body.hasAttribute('data-admin-page')) return;
    var db = client();
    if (!db) return;

    var sessionResult = await db.auth.getSession();
    var session = sessionResult.data && sessionResult.data.session;
    if (!session) {
      window.location.href = '/login?redirect=/admin';
      return;
    }

    var profile = await profileForUser(db, session.user.id);
    if (!canAccessAdmin(profile)) {
      window.location.href = '/dashboard/customer';
      return;
    }

    document.dispatchEvent(new CustomEvent('controlp:admin-ready', { detail: { session: session, profile: profile } }));
  }

  async function handleLogin(root, event) {
    event.preventDefault();
    var db = client();
    if (!db) return setMessage(root, 'Supabase is not configured on this page yet.', 'error');

    var email = field(root, 'email', 0).value.trim();
    var password = field(root, 'password', 1).value;
    if (!email || !password) return setMessage(root, 'Enter your email and password.', 'error');

    var button = root.querySelector('[data-auth-submit]');
    if (button) button.disabled = true;
    var auth = await db.auth.signInWithPassword({ email: email, password: password });
    if (button) button.disabled = false;
    if (auth.error) return setMessage(root, auth.error.message, 'error');

    var profile = await profileForUser(db, auth.data.user.id);
    window.location.href = nextUrlForRole(profile && profile.role);
  }

  async function handleMagicLink(root, event) {
    event.preventDefault();
    var db = client();
    if (!db) return setMessage(root, 'Supabase is not configured on this page yet.', 'error');
    var email = field(root, 'email', 0).value.trim();
    if (!email) return setMessage(root, 'Enter your email first.', 'error');
    var redirectTo = window.location.origin + '/login';
    var auth = await db.auth.signInWithOtp({ email: email, options: { emailRedirectTo: redirectTo } });
    if (auth.error) return setMessage(root, auth.error.message, 'error');
    setMessage(root, 'Magic link sent. Check your inbox.', 'success');
  }

  async function handleRegister(root, event) {
    event.preventDefault();
    var db = client();
    if (!db) return setMessage(root, 'Supabase is not configured on this page yet.', 'error');

    var inputs = root.querySelectorAll('input');
    var firstName = (field(root, 'first_name', 0).value || '').trim();
    var lastName = (field(root, 'last_name', 1).value || '').trim();
    var email = field(root, 'email', 2).value.trim();
    var company = field(root, 'company', 3).value.trim();
    var password = field(root, 'password', 4).value;
    var terms = inputs[5];
    if (!firstName || !lastName || !email || !password) return setMessage(root, 'Fill out the required fields.', 'error');
    if (terms && !terms.checked) return setMessage(root, 'Please accept the terms before creating an account.', 'error');

    var button = root.querySelector('[data-auth-submit]');
    if (button) button.disabled = true;
    var auth = await db.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: (firstName + ' ' + lastName).trim(),
          company: company
        }
      }
    });
    if (button) button.disabled = false;
    if (auth.error) return setMessage(root, auth.error.message, 'error');

    if (auth.data && auth.data.user) {
      await db.from('users').update({ company: company }).eq('id', auth.data.user.id);
    }
    setMessage(root, 'Account created. Check your email if confirmation is enabled.', 'success');
  }

  async function handleLogout() {
    var db = client();
    if (db) await db.auth.signOut();
    window.location.href = '/login';
  }

  async function signOutQuietly() {
    var db = client();
    if (db) await db.auth.signOut();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var login = document.querySelector('[data-auth-form="login"]');
    if (login) login.addEventListener('submit', handleLogin.bind(null, login));

    var register = document.querySelector('[data-auth-form="register"]');
    if (register) register.addEventListener('submit', handleRegister.bind(null, register));

    document.querySelectorAll('[data-auth-magic-link]').forEach(function (button) {
      button.addEventListener('click', handleMagicLink.bind(null, login || document.body));
    });

    document.querySelectorAll('[data-auth-logout]').forEach(function (button) {
      button.addEventListener('click', handleLogout);
    });

    if (document.body.hasAttribute('data-logout-page')) {
      signOutQuietly();
    }

    protectAdminPage().catch(function () {
      window.location.href = '/login?redirect=/admin';
    });
  });
})();
