/**
 * 由中文页生成英文独立页（/en/）。
 *
 * 用法：node build-en.mjs .
 *
 * 规则：
 *  - <html lang> 改为 en，并注入 window.__FORCE_LANG__ = 'en'
 *  - 资源与导航改成站点根绝对路径（/assets/…、/en/…）
 *  - title / description / og:* 取页面里 PAGE_META.en
 *  - canonical 指向 /en/…，hreflang 的 zh-CN 与 x-default 指回中文页
 *
 * 改了中文页之后重新跑一次即可；本文件不参与部署（.vercelignore 已排除）。
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || '.';
const outDir = path.join(root, 'en');
fs.mkdirSync(outDir, { recursive: true });

const BASE = 'https://fastaibook.tech';
const PAGES = [
  'index.html', 'guide.html', 'fix.html', 'privacy.html', 'articles.html',
  'deepseek-export-structure.html', 'keep-subset-of-chats.html', 'merge-deepseek-exports.html',
  'export-attachments.html', 'local-vs-cloud-privacy.html', 'what-is-chat-demo.html',
  'export-size-optimization.html', 'chat-demo-backup-migrate.html', 'deepseek-export-faq.html',
  'subset-tool.html', 'merge-tool.html',
];
const NAV = {
  'index.html': '/en/',
  'guide.html': '/en/guide.html',
  'fix.html': '/en/fix.html',
  'privacy.html': '/en/privacy.html',
  'articles.html': '/en/articles.html',
  'deepseek-export-structure.html': '/en/deepseek-export-structure.html',
  'keep-subset-of-chats.html': '/en/keep-subset-of-chats.html',
  'merge-deepseek-exports.html': '/en/merge-deepseek-exports.html',
  'export-attachments.html': '/en/export-attachments.html',
  'local-vs-cloud-privacy.html': '/en/local-vs-cloud-privacy.html',
  'what-is-chat-demo.html': '/en/what-is-chat-demo.html',
  'export-size-optimization.html': '/en/export-size-optimization.html',
  'chat-demo-backup-migrate.html': '/en/chat-demo-backup-migrate.html',
  'deepseek-export-faq.html': '/en/deepseek-export-faq.html',
  'subset-tool.html': '/en/subset-tool.html',
  'merge-tool.html': '/en/merge-tool.html',
};
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 英文版设为 noindex 的页面（应用界面，内容与中文版重复且 SEO 价值低） */
const NOINDEX_PAGES = new Set(['subset-tool.html', 'merge-tool.html']);

/**
 * 删除带 data-lang="zh" 的元素（含其内部全部内容）。
 * 英文页若保留中文正文，会和中文页被判为重复内容（Search Console 的
 * "Duplicate without user-selected canonical"），所以生成时必须剥掉。
 * 采用标签配对扫描，遇到不配对就抛错中止，避免产出损坏的 HTML。
 */
function stripLangElements(html, lang) {
  const openRe = new RegExp('<' + '([a-zA-Z][a-zA-Z0-9-]*)([^>]*\\bdata-lang="' + lang + '"[^>]*)>', 'g');
  let out = '';
  let last = 0;
  let guard = 0;
  while (true) {
    openRe.lastIndex = last;
    const m = openRe.exec(html);
    if (!m) break;
    const tag = m[1].toLowerCase();
    const start = m.index;
    // 从开标签后开始，按同名标签配对找闭标签
    const tokenRe = new RegExp('<(/?)' + tag + '\\b[^>]*>', 'gi');
    tokenRe.lastIndex = start + m[0].length;
    let depth = 1;
    let end = -1;
    let t;
    while ((t = tokenRe.exec(html))) {
      if (t[1] === '/') {
        depth--;
        if (depth === 0) { end = t.index + t[0].length; break; }
      } else {
        depth++;
      }
    }
    if (end < 0) throw new Error('未配对的 <' + tag + ' data-lang="' + lang + '">');
    out += html.slice(last, start);
    last = end;
    if (++guard > 5000) throw new Error('剥离过多，疑似死循环');
  }
  out += html.slice(last);
  return out;
}

/** 校验标签配对，防止生成损坏的 HTML */
function checkBalanced(html, tags) {
  for (const tag of tags) {
    const open = (html.match(new RegExp('<' + tag + '\\b', 'gi')) || []).length;
    const close = (html.match(new RegExp('</' + tag + '\\s*>', 'gi')) || []).length;
    if (open !== close) return tag + ' 不配对（<' + tag + '> ' + open + ' / </' + tag + '> ' + close + '）';
  }
  return null;
}

