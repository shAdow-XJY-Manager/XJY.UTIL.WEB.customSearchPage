import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePrefs } from '../native/model.js';
import { isVideo, validateVideo, videoLimit } from '../native/media.js';
test('legacy colors migrate independently without losing chosen values', () => {
 const p=normalizePrefs({customColor:true,imageTheme:true,colors:{field:0xff123456}});
 assert.equal(p.pageMode,'solid'); assert.equal(p.colorModes.field,'custom'); assert.equal(p.colors.field,0xff123456);
 const disabled=normalizePrefs({customColor:false,imageTheme:true,colors:{field:0xff123456}});
 assert.equal(disabled.pageMode,'ambient'); assert.equal(disabled.colorModes.field,'auto');assert.equal(disabled.colors.field,0xff123456);
});
test('ambient mode and custom component colors coexist after normalization',()=>{
 const p=normalizePrefs({pageMode:'ambient',colorModes:{field:'custom',text:'auto'},colors:{field:0xffabcdef}});
 assert.equal(p.pageMode,'ambient');assert.equal(p.colorModes.field,'custom');assert.equal(p.colorModes.text,'auto');
 assert.deepEqual(normalizePrefs(p),p);
});
test('video detection and size/format gates run before decoding',async()=>{
 assert(isVideo({name:'loop.MP4',type:''}));assert(!isVideo({name:'wallpaper.gif',type:'image/gif'}));
 await assert.rejects(validateVideo({name:'loop.webm',type:'video/webm',size:videoLimit+1}),/100 MiB/);
 await assert.rejects(validateVideo({name:'movie.mov',type:'video/quicktime',size:20}),/MP4/);
});
