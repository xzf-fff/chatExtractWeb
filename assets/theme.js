/* 主题：默认浅色，记忆用户选择；按钮需带 data-theme-toggle */
(function () {
  'use strict';
  var KEY = 'chatExtract.theme';
  function current() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch (e) { /* ignore */ }
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      b.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      b.setAttribute('title', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    });
  }
  apply(current());
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest && ev.target.closest('[data-theme-toggle]');
    if (!btn) return;
    apply(current() === 'dark' ? 'light' : 'dark');
  });
  document.addEventListener('ds:langchange', function () {
    // 语言切换后同步按钮提示
    var theme = current();
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      b.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      b.setAttribute('title', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    });
  });
})();
