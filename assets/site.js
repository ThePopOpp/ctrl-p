(function () {
  'use strict';

  var THEME_KEY = 'cp-theme';

  function applyStoredTheme() {
    try {
      var t = localStorage.getItem(THEME_KEY);
      if (t === 'dark') document.documentElement.classList.add('dark');
      else if (t === 'light') document.documentElement.classList.remove('dark');
      else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  }

  function toggleTheme() {
    var dark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    } catch (e) {}
    syncThemeToggleLabels();
  }

  function syncThemeToggleLabels() {
    var dark = document.documentElement.classList.contains('dark');
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }

  function closeMobileNav() {
    var root = document.getElementById('cp-mobile-nav');
    if (!root) return;
    root.classList.remove('cp-mobile-nav--open', 'cp-mobile-nav--sub');
    root.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('cp-mobile-nav-open');
  }

  function openMobileNav() {
    var root = document.getElementById('cp-mobile-nav');
    if (!root) return;
    root.classList.add('cp-mobile-nav--open');
    root.classList.remove('cp-mobile-nav--sub');
    document.documentElement.classList.add('cp-mobile-nav-open');
  }

  function openMobileSub() {
    var root = document.getElementById('cp-mobile-nav');
    if (!root) return;
    root.classList.add('cp-mobile-nav--sub');
  }

  function backMobileSub() {
    var root = document.getElementById('cp-mobile-nav');
    if (!root) return;
    root.classList.remove('cp-mobile-nav--sub');
  }

  function mountMobileNav() {
    if (document.getElementById('cp-mobile-nav')) return;

    var wrap = document.createElement('div');
    wrap.id = 'cp-mobile-nav';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML =
      '<div id="cp-mobile-nav-backdrop" data-mobile-nav-close></div>' +
      '<div id="cp-mobile-nav-panel" role="dialog" aria-modal="true" aria-label="Site menu">' +
      '  <div class="flex items-center justify-between gap-3 px-5 pt-4 pb-2 border-b shrink-0" style="border-color:hsl(var(--border))">' +
      '    <a href="home.html" class="flex items-center gap-2 min-w-0">' +
      '      <div class="w-8 h-8 rounded-md flex items-center justify-center bg-zinc-900 text-white font-bold text-[13px] font-display shrink-0">cp</div>' +
      '      <span class="font-bold text-[16px] font-display tracking-tight truncate">controlp<span class="text-zinc-400">.io</span></span>' +
      '    </a>' +
      '    <div class="flex items-center gap-2 shrink-0">' +
      '      <button type="button" class="cp-theme-btn" data-theme-toggle aria-label="Toggle color mode">' +
      '        <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>' +
      '        <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>' +
      '      </button>' +
      '      <button type="button" class="cp-theme-btn" data-mobile-nav-close aria-label="Close menu">' +
      '        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
      '      </button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="cp-mobile-track">' +
      '    <div class="cp-mobile-pane cp-mobile-pane--root">' +
      '      <div class="cp-mobile-scroll">' +
      '        <button type="button" class="cp-mobile-row" data-mobile-go-shop>' +
      '          <span>Shop</span><svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>' +
      '        </button>' +
      '        <a href="shop.html" class="cp-mobile-row"><span>All products</span></a>' +
      '        <a href="product.html" class="cp-mobile-row"><span>Featured product</span></a>' +
      '        <a href="templates.html" class="cp-mobile-row"><span>Templates</span></a>' +
      '        <a href="blog.html" class="cp-mobile-row"><span>Blog</span></a>' +
      '        <a href="resources.html" class="cp-mobile-row"><span>Resources</span></a>' +
      '        <a href="faq.html" class="cp-mobile-row"><span>FAQ</span></a>' +
      '        <a href="about.html" class="cp-mobile-row"><span>About</span></a>' +
      '        <a href="contact.html" class="cp-mobile-row"><span>Contact</span></a>' +
      '        <div class="pt-4 mt-2 border-t text-[11px] uppercase tracking-wider font-semibold opacity-50 px-0" style="border-color:hsl(var(--border))">Account</div>' +
      '        <a href="login.html" class="cp-mobile-row"><span>Sign in</span></a>' +
      '        <a href="register.html" class="cp-mobile-row"><span>Create account</span></a>' +
      '        <a href="dashboard.html" class="cp-mobile-row"><span>Dashboard</span></a>' +
      '        <a href="cart.html" class="cp-mobile-row"><span>Cart</span></a>' +
      '        <a href="checkout.html" class="cp-mobile-row"><span>Checkout</span></a>' +
      '      </div>' +
      '    </div>' +
      '    <div class="cp-mobile-pane cp-mobile-pane--sub">' +
      '      <div class="cp-mobile-scroll">' +
      '        <button type="button" class="cp-mobile-back" data-mobile-sub-back><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg> Back</button>' +
      '        <div class="text-[11px] uppercase tracking-wider font-semibold opacity-50 mb-2">Shop categories</div>' +
      '        <a href="shop.html" class="cp-mobile-row"><span>Large format &amp; banners</span></a>' +
      '        <a href="shop.html" class="cp-mobile-row"><span>Signs</span></a>' +
      '        <a href="shop.html" class="cp-mobile-row"><span>Vehicle wraps</span></a>' +
      '        <a href="shop.html" class="cp-mobile-row"><span>Business cards</span></a>' +
      '        <a href="shop.html" class="cp-mobile-row"><span>Flags &amp; displays</span></a>' +
      '        <a href="shop.html" class="cp-mobile-row"><span>Apparel &amp; merch</span></a>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    document.body.appendChild(wrap);

    wrap.querySelectorAll('[data-mobile-nav-close]').forEach(function (el) {
      el.addEventListener('click', closeMobileNav);
    });
    wrap.querySelector('[data-mobile-go-shop]').addEventListener('click', openMobileSub);
    wrap.querySelector('[data-mobile-sub-back]').addEventListener('click', backMobileSub);

    wrap.querySelectorAll('a.cp-mobile-row').forEach(function (a) {
      a.addEventListener('click', closeMobileNav);
    });

    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMobileNav();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyStoredTheme();
    syncThemeToggleLabels();
    mountMobileNav();

    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        toggleTheme();
      });
    });

    document.querySelectorAll('[data-mobile-nav-open]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openMobileNav();
        var nav = document.getElementById('cp-mobile-nav');
        if (nav) nav.setAttribute('aria-hidden', 'false');
      });
    });

    syncThemeToggleLabels();
  });
})();
