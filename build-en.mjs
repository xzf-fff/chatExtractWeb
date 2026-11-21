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
const PAGES = ['index.html', 'guide.html', 'subset-tool.html', 'merge-tool.html'];
const NAV = {
  'index.html': '/en/',
  'guide.html': '/en/guide.html',
  'subset-tool.html': '/en/subset-tool.html',
  'merge-tool.html': '/en/merge-tool.html',
};
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

for (const page of PAGES) {
  let html = fs.readFileSync(path.join(root, page), 'utf8');
  const zhPath = page === 'index.html' ? '/' : '/' + page;
  const enPath = page === 'index.html' ? '/en/' : '/en/' + page;

  html = html.replace('<html lang="zh-CN"', '<html lang="en"');
  html = html.replace('<meta charset="utf-8">',
    '<meta charset="utf-8">\n<script>window.__FORCE_LANG__ = \'en\';</script>');

  html = html.replace(/(href|src)="assets\//g, '$1="/assets/');
  html = html.replace(/href="site\.webmanifest"/g, 'href="/site.webmanifest"');

  html = html.replace(/href="(index|guide|subset-tool|merge-tool)\.html(#[^"]*)?"/g,
    (m, name, hash) => 'href="' + NAV[name + '.html'] + (hash || '') + '"');

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

  fs.writeFileSync(path.join(outDir, page), html);
  console.log('built en/' + page, html.length, 'bytes');
}