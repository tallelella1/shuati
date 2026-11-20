const { isCorrect } = require('./parser.cjs');
const { mapQuestionImages } = require('./media.cjs');

function newData() {
  return { schema: 1, nextId: 1, papers: {}, versions: {}, progress: {}, sessions: {} };
}

function allocate(data, prefix) { return `${prefix}-${data.nextId++}`; }
const signature = q => JSON.stringify([q.type, q.stem, q.options, q.answers]);

function importPaper(data, path, parsed) {
  if (parsed.issues.length || !parsed.questions.length) throw new Error('请先修正试卷导入错误');
  const existing = Object.values(data.papers).find(paper => paper.path === path);
  const id = existing?.id ?? allocate(data, 'paper');
  const previous = new Map((existing?.questionIds ?? []).map(id => [data.versions[id].number, data.versions[id]]));
  const questionIds = parsed.questions.map(({ line, ...question }) => {
    const old = previous.get(question.number);
    const questionId = old && signature(old) === signature(question) ? old.id : allocate(data, 'q');
    data.versions[questionId] = { ...question, id: questionId, paperId: id, path };
    return questionId;
  });
  const paper = { ...existing, id, path, title: existing?.customTitle ?? parsed.title, questionIds };
  data.papers[id] = paper;
  return paper;
}

function requirePaper(data, id) {
  const paper = data.papers[id];
  if (!paper) throw new Error('题库已删除');
  return paper;
}

function renamePaper(data, id, title) {
  const paper = requirePaper(data, id);
  const name = title.trim();
  if (!name) throw new Error('题库名称不能为空');
  paper.title = paper.customTitle = name;
}

function deletePaper(data, id) {
  if (!data.papers[id]) return false;
  delete data.papers[id];
  const removed = new Set();
  for (const question of Object.values(data.versions)) {
    if (question.paperId !== id) continue;
    removed.add(question.id);
    delete data.versions[question.id];
    delete data.progress[question.id];
  }
  for (const session of Object.values(data.sessions)) {
    const remaining = session.questionIds.filter(questionId => !removed.has(questionId));
    if (session.paperId === id || !remaining.length) {
      delete data.sessions[session.id];
    } else if (remaining.length !== session.questionIds.length) {
      // Keep the current question, or move to the next available question.
      const beforeCursor = session.questionIds.slice(0, session.cursor).filter(questionId => !removed.has(questionId));
      session.cursor = Math.min(beforeCursor.length, remaining.length - 1);
      session.questionIds = remaining;
      for (const store of [session.selected, session.results]) {
        for (const questionId of Object.keys(store)) if (removed.has(questionId)) delete store[questionId];
      }
    }
  }
  return true;
}

const withinPath = (path, root) => path === root || path.startsWith(`${root}/`);

function mentionsImagePath(question, root) {
  const prefix = `![[/${root}`;
  const matches = text => text.includes(`${prefix}]]`) || text.includes(`${prefix}|`) || text.includes(`${prefix}/`);
  return matches(question.stem) || matches(question.explanation) || question.options.some(option => matches(option.text));
}

function usesVaultPath(data, root) {
  return Object.values(data.papers).some(paper => withinPath(paper.path, root))
    || Object.values(data.versions).some(question => withinPath(question.path, root) || mentionsImagePath(question, root));
}

function moveVaultPath(data, oldPath, newPath) {
  const move = path => withinPath(path, oldPath) ? newPath + path.slice(oldPath.length) : path;
  for (const paper of Object.values(data.papers)) paper.path = move(paper.path);
  for (const question of Object.values(data.versions)) {
    question.path = move(question.path);
    if (mentionsImagePath(question, oldPath)) data.versions[question.id] = mapQuestionImages(question, move);
  }
  return true;
}

function relocationContent(question, imagePaths) {
  const mapped = mapQuestionImages(question, path => {
    imagePaths.push(path);
    return path.slice(path.lastIndexOf('/') + 1);
  });
  return JSON.stringify([mapped.number, mapped.module, signature(mapped), mapped.explanation]);
}

