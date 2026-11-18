const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePaper, isCorrect } = require('../src/parser.cjs');

function question(number, type = '单选') {
  const choices = type === '判断' ? '- T. 正确\n- F. 错误\n答案：T' : `- A. 甲\n- B. 乙\n- C. 丙\n答案：${type === '多选' ? 'ABC' : 'A'}`;
  return `## ${number} · 基础 · ${type}\n题干 ${number}\n\n| 年份 | 产量 |\n| --- | --- |\n| 2025 | 90 |\n\n${choices}\n解析：第一行\n\n第二行\n`;
}

const paper = (...blocks) => '# 离线样卷\n\n' + blocks.join('\n');

test('90 题不截断，保留原题号、原顺序和 Markdown', () => {
  const text = paper(...Array.from({ length: 90 }, (_, i) => question(i + 11, ['单选', '多选', '判断'][i % 3])));
  const result = parsePaper('\uFEFF' + text.replace(/\n/g, '\r\n'));
  assert.deepEqual(result.issues, []);
  assert.equal(result.title, '离线样卷');
  assert.deepEqual(result.questions.map(q => q.number), Array.from({ length: 90 }, (_, i) => i + 11));
  assert.match(result.questions[0].stem, /\| 2025 \| 90 \|/);
  assert.equal(result.questions[1].explanation, '第一行\n\n第二行');
  assert.deepEqual(result.questions[2].answers, ['T']);
});

test('导入报错定位到题号和行，拒绝重复题号、坏答案和缺答案', () => {
  const result = parsePaper(paper(question(1), question(1), question(3).replace('答案：A', '答案：A 或 D'), question(4).replace('答案：A\n', '')));
  assert.deepEqual(result.issues.map(issue => issue.number), [1, 3, 4]);
  assert.ok(result.issues.every(issue => issue.line > 0));
  assert.match(result.issues[0].message, /重复/);
});

test('兼容示例 A/B 判断题，保留图片选项；多选按集合判分', () => {
  const result = parsePaper(paper('## 2 | 常识 | 判断\n这是一道判断题。\n- A. 正确\n- B. 错误\n答案：A', question(9, '多选').replace('- A. 甲', '- A. ![[图表.png]]')));
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.questions[0].answers, ['T']);
  assert.equal(result.questions[1].options[0].text, '![[图表.png]]');
  assert.equal(isCorrect(result.questions[1], ['C', 'B', 'A']), true);
  assert.equal(isCorrect(result.questions[1], ['A', 'B']), false);
  assert.equal(isCorrect(result.questions[1], ['A', 'A', 'B']), false);
});

module.exports = { question, paper };
