/* ============================================================
 * ChatExtract 多语言运行时
 * - 站点页：由 html[lang] + [data-lang] 控制显隐（内容静态可抓取）
 * - 工具页：读取 window.TOOL_I18N，按「原文 → 译文」替换 DOM
 *   并提供 t() 供动态文案（toast / 校验结果）使用
 * ============================================================ */
(function () {
  'use strict';

  var KEY = 'chatExtract.lang';
  var params = new URLSearchParams(location.search);
  var stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) { /* 隐私模式 */ }
  var FORCED = typeof window.__FORCE_LANG__ === 'string' ? window.__FORCE_LANG__ : '';
  var inEnDir = location.pathname.indexOf('/en/') === 0;
  // 只有静态页（index/guide，带 data-i18n-nav）才用独立 URL 切语言；
  // 工具页若跳转会丢失已载入的数据，保持原地切换。
  var canNavigate = (location.protocol === 'http:' || location.protocol === 'https:')
    && document.documentElement.hasAttribute('data-i18n-nav');
  var lang = FORCED || params.get('lang') || stored || (inEnDir ? 'en' : 'zh');
  if (lang !== 'en' && lang !== 'zh') lang = 'zh';

  var dict = null;
  var applying = false;
  var observer = null;
  var touchedText = new Set();
  var touchedAttrs = new Set();
  var touchedBlocks = new Set();
  var CJK = /[\u4e00-\u9fff]/;

  function getDict() {
    if (dict) return dict;
    var src = window.TOOL_I18N && window.TOOL_I18N.en;
    dict = src || { exact: {}, rules: [], blocks: {} };
    dict.exact = dict.exact || {};
    dict.rules = dict.rules || [];
    dict.blocks = dict.blocks || {};
    return dict;
  }

  /* ---------- 文案翻译（动态字符串用） ---------- */
  function t(text) {
    if (lang !== 'en' || typeof text !== 'string' || !text) return text;
    if (!CJK.test(text)) return text;
    var d = getDict();
    if (Object.prototype.hasOwnProperty.call(d.exact, text)) return d.exact[text];
    for (var i = 0; i < d.rules.length; i++) {
      var rule = d.rules[i];
      if (rule[0].test(text)) return text.replace(rule[0], rule[1]);
    }
    return text;
  }

  /* ---------- DOM 文本替换 ---------- */
  function skipParent(el) {
    while (el && el !== document.body) {
      var tag = el.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'PRE' || tag === 'CODE') return true;
      if (el.hasAttribute && el.hasAttribute('data-i18n-skip')) return true;
      el = el.parentNode;
    }
    return false;
  }

  function translateTextNode(node) {
    var raw = node.nodeValue;
    if (!raw || !CJK.test(raw)) return;
    // 始终记录最近一次的中文原文，切回中文时可还原动态更新过的文案
    node.__zh = raw;
    var lead = (raw.match(/^\s*/) || [''])[0];
    var tail = (raw.match(/\s*$/) || [''])[0];
    var core = raw.slice(lead.length, raw.length - tail.length);
    if (!core) return;
    var out = t(core);
    if (out !== core) {
      node.nodeValue = lead + out + tail;
      touchedText.add(node);
    }
  }

  function translateBlock(el) {
    var key = el.getAttribute('data-i18n-block');
    if (!key) return;
    var d = getDict();
    var html = d.blocks[key];
    if (html == null) return;
    if (el.__zhHtml == null) el.__zhHtml = el.innerHTML;
    if (el.innerHTML !== html) {
      el.innerHTML = html;
      touchedBlocks.add(el);
    }
  }

  function translateAttrs(el) {
    ['placeholder', 'title', 'aria-label'].forEach(function (attr) {
      var v = el.getAttribute && el.getAttribute(attr);
      if (!v || !CJK.test(v)) return;
      if (el.__zhAttrs == null) el.__zhAttrs = {};
      el.__zhAttrs[attr] = v;
      var out = t(v);
      if (out !== v) { el.setAttribute(attr, out); touchedAttrs.add(el); }
    });
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { translateTextNode(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;

    if (root.nodeType === 1 && root.hasAttribute && root.hasAttribute('data-i18n-block')) translateBlock(root);
    if (root.nodeType === 1) translateAttrs(root);

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: function (n) {
        if (n.nodeType === 3) return skipParent(n.parentNode) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        if (n.nodeType === 1) {
          if (n.hasAttribute('data-i18n-block')) translateBlock(n);
          if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
          translateAttrs(n);
          return NodeFilter.FILTER_SKIP;
        }
        return NodeFilter.FILTER_REJECT;
      },
    });
    var n;
    while ((n = walker.nextNode())) translateTextNode(n);
  }

  /* ---------- 切回中文 ---------- */
  function restore() {
    touchedText.forEach(function (node) {
      if (node.__zh != null) node.nodeValue = node.__zh;
    });
    touchedAttrs.forEach(function (el) {
      if (!el.__zhAttrs) return;
      Object.keys(el.__zhAttrs).forEach(function (attr) {
        if (el.isConnected) el.setAttribute(attr, el.__zhAttrs[attr]);
      });
    });
    touchedBlocks.forEach(function (el) {
      if (el.__zhHtml != null) el.innerHTML = el.__zhHtml;
    });
    touchedText.clear();
    touchedAttrs.clear();
    touchedBlocks.clear();
  }

  /* ---------- 标题与 meta ---------- */
  function applyMeta() {
    var meta = window.PAGE_META;
    if (!meta) return;
    var pack = meta[lang] || meta.zh;
    if (!pack) return;
    if (pack.title) document.title = pack.title;
    var sel = {
      'meta[name="description"]': pack.description,
      'meta[property="og:title"]': pack.title,
      'meta[property="og:description"]': pack.description,
      'meta[name="twitter:title"]': pack.title,
      'meta[name="twitter:description"]': pack.description,
    };
    Object.keys(sel).forEach(function (q) {
      if (!sel[q]) return;
      var el = document.querySelector(q);
      if (el) el.setAttribute('content', sel[q]);
    });
    var locale = document.querySelector('meta[property="og:locale"]');
    if (locale) locale.setAttribute('content', lang === 'en' ? 'en_US' : 'zh_CN');
  }

  /* ---------- 语言切换 ---------- */
  function syncButtons() {
    document.querySelectorAll('[data-lang-btn]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang-btn') === lang));
    });
    document.querySelectorAll('[data-lang-link]').forEach(function (a) {
      var target = a.getAttribute('data-lang-link');
      var base = a.getAttribute('href') || '';
      var url = base.split('#')[0];
      a.setAttribute('href', target === 'en' ? url + (url.indexOf('?') < 0 ? '?' : '&') + 'lang=en' : url);
    });
  }

  function writeUrl() {
    try {
      var url = new URL(location.href);
      if (lang === 'en') url.searchParams.set('lang', 'en');
      else url.searchParams.delete('lang');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (e) { /* file:// 下可能受限 */ }
  }

  function startObserver() {
    if (observer || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(function (records) {
      if (applying || lang !== 'en') return;
      applying = true;
      try {
        for (var i = 0; i < records.length; i++) {
          var r = records[i];
          if (r.type === 'characterData') translateTextNode(r.target);
          else if (r.type === 'childList') {
            r.addedNodes.forEach(function (n) { walk(n); });
          }
        }
      } finally { applying = false; }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function applyAll() {
    applying = true;
    try { walk(document.body); } finally { applying = false; }
  }

  function setLang(next, opts) {
    next = next === 'en' ? 'en' : 'zh';
    opts = opts || {};
    // 独立英文目录：切换语言 = 换 URL（利于收录与分享）
    if (!opts.silentUrl && canNavigate) {
      if (next === 'en' && !inEnDir) {
        location.href = '/en' + (location.pathname === '/' ? '/' : location.pathname) + location.search + location.hash;
        return;
      }
      if (next === 'zh' && inEnDir) {
        location.href = (location.pathname.replace(/^\/en/, '') || '/') + location.search + location.hash;
        return;
      }
    }
    if (next === lang && opts.force !== true) return;
    lang = next;
    try { localStorage.setItem(KEY, lang); } catch (e) { /* ignore */ }
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    if (!opts.silentUrl) writeUrl();

    if (lang === 'en') { applyAll(); startObserver(); }
    else { restore(); }

    applyMeta();
    syncButtons();
    document.dispatchEvent(new CustomEvent('ds:langchange', { detail: { lang: lang } }));
  }

  /* ---------- 初始化 ---------- */
  function boot() {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    if (lang === 'en') { applyAll(); startObserver(); }
    applyMeta();
    syncButtons();
    document.querySelectorAll('[data-lang-btn]').forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.getAttribute('data-lang-btn')); });
    });
  }

  window.DS_I18N = {
    get lang() { return lang; },
    t: t,
    setLang: setLang,
    apply: function (root) { applying = true; try { walk(root || document.body); } finally { applying = false; } },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
