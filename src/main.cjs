const { ItemView, Plugin, Modal, Notice, Component, MarkdownRenderer, TFile } = require('obsidian');
const { parsePaper } = require('./parser.cjs');
const { resolvePaperMedia } = require('./media.cjs');
const study = require('./study.cjs');

const VIEW = 'shuati-study';
const TAB_NAMES = { paper: '试卷', wrong: '错题', bookmarked: '收藏' };
const TYPE_NAMES = { single: '单选', multiple: '多选', judge: '判断' };
const RESULT_NAMES = { correct: '答对', wrong: '答错', unanswered: '未答' };

function node(parent, tag, text, className) {
  const element = parent.ownerDocument.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
}

function button(parent, text, handler, primary = false) {
  const element = node(parent, 'button', text, primary ? 'mod-cta' : undefined);
  element.type = 'button';
  element.addEventListener('click', handler);
  return element;
}

function select(parent, label, choices, value) {
  const wrapper = node(parent, 'label', undefined, 'shuati-field');
  node(wrapper, 'span', label);
  const input = node(wrapper, 'select');
  for (const [id, name] of choices) {
    const option = node(input, 'option', name);
    option.value = id;
  }
  input.value = value;
  return input;
}

function dialog(app, title, fill) {
  const modal = new Modal(app);
  modal.setTitle(title);
  modal.contentEl.classList.add('shuati-modal');
  fill(modal.contentEl, modal);
  modal.onClose = () => modal.contentEl.replaceChildren();
  modal.open();
  return modal;
}

