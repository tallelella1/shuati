const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePaper } = require('../src/parser.cjs');
const { resolvePaperMedia } = require('../src/media.cjs');
const state = require('../src/study.cjs');
const source = '# 样卷\n## 7 · 资料分析 · 单选\n题干\n- A. 甲\n- B. 乙\n答案：A\n解析：原解析';
const parse = text => parsePaper(text);
const open = () => {
  const data = state.newData();
  const paper = state.importPaper(data, '卷.md', parse(source));
  return { data, paper, question: paper.questionIds[0] };
};

test('同卷重导入、修改解析保留记录，改答案产生独立版本', () => {
  const { data, paper, question } = open();
  state.record(data, question, ['B']);
  const again = state.importPaper(data, '卷.md', parse(source.replace('原解析', '新解析')));
  assert.equal(again.id, paper.id);
  assert.equal(again.questionIds[0], question);
  assert.equal(data.progress[question].wrongCount, 1);
  const changed = state.importPaper(data, '卷.md', parse(source.replace('答案：A', '答案：B')));
  assert.notEqual(changed.questionIds[0], question);
  assert.deepEqual(state.pickQuestions(data, { kind: 'wrong' }), []);
  assert.equal(data.versions[question].answers[0], 'A');
});

test('离开并恢复模考，交卷评分一次，未答题与错题分离，重刷答对后保留累计错次', () => {
  let { data, paper, question } = open();
  const full = state.importPaper(data, '卷.md', parse(source + '\n' + source.slice(source.indexOf('##')).replace('## 7', '## 8')));
  const second = full.questionIds[1];
  const exam = state.startSession(data, { mode: 'exam', kind: 'paper', paperId: paper.id, title: paper.title }, full.questionIds, 10, 1000);
  state.setSelection(data, exam.id, question, ['B'], 2000);
  data.sessions[exam.id].cursor = 1;
  data = JSON.parse(JSON.stringify(data));
  assert.equal(data.sessions[exam.id].cursor, 1);
  assert.equal(data.sessions[exam.id].deadline, 601000);
  assert.deepEqual(data.sessions[exam.id].selected[question], ['B']);
  state.submit(data, exam.id, 3000);
  state.submit(data, exam.id, 4000);
  assert.deepEqual(data.sessions[exam.id].results, { [question]: 'wrong', [second]: 'unanswered' });
  assert.equal(data.progress[question].wrongCount, 1);
  assert.equal(data.progress[second], undefined);
  assert.deepEqual(state.pickQuestions(data, { kind: 'wrong' }), [question]);
  state.record(data, question, ['A']);
  assert.deepEqual(state.pickQuestions(data, { kind: 'wrong' }), []);
  assert.equal(data.progress[question].wrongCount, 1);
});

test('删除单条未完成记录，保留已提交的错题与收藏，旧页面操作不会恢复记录', () => {
  const { data, paper, question } = open();
  const practice = state.startSession(data, { mode: 'practice' }, paper.questionIds);
  const pending = state.startSession(data, { mode: 'exam' }, paper.questionIds, 1);
  const completed = state.startSession(data, { mode: 'practice' }, paper.questionIds);
  state.setSelection(data, practice.id, question, ['B']);
  state.grade(data, practice.id, question);
  state.toggleBookmark(data, question);
  state.submit(data, completed.id);
  const progress = { ...data.progress[question] };

  state.deleteSession(data, practice.id);
  state.deleteSession(data, practice.id);
  state.setSelection(data, practice.id, question, ['A']);
  state.grade(data, practice.id, question);
  state.submit(data, practice.id);
  assert.equal(state.expire(data, practice.id), false);
  assert.throws(() => state.deleteSession(data, completed.id), /已完成/);

  const saved = JSON.parse(JSON.stringify(data));
  assert.deepEqual(Object.keys(saved.sessions), [pending.id, completed.id]);
  assert.deepEqual(saved.papers[paper.id].questionIds, [question]);
  assert.deepEqual(saved.progress[question], progress);
});

test('到时后提交已保存答案，不接收过期变更', () => {
  const { data, paper, question } = open();
  const exam = state.startSession(data, { mode: 'exam' }, paper.questionIds, 1, 1000);
  state.setSelection(data, exam.id, question, ['A'], 2000);
  state.setSelection(data, exam.id, question, ['B'], 61000);
  assert.deepEqual(exam.selected[question], ['A']);
  assert.equal(exam.results[question], 'correct');
});

test('本地图片和共用材料以来源路径解析，远程、缺失与材料循环拒绝导入', async () => {
  const notes = { '卷/材料.md': '材料正文\n\n![[数据.png]]', '卷/循环.md': '![[循环]]' };
  const resolve = async (ref, origin) => {
    const folder = origin.slice(0, origin.lastIndexOf('/') + 1);
    if (ref === '数据.png') return { path: folder + ref, extension: 'png' };
    const path = folder + ref + '.md';
    if (notes[path]) return { path, extension: 'md', content: notes[path] };
    return null;
  };
  const good = await resolvePaperMedia(parse(source.replace('题干', '题干\n![[材料]]').replace('甲', '![](数据.png)')), '卷/例卷.md', resolve);
  assert.deepEqual(good.issues, []);
  assert.match(good.questions[0].stem, /材料正文\n\n!\[\[\/卷\/数据\.png\]\]/);
  assert.equal(good.questions[0].options[0].text, '![[/卷/数据.png]]');
  const bad = await resolvePaperMedia(parse(source.replace('题干', '题干\n![[循环]]\n![[不存在.png]]\n![](https://example.org/bad.png)')), '卷/例卷.md', resolve);
  assert.equal(bad.issues.length, 3);
  assert.ok(bad.issues.every(issue => issue.number === 7 && issue.line === 2));
});