for (const page of PAGES) {
  let html = fs.readFileSync(path.join(root, page), 'utf8');
  const zhPath = page === 'index.html' ? '/' : '/' + page;
  const enPath = page === 'index.html' ? '/en/' : '/en/' + page;

  html = html.replace('<html lang="zh-CN"', '<html lang="en"');
  html = html.replace('<meta charset="utf-8">',
    '<meta charset="utf-8">\n<script>window.__FORCE_LANG__ = \'en\';</script>');

  html = html.replace(/(href|src)="assets\//g, '$1="/assets/');
  html = html.replace(/href="site\.webmanifest"/g, 'href="/site.webmanifest"');

  html = html.replace(/href="(index|guide|fix|privacy|articles|subset-tool|merge-tool)\.html(#[^"]*)?"/g,
    (m, name, hash) => 'href="' + NAV[name + '.html'] + (hash || '') + '"');
  // 中文页改用根路径后，英文页的站内首页链接要指向 /en/
  html = html.replace(/href="\/"/g, 'href="/en/"');

  const abs = new RegExp(BASE + esc(zhPath) + '(?=["<#?])', 'g');
  html = html.replace(abs, BASE + enPath);

  html = html.replace(/(<link rel="alternate" hreflang="zh-CN" href=")[^"]*(")/, '$1' + BASE + zhPath + '$2');
  html = html.replace(/(<link rel="alternate" hreflang="x-default" href=")[^"]*(")/, '$1' + BASE + zhPath + '$2');

  html = html.replace('<meta property="og:locale" content="zh_CN">', '<meta property="og:locale" content="en_US">');
  html = html.replace('<meta property="og:locale:alternate" content="en_US">', '<meta property="og:locale:alternate" content="zh_CN">');

  const meta = html.match(/en:\s*\{\s*title:\s*'([^']*)',\s*description:\s*'([^']*)'\s*\}/s);
  if (meta) {
    const [, title, desc] = meta;
    html = html.replace(/<title>[\s\S]*?<\/title>/, '<title>' + title + '</title>');
    html = html.replace(/(<meta name="description" content=")[^"]*(")/, '$1' + desc + '$2');
    html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, '$1' + title + '$2');
    html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, '$1' + desc + '$2');
    html = html.replace(/(<meta name="twitter:title" content=")[^"]*(")/, '$1' + title + '$2');
    html = html.replace(/(<meta name="twitter:description" content=")[^"]*(")/, '$1' + desc + '$2');
  }

  html = html.replace(/"inLanguage":\s*\[[^\]]*\]/g, '"inLanguage": ["en"]');

  /* 工具页（应用界面）的英文版设为 noindex：
   * 界面文案由运行时字典翻译，HTML 里仍是中文，和中文版高度重复；
   * 这两页 SEO 价值低，用 noindex 彻底消除重复信号。
   * 同时移除 hreflang（noindex 与 hreflang 互相矛盾）。 */
  if (NOINDEX_PAGES.has(page)) {
    html = html.replace(/<link rel="alternate" hreflang="[^"]+" href="[^"]+"\s*\/?>\s*\n?/g, '');
    const hadRobots = /<meta name="robots"[^>]*>/.test(html);
    html = html.replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex,follow">');
    if (!hadRobots) {
      html = html.replace('</title>', '</title>\n<meta name="robots" content="noindex,follow">');
    }
    if (!/name="robots" content="noindex,follow"/.test(html)) throw new Error('noindex 注入失败: ' + page);
    if (/hreflang=/.test(html)) throw new Error('noindex 页仍残留 hreflang: ' + page);
  }

  // 关键：剥掉中文正文，否则英文页与中文页 HTML 几乎相同，会被判为重复内容
  const before = html.length;
  html = stripLangElements(html, 'zh');
  // PAGE_META 里的 zh 文案也一并去掉（它是脚本里的字符串，不影响渲染）
  html = html.replace(/\bzh:\s*\{\s*title:\s*'[^']*',\s*description:\s*'[^']*'\s*\},?\s*/s, '');

  const unbalanced = checkBalanced(html, ['span', 'div', 'p', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'a', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'details', 'summary', 'article', 'aside', 'header', 'footer', 'nav', 'main', 'section', 'pre', 'code', 'label', 'svg']);
  if (unbalanced) throw new Error('en/' + page + ' 标签不配对：' + unbalanced);
  if (/data-lang="zh"/.test(html)) throw new Error('en/' + page + ' 仍残留中文元素');

  fs.writeFileSync(path.join(outDir, page), html);
  console.log('built en/' + page, html.length, 'bytes', '(-' + (before - html.length) + ' 中文)');
}