const { isCorrect } = require('./parser.cjs');

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
  const paper = { id, path, title: parsed.title, questionIds };
  data.papers[id] = paper;
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
  const previous = data.progress[id] ?? {};
  data.progress[id] = { ...previous, bookmarked: !previous.bookmarked };
}

module.exports = { newData, importPaper, pickQuestions, record, startSession, deleteSession, setSelection, grade, submit, expire, toggleBookmark };