function relocatePaper(data, id, path, parsed) {
  const paper = requirePaper(data, id);
  if (Object.values(data.papers).some(p => p.id !== id && p.path === path)) throw new Error('该笔记已导入为另一套题库');
  if (parsed.issues.length || !parsed.questions.length) throw new Error('请先修正新位置的试卷及图片引用');
  const mismatch = () => new Error('新位置的题目或解析与已导入版本不一致，请选择同一份试卷');
  if (paper.questionIds.length !== parsed.questions.length) throw mismatch();
  const moves = new Map(), sources = new Map();
  for (const [index, questionId] of paper.questionIds.entries()) {
    const before = [], after = [];
    if (relocationContent(data.versions[questionId], before) !== relocationContent(parsed.questions[index], after)) throw mismatch();
    for (const [i, from] of before.entries()) {
      const to = after[i];
      if ((moves.has(from) && moves.get(from) !== to) || (sources.has(to) && sources.get(to) !== from)) {
        throw new Error('图片引用对应关系不一致，请检查新位置的附件');
      }
      moves.set(from, to);
      sources.set(to, from);
    }
  }
  paper.path = path;
  for (const question of Object.values(data.versions)) {
    if (question.paperId !== id) continue;
    data.versions[question.id] = mapQuestionImages({ ...question, path }, from => moves.get(from) ?? from);
  }
  return paper;
}

function pickQuestions(data, { kind, paperId, module, unanswered = false }) {
  const papers = paperId ? [data.papers[paperId]].filter(Boolean) : Object.values(data.papers);
  return papers.flatMap(paper => paper.questionIds).filter(id => {
    const progress = data.progress[id];
    return (!module || data.versions[id].module === module)
      && (kind !== 'wrong' || progress?.isWrong)
      && (kind !== 'bookmarked' || progress?.bookmarked)
      && (!unanswered || !progress?.attempts);
  });
}

function record(data, questionId, selected) {
  if (!selected.length) return 'unanswered';
  const correct = isCorrect(data.versions[questionId], selected);
  const previous = data.progress[questionId] ?? {};
  data.progress[questionId] = {
    ...previous,
    attempts: (previous.attempts ?? 0) + 1,
    wrongCount: (previous.wrongCount ?? 0) + Number(!correct),
    isWrong: !correct,
  };
  return correct ? 'correct' : 'wrong';
}

function startSession(data, scope, questionIds, minutes, now = Date.now()) {
  if (!questionIds.length) throw new Error('没有可作答的题目');
  if (scope.paperId) requirePaper(data, scope.paperId);
  if (questionIds.some(id => !data.versions[id])) throw new Error('部分题目已删除，请重新选择');
  const id = allocate(data, 'session');
  const session = { ...scope, id, questionIds: [...questionIds], cursor: 0, selected: {}, results: {}, started: now };
  if (minutes) session.deadline = now + minutes * 60000;
  data.sessions[id] = session;
  return session;
}

function deleteSession(data, sessionId) {
  const session = data.sessions[sessionId];
  if (!session) return;
  if (session.completed !== undefined) throw new Error('该记录已完成作答，无法删除');
  delete data.sessions[sessionId];
}

function setSelection(data, sessionId, id, selected, now = Date.now()) {
  const session = data.sessions[sessionId];
  if (!session || expire(data, sessionId, now) || session.completed !== undefined || session.results[id] || !session.questionIds.includes(id)) return;
  const question = data.versions[id];
  if ((question.type !== 'multiple' && selected.length > 1) || new Set(selected).size !== selected.length
    || selected.some(key => !question.options.some(option => option.key === key))) throw new Error('选项无效');
  session.selected[id] = [...selected];
}

function grade(data, sessionId, id) {
  const session = data.sessions[sessionId];
  if (!session || session.completed !== undefined || session.mode !== 'practice' || session.results[id] || !session.questionIds.includes(id)) return;
  const selected = session.selected[id] ?? [];
  if (selected.length) session.results[id] = record(data, id, selected);
}

function submit(data, sessionId, now = Date.now()) {
  const session = data.sessions[sessionId];
  if (!session || session.completed !== undefined) return;
  for (const id of session.questionIds) {
    if (!session.results[id]) session.results[id] = session.mode === 'exam' ? record(data, id, session.selected[id] ?? []) : 'unanswered';
  }
  session.completed = Math.min(now, session.deadline ?? now);
}

function expire(data, sessionId, now = Date.now()) {
  const session = data.sessions[sessionId];
  if (!session || session.completed !== undefined || session.deadline === undefined || now < session.deadline) return false;
  submit(data, sessionId, now);
  return true;
}

function toggleBookmark(data, id) {
  if (!data.versions[id]) return;
  const previous = data.progress[id] ?? {};
  data.progress[id] = { ...previous, bookmarked: !previous.bookmarked };
}

module.exports = {
  newData, importPaper, renamePaper, deletePaper, usesVaultPath, moveVaultPath, relocatePaper,
  pickQuestions, record, startSession, deleteSession, setSelection, grade, submit, expire, toggleBookmark,
};
