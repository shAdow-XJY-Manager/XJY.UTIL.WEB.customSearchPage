import test from 'node:test';
import assert from 'node:assert/strict';
import { backgroundSaveError } from '../native/background.js';
test('a browser quota failure reports local storage pressure and retains the existing picture', () => {
  assert.equal(backgroundSaveError(new DOMException('Full', 'QuotaExceededError')), '本机存储空间不足，原背景已保留。');
  assert.equal(backgroundSaveError(new Error('abort')), '背景未保存，已保留原背景。请重试。');
});
