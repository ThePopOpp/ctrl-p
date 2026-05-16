(function () {
  'use strict';

  var currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  var dateFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Phoenix'
  });
  var dashboardData = null;

  function textIncludes(el, value) {
    return el && el.textContent && el.textContent.toLowerCase().indexOf(value.toLowerCase()) !== -1;
  }

  function panelByHeading(label) {
    return Array.prototype.find.call(document.querySelectorAll('.panel'), function (panel) {
      return Array.prototype.some.call(panel.querySelectorAll('h2, h3, .font-semibold'), function (el) {
        return textIncludes(el, label);
      });
    });
  }

  function metricPanel(label) {
    return Array.prototype.find.call(document.querySelectorAll('.panel'), function (panel) {
      var labelEl = panel.querySelector('.uppercase');
      return textIncludes(labelEl, label);
    });
  }

  function setMetric(label, value, subtext, badgeText) {
    var panel = metricPanel(label);
    if (!panel) return;
    var valueEl = panel.querySelector('.font-display.text-\\[26px\\]');
    var subEl = valueEl && valueEl.nextElementSibling;
    var badge = panel.querySelector('.badge');
    if (valueEl) valueEl.textContent = value;
    if (subEl) subEl.textContent = subtext || '';
    if (badge && badgeText) badge.textContent = badgeText;
  }

  function navItem(label) {
    return Array.prototype.find.call(document.querySelectorAll('.nav-item'), function (el) {
      return textIncludes(el, label);
    });
  }

  function setNavBadge(label, value, className) {
    var item = navItem(label);
    if (!item) return;
    var badge = item.querySelector('.badge');
    if (!badge) {
      item.insertAdjacentHTML('beforeend', '<span class="ml-auto badge"></span>');
      badge = item.querySelector('.badge');
    }
    badge.className = 'ml-auto badge ' + (className || 'bg-blue-500/20 text-blue-300');
    badge.textContent = String(value);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char];
    });
  }

  function initials(name) {
    return (name || 'CP').split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) {
      return part.charAt(0).toUpperCase();
    }).join('') || 'CP';
  }

  function human(value) {
    return String(value || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, function (c) {
      return c.toUpperCase();
    });
  }

  function statusBadge(status) {
    var map = {
      draft: 'bg-zinc-500/10 text-zinc-300',
      new: 'bg-zinc-500/10 text-zinc-300',
      quote_requested: 'bg-purple-500/10 text-purple-300',
      awaiting_payment: 'bg-red-500/10 text-red-400',
      unpaid: 'bg-red-500/10 text-red-400',
      pending: 'bg-amber-500/10 text-amber-400',
      paid: 'bg-emerald-500/10 text-emerald-400',
      file_review: 'bg-red-500/10 text-red-400',
      proofing: 'bg-red-500/10 text-red-400',
      proof_pending: 'bg-red-500/10 text-red-400',
      in_production: 'bg-amber-500/10 text-amber-400',
      printing: 'bg-amber-500/10 text-amber-400',
      finishing: 'bg-amber-500/10 text-amber-400',
      ready_for_pickup: 'bg-blue-500/10 text-blue-400',
      ready_to_ship: 'bg-blue-500/10 text-blue-400',
      shipped: 'bg-blue-500/10 text-blue-400',
      completed: 'bg-emerald-500/10 text-emerald-400',
      delivered: 'bg-emerald-500/10 text-emerald-400'
    };
    var cls = map[status] || 'bg-zinc-500/10 text-zinc-300';
    return '<span class="badge ' + cls + '"><span class="status-dot bg-current"></span>' + escapeHtml(human(status)) + '</span>';
  }

  function emptyBlock(message) {
    return '<div class="text-[12px] py-2" style="color: var(--text-dim);">' + escapeHtml(message) + '</div>';
  }

  function formatDate(value) {
    if (!value) return 'Not set';
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function updateDate() {
    var subtitle = document.querySelector('main h1 + div');
    if (subtitle) subtitle.textContent = dateFormatter.format(new Date()) + ' - Phoenix, AZ';
  }

  function productSummary(data) {
    var byProduct = {};
    data.orderItems.forEach(function (item) {
      var product = item.products || {};
      var id = product.id || product.name || 'unknown';
      if (!byProduct[id]) {
        byProduct[id] = {
          name: product.name || 'Unassigned product',
          category: product.category || 'uncategorized',
          quantity: 0,
          revenue: 0
        };
      }
      byProduct[id].quantity += Number(item.quantity || 0);
      byProduct[id].revenue += Number(item.line_total || 0);
    });

    var summaries = Object.keys(byProduct).map(function (id) { return byProduct[id]; });
    if (!summaries.length) {
      summaries = data.products.map(function (product) {
        return {
          name: product.name,
          category: product.category || product.status || 'catalog',
          quantity: 0,
          revenue: 0
        };
      });
    }

    return summaries.sort(function (a, b) {
      return b.revenue - a.revenue || b.quantity - a.quantity;
    });
  }

  function render(data) {
    dashboardData = data;
    var orders = data.orders || [];
    var payments = data.payments || [];
    var messages = data.messages || [];
    var artwork = data.artworkFiles || [];
    var reviews = data.reviews || [];
    var production = data.productionJobs || [];
    var users = data.users || [];

    var revenue = payments.reduce(function (sum, payment) {
      return sum + (payment.status === 'paid' ? Number(payment.amount || 0) : 0);
    }, 0);
    var pendingPayments = orders.filter(function (order) {
      return ['unpaid', 'pending', 'partially_paid'].indexOf(order.payment_status) !== -1;
    });
    var activeProduction = production.filter(function (job) {
      return ['completed', 'ready'].indexOf(job.status) === -1;
    });
    var approvals = artwork.filter(function (file) {
      return ['waiting_for_file_review', 'needs_changes', 'proof_sent'].indexOf(file.review_status) !== -1;
    });
    var pendingReviews = reviews.filter(function (review) { return review.status === 'pending'; });

    setMetric('Revenue', currency.format(revenue), payments.length + ' payment records this week', revenue ? 'Live' : 'No payments');
    setMetric('Orders', String(orders.length), pendingPayments.length + ' pending payment', orders.length ? 'Live' : '0 new');
    setMetric('In production', String(activeProduction.length), production.length + ' production jobs tracked', activeProduction.length + ' jobs');
    setMetric('Approvals needed', String(approvals.length), artwork.length + ' artwork files tracked', approvals.length ? 'Urgent' : 'Clear');

    setNavBadge('Orders', orders.length, 'bg-blue-500/20 text-blue-300');
    setNavBadge('Production', activeProduction.length, 'bg-amber-500/20 text-amber-300');
    setNavBadge('Messages', messages.length, messages.length ? 'bg-red-500/20 text-red-300' : 'bg-zinc-500/20 text-zinc-300');
    setNavBadge('Reviews', pendingReviews.length, pendingReviews.length ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-500/20 text-zinc-300');

    renderOrders(orders);
    renderPipeline(orders);
    renderProducts(productSummary(data));
    renderProduction(production);
    renderCustomers(users);
    renderAlerts({ approvals: approvals, messages: messages, reviews: pendingReviews, pendingPayments: pendingPayments, errors: data.errors || [] });
  }

  function renderOrders(orders) {
    var table = document.querySelector('table tbody');
    if (!table) return;
    if (!orders.length) {
      table.innerHTML = '<tr><td colspan="7" class="text-center" style="color: var(--text-dim);">No live orders yet.</td></tr>';
      return;
    }

    table.innerHTML = orders.slice(0, 10).map(function (order) {
      var customer = (order.users && order.users.full_name) || order.company || order.customer_email || 'Guest customer';
      var product = order.company || order.customer_email || 'Order details pending';
      return '<tr>' +
        '<td class="font-mono text-[11.5px]">#' + escapeHtml(order.order_number || order.id.slice(0, 8)) + '</td>' +
        '<td><div class="flex items-center gap-2"><div class="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[9px] font-semibold text-white">' + escapeHtml(initials(customer)) + '</div><span>' + escapeHtml(customer) + '</span></div></td>' +
        '<td><span style="color: var(--text-dim);">' + escapeHtml(product) + '</span></td>' +
        '<td>' + statusBadge(order.status) + '</td>' +
        '<td><span style="color: var(--text-dim);">' + escapeHtml(human(order.production_status || 'new')) + '</span></td>' +
        '<td class="text-right font-semibold">' + currency.format(Number(order.total || 0)) + '</td>' +
        '<td class="text-right"><button class="btn btn-ghost btn-sm" type="button" data-order-open="' + escapeHtml(order.id) + '" aria-label="Open order">-&gt;</button></td>' +
      '</tr>';
    }).join('');
  }

  function setDrawerText(name, value) {
    var el = document.querySelector('[data-order-drawer-' + name + ']');
    if (el) el.textContent = value;
  }

  function setDrawerHtml(name, value) {
    var el = document.querySelector('[data-order-drawer-' + name + ']');
    if (el) el.innerHTML = value;
  }

  function rowsForOrder(key) {
    return function (row) { return row.order_id === key; };
  }

  function openOrderDrawer(orderId) {
    if (!dashboardData) return;
    var order = (dashboardData.orders || []).find(function (item) { return item.id === orderId; });
    var drawer = document.getElementById('admin-order-drawer');
    if (!order || !drawer) return;

    var customer = (order.users && order.users.full_name) || order.company || order.customer_email || 'Guest customer';
    var items = (dashboardData.orderItems || []).filter(rowsForOrder(order.id));
    var jobs = (dashboardData.productionJobs || []).filter(rowsForOrder(order.id));
    var payments = (dashboardData.payments || []).filter(rowsForOrder(order.id));
    var messages = (dashboardData.messages || []).filter(rowsForOrder(order.id));

    setDrawerText('number', '#' + (order.order_number || order.id.slice(0, 8)));
    setDrawerText('customer', customer + (order.customer_email ? ' - ' + order.customer_email : ''));
    setDrawerHtml('status', statusBadge(order.status));
    setDrawerHtml('payment', statusBadge(order.payment_status));
    setDrawerText('production', human(order.production_status || 'new'));
    setDrawerText('total', currency.format(Number(order.total || 0)));
    setDrawerText('item-count', items.length + ' items');
    setDrawerText('job-count', jobs.length + ' jobs');

    setDrawerHtml('items', items.length ? items.map(function (item) {
      var product = item.products || {};
      return '<div class="panel-2 rounded-md p-3 flex items-center justify-between gap-3">' +
        '<div class="min-w-0"><div class="text-[12.5px] font-semibold truncate">' + escapeHtml(product.name || 'Unassigned product') + '</div>' +
        '<div class="text-[10.5px]" style="color: var(--text-dim);">' + escapeHtml(human(product.category || 'catalog')) + ' - Qty ' + Number(item.quantity || 0) + (item.proof_required ? ' - Proof required' : '') + '</div></div>' +
        '<div class="text-[12px] font-semibold">' + currency.format(Number(item.line_total || 0)) + '</div></div>';
    }).join('') : emptyBlock('No line items found for this order.'));

    setDrawerHtml('jobs', jobs.length ? jobs.map(function (job) {
      return '<div class="panel-2 rounded-md p-3">' +
        '<div class="flex items-center justify-between gap-3"><div class="text-[12.5px] font-semibold">' + escapeHtml(human(job.status)) + '</div>' + statusBadge(job.status) + '</div>' +
        '<div class="text-[10.5px] mt-1" style="color: var(--text-dim);">' + escapeHtml(job.station || 'No station assigned') + ' - Due ' + escapeHtml(formatDate(job.due_at)) + '</div></div>';
    }).join('') : emptyBlock('No production jobs found for this order.'));

    setDrawerHtml('activity', renderOrderActivity(payments, messages));
    setDrawerHtml('notes', escapeHtml(order.internal_notes || order.customer_notes || 'No notes yet.'));

    drawer.classList.remove('hidden');
    drawer.setAttribute('aria-hidden', 'false');
  }

  function renderOrderActivity(payments, messages) {
    var rows = [];
    payments.forEach(function (payment) {
      rows.push({
        date: payment.received_at || payment.created_at,
        html: '<div class="text-[12.5px] font-semibold">Payment ' + escapeHtml(human(payment.status)) + '</div>' +
          '<div class="text-[10.5px]" style="color: var(--text-dim);">' + currency.format(Number(payment.amount || 0)) + ' - ' + escapeHtml(payment.provider || 'manual') + '</div>'
      });
    });
    messages.forEach(function (message) {
      rows.push({
        date: message.created_at,
        html: '<div class="text-[12.5px] font-semibold">' + escapeHtml(message.subject || 'Unread message') + '</div>' +
          '<div class="text-[10.5px]" style="color: var(--text-dim);">' + escapeHtml(human(message.channel)) + ' - ' + escapeHtml(human(message.direction)) + '</div>'
      });
    });
    rows.sort(function (a, b) { return new Date(b.date || 0) - new Date(a.date || 0); });
    if (!rows.length) return emptyBlock('No payments or unread messages for this order.');
    return rows.map(function (row) {
      return '<div class="panel-2 rounded-md p-3">' + row.html + '</div>';
    }).join('');
  }

  function closeOrderDrawer() {
    var drawer = document.getElementById('admin-order-drawer');
    if (!drawer) return;
    drawer.classList.add('hidden');
    drawer.setAttribute('aria-hidden', 'true');
  }

  function renderPipeline(orders) {
    var panel = panelByHeading('Order pipeline');
    if (!panel) return;
    var list = panel.querySelector('.space-y-3');
    if (!list) return;
    var statuses = ['quote_requested', 'awaiting_payment', 'file_review', 'proofing', 'in_production', 'ready_to_ship', 'completed'];
    var max = Math.max(1, orders.length);
    list.innerHTML = statuses.map(function (status) {
      var count = orders.filter(function (order) { return order.status === status || order.production_status === status; }).length;
      var width = Math.max(4, Math.round((count / max) * 100));
      return '<div class="bar-row"><span class="w-28">' + escapeHtml(human(status)) + '</span>' +
        '<div class="bar-track"><div class="bar-fill bg-blue-500" style="width: ' + width + '%"></div></div>' +
        '<span class="w-8 text-right font-semibold">' + count + '</span></div>';
    }).join('');
  }

  function renderProducts(products) {
    var panel = panelByHeading('Top products');
    if (!panel) return;
    var list = panel.querySelector('.space-y-3');
    if (!list) return;
    if (!products.length) {
      list.innerHTML = emptyBlock('No product or order item data yet.');
      return;
    }
    list.innerHTML = products.slice(0, 5).map(function (product, index) {
      return '<div class="flex items-center gap-3">' +
        '<div class="w-7 h-7 rounded bg-zinc-800 flex items-center justify-center text-[10px] font-bold">' + (index + 1) + '</div>' +
        '<div class="flex-1 min-w-0"><div class="text-[12px] font-semibold truncate">' + escapeHtml(product.name) + '</div>' +
        '<div class="text-[10.5px]" style="color: var(--text-dim);">' + product.quantity + ' ordered - ' + currency.format(product.revenue) + ' - ' + escapeHtml(human(product.category)) + '</div></div>' +
      '</div>';
    }).join('');
  }

  function renderProduction(jobs) {
    var panel = panelByHeading('Production queue');
    if (!panel) return;
    var sub = panel.querySelector('h2 + div');
    if (sub) sub.textContent = 'Live queue - ' + jobs.length + ' jobs';
    var list = panel.querySelector('.space-y-3');
    if (!list) return;
    if (!jobs.length) {
      list.innerHTML = emptyBlock('No production jobs are queued.');
      return;
    }
    list.innerHTML = jobs.slice(0, 4).map(function (job, index) {
      var orderNo = job.orders && job.orders.order_number ? '#' + job.orders.order_number : 'Production job';
      var item = job.order_items && job.order_items.products ? job.order_items.products.name : human(job.status);
      return '<div class="flex items-center gap-2.5">' +
        '<div class="w-8 h-8 rounded-md bg-amber-500/10 flex items-center justify-center text-[11px] font-bold text-amber-400 flex-shrink-0">' + (index + 1) + '</div>' +
        '<div class="flex-1 min-w-0"><div class="text-[12px] font-semibold truncate">' + escapeHtml(orderNo) + ' - ' + escapeHtml(item) + '</div>' +
        '<div class="text-[10.5px]" style="color: var(--text-dim);">' + escapeHtml(human(job.status)) + (job.station ? ' - ' + escapeHtml(job.station) : '') + '</div></div></div>';
    }).join('');
  }

  function renderCustomers(users) {
    var panel = panelByHeading('New customers');
    if (!panel) return;
    var total = panel.querySelector('.font-display.text-\\[24px\\]');
    var list = panel.querySelector('.space-y-2\\.5');
    if (total) total.textContent = String(users.length);
    if (!list) return;
    if (!users.length) {
      list.innerHTML = emptyBlock('No customers found.');
      return;
    }
    list.innerHTML = users.slice(0, 4).map(function (user) {
      var name = user.full_name || user.email || 'New customer';
      return '<div class="flex items-center gap-2.5"><div class="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-[10.5px] font-semibold text-white">' + escapeHtml(initials(name)) + '</div>' +
        '<div class="flex-1 min-w-0"><div class="text-[12px] font-semibold truncate">' + escapeHtml(name) + '</div>' +
        '<div class="text-[10.5px]" style="color: var(--text-dim);">' + escapeHtml(human(user.role)) + ' - ' + escapeHtml(user.company || 'No company') + '</div></div>' +
        '<span class="badge bg-blue-500/10 text-blue-400">' + escapeHtml(human(user.status)) + '</span></div>';
    }).join('');
  }

  function renderAlerts(summary) {
    var panel = panelByHeading('Operational alerts');
    if (!panel) return;
    var badge = panel.querySelector('.badge');
    var list = panel.querySelector('.space-y-3');
    if (!list) return;

    var alerts = [];
    if (summary.approvals.length) alerts.push(['bg-red-500/10 text-red-400', 'File reviews waiting', summary.approvals.length + ' artwork files need attention']);
    if (summary.messages.length) alerts.push(['bg-blue-500/10 text-blue-400', 'Unread messages', summary.messages.length + ' customer or internal messages']);
    if (summary.reviews.length) alerts.push(['bg-emerald-500/10 text-emerald-400', 'Reviews pending', summary.reviews.length + ' reviews need moderation']);
    if (summary.pendingPayments.length) alerts.push(['bg-amber-500/10 text-amber-400', 'Payments pending', summary.pendingPayments.length + ' orders are not fully paid']);
    summary.errors.forEach(function (error) {
      alerts.push(['bg-red-500/10 text-red-400', 'Live query failed', error.name + ': ' + error.message]);
    });

    if (badge) badge.textContent = alerts.length + ' active';
    if (!alerts.length) {
      list.innerHTML = emptyBlock('No live operational alerts.');
      return;
    }

    list.innerHTML = alerts.slice(0, 4).map(function (alert) {
      return '<div class="flex items-start gap-2.5">' +
        '<div class="w-7 h-7 rounded-md ' + alert[0] + ' flex items-center justify-center flex-shrink-0">!</div>' +
        '<div class="min-w-0"><div class="text-[12px] font-semibold">' + escapeHtml(alert[1]) + '</div>' +
        '<div class="text-[11px]" style="color: var(--text-dim);">' + escapeHtml(alert[2]) + '</div></div></div>';
    }).join('');
  }

  async function loadData() {
    if (!window.ControlP || !window.ControlP.adminApi) return;
    updateDate();
    var data = await window.ControlP.adminApi.loadDashboardData();
    render(data);
  }

  document.addEventListener('controlp:admin-ready', loadData);
  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.hasAttribute('data-admin-page')) return;
    setTimeout(loadData, 300);
  });

  document.addEventListener('click', function (event) {
    var openButton = event.target.closest('[data-order-open]');
    if (openButton) {
      openOrderDrawer(openButton.getAttribute('data-order-open'));
      return;
    }

    if (event.target.closest('[data-order-drawer-close]')) {
      closeOrderDrawer();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeOrderDrawer();
  });
})();
