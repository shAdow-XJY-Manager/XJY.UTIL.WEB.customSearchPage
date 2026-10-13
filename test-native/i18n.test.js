import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { languages, catalogRows, aliases, resolveLanguage, translate, hasTranslation, setLanguage, engineLabel } from '../native/i18n.js';
import { normalizePrefs, defaults } from '../native/model.js';

test('all 16 locales have complete messages and matching interpolation tokens', () => {
  assert.equal(languages.length, 16); assert.equal(new Set(catalogRows.map(row => row[0])).size, catalogRows.length);
  const tokens = text => [...new Set(text.match(/\{\w+\}|%s/g) || [])].sort();
  for (const [key, ...translations] of catalogRows) {
    assert.equal(translations.length, 15, key);
    for (const text of translations) { assert(text.trim(), key); assert.deepEqual(tokens(text), tokens(key), key); }
  }
  for (const target of Object.values(aliases)) assert(catalogRows.some(row => row[0] === target));
});
test('browser language matching covers scripts, regions, preferences and English fallback', () => {
  for (const [code, expected] of [['zh-HK','zh-TW'],['zh-Hant','zh-TW'],['zh-Hans-HK','zh-CN'],['zh-SG','zh-CN'],['en-GB','en'],['pt-BR','pt'],['fr-CA','fr'],['ar-EG','ar']]) assert.equal(resolveLanguage('auto',[code]),expected);
  assert.equal(resolveLanguage('auto',['nl-NL','de-DE']),'de');
  assert.equal(resolveLanguage('auto',['nl-NL']),'en'); assert.equal(resolveLanguage('auto',[]),'en');
  assert.equal(resolveLanguage('ja',['en-US']),'ja');
});
test('language defaults and existing preferences normalize without changing other user choices', () => {
  assert.equal(defaults().language,'auto'); assert.equal(normalizePrefs({language:'invalid'}).language,'auto');
  const prefs=normalizePrefs({language:'ar',engine:'google',theme:'dark',newTab:false});
  assert.equal(prefs.language,'ar'); assert.equal(prefs.engine,'google'); assert.equal(prefs.theme,'dark'); assert.equal(prefs.newTab,false);
});
test('every static UI text and accessible annotation is translated', () => {
  const html=readFileSync(new URL('../native/index.html',import.meta.url),'utf8');
  for(const match of html.matchAll(/data-i18n(?:-[\w-]+)?="([^"]+)"/g)) assert(hasTranslation(match[1]),match[1]);
});
test('interpolation preserves user text and literal URL placeholders', () => {
  const name='<b>我的引擎</b> العربية';
  assert.equal(translate('编辑搜索引擎 {name}','en',{name}),`Edit search engine ${name}`);
  assert.match(translate('搜索网址需包含一个 %s 或 {query}。','fr'),/%s.*\{query\}/);
  assert.equal(translate('已保存。','unknown'),'Saved.');
});
test('built-in names localize while custom engine names remain untouched', () => {
  setLanguage('en'); assert.equal(engineLabel({id:'baidu',name:'百度'}),'Baidu');
  assert.equal(engineLabel({id:'custom-baidu',name:'百度'}),'百度');
  setLanguage('zh-TW'); assert.equal(engineLabel({id:'douban',name:'豆瓣电影'}),'豆瓣電影');
  setLanguage('zh-CN');
});
