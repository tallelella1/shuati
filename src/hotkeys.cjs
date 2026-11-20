const DEFAULT_HOTKEYS = Object.freeze({
  A: '1', B: '2', C: '3', D: '4', E: '', F: '', G: '', H: '',
  previous: 'ArrowLeft', next: 'ArrowRight', grade: 'Enter',
});
const MODIFIERS = [['Ctrl', 'ctrlKey'], ['Alt', 'altKey'], ['Shift', 'shiftKey'], ['Meta', 'metaKey']];
const NAMED_KEYS = new Set(['Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

function readHotkeys(saved) {
  return Object.fromEntries(Object.entries(DEFAULT_HOTKEYS).map(([action, key]) => [
    action, typeof saved?.[action] === 'string' ? saved[action] : key,
  ]));
}

function recordKey(event) {
  if (event.isComposing || event.keyCode === 229 || event.repeat || event.getModifierState?.('AltGraph')) return '';
  const key = event.key;
  if (!NAMED_KEYS.has(key) && !/^[a-z0-9]$/i.test(key ?? '')) return '';
  const modifiers = MODIFIERS.filter(([, field]) => event[field]).map(([name]) => name);
  return [...modifiers, key.length === 1 ? key.toUpperCase() : key].join('+');
}

function matchHotkey(hotkeys, event) {
  const key = recordKey(event);
  return key ? Object.keys(hotkeys).find(action => hotkeys[action] === key) : undefined;
}

function actionForOption(type, key) {
  if (type === 'judge') return key === 'T' ? 'A' : 'B';
  return key;
}

function keyLabel(key) {
  const arrows = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' };
  return key.split('+').map(part => arrows[part] ?? part).join('+');
}

module.exports = { readHotkeys, recordKey, matchHotkey, actionForOption, keyLabel };
