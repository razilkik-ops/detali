const fs = require('node:fs/promises');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const docsRoot = path.resolve(projectRoot, process.env.STATIC_OUTPUT_DIR || 'docs');
const publishedSiteUrl = new URL(process.env.STATIC_SITE_URL || 'https://razilkik-ops.github.io/detali');
const publishedOrigin = publishedSiteUrl.origin;
const configuredBasePath = process.env.STATIC_BASE_PATH ?? '/detali';
const publishedBasePath = configuredBasePath === '/' ? '' : `/${configuredBasePath.replace(/^\/+|\/+$/gu, '')}`;

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else files.push(target);
  }
  return files;
}

function matches(html, expression) {
  return [...html.matchAll(expression)].map((match) => match[1]);
}

function pageTarget(urlPath) {
  const relative = decodeURIComponent(urlPath.slice(publishedBasePath.length)).replace(/^\//, '');
  if (!relative) return path.join(docsRoot, 'index.html');
  if (path.extname(relative)) return path.join(docsRoot, relative);
  return path.join(docsRoot, relative, 'index.html');
}

async function audit() {
  const htmlFiles = (await walk(docsRoot)).filter((file) => file.endsWith('.html'));
  const errors = [];
  const indexablePages = [];
  const titleOwners = new Map();
  const descriptionOwners = new Map();

  for (const file of htmlFiles) {
    const relative = path.relative(docsRoot, file);
    const html = await fs.readFile(file, 'utf8');
    const titles = matches(html, /<title>([^<]*)<\/title>/giu);
    const descriptions = matches(html, /<meta\s+name="description"\s+content="([^"]*)">/giu);
    const canonicals = matches(html, /<link\s+rel="canonical"\s+href="([^"]*)">/giu);
    const robots = matches(html, /<meta\s+name="robots"\s+content="([^"]*)">/giu);
    const h1Count = (html.match(/<h1(?:\s|>)/giu) || []).length;
    const noindex = robots.some((value) => value.includes('noindex'));

    if (titles.length !== 1) errors.push(`${relative}: ожидался один title, найдено ${titles.length}`);
    if (descriptions.length !== 1) errors.push(`${relative}: ожидался один description, найдено ${descriptions.length}`);
    if (canonicals.length !== 1) errors.push(`${relative}: ожидался один canonical, найдено ${canonicals.length}`);
    if (h1Count !== 1) errors.push(`${relative}: ожидался один h1, найдено ${h1Count}`);

    for (const json of matches(html, /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/giu)) {
      try { JSON.parse(json); } catch (error) { errors.push(`${relative}: некорректный JSON-LD (${error.message})`); }
    }

    for (const tag of html.match(/<img\b[^>]*>/giu) || []) {
      if (!/\salt="[^"]*"/iu.test(tag)) errors.push(`${relative}: у изображения нет alt`);
    }

    for (const href of matches(html, /<a\b[^>]*\shref="([^"]+)"/giu)) {
      if (/^(?:mailto:|tel:|#)/iu.test(href)) continue;
      let target;
      try { target = new URL(href, publishedOrigin); } catch { errors.push(`${relative}: некорректная ссылка ${href}`); continue; }
      if (target.origin !== publishedOrigin || (publishedBasePath && !target.pathname.startsWith(`${publishedBasePath}/`))) continue;
      try { await fs.access(pageTarget(target.pathname)); } catch { errors.push(`${relative}: внутренняя ссылка ведёт на отсутствующую страницу ${target.pathname}`); }
    }

    if (!noindex && titles[0] && descriptions[0] && canonicals[0]) {
      if (titles[0].length < 25 || titles[0].length > 70) errors.push(`${relative}: длина title ${titles[0].length}, ожидается 25–70`);
      if (descriptions[0].length < 70 || descriptions[0].length > 180) errors.push(`${relative}: длина description ${descriptions[0].length}, ожидается 70–180`);
      if (titleOwners.has(titles[0])) errors.push(`${relative}: title дублирует ${titleOwners.get(titles[0])}`);
      if (descriptionOwners.has(descriptions[0])) errors.push(`${relative}: description дублирует ${descriptionOwners.get(descriptions[0])}`);
      titleOwners.set(titles[0], relative);
      descriptionOwners.set(descriptions[0], relative);
      indexablePages.push(canonicals[0]);
    }
  }

  const sitemap = await fs.readFile(path.join(docsRoot, 'sitemap.xml'), 'utf8');
  const sitemapUrls = matches(sitemap, /<loc>([^<]+)<\/loc>/giu).sort();
  const canonicalUrls = indexablePages.sort();
  if (JSON.stringify(sitemapUrls) !== JSON.stringify(canonicalUrls)) {
    errors.push('sitemap.xml не совпадает с набором indexable canonical URL');
  }
  if ((sitemap.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) || []).length !== canonicalUrls.length) {
    errors.push('sitemap.xml: lastmod заполнен не для всех URL');
  }

  if (errors.length) throw new Error(`SEO-аудит не пройден:\n- ${errors.join('\n- ')}`);
  console.log(`SEO-аудит: ${htmlFiles.length} HTML-страниц, ${indexablePages.length} indexable URL, ошибок нет`);
}

audit().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