class ShuatiView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.tab = 'paper';
    this.paperId = '';
    this.module = '';
    this.unanswered = false;
    this.sessionId = '';
    this.showCard = false;
    this.rawTimer = null;
    this.markdown = null;
    this.renderId = 0;
  }

  getViewType() { return VIEW; }
  getDisplayText() { return '刷题'; }
  getIcon() { return 'list-checks'; }

  async onOpen() {
    this.contentEl.classList.add('shuati-view');
    this.registerInterval(window.setInterval(() => this.tick(), 1000));
    this.render();
  }

  async onClose() {
    this.renderId++;
    this.clearMarkdown();
  }

  clearMarkdown() {
    if (this.markdown) this.removeChild(this.markdown);
    this.markdown = null;
  }

  run(action, redraw = true) {
    return Promise.resolve().then(action).then(() => {
      if (redraw) this.plugin.redrawViews();
    }).catch(error => {
      console.error('Shuati', error);
      new Notice(`刷题 · ${error.message}`);
      if (redraw) this.plugin.redrawViews();
    });
  }

  render() {
    const renderId = ++this.renderId;
    this.clearMarkdown();
    this.markdown = this.addChild(new Component());
    this.rawTimer = null;
    this.contentEl.replaceChildren();
    const container = node(this.contentEl, 'div', undefined, 'shuati-shell');
    const session = this.plugin.data.sessions[this.sessionId];
    if (session) this.renderSession(container, session, renderId);
    else this.renderHome(container);
  }

  renderHome(root) {
    const data = this.plugin.data;
    const header = node(root, 'header', undefined, 'shuati-top');
    node(header, 'h1', '刷题');
    button(header, '导入当前笔记', () => this.run(() => this.plugin.previewImport()), true);
    const tabs = node(root, 'nav', undefined, 'shuati-tabs');
    tabs.setAttribute('aria-label', '刷题分类');
    for (const [name, label] of Object.entries(TAB_NAMES)) {
      const tab = button(tabs, label, () => {
        this.tab = name;
        this.module = '';
        this.unanswered = false;
        this.render();
      });
      tab.setAttribute('aria-pressed', String(this.tab === name));
    }
    const papers = Object.values(data.papers);
    if (!papers.length) {
      node(root, 'p', '打开题库笔记，在命令面板运行「导入当前笔记为试卷」。', 'shuati-empty');
      return;
    }
    if (!data.papers[this.paperId]) this.paperId = this.tab === 'paper' ? papers[0].id : '';
    const filters = node(root, 'div', undefined, 'shuati-filters');
    const paperChoices = papers.map(paper => [paper.id, `${paper.title}（${paper.questionIds.length} 题）`]);
    if (this.tab !== 'paper') paperChoices.unshift(['', '全部试卷']);
    const paperInput = select(filters, '试卷', paperChoices, this.paperId);
    paperInput.addEventListener('change', () => {
      this.paperId = paperInput.value;
      this.module = '';
      this.render();
    });
    const baseScope = { kind: this.tab, paperId: this.paperId };
    const moduleNames = [...new Set(study.pickQuestions(data, baseScope).map(id => data.versions[id].module))];
    if (!moduleNames.includes(this.module)) this.module = '';
    const moduleInput = select(filters, '模块', [['', '全部模块'], ...moduleNames.map(name => [name, name])], this.module);
    moduleInput.addEventListener('change', () => { this.module = moduleInput.value; this.render(); });
    if (this.tab === 'paper') {
      const wrapper = node(filters, 'label', undefined, 'shuati-check');
      const input = node(wrapper, 'input');
      input.type = 'checkbox';
      input.checked = this.unanswered;
      input.addEventListener('change', () => { this.unanswered = input.checked; this.render(); });
      node(wrapper, 'span', '只练未答题');
    }
    const scope = { ...baseScope, module: this.module, unanswered: this.unanswered };
    const ids = study.pickQuestions(data, scope);
    node(root, 'p', `可练 ${ids.length} 题`, 'shuati-muted');
    const actions = node(root, 'div', undefined, 'shuati-actions');
    const paper = data.papers[this.paperId];
    const title = paper?.title ?? TAB_NAMES[this.tab];
    button(actions, this.tab === 'wrong' ? '重刷错题' : '开始练习', () => this.start({ ...scope, title, mode: 'practice' }, ids), true).disabled = !ids.length;
    if (this.tab === 'paper') button(actions, '整卷模考', () => this.configureExam(paper));
    if (this.tab !== 'paper' && ids.length) this.renderReviewList(root, data, ids);
    this.renderSessions(root, data);
  }

  renderReviewList(root, data, ids) {
    const list = node(root, 'ul', undefined, 'shuati-list');
    for (const id of ids) {
      const q = data.versions[id];
      const progress = data.progress[id];
      const text = `${data.papers[q.paperId].title} · 第 ${q.number} 题 · ${q.module}`;
      const row = node(list, 'li');
      button(row, text, () => this.start({ mode: 'practice', kind: this.tab, paperId: q.paperId, title: text }, [id]));
      if (progress?.wrongCount) node(row, 'span', `累计答错 ${progress.wrongCount} 次`, 'shuati-muted');
    }
  }

  renderSessions(root, data) {
    const sessions = Object.values(data.sessions).reverse();
    const active = sessions.filter(session => session.completed === undefined);
    const history = sessions.filter(session => session.completed !== undefined);
    if (active.length) this.sessionList(root, '继续作答', active);
    if (history.length) this.sessionList(root, '作答记录', history, true);
  }

  sessionList(root, title, sessions, collapsed = false) {
    const section = node(root, collapsed ? 'details' : 'section', undefined, 'shuati-section');
    node(section, collapsed ? 'summary' : 'h2', title);
    const list = node(section, 'ul', undefined, 'shuati-list');
    for (const session of sessions) {
      const label = session.mode === 'exam' ? '模考' : '练习';
      const row = node(list, 'li');
      const date = new Date(session.started).toLocaleString();
      const description = `${session.title} · ${label} · ${date}`;
      button(row, description, () => this.resume(session.id));
      if (session.completed === undefined) {
        const remove = button(row, '删除', () => this.confirmDeleteSession(session, description));
        remove.setAttribute('aria-label', `删除 ${description}`);
      }
    }
  }

  confirmDeleteSession(session, description) {
    dialog(this.app, '删除继续作答记录', (root, modal) => {
      node(root, 'p', description);
      node(root, 'p', '删除后将无法继续本次作答。已记入的答题结果和收藏仍会保留。');
      const actions = node(root, 'div', undefined, 'shuati-actions');
      button(actions, '取消', () => modal.close());
      const remove = button(actions, '确认删除', () => {
        remove.disabled = true;
        return this.run(async () => {
          try {
            await this.plugin.update(data => study.deleteSession(data, session.id));
            modal.close();
          } finally {
            remove.disabled = false;
          }
        });
      });
      remove.classList.add('mod-warning');
    });
  }

  configureExam(paper) {
    dialog(this.app, '整卷模考', (root, modal) => {
      node(root, 'p', `${paper.title} · ${paper.questionIds.length} 题`);
      const label = node(root, 'label', undefined, 'shuati-field');
      node(label, 'span', '限时（分钟，可留空）');
      const input = node(label, 'input');
      input.type = 'number';
      input.min = '1';
      input.step = '1';
      button(root, '开始模考', () => {
        const minutes = input.value === '' ? undefined : Number(input.value);
        if (input.validity.badInput || (minutes !== undefined && (!Number.isSafeInteger(minutes) || minutes < 1 || !Number.isSafeInteger(Date.now() + minutes * 60000)))) {
          new Notice('限时请输入有效的正整数分钟');
          return;
        }
        modal.close();
        this.start({ mode: 'exam', kind: 'paper', paperId: paper.id, title: paper.title }, paper.questionIds, minutes);
      }, true);
    });
  }

  start(scope, ids, minutes) {
    return this.run(async () => {
      const session = await this.plugin.update(data => study.startSession(data, scope, ids, minutes));
      this.sessionId = session.id;
      this.showCard = scope.mode === 'exam';
    });
  }

  resume(id) {
    return this.run(async () => {
      let session = this.plugin.data.sessions[id];
      if (!session) return;
      if (session.deadline !== undefined && session.completed === undefined && Date.now() >= session.deadline) {
        await this.plugin.update(data => study.expire(data, id));
        session = this.plugin.data.sessions[id];
        if (!session) return;
      }
      this.sessionId = id;
      this.showCard = session.mode === 'exam';
    });
  }

  tick() {
    const session = this.plugin.data.sessions[this.sessionId];
    if (!session || session.completed !== undefined || session.deadline === undefined) return;
    const seconds = Math.max(0, Math.ceil((session.deadline - Date.now()) / 1000));
    if (this.rawTimer) {
      const minutes = Math.floor(seconds / 60);
      this.rawTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }
    if (!seconds && !this.expiring) {
      this.expiring = true;
      this.run(() => this.plugin.update(data => study.expire(data, session.id))).finally(() => { this.expiring = false; });
    }
  }

  renderSession(root, session, renderId) {
    const done = session.completed !== undefined;
    const header = node(root, 'header', undefined, 'shuati-top');
    button(header, '返回题库', () => { this.sessionId = ''; this.render(); });
    node(header, 'h1', session.title);
    if (!done && session.deadline !== undefined) {
      this.rawTimer = node(header, 'span', undefined, 'shuati-timer');
      this.rawTimer.setAttribute('aria-label', '剩余时间');
      this.tick();
    }
    const total = session.questionIds.length;
    if (done) {
      const results = Object.values(session.results);
      const count = kind => results.filter(result => result === kind).length;
      node(root, 'p', `成绩 ${count('correct')} / ${total} · 答错 ${count('wrong')} · 未答 ${count('unanswered')}`, 'shuati-score');
    } else {
      const answered = session.mode === 'exam' ? Object.values(session.selected).filter(keys => keys.length).length : Object.keys(session.results).length;
      node(root, 'p', `已答 ${answered} / ${total}`, 'shuati-muted shuati-progress');
    }
    if (session.mode === 'exam' || done) {
      const toggle = button(root, this.showCard ? '收起答题卡' : '展开答题卡', () => { this.showCard = !this.showCard; this.render(); });
      toggle.setAttribute('aria-expanded', String(this.showCard));
      if (this.showCard) this.renderCard(root, session);
    }
    const id = session.questionIds[session.cursor];
    const question = this.plugin.data.versions[id];
    const result = session.results[id];
    this.renderQuestion(root, session, question, result, renderId);
    const actions = node(root, 'footer', undefined, 'shuati-actions shuati-footer');
    button(actions, '上一题', () => this.jump(session, session.cursor - 1)).disabled = session.cursor === 0;
    node(actions, 'span', `${session.cursor + 1} / ${total}`, 'shuati-muted');
    button(actions, '下一题', () => this.jump(session, session.cursor + 1)).disabled = session.cursor === total - 1;
    if (!done && session.mode === 'practice') {
      button(actions, '答题卡', () => this.openPracticeCard(session.id));
    }
    if (!done) button(actions, session.mode === 'exam' ? '交卷' : '结束练习', () => this.confirmSubmit(session), true);
  }

  openPracticeCard(sessionId) {
    const session = this.plugin.data.sessions[sessionId];
    if (!session) return;
    dialog(this.app, '答题卡', (root, modal) => {
      this.renderCard(root, session, index => {
        modal.close();
        this.contentEl.scrollTop = 0;
        return this.jump(session, index);
      });
    });
  }

  renderCard(root, session, onJump = index => this.jump(session, index)) {
    const card = node(root, 'div', undefined, 'shuati-grid');
    for (const [index, id] of session.questionIds.entries()) {
      const q = this.plugin.data.versions[id];
      const item = button(card, String(q.number), () => onJump(index));
      const result = session.results[id];
      const selected = Boolean(session.selected[id]?.length);
      let status = '未答';
      if (result) status = RESULT_NAMES[result];
      else if (selected) status = session.mode === 'practice' ? '已选，未提交' : '已答';
      item.setAttribute('aria-label', `第 ${q.number} 题，${status}`);
      item.dataset.status = result ?? (selected ? 'selected' : 'unanswered');
      if (index === session.cursor) item.setAttribute('aria-current', 'step');
    }
  }

  jump(session, cursor) {
    return this.run(() => this.plugin.update(data => {
      const current = data.sessions[session.id];
      if (current && cursor >= 0 && cursor < current.questionIds.length) current.cursor = cursor;
    }));
  }

  confirmSubmit(session) {
    const exam = session.mode === 'exam';
    dialog(this.app, exam ? '确认交卷' : '结束本次练习', (root, modal) => {
      const ungraded = session.questionIds.filter(id => exam ? !session.selected[id]?.length : !session.results[id]).length;
      node(root, 'p', ungraded ? `还有 ${ungraded} 道题${exam ? '未作答' : '未判分'}。` : '已完成全部题目。');
      const actions = node(root, 'div', undefined, 'shuati-actions');
      button(actions, '继续作答', () => modal.close());
      button(actions, exam ? '确认交卷' : '结束练习', () => {
        modal.close();
        this.showCard = true;
        return this.run(() => this.plugin.update(data => study.submit(data, session.id)));
      }, true);
    });
  }

  renderQuestion(root, session, question, result, renderId) {
    const article = node(root, 'article', undefined, 'shuati-question');
    const top = node(article, 'div', undefined, 'shuati-top');
    node(top, 'h2', `第 ${question.number} 题 · ${question.module} · ${TYPE_NAMES[question.type]}`);
    const progress = this.plugin.data.progress[question.id];
    const star = button(top, progress?.bookmarked ? '取消收藏' : '收藏', () => this.run(() =>
      this.plugin.update(data => study.toggleBookmark(data, question.id))));
    star.setAttribute('aria-pressed', String(Boolean(progress?.bookmarked)));
    if (progress?.wrongCount) node(article, 'p', `累计答错 ${progress.wrongCount} 次`, 'shuati-muted');
    this.renderMarkdown(article, question.stem, question.path, renderId);
    const options = node(article, 'fieldset', undefined, 'shuati-options');
    node(options, 'legend', question.type === 'multiple' ? '选择所有正确选项' : '选择一个选项');
    const selected = session.selected[question.id] ?? [];
    for (const option of question.options) {
      const label = node(options, 'label', undefined, 'shuati-option');
      const control = node(label, 'input');
      control.type = question.type === 'multiple' ? 'checkbox' : 'radio';
      control.name = `shuati-option-${session.id}-${this.leaf.id}`;
      control.value = option.key;
      control.setAttribute('aria-label', option.key);
      control.checked = selected.includes(option.key);
      control.disabled = Boolean(result);
      if (result && question.answers.includes(option.key)) label.dataset.result = 'correct';
      if (result && selected.includes(option.key) && !question.answers.includes(option.key)) label.dataset.result = 'wrong';
      node(label, 'span', `${option.key}.`, 'shuati-option-key');
      this.renderMarkdown(label, option.text, question.path, renderId);
      control.addEventListener('change', () => {
        const keys = [...options.querySelectorAll('input:checked')].map(input => input.value);
        const update = () => this.plugin.update(data => study.setSelection(data, session.id, question.id, keys));
        // Practice selections stay visible until an explicit grade or navigation.
        this.run(update, false).then(() => {
          const current = this.plugin.data.sessions[session.id];
          if (renderId !== this.renderId) return;
          if (!current || current.completed !== undefined) this.render();
          else this.refreshSelection(root, current, question, options);
        });
      });
    }
    if (result) {
      const feedback = node(article, 'div', undefined, 'shuati-feedback');
      feedback.dataset.result = result;
      node(feedback, 'strong', `${RESULT_NAMES[result]} · 正确答案 ${question.answers.join('、')}`);
      if (question.explanation) this.renderMarkdown(feedback, question.explanation, question.path, renderId);
    } else if (session.mode === 'practice') {
      const grade = button(article, '提交本题', () => this.run(() => this.plugin.update(data => study.grade(data, session.id, question.id))), true);
      grade.classList.add('shuati-grade');
      grade.disabled = !selected.length;
    }
  }

  refreshSelection(root, session, question, options) {
    if (session.mode === 'practice') {
      const grade = root.querySelector('.shuati-grade');
      if (grade) grade.disabled = !options.querySelector('input:checked');
    } else {
      const progress = root.querySelector('.shuati-progress');
      if (progress) progress.textContent = `已答 ${Object.values(session.selected).filter(keys => keys.length).length} / ${session.questionIds.length}`;
      const card = root.querySelector('.shuati-grid');
      const item = card?.children[session.cursor];
      if (item) {
        const answered = Boolean(session.selected[question.id]?.length);
        item.dataset.status = answered ? 'selected' : 'unanswered';
        item.setAttribute('aria-label', `第 ${question.number} 题，${answered ? '已答' : '未答'}`);
      }
    }
  }

  renderMarkdown(parent, markdown, source, renderId) {
    const target = node(parent, 'div', undefined, 'shuati-markdown markdown-rendered');
    MarkdownRenderer.render(this.app, markdown, target, source, this.markdown).then(() => {
      if (renderId !== this.renderId) return;
      for (const img of target.querySelectorAll('img')) {
        img.classList.add('shuati-image');
        img.title = '查看大图';
        img.tabIndex = 0;
        const zoom = event => {
          event.preventDefault();
          event.stopPropagation();
          dialog(this.app, '题图', root => {
            const large = node(root, 'img', undefined, 'shuati-zoom');
            large.src = img.currentSrc || img.src;
            large.alt = img.alt;
          });
        };
        img.addEventListener('click', zoom);
        img.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') zoom(event); });
      }
    }).catch(error => {
      if (renderId === this.renderId) target.textContent = `渲染失败：${error.message}`;
    });
  }
}

