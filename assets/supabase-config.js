(function () {
  'use strict';

  window.ControlPConfig = window.ControlPConfig || {};
  window.ControlPConfig.supabase = {
    url: 'https://kwyzxqlbwraiqftfjgjj.supabase.co',
    publishableKey: 'sb_publishable_gD-BnrmZC7-42PlyP3UJiw_00znWlAC'
  };

  window.ControlP = window.ControlP || {};

  window.ControlP.getSupabase = function () {
    var cfg = window.ControlPConfig && window.ControlPConfig.supabase;
    if (!window.supabase || !cfg || !cfg.url || !cfg.publishableKey) return null;
    if (!window.ControlP.supabaseClient) {
      window.ControlP.supabaseClient = window.supabase.createClient(cfg.url, cfg.publishableKey);
    }
    return window.ControlP.supabaseClient;
  };
})();
