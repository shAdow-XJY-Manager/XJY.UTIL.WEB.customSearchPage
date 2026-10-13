// Real installed-browser regression suite; test profiles are disposable.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {spawn, execFileSync} = require('node:child_process');
const assert = require('node:assert/strict');
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'playwright')); }
const root = path.resolve(__dirname,'..'), kind = process.argv[2] || 'chrome';
assert(['chrome','edge'].includes(kind));
const executable = process.env.BROWSER_EXECUTABLE || (kind === 'edge' ? '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const output = path.join(root,'build',`qa-native-${kind}`); fs.mkdirSync(output,{recursive:true});
const profile = fs.mkdtempSync(path.join(os.tmpdir(),`frequency-${kind}-`));
const checks=[], errors=[], external=[], resources=[];
let browser, context, child, extensionId, activePage;
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
const newtab = kind === 'edge' ? 'edge://newtab/' : 'chrome://newtab/';
const passed = name => { checks.push(name); console.log('PASS',kind,name); };
async function launch() {
  const file = path.join(profile,'DevToolsActivePort'); fs.rmSync(file,{force:true});
  child = spawn(executable,['--headless=new','--remote-debugging-port=0','--enable-unsafe-extension-debugging','--no-first-run','--no-default-browser-check',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
  for(let n=0;!fs.existsSync(file)&&n<150;n++)await wait(100);
  browser = await pw.chromium.connectOverCDP('http://127.0.0.1:'+fs.readFileSync(file,'utf8').split('\n')[0]);
  context = browser.contexts()[0]; context.setDefaultTimeout(10000);
  await context.addInitScript(()=>Object.defineProperty(navigator,'languages',{configurable:true,get:()=>['zh-CN']}));
  const cdp = await browser.newBrowserCDPSession();
  ({id:extensionId} = await cdp.send('Extensions.loadUnpacked',{path:path.join(root,'build/extension')}));
}
async function stop() {
  if(!child)return;
  const exit = new Promise(resolve=>child.once('exit',resolve));
  if(browser)await browser.close().catch(()=>{}); child.kill(); await Promise.race([exit,wait(5000)]); browser=null; child=null;
}
async function app() {
  const page=await context.newPage();activePage=page;await page.setViewportSize({width:1280,height:900});
  await page.emulateMedia({colorScheme:'light'});
  page.on('request',r=>{if(!r.isNavigationRequest()&&page.url().startsWith(`chrome-extension://${extensionId}/`)){resources.push(r.url());if(/^https?:/.test(r.url()))external.push(r.url())}});
  page.on('pageerror',e=>{if(page.url().startsWith(`chrome-extension://${extensionId}/`))errors.push(e.message)});
  page.on('console',m=>{if(page.url().startsWith(`chrome-extension://${extensionId}/`)&&['warning','error'].includes(m.type()))errors.push(m.text())});
  await page.goto(newtab).catch(e=>{if(!e.message.includes('ERR_ABORTED'))throw e});
  await page.waitForSelector('html[data-ready="true"]');assert(page.url().startsWith(`chrome-extension://${extensionId}/`));
  return page;
}
async function read(page) {
  return page.evaluate(async()=>{
    const request=indexedDB.open('frequency_search_v2');
    const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
    const record=await new Promise((resolve,reject)=>{const r=db.transaction('state').objectStore('state').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});db.close();
    return {prefs:record.prefs,migrated:record.migrated,shortcuts:record.shortcuts,topSitesImported:record.topSitesImported,background:record.background?{size:record.background.size,type:record.background.type}:null};
  });
}
async function settings(page, tab='appearance'){await page.getByRole('button',{name:'设置',exact:true}).click();await page.locator('#settings').waitFor();await page.locator('#tab-'+tab).click()}
async function closeSettings(page){await page.getByRole('button',{name:'关闭设置',exact:true}).click();await page.locator('#settings').waitFor({state:'hidden'})}
async function edit(page){await settings(page);await page.getByRole('button',{name:'编辑布局',exact:true}).click();await page.locator('body.editing').waitFor()}
async function drag(page,locator,dx,dy){const b=await locator.boundingBox();const x=b.x+b.width/2,y=b.y+b.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:5});await page.mouse.up();await page.waitForTimeout(30)}
async function pickStatus(page,file,text){const selected=page.locator('#background-file').setInputFiles(file,{timeout:30000});selected.catch(()=>{});await page.waitForFunction(expected=>document.getElementById('settings-status').textContent===expected,text,{timeout:30000})}
async function selectEngine(page,name){await page.locator('#engine-button').click();await page.getByRole('menuitemradio',{name,exact:true}).click()}
(async()=>{
 try {
  await launch();await context.setOffline(true);let page=await app();
  assert.equal(await page.title(),'新标签页');assert.equal(await page.locator('body').innerText(),'添加快捷链接');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'auto');
  assert.equal((await read(page)).prefs.newTab,false);
  assert.equal(await page.locator('#query').evaluate(el=>document.activeElement===el),false);
  await page.screenshot({path:path.join(output,'01-main.png')});passed('minimal offline new tab with system fonts and address-bar focus preserved');
  await page.locator('#query').fill('保留中文🙂');await page.locator('#engine-button').click();
  await page.screenshot({path:path.join(output,'02-engine-menu.png')});
  await page.getByRole('menuitemradio',{name:'Bing',exact:true}).press('ArrowDown');await page.keyboard.press('Enter');
  assert.equal(await page.locator('#query').inputValue(),'保留中文🙂');assert.equal(await page.locator('#query').evaluate(el=>document.activeElement===el),true);
  assert.match(await page.locator('#engine-button').getAttribute('aria-label'),/Google/);
  await page.locator('#engine-button').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#engine-menu').isVisible(),false);
  await page.locator('#engine-button').click();await page.mouse.click(30,120);assert.equal(await page.locator('#engine-menu').isVisible(),false);
  passed('engine menu keyboard selection, dismissal, retained input and focus');
  await settings(page);await page.screenshot({path:path.join(output,'03-settings.png')});
  assert(await page.locator('#panel-appearance').isVisible());assert.equal(await page.locator('#panel-search').isVisible(),false);
  await page.locator('#tab-appearance').focus();await page.keyboard.press('ArrowRight');assert(await page.locator('#panel-search').isVisible());
  await page.keyboard.press('End');assert(await page.locator('#panel-shortcuts').isVisible());await page.keyboard.press('Home');assert(await page.locator('#panel-appearance').isVisible());
  passed('three settings tabs, roving keyboard navigation, default appearance panel and fixed footer');
  assert.equal(await page.locator('#settings').evaluate(el=>el.getBoundingClientRect().width),420);
  await page.locator('#theme').selectOption('dark');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.locator('#theme').selectOption('light');await closeSettings(page);passed('settings drawer and theme switching');
  // Sample the actual button area, including object-fit letterboxing and shade.
  await settings(page);await page.locator('#theme').selectOption('dark');
  const sample=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=600;canvas.height=300;const ctx=canvas.getContext('2d');ctx.fillStyle='#163c90';ctx.fillRect(0,0,420,300);ctx.fillStyle='#ffffff';ctx.fillRect(420,0,180,300);return canvas.toDataURL('image/png').split(',')[1]});
  await pickStatus(page,{name:'theme-sample.png',mimeType:'image/png',buffer:Buffer.from(sample,'base64')},'本地背景已保存。');
  await page.waitForFunction(()=>!document.getElementById('ambient').hidden);
  const tint=await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor);
  assert.equal(await page.locator('#ambient').evaluate(el=>el.width),160);
  await page.waitForFunction(()=>document.getElementById('settings-button').style.getPropertyValue('--settings-ink')==='rgb(32, 33, 36)');
  await page.locator('#background-fit').selectOption('4');
  assert(await page.locator('#settings-button').evaluate(el=>Boolean(el.style.getPropertyValue('--settings-ink'))));
  await closeSettings(page);await page.locator('#query').fill('');await page.mouse.click(30,120);
  await page.screenshot({path:path.join(output,'10-image-theme.png')});
  await settings(page);await page.locator('#background-fit').selectOption('1');
  await page.waitForFunction(()=>document.getElementById('settings-button').style.getPropertyValue('--settings-ink')==='rgb(32, 33, 36)');
  await page.locator('#overlay').focus();await page.locator('#overlay').press('End');
  await page.waitForFunction(()=>document.getElementById('settings-button').style.getPropertyValue('--settings-ink')==='rgb(248, 250, 252)');
  await page.locator('#overlay').press('Home');await page.locator('#background-fit').selectOption('4');
  await page.locator('#theme').selectOption('auto');await page.emulateMedia({colorScheme:'light'});
  await page.waitForFunction(expected=>getComputedStyle(document.body).backgroundColor!==expected,tint);
  await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(expected=>getComputedStyle(document.body).backgroundColor===expected,tint);
  await page.locator('#image-theme').uncheck();assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(32, 33, 36)');
  await closeSettings(page);await page.reload();await page.waitForSelector('html[data-ready="true"]');
  assert.equal((await read(page)).prefs.imageTheme,false);await settings(page);await page.locator('#image-theme').check();
  await page.locator('#advanced-colors summary').click();await page.locator('#custom-color').check();
  await page.locator('#color-page').evaluate(el=>{el.value='#204020';el.dispatchEvent(new Event('change',{bubbles:true}))});
  await page.waitForFunction(()=>getComputedStyle(document.body).backgroundColor==='rgb(32, 64, 32)');
  await page.locator('#color-settings').evaluate(el=>{el.value='#ffcc00';el.dispatchEvent(new Event('change',{bubbles:true}))});
  await page.waitForFunction(()=>document.getElementById('settings-button').style.getPropertyValue('--settings-ink')==='rgb(255, 204, 0)');
  await page.locator('#clear-background').click();await page.waitForFunction(text=>document.getElementById('settings-status').textContent===text,'已恢复纯色背景。');
  assert.equal(await page.locator('html').evaluate(el=>el.style.getPropertyValue('--image-page')),'');
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(32, 64, 32)');
  passed('local image tint, fitted/cropped/letterboxed button sampling, overlay, live theme and custom-color precedence');
  const repository=page.locator('#repository-link');await repository.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'11-repository.png')});
  assert.equal(await repository.getAttribute('href'),'https://github.com/shAdow-XJY-Manager/XJY.UTIL.WEB.customSearchPage');
  assert.equal(await repository.getAttribute('target'),'_blank');assert.match(await repository.getAttribute('rel'),/noopener/);
  await repository.focus();await page.keyboard.press('Tab');assert.equal(await page.locator('#language').evaluate(el=>document.activeElement===el),true);
  await page.keyboard.press('Shift+Tab');assert.equal(await repository.evaluate(el=>document.activeElement===el),true);
  await context.route('https://github.com/shAdow-XJY-Manager/XJY.UTIL.WEB.customSearchPage',route=>route.fulfill({status:200,contentType:'text/html',body:'<title>Repository test</title>'}));
  const repositoryPopup=context.waitForEvent('page');await repository.click();const repositoryPage=await repositoryPopup;await repositoryPage.waitForURL('https://github.com/shAdow-XJY-Manager/**');
  assert.equal(await repositoryPage.evaluate(()=>window.opener),null);await repositoryPage.close();
  await page.locator('#reset-all').click();await page.waitForFunction(text=>document.getElementById('settings-status').textContent===text,'已恢复默认设置。');
  assert((await read(page)).prefs.imageTheme);await closeSettings(page);await page.emulateMedia({colorScheme:'light'});
  passed('repository footer link opens safely and participates in the drawer keyboard focus loop');
  await edit(page);await page.screenshot({path:path.join(output,'04-layout-edit.png')});
  const start=await page.locator('#search-shell').boundingBox();await drag(page,page.locator('#search-shell'),80,35);
  const moved=await page.locator('#search-shell').boundingBox();assert(moved.x>start.x+70&&moved.y>start.y+25);
  for(const edge of ['n','ne','e','se','s','sw','w','nw']){
    await page.locator('#reset-layout').click();const before=await page.locator('#search-shell').boundingBox();
    await drag(page,page.locator(`[data-edge="${edge}"]`),edge.includes('w')?-25:25,edge.includes('n')?-20:20);
    const after=await page.locator('#search-shell').boundingBox();
    if(/[ew]/.test(edge))assert(after.width>before.width+20);
    if(/[ns]/.test(edge))assert(after.height>before.height+15);
  }
  passed('pointer dragging and all eight resize directions');
  await page.locator('#search-shell').focus();const keyboardBefore=await page.locator('#search-shell').boundingBox();
  await page.keyboard.press('Shift+ArrowLeft');await page.waitForTimeout(30);
  assert((await page.locator('#search-shell').boundingBox()).x<keyboardBefore.x-9);
  await page.locator('[data-edge="e"]').focus();const widthBefore=(await page.locator('#search-shell').boundingBox()).width;
  await page.keyboard.press('Shift+ArrowRight');await page.waitForTimeout(30);assert((await page.locator('#search-shell').boundingBox()).width>=widthBefore+9);
  await page.locator('#save-layout').click();await page.locator('body.editing').waitFor({state:'hidden'});
  const savedLayout=(await read(page)).prefs.layout;await page.reload();await page.waitForSelector('html[data-ready="true"]');
  assert.deepEqual((await read(page)).prefs.layout,savedLayout);passed('keyboard move/resize, completion and reload persistence');
  await edit(page);await page.locator('#reset-layout').click();await page.keyboard.press('Escape');
  assert.deepEqual((await read(page)).prefs.layout,savedLayout);passed('reset stays a draft and Escape cancels it');
  await page.setViewportSize({width:320,height:640});await page.addStyleTag({content:':root{font-size:32px}'});await page.waitForFunction(()=>{const r=document.getElementById('search-shell').getBoundingClientRect();return r.width<=288.1&&r.height>=87.9&&r.x>=15&&r.right<=305});
  const narrow=await page.locator('#search-shell').boundingBox();assert(narrow.width<=288.1&&narrow.height>=87.9&&narrow.x>=15&&narrow.x+narrow.width<=305);
  await settings(page);assert.equal(await page.locator('#settings').evaluate(el=>el.getBoundingClientRect().width),320);
  await page.locator('#edit-layout').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'05-narrow-large-text.png')});
  assert(await page.locator('#edit-layout').isVisible());await closeSettings(page);
  await page.setViewportSize({width:1280,height:900});await page.reload();await page.waitForSelector('html[data-ready="true"]');
  assert.deepEqual((await read(page)).prefs.layout,savedLayout);passed('320px / 200% text and viewport restoration without overwriting geometry');
  // Seed only this disposable profile with the exact Sembast v2 IndexedDB shape.
  await page.evaluate(async png=>{
    const r=indexedDB.open('shadow._db',2);r.onupgradeneeded=()=>{r.result.createObjectStore('info');const s=r.result.createObjectStore('entry',{autoIncrement:true});s.createIndex('record',['store','key']);s.createIndex('deleted','deleted',{multiEntry:true})};
    const db=await new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    await new Promise((resolve,reject)=>{const tx=db.transaction(['info','entry'],'readwrite');tx.objectStore('info').put({sembast:1,version:1},'meta');
      const values={engine_option:2,is_jump_to_new_page:true,is_custom_back_img:true,custom_back_img_encode:png,background_overlay_opacity:.32,search_bar_align_option:8,search_bar_length_option:0,box_fit_option:4};
      for(const [key,value]of Object.entries(values))tx.objectStore('entry').add({store:'search_records',key,value});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)});db.close();
    const current=await new Promise((resolve,reject)=>{const r=indexedDB.open('frequency_search_v2');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    await new Promise((resolve,reject)=>{const tx=current.transaction('state','readwrite');tx.objectStore('state').delete('current');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)});current.close();
  },fs.readFileSync(path.join(root,'web/favicon.png')).toString('base64'));
  await page.reload();await page.waitForSelector('html[data-ready="true"]');let migrated=await read(page);
  assert.equal(migrated.prefs.engine,'baidu');assert.equal(migrated.prefs.layout.cx,1);assert.equal(migrated.prefs.layout.width,500);
  assert.equal(migrated.prefs.overlay,.32);assert.equal(migrated.background.type,'image/png');assert(migrated.migrated);
  await page.locator('#background').evaluate(img=>new Promise((resolve,reject)=>{if(img.complete&&img.naturalWidth)resolve();else{img.onload=resolve;img.onerror=reject}}));
  passed('real legacy IndexedDB migration including image, layout and target override');
  await settings(page);await pickStatus(page,path.join(root,'web/icons/Icon-192.png'),'本地背景已保存。');let imageState=await read(page);assert.equal(imageState.background.type,'image/png');
  async function backgroundHash(){return page.evaluate(async()=>{const r=indexedDB.open('frequency_search_v2');const db=await new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});const record=await new Promise(resolve=>{const q=db.transaction('state').objectStore('state').get('current');q.onsuccess=()=>resolve(q.result)});db.close();return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await record.background.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('')})}
  const hash=buffer=>require('node:crypto').createHash('sha256').update(buffer).digest('hex');
  assert.equal(await backgroundHash(),hash(fs.readFileSync(path.join(root,'web/icons/Icon-192.png'))));
  await pickStatus(page,{name:'broken.png',mimeType:'image/png',buffer:Buffer.from('broken')},'图片损坏或不支持。');assert.deepEqual((await read(page)).background,imageState.background);
  const pixels=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=5000;c.height=4000;const ctx=c.getContext('2d');ctx.fillStyle='#164f87';ctx.fillRect(0,0,c.width,c.height);return c.toDataURL('image/png').split(',')[1]});
  const png=Buffer.from(pixels,'base64'),large=Buffer.concat([png,Buffer.alloc(33*1024*1024-png.length)]);
  const originalPath=path.join(output,'original-large.png');fs.writeFileSync(originalPath,large);
  await pickStatus(page,originalPath,'本地背景已保存。');
  await page.waitForFunction(()=>document.getElementById('background').naturalWidth===5000);
  imageState=await read(page);assert.equal(imageState.background.size,large.length);assert.equal(imageState.background.type,'image/png');assert.equal(await backgroundHash(),hash(large));
  assert.match(await page.locator('#background-meta').innerText(),/5000 × 4000/);
  await page.reload();await page.waitForSelector('html[data-ready="true"]');await page.waitForFunction(()=>document.getElementById('background').naturalWidth===5000);
  assert.equal(await backgroundHash(),hash(large));assert.deepEqual((await read(page)).background,imageState.background);await settings(page);
  await page.locator('#background-file').setInputFiles([]);assert.deepEqual((await read(page)).background,imageState.background);
  fs.rmSync(originalPath,{force:true});
  passed('original PNG bytes/format/transparency, 33 MiB / 20 MP dimensions, reload, corrupt input and cancellation');
  await page.evaluate(()=>{const original=IDBDatabase.prototype.transaction;window.qaQuotaTransaction=original;IDBDatabase.prototype.transaction=function(...args){if(this.name==='frequency_search_v2'&&args[1]==='readwrite')throw new DOMException('Full','QuotaExceededError');return original.apply(this,args)}});
  await pickStatus(page,path.join(root,'web/favicon.png'),'本机存储空间不足，原背景已保留。');assert.deepEqual((await read(page)).background,imageState.background);
  await page.evaluate(()=>{IDBDatabase.prototype.transaction=window.qaQuotaTransaction;delete window.qaQuotaTransaction});
  passed('real original-image handler retains prior picture on browser storage quota failure');
  // Abort a real readwrite transaction without adding production test hooks.
  await page.evaluate(()=>{const original=IDBDatabase.prototype.transaction;window.qaOriginalTransaction=original;
    IDBDatabase.prototype.transaction=function(...args){const tx=original.apply(this,args);if(this.name==='frequency_search_v2'&&args[1]==='readwrite')queueMicrotask(()=>tx.abort());return tx}});
  await pickStatus(page,path.join(root,'web/favicon.png'),'背景未保存，已保留原背景。请重试。');assert.deepEqual((await read(page)).background,imageState.background);
  await page.evaluate(()=>{IDBDatabase.prototype.transaction=window.qaOriginalTransaction;delete window.qaOriginalTransaction});
  await pickStatus(page,path.join(root,'web/favicon.png'),'本地背景已保存。');passed('aborted image transaction retains prior state and can retry');
  await page.locator('#overlay').focus();await page.locator('#overlay').press('ArrowRight');await page.waitForTimeout(80);assert((await read(page)).prefs.overlay>.32);
  await closeSettings(page);const persisted=await read(page);await page.close();page=await app();assert.deepEqual(await read(page),persisted);passed('background and preferences persist into a new tab');
  await stop();await launch();await context.setOffline(true);page=await app();assert.deepEqual(await read(page),persisted);passed('browser restart and loading same directory preserve data');
  const manager=await context.newPage();await manager.setViewportSize({width:1280,height:900});await manager.goto(kind==='edge'?'edge://extensions/':'chrome://extensions/');await manager.waitForTimeout(800);
  const item=manager.locator(`extensions-item[id="${extensionId}"]`);
  if(kind==='edge'){const dev=manager.locator('fluent-switch#dev-switch:visible').first();if(!await dev.evaluate(el=>el.checked===true))await dev.click();await manager.getByText('重新加载',{exact:true}).click()}
  else{const dev=manager.locator('extensions-toolbar #devMode');if(!await dev.evaluate(el=>el.checked===true))await dev.click();await item.locator('#dev-reload-button').click()}
  await page.close();page=await app();assert.deepEqual(await read(page),persisted);passed('extension-manager reload preserves migrated state');
  await settings(page);await page.locator('#reset-all').click();await page.waitForFunction(text=>document.getElementById('settings-status').textContent===text,'已恢复默认设置。');await closeSettings(page);
  await page.reload();await page.waitForSelector('html[data-ready="true"]');assert.equal((await read(page)).prefs.engine,'bing');assert.equal((await read(page)).background,null);assert.equal((await read(page)).prefs.newTab,false);passed('reset keeps migration marker and never resurrects legacy data');
  // New feature coverage uses disposable data and controlled permission responses.
  await page.emulateMedia({colorScheme:'dark'});
  assert.equal(await page.locator('html').getAttribute('data-theme'),'auto');
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(32, 33, 36)');
  await page.emulateMedia({colorScheme:'light'});
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(248, 249, 250)');
  await settings(page);await page.locator('#theme').selectOption('light');await page.emulateMedia({colorScheme:'dark'});
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(248, 249, 250)');
  await page.locator('#theme').selectOption('auto');await closeSettings(page);await page.emulateMedia({colorScheme:'light'});
  passed('auto theme responds live to system changes; explicit choice takes priority');
  await settings(page,'search');await page.getByText('自定义搜索引擎',{exact:true}).click();await page.locator('#add-engine').click();
  await page.locator('#item-name').fill('自定义测试');await page.locator('#item-url').fill('https://example.test/find/%s?mode=web');await page.locator('#save-item').click();
  await page.locator('#item-dialog').waitFor({state:'hidden'});assert.equal((await read(page)).prefs.customEngines.length,1);
  await closeSettings(page);await page.locator('#query').fill('内容保留🙂 &/#%');await page.locator('#engine-button').click();
  assert.equal(await page.getByRole('menuitemradio').count(),36);await page.locator('#engine-filter').fill('自定义测试');
  assert.equal(await page.getByRole('menuitemradio').count(),1);await page.locator('#engine-filter').press('ArrowDown');await page.keyboard.press('Enter');
  assert.equal(await page.locator('#query').inputValue(),'内容保留🙂 &/#%');assert.match(await page.locator('#engine-button').getAttribute('aria-label'),/自定义测试/);
  await context.setOffline(false);await context.route('https://example.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<title>Custom search test</title>'}));
  await page.locator('#query').press('Enter');await page.waitForURL('https://example.test/find/**');
  assert.equal(decodeURIComponent(new URL(page.url()).pathname.slice('/find/'.length)),'内容保留🙂 &/#%');
  await page.close();await context.setOffline(true);page=await app();await settings(page,'search');await page.getByText('自定义搜索引擎',{exact:true}).click();await page.getByRole('button',{name:'编辑搜索引擎 自定义测试',exact:true}).click();
  await page.locator('#item-url').fill('javascript:alert(%s)');await page.locator('#save-item').click();assert(await page.locator('#item-status').innerText());
  assert.match((await read(page)).prefs.customEngines[0].template,/example.test/);
  await page.locator('#item-url').fill('https://example.test/search?q={query}');await page.locator('#save-item').click();await page.locator('#item-dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'编辑搜索引擎 自定义测试',exact:true}).click();await page.locator('#delete-item').click();await page.locator('#item-dialog').waitFor({state:'hidden'});
  assert.equal((await read(page)).prefs.engine,'bing');assert.equal((await read(page)).prefs.customEngines.length,0);await closeSettings(page);
  passed('35-provider filtering, custom engine add/edit/delete, safe URLs and active-engine fallback');
  const demo=[['GitHub','https://github.com/'],['维基百科','https://zh.wikipedia.org/'],['YouTube','https://www.youtube.com/'],['哔哩哔哩','https://www.bilibili.com/'],['MDN','https://developer.mozilla.org/'],['知乎','https://www.zhihu.com/'],['豆瓣','https://www.douban.com/'],['Google 学术','https://scholar.google.com/'],['PubMed','https://pubmed.ncbi.nlm.nih.gov/']];
  for(const [title,url] of demo){await page.locator('#add-shortcut').click();await page.locator('#item-name').fill(title);await page.locator('#item-url').fill(url);await page.locator('#save-item').click();await page.locator('#item-dialog').waitFor({state:'hidden'})}
  await page.locator('#query').fill('');await page.mouse.click(30,120);
  assert.equal((await read(page)).shortcuts.length,9);await page.screenshot({path:path.join(output,'06-shortcuts.png')});
  await page.setViewportSize({width:320,height:640});await page.addStyleTag({content:':root{font-size:32px}'});
  await page.locator('#add-shortcut').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'08-narrow-shortcuts.png')});
  const linkBounds=await page.locator('#shortcuts').boundingBox();assert(linkBounds.x>=0&&linkBounds.x+linkBounds.width<=320&&linkBounds.y+linkBounds.height<=640);
  await page.locator('#add-shortcut').click();await page.locator('#cancel-item').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'09-narrow-dialog.png')});
  await page.locator('#cancel-item').click();await page.setViewportSize({width:1280,height:900});await page.reload();await page.waitForSelector('html[data-ready="true"]');
  assert.equal((await read(page)).shortcuts.length,9);passed('shortcut rows and edit dialog remain reachable at 320px and 200% text');
  const beforeOrder=(await read(page)).shortcuts.map(e=>e.id);
  await page.locator('.shortcut').first().dragTo(page.locator('.shortcut').nth(2));
  await page.waitForFunction(()=>document.querySelector('.shortcut-title').textContent==='维基百科');assert.notDeepEqual((await read(page)).shortcuts.map(e=>e.id),beforeOrder);
  const first=(await read(page)).shortcuts[0];await page.locator('.shortcut a').first().focus();await page.keyboard.press('Alt+ArrowRight');
  await page.waitForFunction(title=>document.querySelectorAll('.shortcut-title')[1].textContent===title,first.title);
  await page.getByRole('button',{name:'编辑快捷链接 GitHub',exact:true}).click();await page.locator('#item-name').fill('代码');await page.locator('#save-item').click();await page.locator('#item-dialog').waitFor({state:'hidden'});
  await page.getByRole('link',{name:'代码',exact:true}).waitFor();
  await page.getByRole('button',{name:'编辑快捷链接 代码',exact:true}).click();await page.locator('#move-earlier').click();await page.locator('#item-dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'编辑快捷链接 代码',exact:true}).click();await page.locator('#delete-item').click();await page.locator('#item-dialog').waitFor({state:'hidden'});
  assert.equal((await read(page)).shortcuts.length,8);
  await page.locator('#add-shortcut').click();await page.locator('#item-url').fill('javascript:alert(1)');await page.locator('#save-item').click();assert(await page.locator('#item-status').innerText());await page.keyboard.press('Escape');
  assert.equal((await read(page)).shortcuts.length,8);
  passed('shortcut add/edit/delete, drag ordering, keyboard ordering, cancellation and safe addresses');
  await page.evaluate(()=>{window.qaTx=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args){const tx=window.qaTx.apply(this,args);if(this.name==='frequency_search_v2'&&args[1]==='readwrite')queueMicrotask(()=>tx.abort());return tx}});
  await page.locator('#add-shortcut').click();await page.locator('#item-url').fill('https://failure.test');await page.locator('#save-item').click();await page.getByText('未保存，已保留原数据。请重试。',{exact:true}).last().waitFor();assert.equal((await read(page)).shortcuts.length,8);
  await page.evaluate(()=>{IDBDatabase.prototype.transaction=window.qaTx;delete window.qaTx});await page.locator('#cancel-item').click();
  passed('failed shortcut transaction keeps original list and edit dialog open');
  await settings(page,'shortcuts');
  await page.evaluate(()=>{
    window.qaPermission={request:chrome.permissions.request,remove:chrome.permissions.remove,topSites:chrome.topSites,calls:[],mode:'denied'};
    chrome.permissions.request=async arg=>{qaPermission.calls.push(['request',arg]);return qaPermission.mode!=='denied'};
    chrome.permissions.remove=async arg=>{qaPermission.calls.push(['remove',arg]);return true};
    chrome.topSites={get:async()=>{qaPermission.calls.push(['get']);if(qaPermission.mode==='failed')throw new Error('读取失败，请重试。');return [{title:'MDN',url:'https://developer.mozilla.org/'},{title:'Example',url:'https://example.test/'},{title:'Internal',url:'chrome://settings'}]}};
  });
  await page.locator('#import-sites').click();await page.getByText('未获得读取授权，可以手动添加或稍后重试。',{exact:true}).waitFor();assert.equal((await read(page)).topSitesImported,false);
  await page.evaluate(()=>qaPermission.mode='failed');await page.locator('#import-sites').click();await page.getByText('导入失败，请稍后重试。',{exact:true}).waitFor();assert.equal((await read(page)).topSitesImported,false);
  await page.evaluate(()=>qaPermission.mode='ok');await page.locator('#import-sites').click();await page.getByText('已导入 1 个常用网站，之后可在本页独立编辑。',{exact:true}).waitFor();
  assert.equal((await read(page)).shortcuts.length,9);assert.equal((await read(page)).topSitesImported,true);assert(await page.locator('#import-sites').isDisabled());
  assert.equal(await page.evaluate(()=>qaPermission.calls.filter(e=>e[0]==='remove').length),2);
  await page.evaluate(()=>{chrome.permissions.request=qaPermission.request;chrome.permissions.remove=qaPermission.remove;chrome.topSites=qaPermission.topSites;delete window.qaPermission});
  await closeSettings(page);const featureState=await read(page);await page.reload();await page.waitForSelector('html[data-ready="true"]');assert.deepEqual(await read(page),featureState);
  await stop();await launch();await context.setOffline(true);page=await app();assert.deepEqual(await read(page),featureState);
  await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:path.join(output,'07-shortcuts-dark.png')});await page.emulateMedia({colorScheme:'light'});
  await settings(page,'shortcuts');assert(await page.locator('#import-sites').isDisabled());await page.locator('#reset-all').click();await page.waitForFunction(text=>document.getElementById('settings-status').textContent===text,'已恢复默认设置。');assert.equal((await read(page)).topSitesImported,true);assert.equal((await read(page)).shortcuts.length,0);await closeSettings(page);
  passed('import denial/failure/retry, deduplication, permission removal and one-time marker through restart/reset (controlled permission fixture)');
  // Browser restart invalidates the old manager target; bind this profile again.
  const featureManager=await context.newPage();await featureManager.goto(kind==='edge'?'edge://extensions/':'chrome://extensions/');await featureManager.waitForTimeout(500);
  await context.setOffline(false);await context.route(/^https:\/\/(www\.)?(bing\.com|google\.com|baidu\.com)\//,r=>r.fulfill({status:200,contentType:'text/html',body:'<title>Search test</title>'}));
  for(const [engine,host,parameter]of [['Bing','www.bing.com','q'],['Google','www.google.com','q'],['百度','www.baidu.com','wd']]){
    await selectEngine(page,engine);await page.locator('#query').fill('中文🙂 & + # %');
    await page.locator('#query').press('Enter');await page.waitForURL(`https://${host}/**`);const url=new URL(page.url());assert.equal(url.searchParams.get(parameter),'中文🙂 & + # %');assert.equal(url.hash,'');await page.close();page=await app();
  }passed('all three engines, real input and Enter navigation preserve special characters');
  await page.locator('#query').fill('中文组合输入');await page.locator('#query').dispatchEvent('compositionstart');await page.locator('#query').press('Enter');assert(page.url().startsWith('chrome-extension:'));await page.locator('#query').dispatchEvent('compositionend');passed('composition Enter does not submit prematurely');
  await settings(page,'search');await page.locator('#new-tab').check();await closeSettings(page);await page.locator('#query').fill('new tab test');
  const popup=context.waitForEvent('page');popup.catch(()=>{});await page.locator('#query').press('Enter');const result=await popup;await result.waitForURL(/^https:/);assert(page.url().startsWith('chrome-extension:'));passed('new-tab search keeps original page');
  if(kind==='edge')await featureManager.locator('fluent-switch.toggle-switch[aria-label="开启 频率搜索 · 新标签页"]').click();else await featureManager.locator(`extensions-item[id="${extensionId}"]`).locator('#enableToggle').click();
  // Creating a native target directly avoids Edge's same-URL navigation event quirk.
  const nativeSession=await browser.newBrowserCDPSession();
  const {targetId:nativeTarget}=await nativeSession.send('Target.createTarget',{url:newtab});
  const {targetInfo:nativeInfo}=await nativeSession.send('Target.getTargetInfo',{targetId:nativeTarget});
  assert(/^(edge|chrome):/.test(nativeInfo.url),nativeInfo.url);
  passed('disabling restores browser ownership of a new-tab target');
  await nativeSession.send('Extensions.uninstall', {id:extensionId});
  const removed = await nativeSession.send('Target.createTarget', {url:newtab});
  const removedInfo = await nativeSession.send('Target.getTargetInfo', {targetId:removed.targetId});
  assert(/^(edge|chrome):/.test(removedInfo.targetInfo.url));
  passed('uninstall removes override and restores a native new-tab target');
  assert(external.every(url=>url.startsWith('https://cdn.jsdelivr.net/npm/simple-icons@')));assert.deepEqual(errors,[]);assert.equal(resources.some(url=>/\.(woff2?|ttf|otf|wasm)(\?|$)/.test(url)),false);passed('no runtime errors or font/WASM downloads; only fixed icon CDN requests');
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({version:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,browser:await browser.version(),extensionId,checks,errors,external},null,2));
 }catch(error){console.error('CHECK FAILED:',error);if(activePage&&!activePage.isClosed()&&activePage.url().startsWith('chrome-extension:')){await activePage.screenshot({path:path.join(output,'failure.png'),timeout:5000}).catch(()=>{});console.error(await activePage.locator('body').ariaSnapshot().catch(()=>''))}throw error}
 finally{await stop();fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});fs.rmSync(path.join(output,'oversized.png'),{force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