class ShuatiPlugin extends Plugin {
  async onload() {
    const saved = await this.loadData();
    if (saved && (saved.schema !== 1 || !Number.isSafeInteger(saved.nextId) || saved.nextId < 1
      || ['papers', 'versions', 'progress', 'sessions'].some(key => !saved[key] || typeof saved[key] !== 'object' || Array.isArray(saved[key])))) {
      throw new Error('刷题存档格式无效，原文件已保留');
    }
    this.data = saved ?? study.newData();
    this.writes = Promise.resolve();
    this.registerView(VIEW, leaf => new ShuatiView(leaf, this));
    this.addRibbonIcon('list-checks', '打开刷题', () => this.openView());
    this.addCommand({ id: 'open', name: '打开刷题', callback: () => this.openView() });
    this.addCommand({ id: 'import-note', name: '导入当前笔记为试卷', callback: () => this.previewImport().catch(error => new Notice(error.message)) });
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      const toPath = path => path === oldPath ? file.path : path.startsWith(`${oldPath}/`) ? file.path + path.slice(oldPath.length) : path;
      if (!Object.values(this.data.papers).some(paper => toPath(paper.path) !== paper.path)) return;
      this.update(data => {
        for (const paper of Object.values(data.papers)) paper.path = toPath(paper.path);
        for (const question of Object.values(data.versions)) question.path = toPath(question.path);
      }).then(() => this.redrawViews()).catch(error => new Notice(error.message));
    }));
  }

  update(mutation) {
    const write = this.writes.then(async () => {
      const next = JSON.parse(JSON.stringify(this.data));
      const result = mutation(next);
      await this.saveData(next);
      this.data = next;
      return result;
    });
    this.writes = write.catch(() => {});
    return write;
  }

  redrawViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) leaf.view.render();
  }

  async openView() {
    let [leaf] = this.app.workspace.getLeavesOfType(VIEW);
    if (!leaf) {
      leaf = this.app.workspace.getLeaf('tab');
      await leaf.setViewState({ type: VIEW, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    return leaf.view;
  }

  async previewImport() {
    const active = this.app.workspace.getActiveFile();
    const recent = active ?? this.app.vault.getAbstractFileByPath(this.app.workspace.getLastOpenFiles()[0] ?? '');
    if (!(recent instanceof TFile) || recent.extension !== 'md') throw new Error('请先打开要导入的 Markdown 笔记');
    const read = file => this.app.vault.read(file);
    const parsed = await resolvePaperMedia(parsePaper(await read(recent)), recent.path, async (link, source) => {
      const file = this.app.metadataCache.getFirstLinkpathDest(link, source);
      if (!(file instanceof TFile)) return null;
      return { path: file.path, extension: file.extension.toLowerCase(), content: file.extension === 'md' ? await read(file) : undefined };
    });
    dialog(this.app, parsed.issues.length ? '请修正试卷' : '导入试卷', (root, modal) => {
      node(root, 'p', recent.path, 'shuati-muted');
      if (parsed.issues.length) {
        const list = node(root, 'ul', undefined, 'shuati-errors');
        for (const issue of parsed.issues) {
          node(list, 'li', `${issue.number ? `第 ${issue.number} 题 · ` : ''}第 ${issue.line} 行 · ${issue.message}`);
        }
        return;
      }
      node(root, 'p', `${parsed.title} · ${parsed.questions.length} 题`);
      const save = button(root, '确认导入', async () => {
        save.disabled = true;
        try {
          const paper = await this.update(data => study.importPaper(data, recent.path, parsed));
          modal.close();
          const view = await this.openView();
          view.paperId = paper.id;
          view.tab = 'paper';
          view.module = '';
          view.unanswered = false;
          view.sessionId = '';
          this.redrawViews();
          new Notice(`已导入 ${paper.questionIds.length} 题`);
        } catch (error) {
          new Notice(`导入失败：${error.message}`);
          save.disabled = false;
        }
      }, true);
    });
  }
}

module.exports = ShuatiPlugin;
