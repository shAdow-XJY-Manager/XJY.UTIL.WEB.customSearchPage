import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { build } from 'vite';
import { root, checkSize } from './check-size.mjs';
import { languages, translate } from '../native/i18n.js';
const args = process.argv.slice(2);
const target = args.find(arg => !arg.startsWith('--')) || 'all';
const base = args.find(arg => arg.startsWith('--base-href='))?.slice(12) || '/XJY.UTIL.WEB.customSearchPage/';
if (!['all', 'web', 'extension'].includes(target) || !base.startsWith('/') || !base.endsWith('/') ||
    args.some(arg => arg.startsWith('--') && !arg.startsWith('--base-href=')) || args.filter(arg => !arg.startsWith('--')).length > 1) {
  throw new Error('Usage: npm run build -- [all|web|extension] [--base-href=/path/]');
}
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
for (const extension of [false, true]) {
  if (target === 'web' && extension || target === 'extension' && !extension) continue;
  const output = path.join(root, 'build', extension ? '.extension-stage' : 'web');
  await build({ configFile: path.join(root, 'vite.config.js'), base: extension ? './' : base,
    build: { outDir: output, emptyOutDir: true, target: 'es2022', sourcemap: false, minify: true } });
  fs.cpSync(path.join(root, 'native/licenses'), path.join(output, 'licenses'), { recursive: true });
  if (!extension) {
    fs.copyFileSync(path.join(root, 'web/favicon.png'), path.join(output, 'favicon.png'));
    fs.mkdirSync(path.join(output, 'icons'), { recursive: true });
    for (const name of ['Icon-192.png', 'Icon-512.png']) fs.copyFileSync(path.join(root, 'web/icons', name), path.join(output, 'icons', name));
    fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ name: '新标签页', short_name: '新标签页', start_url: '.', display: 'standalone', icons: [
      { src: 'icons/Icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/Icon-512.png', sizes: '512x512', type: 'image/png' },
    ] }));
    const index = path.join(output, 'index.html');
    fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace('</head>', '<link rel="manifest" href="manifest.json"><link rel="icon" href="favicon.png"></head>'));
    continue;
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension/manifest.json'), 'utf8'));
  manifest.version = version;
  manifest.name = '__MSG_extensionName__'; manifest.short_name = '__MSG_extensionShortName__';
  manifest.description = '__MSG_extensionDescription__'; manifest.default_locale = 'en';
  for (const [locale] of languages) {
    const codes = locale === 'pt' ? ['pt_BR', 'pt_PT'] : [locale.replace('-', '_')];
    const brand = locale === 'zh-CN' ? '频率搜索' : locale === 'zh-TW' ? '頻率搜尋' : 'Frequency Search';
    const messages = { extensionName: { message: `${brand} · ${translate('新标签页', locale)}` },
      extensionShortName: { message: locale.startsWith('zh') ? brand : 'Frequency' },
      extensionDescription: { message: translate('简洁的新标签页，本地背景与自由布局。', locale) } };
    for (const code of codes) {
      const localeDir = path.join(output, '_locales', code); fs.mkdirSync(localeDir, { recursive: true });
      fs.writeFileSync(path.join(localeDir, 'messages.json'), JSON.stringify(messages));
    }
  }
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.cpSync(path.join(root, 'extension/icons'), path.join(output, 'icons'), { recursive: true });
  const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  if ([...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].some(match => !/src=/.test(match[1]) || match[2].trim())) throw new Error('Inline scripts violate extension CSP');
  fs.mkdirSync(path.join(root, 'build/releases'), { recursive: true });
  const zip = path.join(root, `build/releases/frequency-search-${version}.zip`);
  fs.rmSync(zip, { force: true });
  execFileSync('zip', ['-q', '-r', zip, '.', '-x', '*.DS_Store'], { cwd: output });
  const size = checkSize(output, zip);
  const final = path.join(root, 'build/extension');
  fs.rmSync(final, { recursive: true, force: true }); fs.renameSync(output, final);
  fs.writeFileSync(path.join(root, 'build/releases/size-report.json'), JSON.stringify({ version, ...size }, null, 2));
  console.log(`Extension: ${final}\nZIP: ${zip}`);
}
