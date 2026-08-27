const fs = require('node:fs/promises');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const roots = [...new Set([
  path.join(projectRoot, 'public'),
  path.resolve(projectRoot, process.env.STATIC_OUTPUT_DIR || 'docs')
])];
const allowedExtensions = new Set(['.html', '.css', '.js', '.xml', '.txt', '.svg', '.jpg', '.jpeg', '.png', '.webp', '.woff', '.woff2', '.ico', '.webmanifest']);
const forbiddenNames = /^(?:\.env(?:\..+)?|package(?:-lock)?\.json|server\.js|.*\.(?:map|bak|backup|old|orig|pem|key|p12|pfx|sqlite|db))$/iu;
const secretPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bAIza[0-9A-Za-z_-]{35}\b/u,
  /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/u,
  /\bsk-[A-Za-z0-9_-]{20,}\b/u,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/u,
  /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|password)\s*[:=]\s*["'][^"']{8,}["']/iu
];

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

async function audit() {
  const errors = [];
  let inspected = 0;
  for (const directory of roots) {
    const files = await walk(directory);
    for (const file of files) {
      inspected += 1;
      const relative = path.relative(projectRoot, file);
      const basename = path.basename(file);
      const extension = path.extname(file).toLowerCase();
      if (!['.nojekyll', '.htaccess'].includes(basename) && (!allowedExtensions.has(extension) || forbiddenNames.test(basename))) {
        errors.push(`${relative}: недопустимый публичный тип файла`);
        continue;
      }
      if (basename !== '.htaccess' && !['.html', '.css', '.js', '.xml', '.txt', '.svg', '.webmanifest'].includes(extension)) continue;
      const content = await fs.readFile(file, 'utf8');
      if (secretPatterns.some((pattern) => pattern.test(content))) errors.push(`${relative}: обнаружен фрагмент, похожий на секрет`);
      if (extension === '.svg' && /<script\b|\bon\w+\s*=/iu.test(content)) errors.push(`${relative}: активное содержимое в SVG`);
    }
  }
  if (errors.length) throw new Error(`Аудит public/docs не пройден:\n- ${errors.join('\n- ')}`);
  console.log(`Аудит public/docs: ${inspected} файлов, секретов и лишних типов нет`);
}

audit().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
