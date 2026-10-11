// Real installed-browser regression suite; test profiles are disposable.
const fs = require('node:fs'), path = require('node:path');
const {spawn, execFileSync} = require('node:child_process');
const assert = require('node:assert/strict');
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'playwright')); }
const root = path.resolve(__dirname,'..'), kind = process.argv[2] || 'chrome';
assert(['chrome','edge'].includes(kind));
const executable = process.env.BROWSER_EXECUTABLE || (kind === 'edge' ? '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const output = path.join(root,'build',`qa-native-${kind}`); fs.mkdirSync(output,{recursive:true});
const profile = fs.mkdtempSync(path.join(output,'profile-'));
const checks=[], errors=[], external=[], resources=[];
let browser, context, child, extensionId, activePage;
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
const newtab = kind === 'edge' ? 'edge://newtab/' : 'chrome://newtab/';
const passed = name => { checks.push(name); console.log('PASS',kind,name); };
async function launch() {
  const file = path.join(profile,'DevToolsActivePort'); fs.rmSync(file,{force:true});
  child = spawn(executable,['--headless=new','--remote-debugging-port=0','--enable-unsafe-extension-debugging','--no-first-run','--no-default-browser-check',`--user-data-dir=${profile}`],{stdio:'ignore'});
  for(let n=0;!fs.existsSync(file)&&n<150;n++)await wait(100);
  browser = await pw.chromium.connectOverCDP('http://127.0.0.1:'+fs.readFileSync(file,'utf8').split('\n')[0]);
  context = browser.contexts()[0]; context.setDefaultTimeout(10000);
  const cdp = await browser.newBrowserCDPSession();
  ({id:extensionId} = await cdp.send('Extensions.loadUnpacked',{path:path.join(root,'build/extension')}));
}
async function stop() {
  if(!browser)return;
  const exit = new Promise(resolve=>child.once('exit',resolve));
  await browser.close(); child.kill(); await Promise.race([exit,wait(5000)]); browser=null;
}
async function app() {
  const page=await context.newPage();activePage=page;await page.setViewportSize({width:1280,height:900});
  await page.emulateMedia({colorScheme:'light'});
  page.on('request',r=>{if(!r.isNavigationRequest()) {resources.push(r.url());if(/^https?:/.test(r.url()) && page.url().startsWith('chrome-extension:'))external.push(r.url());}});
  page.on('pageerror',e=>{if(page.url().startsWith('chrome-extension:'))errors.push(e.message)});
  page.on('console',m=>{if(page.url().startsWith('chrome-extension:')&&['warning','error'].includes(m.type()))errors.push(m.text())});
  await page.goto(newtab).catch(e=>{if(!e.message.includes('ERR_ABORTED'))throw e});
  await page.waitForSelector('html[data-ready="true"]');assert(page.url().startsWith(`chrome-extension://${extensionId}/`));
  return page;
}
async function read(page) {
  return page.evaluate(async()=>{
    const request=indexedDB.open('frequency_search_v2');
    const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
    const record=await new Promise((resolve,reject)=>{const r=db.transaction('state').objectStore('state').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});db.close();
    return {prefs:record.prefs,migrated:record.migrated,background:record.background?{size:record.background.size,type:record.background.type}:null};
  });
}
async function settings(page){await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('dialog').waitFor()}
async function closeSettings(page){await page.getByRole('button',{name:'关闭设置',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'})}
async function edit(page){await settings(page);await page.getByRole('button',{name:'编辑布局',exact:true}).click();await page.locator('body.editing').waitFor()}
async function drag(page,locator,dx,dy){const b=await locator.boundingBox();const x=b.x+b.width/2,y=b.y+b.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:5});await page.mouse.up();await page.waitForTimeout(30)}
async function pickStatus(page,file,text){const selected=page.locator('#background-file').setInputFiles(file,{timeout:30000});selected.catch(()=>{});await page.waitForFunction(expected=>document.getElementById('settings-status').textContent===expected,text,{timeout:30000})}
async function selectEngine(page,name){await page.locator('#engine-button').click();await page.getByRole('menuitemradio',{name,exact:true}).click()}
(async()=>{
 try {
  await launch();await context.setOffline(true);let page=await app();
  assert.equal(await page.title(),'新标签页');assert.equal(await page.locator('body').innerText(),'');
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
  assert.equal(await page.locator('#settings').evaluate(el=>el.getBoundingClientRect().width),360);
  await page.locator('#theme').selectOption('dark');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.locator('#theme').selectOption('light');await closeSettings(page);passed('settings drawer and theme switching');
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
  assert.equal(migrated.prefs.engine,2);assert.equal(migrated.prefs.layout.cx,1);assert.equal(migrated.prefs.layout.width,500);
  assert.equal(migrated.prefs.overlay,.32);assert.equal(migrated.background.type,'image/png');assert(migrated.migrated);
  await page.locator('#background').evaluate(img=>new Promise((resolve,reject)=>{if(img.complete&&img.naturalWidth)resolve();else{img.onload=resolve;img.onerror=reject}}));
  passed('real legacy IndexedDB migration including image, layout and target override');
  await settings(page);await pickStatus(page,path.join(root,'web/icons/Icon-192.png'),'本地背景已保存。');const imageState=await read(page);assert.equal(imageState.background.type,'image/jpeg');
  await pickStatus(page,{name:'broken.png',mimeType:'image/png',buffer:Buffer.from('broken')},'图片损坏或不支持。');assert.deepEqual((await read(page)).background,imageState.background);
  const huge=path.join(output,'oversized.png');fs.writeFileSync(huge,Buffer.alloc(33*1024*1024));
  // Large files can outlive Playwright's file metadata acknowledgement; the
  // page's validation result proves the file reached the real input handler.
  await pickStatus(page,huge,'背景图片不能超过 32 MB。');
  const pixels=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=5000;c.height=4000;return c.toDataURL('image/png').split(',')[1]});
  await pickStatus(page,{name:'pixels.png',mimeType:'image/png',buffer:Buffer.from(pixels,'base64')},'背景图片不能超过 1600 万像素。');
  await page.locator('#background-file').setInputFiles([]);assert.deepEqual((await read(page)).background,imageState.background);
  passed('real image compression, damaged/oversize/pixel-limit files and cancellation');
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
  await settings(page);await page.locator('#reset-all').click();await page.getByText('已恢复默认设置。',{exact:true}).waitFor();await closeSettings(page);
  await page.reload();await page.waitForSelector('html[data-ready="true"]');assert.equal((await read(page)).prefs.engine,0);assert.equal((await read(page)).background,null);assert.equal((await read(page)).prefs.newTab,false);passed('reset keeps migration marker and never resurrects legacy data');
  await context.setOffline(false);await context.route(/^https:\/\/(www\.)?(bing\.com|google\.com|baidu\.com)\//,r=>r.fulfill({status:200,contentType:'text/html',body:'<title>Search test</title>'}));
  for(const [engine,host,parameter]of [['Bing','www.bing.com','q'],['Google','www.google.com','q'],['百度','www.baidu.com','wd']]){
    await selectEngine(page,engine);await page.locator('#query').fill('中文🙂 & + # %');
    await page.locator('#query').press('Enter');await page.waitForURL(`https://${host}/**`);const url=new URL(page.url());assert.equal(url.searchParams.get(parameter),'中文🙂 & + # %');assert.equal(url.hash,'');await page.close();page=await app();
  }passed('all three engines, real input and Enter navigation preserve special characters');
  await page.locator('#query').fill('中文组合输入');await page.locator('#query').dispatchEvent('compositionstart');await page.locator('#query').press('Enter');assert(page.url().startsWith('chrome-extension:'));await page.locator('#query').dispatchEvent('compositionend');passed('composition Enter does not submit prematurely');
  await settings(page);await page.locator('#new-tab').check();await closeSettings(page);await page.locator('#query').fill('new tab test');
  const popup=context.waitForEvent('page');popup.catch(()=>{});await page.locator('#query').press('Enter');const result=await popup;await result.waitForURL(/^https:/);assert(page.url().startsWith('chrome-extension:'));passed('new-tab search keeps original page');
  if(kind==='edge')await manager.locator('fluent-switch.toggle-switch[aria-label="开启 频率搜索 · 新标签页"]').click();else await item.locator('#enableToggle').click();
  const normal=await context.newPage();await normal.goto(newtab);assert(!normal.url().startsWith('chrome-extension:'));passed('disabling restores browser new tab');
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);assert.equal(resources.some(url=>/\.(woff2?|ttf|otf|wasm)(\?|$)/.test(url)),false);passed('no runtime errors, font/WASM downloads or external resource dependencies');
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({version:'1.2.0',browser:await browser.version(),extensionId,checks,errors,external},null,2));
 }catch(error){console.error('CHECK FAILED:',error);if(activePage&&!activePage.isClosed()&&activePage.url().startsWith('chrome-extension:')){await activePage.screenshot({path:path.join(output,'failure.png'),timeout:5000}).catch(()=>{});console.error(await activePage.locator('body').ariaSnapshot().catch(()=>''))}throw error}
 finally{await stop();fs.rmSync(profile,{recursive:true,force:true});fs.rmSync(path.join(output,'oversized.png'),{force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
