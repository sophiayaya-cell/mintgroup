// shared auth for /sales/* dashboard pages
// - Login gate: if the session cookie is missing/invalid (API returns 401),
//   redirect to GitHub OAuth (same App as Decap CMS), then back to this page.
// - Shows a small "已登录 · GitHub · 退出" pill and wires the logout button.
// - API calls rely on the HttpOnly sales_session cookie (sent automatically on
//   same-origin /api/sales/* requests); no API key lives in the browser anymore.
(function () {
  var SALES_AUTH = '/api/sales/auth';
  var SALES_LOGOUT = '/api/sales/logout';

  function opts(extra) {
    return Object.assign({ credentials: 'same-origin' }, extra || {});
  }

  function doLogout() {
    fetch(SALES_LOGOUT, opts({ method: 'POST' }))
      .then(function () { window.location.href = '/sales/'; })
      .catch(function () { window.location.href = '/sales/'; });
  }

  function showBar(login) {
    if (document.getElementById('saAuthBar')) return;
    var bar = document.createElement('div');
    bar.id = 'saAuthBar';
    bar.style.cssText = 'position:fixed;top:0;right:0;z-index:9999;background:#0f7a4d;color:#fff;' +
      'font:13px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:7px 12px;' +
      'border-bottom-left-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.18)';
    var who = login ? (' · ' + login) : '';
    bar.innerHTML = '<span>已登录 GitHub' + who + '</span> ' +
      '<a href="#" id="saLogout" style="color:#fff;text-decoration:underline;margin-left:8px">退出</a>';
    document.body.appendChild(bar);
    bar.querySelector('#saLogout').addEventListener('click', function (e) {
      e.preventDefault(); doLogout();
    });
  }

  // 自动门禁：未登录(401) → 跳 GitHub；已登录 → 显示状态条
  fetch('/api/sales/accounts?limit=1', opts())
    .then(function (r) {
      if (r.status === 401) {
        var here = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = SALES_AUTH + '?redirect=' + here;
      } else if (r.ok) {
        r.json().then(function (j) {
          var who = (j && j.session && j.session.gh) ? j.session.gh : '';
          showBar(who);
        }).catch(function () { showBar(''); });
      }
    })
    .catch(function () { /* 网络/接口异常不阻断页面，仅不显示状态条 */ });

  window.SalesAuth = {
    logout: doLogout,
    apiFetch: function (path, o) { return fetch('/api/sales' + path, opts(o)); }
  };
})();
