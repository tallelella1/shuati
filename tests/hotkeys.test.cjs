const test = require('node:test');
const assert = require('node:assert/strict');
const { readHotkeys, recordKey, matchHotkey, actionForOption } = require('../src/hotkeys.cjs');

test('existing saves get numeric defaults and judgment keys follow meaning, not order', () => {
  const keys = readHotkeys();
  assert.deepEqual([keys.A, keys.B, keys.C, keys.D, keys.E], ['1', '2', '3', '4', '']);
  assert.equal(keys.previous, 'ArrowLeft');
  assert.equal(keys.next, 'ArrowRight');
  assert.equal(keys.grade, 'Enter');
  assert.equal(actionForOption('multiple', 'C'), 'C');
  assert.equal(actionForOption('judge', 'T'), 'A');
  assert.equal(actionForOption('judge', 'F'), 'B');
});

test('custom bindings override defaults, including an explicitly unbound action', () => {
  const keys = readHotkeys({ A: 'Shift+Q', B: '' });
  assert.equal(matchHotkey(keys, { key: 'Q', shiftKey: true }), 'A');
  assert.equal(matchHotkey(keys, { key: 'q' }), undefined);
  assert.equal(matchHotkey(keys, { key: '1' }), undefined);
  assert.equal(matchHotkey(keys, { key: '2' }), undefined);
  assert.equal(matchHotkey(keys, { key: '3', code: 'Numpad3' }), 'C');
});

test('key recording ignores repeats, composing, modifiers alone and browser navigation keys', () => {
  assert.equal(recordKey({ key: '4', repeat: true }), '');
  assert.equal(recordKey({ key: 'a', isComposing: true }), '');
  assert.equal(recordKey({ key: 'Enter', keyCode: 229 }), '');
  assert.equal(recordKey({ key: 'Control', ctrlKey: true }), '');
  assert.equal(recordKey({ key: 'Tab' }), '');
  assert.equal(recordKey({ key: 'Escape' }), '');
  assert.equal(recordKey({ key: 'q', ctrlKey: true, altKey: true, getModifierState: key => key === 'AltGraph' }), '');
  assert.equal(recordKey({ key: 'q', altKey: true, shiftKey: true }), 'Alt+Shift+Q');
});
