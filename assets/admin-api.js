(function () {
  'use strict';

  window.ControlP = window.ControlP || {};

  function getClient() {
    return window.ControlP && window.ControlP.getSupabase ? window.ControlP.getSupabase() : null;
  }

  function sevenDaysAgo() {
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  async function safeQuery(name, query) {
    try {
      var result = await query;
      if (result.error) throw result.error;
      return { name: name, data: result.data || [], error: null };
    } catch (error) {
      console.warn('controlp admin query failed:', name, error.message);
      return { name: name, data: [], error: error };
    }
  }

  function requireClient() {
    var db = getClient();
    if (!db) throw new Error('Supabase client is not configured.');
    return db;
  }

  async function currentUserId(db) {
    var sessionResult = await db.auth.getSession();
    var session = sessionResult.data && sessionResult.data.session;
    return session && session.user ? session.user.id : null;
  }

  async function logActivity(db, action, entityType, entityId, details) {
    var actorId = await currentUserId(db);
    var result = await db.from('activity_logs').insert({
      actor_id: actorId,
      action: action,
      entity_type: entityType,
      entity_id: entityId,
      details: details || {}
    });
    if (result.error) throw result.error;
  }

  async function loadDashboardData() {
    var db = getClient();
    if (!db) {
      return {
        orders: [],
        orderItems: [],
        products: [],
        users: [],
        artworkFiles: [],
        payments: [],
        messages: [],
        reviews: [],
        productionJobs: [],
        activityLogs: [],
        errors: [{ name: 'supabase', message: 'Supabase client is not configured.' }]
      };
    }

    var weekAgo = sevenDaysAgo();
    var queries = [
      safeQuery('orders', db
        .from('orders')
        .select('id, order_number, status, production_status, payment_status, total, subtotal, tax, shipping_cost, company, customer_email, customer_phone, customer_notes, internal_notes, created_at, due_at, users!orders_user_id_fkey(full_name, company)')
        .order('created_at', { ascending: false })
        .limit(50)),
      safeQuery('orderItems', db
        .from('order_items')
        .select('id, order_id, quantity, unit_price, line_total, proof_required, created_at, products!order_items_product_id_fkey(id, name, category)')
        .order('created_at', { ascending: false })
        .limit(200)),
      safeQuery('products', db
        .from('products')
        .select('id, name, category, featured, status, active, created_at')
        .order('created_at', { ascending: false })
        .limit(100)),
      safeQuery('users', db
        .from('users')
        .select('id, full_name, email, company, role, status, created_at')
        .order('created_at', { ascending: false })
        .limit(50)),
      safeQuery('artworkFiles', db
        .from('artwork_files')
        .select('id, filename, review_status, created_at, order_id')
        .order('created_at', { ascending: false })
        .limit(100)),
      safeQuery('payments', db
        .from('payments')
        .select('id, order_id, amount, status, provider, method, created_at, received_at')
        .gte('created_at', weekAgo)
        .order('created_at', { ascending: false })
        .limit(100)),
      safeQuery('messages', db
        .from('messages')
        .select('id, order_id, subject, channel, direction, read_at, created_at')
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(100)),
      safeQuery('reviews', db
        .from('reviews')
        .select('id, customer_name, rating, status, featured, created_at')
        .order('created_at', { ascending: false })
        .limit(50)),
      safeQuery('productionJobs', db
        .from('production_jobs')
        .select('id, order_id, status, priority, station, due_at, orders!production_jobs_order_id_fkey(order_number), order_items!production_jobs_order_item_id_fkey(quantity, products!order_items_product_id_fkey(name))')
        .order('priority', { ascending: true })
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(12)),
      safeQuery('activityLogs', db
        .from('activity_logs')
        .select('id, action, entity_type, created_at, details')
        .order('created_at', { ascending: false })
        .limit(10))
    ];

    var results = await Promise.all(queries);
    var data = results.reduce(function (memo, result) {
      memo[result.name] = result.data;
      if (result.error) memo.errors.push({ name: result.name, message: result.error.message });
      return memo;
    }, { errors: [] });

    return data;
  }

  async function updateProductionJobStatus(jobId, status, orderId) {
    var db = requireClient();
    var result = await db
      .from('production_jobs')
      .update({ status: status })
      .eq('id', jobId)
      .select('id, order_id, status')
      .single();
    if (result.error) throw result.error;

    if (orderId) {
      var orderResult = await db
        .from('orders')
        .update({ production_status: status })
        .eq('id', orderId);
      if (orderResult.error) throw orderResult.error;
    }

    await logActivity(db, 'production_status_updated', 'production_job', jobId, {
      order_id: orderId || result.data.order_id,
      status: status
    });

    return result.data;
  }

  async function markMessageRead(messageId, orderId) {
    var db = requireClient();
    var result = await db
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId)
      .select('id, order_id, read_at')
      .single();
    if (result.error) throw result.error;

    await logActivity(db, 'message_marked_read', 'message', messageId, {
      order_id: orderId || result.data.order_id
    });

    return result.data;
  }

  window.ControlP.adminApi = {
    loadDashboardData: loadDashboardData,
    updateProductionJobStatus: updateProductionJobStatus,
    markMessageRead: markMessageRead
  };
})();
