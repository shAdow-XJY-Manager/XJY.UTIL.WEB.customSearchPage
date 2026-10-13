// Production website checks, using an isolated browser and the actual deployment subpath.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { execFileSync } = require('node:child_process'), assert = require('node:assert/strict');
let pw; try { pw = require('playwright'); } catch { pw = require(path.join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'playwright')); }
const root = path.resolve(__dirname, '..'), output = path.join(root, /edge/i.test(process.env.BROWSER_EXECUTABLE || '') ? 'build/qa-web-edge' : 'build/qa-web');
const prefix = '/XJY.UTIL.WEB.customSearchPage/', directory = path.join(root, 'build/web');
const errors = [], external = [], checks = []; fs.mkdirSync(output, { recursive: true });
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const relative = decodeURIComponent(pathname.slice(prefix.length)) || 'index.html';
  const file = path.resolve(directory, relative);
  if (!pathname.startsWith(prefix) || !file.startsWith(directory + path.sep) || !fs.existsSync(file)) { response.writeHead(404).end(); return; }
  response.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' }[path.extname(file)] || 'text/plain');
  response.end(fs.readFileSync(file));
});
let browser;
(async () => { try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}${prefix}`;
  browser = await pw.chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', locale: 'zh-CN' });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.isNavigationRequest() && /^https?:/.test(request.url()) && !request.url().startsWith(url)) external.push(request.url()); });
  await page.goto(url); await page.waitForSelector('html[data-ready="true"]');
  assert.equal(await page.title(), '新标签页'); assert.equal(await page.locator('#new-tab').isChecked(), true);
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'auto'); assert(await page.locator('#image-theme').isChecked()); checks.push('production subpath and website defaults');
  await page.emulateMedia({ colorScheme: 'dark' });
  assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(32, 33, 36)');
  await page.emulateMedia({ colorScheme: 'light', locale: 'zh-CN' }); checks.push('live system theme');
  await page.locator('#settings-button').click(); await page.locator('#tab-search').click(); assert(await page.locator('#import-sites').isDisabled());
  await page.getByText('自定义搜索引擎', { exact: true }).click(); await page.locator('#add-engine').click();
  await page.locator('#item-name').fill('本地测试'); await page.locator('#item-url').fill('https://example.test/search?q=%s');
  await page.locator('#save-item').click(); await page.locator('#item-dialog').waitFor({ state: 'hidden' }); await page.locator('#close-settings').click();
  await page.locator('#engine-button').click(); await page.locator('#engine-filter').fill('本地测试'); await page.locator('#engine-filter').press('ArrowUp'); await page.keyboard.press('Enter');
  await context.route('https://example.test/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Search test</title>' }));
  await page.locator('#query').fill('中文🙂 & + # %'); const popup = context.waitForEvent('page');
  await page.locator('#query').press('Enter'); const result = await popup; await result.waitForURL('https://example.test/**');
  assert.equal(new URL(result.url()).searchParams.get('q'), '中文🙂 & + # %'); assert.equal(page.url(), url); await result.close();
  checks.push('custom engine filter, keyboard selection, encoding and default new-tab search');
  await page.locator('#add-shortcut').click(); await page.locator('#item-name').fill('MDN'); await page.locator('#item-url').fill('developer.mozilla.org');
  await page.locator('#save-item').click(); await page.locator('#item-dialog').waitFor({ state: 'hidden' }); await page.reload(); await page.waitForSelector('html[data-ready="true"]');
  assert.equal(await page.getByRole('link', { name: 'MDN', exact: true }).getAttribute('href'), 'https://developer.mozilla.org/');
  assert.match(await page.locator('#engine-button').getAttribute('aria-label'), /本地测试/); checks.push('manual shortcuts and custom engine persist on website');
  await page.screenshot({ path: path.join(output, 'website.png') });
  await page.locator('#settings-button').click(); await page.locator('#tab-shortcuts').click();
  await page.locator('#show-add-shortcut').uncheck(); await page.locator('#close-settings').click();
  assert.equal(await page.locator('#add-shortcut').count(),0); assert.equal(await page.locator('#shortcuts a').count(),1);
  await page.reload(); await page.waitForSelector('html[data-ready="true"]'); assert.equal(await page.locator('#add-shortcut').count(),0);
  await page.locator('#settings-button').click(); await page.locator('#tab-shortcuts').click();
  assert(await page.locator('#add-shortcut-settings').isVisible()); await page.locator('#show-add-shortcut').check(); await page.locator('#close-settings').click();
  await page.locator('#engine-button').click();
  assert.equal(await page.locator('#engine-options img.brand-icon').count(),35);
  await page.waitForFunction(()=>[...document.querySelectorAll('#engine-options img.brand-icon')].every(image=>image.complete&&image.naturalWidth>0));
  await page.keyboard.press('Escape');
  checks.push('35 bundled engine logos and persistent add-tile toggle keep existing shortcuts');
  const { languages, translate }=await import(require('node:url').pathToFileURL(path.join(root,'native/i18n.js')).href);
  const text='保留 العربية Café 🙂 & +';await page.locator('#query').fill(text);
  await page.locator('#settings-button').click();await page.locator('#tab-appearance').click();
  for(const [locale] of languages){
    await page.locator('#language').selectOption(locale);await page.waitForFunction(code=>document.documentElement.lang===code,locale);
    assert.equal(await page.title(),translate('新标签页',locale));assert.equal(await page.locator('#query').getAttribute('placeholder'),translate('搜索',locale));
    assert.equal(await page.locator('#query').inputValue(),text);const grid=await page.locator('#shortcuts').boundingBox();assert(grid.x>=0&&grid.x+grid.width<=1280);assert.match(await page.locator('#engine-button').getAttribute('aria-label'),/本地测试/);
    assert.equal(await page.locator('#close-settings').getAttribute('aria-label'),translate('关闭设置',locale));
    for(const tab of ['search','shortcuts','appearance']){await page.locator('#tab-'+tab).click();assert(await page.locator('#panel-'+tab).isVisible())}
    assert(await page.locator('#settings').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    if(['en','de','ar','ja','zh-TW'].includes(locale))await page.screenshot({path:path.join(output,`language-${locale}.png`)});
  }
  checks.push('all 16 UI locales, translated titles/accessibility, preserved query and custom engine names');
  await page.locator('#language').selectOption('ar');await page.locator('#tab-appearance').focus();await page.keyboard.press('ArrowLeft');assert(await page.locator('#panel-search').isVisible());await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('html').getAttribute('dir'),'rtl');const rtlPanel=await page.locator('#settings').boundingBox();assert(rtlPanel.x<20);
  await page.locator('#close-settings').click();await page.locator('#query').fill('');assert.equal(await page.locator('#query').getAttribute('dir'),'rtl');await page.locator('#query').fill('English');assert.equal(await page.locator('#query').getAttribute('dir'),'auto');await page.locator('#settings-button').click();
  await page.locator('#language').selectOption('en');await page.locator('#tab-search').click();await page.getByText('Custom search engines',{exact:true}).click();await page.locator('#add-engine').click();
  await page.locator('#save-item').click();assert.equal(await page.locator('#item-status').innerText(),translate('引擎名称需为 1–40 个字符。','en'));
  await page.locator('#item-name').fill('User engine العربية');await page.locator('#item-url').fill('javascript:alert(%s)');await page.locator('#save-item').click();
  assert.equal(await page.locator('#item-status').innerText(),translate('请输入有效的 HTTP 或 HTTPS 搜索网址，不含用户名或密码。','en'));
  await page.locator('#cancel-item').click();await page.locator('#tab-appearance').click();
  await page.setViewportSize({width:320,height:640});await page.addStyleTag({content:':root{font-size:32px}'});
  for(const locale of ['en','de','ar']){
    await page.locator('#language').selectOption(locale);assert(await page.locator('#settings').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    await page.locator('#tab-shortcuts').click();await page.locator('#add-shortcut-settings').click();await page.locator('#cancel-item').scrollIntoViewIfNeeded();
    const overflow=await page.locator('#item-dialog').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,items:[...el.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>el.getBoundingClientRect().right||e.getBoundingClientRect().left<el.getBoundingClientRect().left).map(e=>({tag:e.tagName,id:e.id,text:e.textContent?.slice(0,80),width:e.getBoundingClientRect().width}))}));
    if(overflow.scroll>overflow.client+1){await page.screenshot({path:path.join(output,`failure-${locale}-dialog.png`)});console.error(locale,overflow)}
    assert(overflow.scroll<=overflow.client+1);await page.locator('#cancel-item').click();
    await page.locator('#tab-appearance').click();await page.screenshot({path:path.join(output,`language-${locale}-narrow.png`)});
  }
  checks.push('Arabic RTL placement and arrows; English/German/Arabic at 320px and 200% text; translated validation');
  await page.locator('#language').selectOption('en');await page.locator('#close-settings').click();await page.reload();await page.waitForSelector('html[data-ready="true"]');
  assert.equal(await page.title(),'New tab');assert.equal(await page.locator('#language').inputValue(),'en');
  await page.evaluate(()=>{Object.defineProperty(navigator,'languages',{configurable:true,get:()=>['ja-JP']});window.dispatchEvent(new Event('languagechange'))});assert.equal(await page.title(),'New tab');
  await page.locator('#settings-button').click();await page.locator('#language').selectOption('auto');await page.waitForFunction(()=>document.documentElement.lang==='ja');
  await page.evaluate(()=>{Object.defineProperty(navigator,'languages',{configurable:true,get:()=>['ar-EG']});window.dispatchEvent(new Event('languagechange'))});await page.waitForFunction(()=>document.documentElement.lang==='ar');
  await page.locator('#reset-all').click();await page.waitForFunction(()=>document.getElementById('settings-status').textContent==='تمت استعادة الإعدادات الافتراضية.');assert.equal(await page.locator('#language').inputValue(),'auto');
  checks.push('saved locale survives reload; explicit choice wins; automatic mode follows browser changes and reset');
  for(const [locale,expected] of [['fr-FR','fr'],['nl-NL','en']]){
    const fresh=await browser.newContext({locale});const first=await fresh.newPage();await first.goto(url);await first.waitForSelector('html[data-ready="true"]');
    assert.equal(await first.locator('html').getAttribute('lang'),expected);assert.equal(await first.title(),translate('新标签页',expected));await fresh.close();
  }
  checks.push('fresh browser locale detection and unsupported-language fallback');
  const cache = await page.evaluate(async()=>{const c=await caches.open('frequency-engine-icons-v1');return (await c.keys()).map(r=>r.url)});
  assert(cache.some(url=>url.includes('/github.svg')), 'official CDN icons cached locally');
  await page.locator('#close-settings').click(); await page.locator('#engine-button').click(); await page.locator('[data-engine="github"]').click();
  await context.route('https://cdn.jsdelivr.net/**', route=>route.abort());
  await page.reload(); await page.waitForSelector('html[data-ready="true"]');
  await page.waitForFunction(()=>document.getElementById('engine-icon').src.startsWith('blob:')&&document.getElementById('engine-icon').naturalWidth>0);
  checks.push('CDN icon cache survives reload with network blocked');

  assert.deepEqual(errors, []); assert(external.every(url => url.startsWith('https://cdn.jsdelivr.net/npm/simple-icons@'))); checks.push('only fixed icon CDN requests; no runtime errors');
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ browser: await browser.version(), version: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version, checks, errors, external }, null, 2)); console.log(checks);
} finally { if (browser) await browser.close(); server.close(); } })().catch(error => { console.error(error); process.exitCode = 1; });
