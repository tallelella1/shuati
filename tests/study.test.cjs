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

test('默认按原顺序，勾选乱序后每次重新排列，续做保留题序和答案', t => {
  const { data } = open();
  const questionMarkdown = source.slice(source.indexOf('##'));
  const markdown = source + '\n' + [8, 9].map(number => questionMarkdown.replace('## 7', `## ${number}`)).join('\n');
  const paper = state.importPaper(data, '卷.md', parse(markdown));
  const original = [...paper.questionIds];
  const scope = { mode: 'practice', kind: 'paper', paperId: paper.id };
  const random = t.mock.method(Math, 'random', () => 0);
  const defaultPractice = state.startSession(data, scope, paper.questionIds);
  const orderedExam = state.startSession(data, { ...scope, mode: 'exam', shuffle: false }, paper.questionIds);
  assert.deepEqual(defaultPractice.questionIds, original);
  assert.deepEqual(orderedExam.questionIds, original);
  assert.equal(random.mock.callCount(), 0);
  const shuffledScope = { ...scope, shuffle: true };
  const first = state.startSession(data, shuffledScope, paper.questionIds);
  const firstOrder = [...first.questionIds];
  random.mock.mockImplementation(() => 0.5);
  const second = state.startSession(data, shuffledScope, paper.questionIds);
  assert.notDeepEqual(first.questionIds, original);
  assert.notDeepEqual(first.questionIds, second.questionIds);
  assert.deepEqual(paper.questionIds, original);
  for (const session of [first, second]) {
    assert.deepEqual([...session.questionIds].sort(), [...original].sort());
  }
  first.cursor = 1;
  const current = first.questionIds[first.cursor];
  state.setSelection(data, first.id, current, ['A']);
  const restored = JSON.parse(JSON.stringify(data)).sessions[first.id];
  assert.deepEqual(restored.questionIds, firstOrder);
  assert.equal(restored.questionIds[restored.cursor], current);
  assert.deepEqual(restored.selected[current], ['A']);
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

test('重命名会保留题库和题目 ID，重导不覆盖自定义名称', () => {
  const { data, paper, question } = open();
  state.record(data, question, ['B']);
  assert.throws(() => state.renamePaper(data, paper.id, '   '), /名称不能为空/);
  state.renamePaper(data, paper.id, '  我的专项训练  ');
  const reimported = state.importPaper(data, paper.path, parse(source));
  assert.equal(reimported.id, paper.id);
  assert.equal(reimported.title, '我的专项训练');
  assert.deepEqual(reimported.questionIds, [question]);
  assert.deepEqual(data.progress[question], { attempts: 1, wrongCount: 1, isWrong: true });
});

test('删除题库清除历史版本与进度，只裁掉混合记录中的相关题目', t => {
  t.mock.method(Math, 'random', () => 0.99);
  const { data, paper, question } = open();
  const a = state.importPaper(data, paper.path, parse(source.replace('题干', '新题干')));
  const b = state.importPaper(data, '另卷.md', parse(source));
  const c = state.importPaper(data, '第三卷.md', parse(source));
  const revised = a.questionIds[0], keep = b.questionIds[0], next = c.questionIds[0];
  for (const id of [question, revised, keep]) state.record(data, id, ['B']);
  const scoped = state.startSession(data, { mode: 'exam', paperId: paper.id }, [revised]);
  const mixed = state.startSession(data, { mode: 'practice', kind: 'wrong', shuffle: true }, [keep, revised, next]);
  mixed.cursor = 1;
  mixed.selected = { [revised]: ['B'], [keep]: ['A'] };
  mixed.results = { [revised]: 'wrong', [keep]: 'correct' };
  const completed = state.startSession(data, { mode: 'practice' }, [question]);
  state.submit(data, completed.id);
  assert.equal(state.deletePaper(data, paper.id), true);
  assert.equal(state.deletePaper(data, paper.id), false);
  assert.deepEqual(Object.keys(data.papers), [b.id, c.id]);
  assert.deepEqual(Object.keys(data.versions), [keep, next]);
  assert.deepEqual(Object.keys(data.progress), [keep]);
  assert.deepEqual(Object.keys(data.sessions), [mixed.id]);
  assert.deepEqual(mixed.questionIds, [keep, next]);
  assert.equal(mixed.cursor, 1);
  assert.deepEqual(mixed.selected, { [keep]: ['A'] });
  assert.deepEqual(mixed.results, { [keep]: 'correct' });
  assert.throws(() => state.startSession(data, { mode: 'exam', paperId: paper.id }, [revised]), /已删除/);
  state.toggleBookmark(data, revised);
  assert.equal(data.progress[revised], undefined);
  assert.equal(data.sessions[scoped.id], undefined);
});

test('库内试卷和附件搬迁同步所有题目版本的路径及带尺寸的图片引用', () => {
  const data = state.newData();
  const paper = state.importPaper(data, '旧卷/练习.md', parse(source.replace('题干', '![[/旧卷/附件/图.png|300]]')));
  const old = paper.questionIds[0];
  const current = state.importPaper(data, paper.path, parse(source.replace('甲', '![[/旧卷/附件/图.png]]').replace('解法', '![[/旧卷备份/另图.png]]'))).questionIds[0];
  assert.equal(state.usesVaultPath(data, '旧卷/附件/图.png'), true);
  assert.equal(state.usesVaultPath(data, '旧'), false);
  state.moveVaultPath(data, '旧卷', '归档/卷');
  state.moveVaultPath(data, '归档/卷/附件/图.png', '公共图片/新图.png');
  assert.equal(data.papers[paper.id].path, '归档/卷/练习.md');
  assert.equal(data.versions[old].path, '归档/卷/练习.md');
  assert.equal(data.versions[old].stem, '![[/公共图片/新图.png|300]]');
  assert.equal(data.versions[current].options[0].text, '![[/公共图片/新图.png]]');
  assert.equal(state.usesVaultPath(data, '旧卷/附件/图.png'), false);
});

test('手动选择迁移后的笔记会保留进度和历史，拒绝冲突、内容与引用映射不一致', () => {
  const data = state.newData();
  const withAsset = folder => parse(source.replace('题干', `题干 ![[/${folder}/图.png]]`).replace('甲', `![[/${folder}/图.png]]`));
  const paper = state.importPaper(data, '旧/练习.md', withAsset('旧'));
  const old = paper.questionIds[0];
  const current = state.importPaper(data, paper.path, { ...withAsset('旧'), questions: withAsset('旧').questions.map(q => ({ ...q, stem: q.stem.replace('题干', '新题干') })) });
  const question = current.questionIds[0];
  state.record(data, question, ['B']);
  const session = state.startSession(data, { mode: 'practice', paperId: paper.id }, [old]);
  state.renamePaper(data, paper.id, '专项');
  const occupied = state.importPaper(data, '占用.md', parse(source));
  const same = withAsset('迁移/附件');
  same.questions[0].stem = same.questions[0].stem.replace('题干', '新题干');
  const snapshot = JSON.stringify(data);
  assert.throws(() => state.relocatePaper(data, paper.id, occupied.path, same), /已导入/);
  assert.throws(() => state.relocatePaper(data, paper.id, '迁移/新卷.md', withAsset('迁移/附件')), /不一致/);
  const conflicting = JSON.parse(JSON.stringify(same));
  conflicting.questions[0].options[0].text = '![[/其他目录/图.png]]';
  assert.throws(() => state.relocatePaper(data, paper.id, '迁移/新卷.md', conflicting), /图片引用/);
  assert.equal(JSON.stringify(data), snapshot);
  const moved = state.relocatePaper(data, paper.id, '迁移/新卷.md', same);
  assert.equal(moved.title, '专项');
  assert.equal(moved.path, '迁移/新卷.md');
  assert.deepEqual(moved.questionIds, [question]);
  assert.match(data.versions[old].stem, /\/迁移\/附件\/图\.png/);
  assert.equal(data.versions[old].path, moved.path);
  assert.deepEqual(data.sessions[session.id].questionIds, [old]);
  assert.equal(data.progress[question].wrongCount, 1);
});
