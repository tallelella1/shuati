const { ItemView, Plugin, Modal, FuzzySuggestModal, Notice, Component, MarkdownRenderer, TFile, PluginSettingTab, Setting } = require('obsidian');
const { parsePaper } = require('./parser.cjs');
const { resolvePaperMedia } = require('./media.cjs');
const study = require('./study.cjs');
const { readHotkeys, recordKey, matchHotkey, actionForOption, keyLabel } = require('./hotkeys.cjs');

const VIEW = 'shuati-study';
const TAB_NAMES = { paper: '试卷', wrong: '错题', bookmarked: '收藏' };
const TYPE_NAMES = { single: '单选', multiple: '多选', judge: '判断' };
const HOTKEY_NAMES = {
  A: '选项 A / 判断正确', B: '选项 B / 判断错误', C: '选项 C', D: '选项 D',
  E: '选项 E', F: '选项 F', G: '选项 G', H: '选项 H',
  previous: '上一题', next: '下一题', grade: '提交本题（练习）',
};
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

const paperTitleOrder = new Intl.Collator('zh-Hans-CN-u-co-pinyin', { sensitivity: 'base', numeric: true });

function sortedPapers(papers) {
  return Object.values(papers).sort((a, b) => paperTitleOrder.compare(a.title, b.title));
}

function paperLabel(paper) {
  return `${paper.title}（${paper.questionIds.length} 题）`;
}

function renderImportIssues(root, issues) {
  const list = node(root, 'ul', undefined, 'shuati-errors');
  for (const issue of issues) {
    node(list, 'li', `${issue.number ? `第 ${issue.number} 题 · ` : ''}第 ${issue.line} 行 · ${issue.message}`);
  }
}

class PaperNotePicker extends FuzzySuggestModal {
  constructor(app, choose) {
    super(app);
    this.choose = choose;
    this.setPlaceholder('搜索库内 Markdown 笔记');
  }

  getItems() { return this.app.vault.getMarkdownFiles(); }
  getItemText(file) { return file.path; }
  onChooseItem(file) { this.choose(file); }
}

class ShuatiSettings extends PluginSettingTab {
  constructor(plugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  display() {
    const root = this.containerEl;
    root.replaceChildren();
    const hotkeys = readHotkeys(this.plugin.data.hotkeys);
    new Setting(root).setName('自定义答题快捷键').setHeading();
    node(root, 'p', '点击输入框后按键录入。支持字母、数字、方向键、Enter 和修饰键组合。按 Backspace 或 Delete 清除绑定。', 'setting-item-description');
    for (const [action, name] of Object.entries(HOTKEY_NAMES)) {
      new Setting(root).setName(name).addText(text => {
        const input = text.inputEl;
        text.setPlaceholder('未绑定').setValue(keyLabel(hotkeys[action]));
        input.readOnly = true;
        input.setAttribute('aria-label', name);
        input.addEventListener('keydown', async event => {
          if (event.key === 'Tab' || event.key === 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          if (event.repeat || event.isComposing || event.keyCode === 229) return;
          const clear = event.key === 'Backspace' || event.key === 'Delete';
          const key = clear ? '' : recordKey(event);
          if (!clear && !key) return;
          try {
            await this.plugin.update(data => {
              const current = readHotkeys(data.hotkeys);
              const conflict = key && Object.keys(current).find(other => other !== action && current[other] === key);
              if (conflict) throw new Error(`${keyLabel(key)} 已绑定到「${HOTKEY_NAMES[conflict]}」`);
              data.hotkeys = { ...current, [action]: key };
            });
            text.setValue(keyLabel(readHotkeys(this.plugin.data.hotkeys)[action]));
            this.plugin.redrawViews();
          } catch (error) { new Notice(error.message); }
        });
      });
    }
    new Setting(root).setName('恢复默认快捷键').addButton(button => button.setButtonText('恢复默认').onClick(async () => {
      try {
        await this.plugin.update(data => { delete data.hotkeys; });
        this.display();
        this.plugin.redrawViews();
      } catch (error) { new Notice(error.message); }
    }));
  }
}

class ShuatiView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.tab = 'paper';
    this.paperId = '';
    this.module = '';
    this.unanswered = false;
    this.shuffle = false;
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
    this.contentEl.tabIndex = 0;
    this.registerDomEvent(this.contentEl, 'keydown', event => this.handleHotkey(event));
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

  handleHotkey(event) {
    const target = event.target;
    const activeView = this.app.workspace.getActiveViewOfType(ShuatiView);
    if (event.defaultPrevented || activeView !== this || !target?.closest
      || target.closest('input:not([type="radio"]):not([type="checkbox"]), textarea, select, [contenteditable], [role="textbox"]')) return;
    if (Array.from(this.contentEl.ownerDocument.querySelectorAll('.modal-container')).some(modal => modal.getClientRects().length)) return;
    if (event.key === 'Enter' && target.closest('button, a[href], summary, [role="button"]')) return;
    const action = matchHotkey(readHotkeys(this.plugin.data.hotkeys), event);
    if (!action) return;
    const control = this.contentEl.querySelector(`[data-shuati-hotkey="${action}"]`);
    if (!control || control.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    control.click();
  }

  bindHotkey(control, action, hintParent = control) {
    control.dataset.shuatiHotkey = action;
    const key = readHotkeys(this.plugin.data.hotkeys)[action];
    if (key) node(hintParent, 'kbd', keyLabel(key), 'shuati-key');
    return control;
  }

  render() {
    const previousFocus = this.contentEl.ownerDocument.activeElement;
    const hadFocus = this.contentEl.contains(previousFocus);
    const renderId = ++this.renderId;
    this.clearMarkdown();
    this.markdown = this.addChild(new Component());
    this.rawTimer = null;
    this.contentEl.replaceChildren();
    const container = node(this.contentEl, 'div', undefined, 'shuati-shell');
    const session = this.plugin.data.sessions[this.sessionId];
    if (session) this.renderSession(container, session, renderId);
    else this.renderHome(container);
    if (hadFocus && !this.contentEl.contains(this.contentEl.ownerDocument.activeElement)) {
      this.contentEl.focus({ preventScroll: true });
    }
  }

  renderHome(root) {
    const data = this.plugin.data;
    const header = node(root, 'header', undefined, 'shuati-top');
    const heading = node(header, 'h1', '刷题');
    heading.id = `shuati-heading-${this.leaf.id}`;
    button(header, '导入当前笔记', () => this.run(() => this.plugin.previewImport()), true);
    const tabs = node(root, 'nav', undefined, 'shuati-tabs');
    tabs.setAttribute('aria-labelledby', heading.id);
    for (const [name, label] of Object.entries(TAB_NAMES)) {
      const tab = button(tabs, label, () => {
        this.tab = name;
        this.module = '';
        this.unanswered = false;
        this.render();
      });
      tab.setAttribute('aria-pressed', String(this.tab === name));
    }
    const papers = sortedPapers(data.papers);
    if (!papers.length) {
      node(root, 'p', '打开题库笔记，在命令面板运行「导入当前笔记为试卷」。', 'shuati-empty');
      return;
    }
    if (!data.papers[this.paperId]) this.paperId = this.tab === 'paper' ? papers[0].id : '';
    const filters = node(root, 'div', undefined, 'shuati-filters');
    const paperChoices = papers.map(paper => [paper.id, paperLabel(paper)]);
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
    const shuffleLabel = node(filters, 'label', undefined, 'shuati-check');
    const shuffleInput = node(shuffleLabel, 'input');
    shuffleInput.type = 'checkbox';
    shuffleInput.checked = this.shuffle;
    shuffleInput.addEventListener('change', () => { this.shuffle = shuffleInput.checked; });
    node(shuffleLabel, 'span', '乱序');
    const scope = { ...baseScope, module: this.module, unanswered: this.unanswered };
    const ids = study.pickQuestions(data, scope);
    node(root, 'p', `可练 ${ids.length} 题`, 'shuati-muted');
    const actions = node(root, 'div', undefined, 'shuati-actions');
    const paper = data.papers[this.paperId];
    const title = paper?.title ?? TAB_NAMES[this.tab];
    button(actions, this.tab === 'wrong' ? '重刷错题' : '开始练习', () => this.start({ ...scope, title, mode: 'practice', shuffle: this.shuffle }, ids), true).disabled = !ids.length;
    if (this.tab === 'paper') {
      button(actions, '整卷模考', () => this.configureExam(paper));
      button(actions, '管理题库', () => this.choosePaperToManage());
    }
    if (this.tab !== 'paper' && ids.length) this.renderReviewList(root, data, ids);
    this.renderSessions(root, data);
  }

  choosePaperToManage() {
    dialog(this.app, '选择要管理的题库', (root, modal) => {
      const list = node(root, 'ul', undefined, 'shuati-list shuati-paper-list');
      for (const paper of sortedPapers(this.plugin.data.papers)) {
        const row = node(list, 'li');
        const choice = button(row, paperLabel(paper), () => {
          modal.close();
          const current = this.plugin.data.papers[paper.id];
          if (current) this.managePaper(current);
          else new Notice('题库已删除');
        });
        choice.title = paper.path;
      }
    });
  }

  managePaper(paper) {
    dialog(this.app, '管理题库', (root, modal) => {
      node(root, 'p', paper.title);
      const source = this.app.vault.getAbstractFileByPath(paper.path);
      node(root, 'p', `${source ? '源笔记' : '未找到源笔记'} · ${paper.path}`, 'shuati-muted shuati-path');
      const actions = node(root, 'div', undefined, 'shuati-actions');
      const openAction = action => () => { modal.close(); action(); };
      button(actions, '返回题库选择', openAction(() => this.choosePaperToManage()));
      button(actions, '重命名', openAction(() => this.renamePaper(paper)));
      button(actions, '重定位题库', openAction(() => {
        new PaperNotePicker(this.app, file => this.run(() => this.previewRelocation(paper, file), false)).open();
      }));
      button(actions, '删除题库', openAction(() => this.confirmDeletePaper(paper))).classList.add('mod-warning');
    });
  }

  renamePaper(paper) {
    dialog(this.app, '重命名题库', (root, modal) => {
      const label = node(root, 'label', undefined, 'shuati-field');
      node(label, 'span', '题库名称');
      const input = node(label, 'input', undefined, 'shuati-paper-name');
      input.type = 'text';
      input.value = paper.title;
      const actions = node(root, 'div', undefined, 'shuati-actions');
      button(actions, '取消', () => modal.close());
      const save = button(actions, '保存名称', () => {
        save.disabled = true;
        return this.run(async () => {
          try {
            await this.plugin.update(data => study.renamePaper(data, paper.id, input.value));
            modal.close();
            new Notice('题库已重命名');
          } finally { save.disabled = false; }
        });
      }, true);
      input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) save.click(); });
    });
  }

  confirmDeletePaper(paper) {
    dialog(this.app, '删除题库', (root, modal) => {
      node(root, 'p', `${paper.title} · ${paper.questionIds.length} 题`);
      node(root, 'p', '将删除刷题插件中这套题库的题目、进度、错题、收藏和相关作答。跨题库作答中，仅移除这套题库的题目。源笔记和附件仍保存在库中。');
      const actions = node(root, 'div', undefined, 'shuati-actions');
      button(actions, '取消', () => modal.close());
      const remove = button(actions, '确认删除', () => {
        remove.disabled = true;
        return this.run(async () => {
          try {
            await this.plugin.update(data => study.deletePaper(data, paper.id));
            modal.close();
            new Notice('题库已删除');
          } finally { remove.disabled = false; }
        });
      });
      remove.classList.add('mod-warning');
    });
  }

  async previewRelocation(paper, file) {
    const path = file.path;
    const parsed = await this.plugin.readPaper(file, path);
    dialog(this.app, parsed.issues.length ? '检查新位置的试卷' : '确认重定位题库', (root, modal) => {
      node(root, 'p', `原位置 · ${paper.path}`, 'shuati-muted shuati-path');
      node(root, 'p', `新位置 · ${path}`, 'shuati-path');
      if (parsed.issues.length) { renderImportIssues(root, parsed.issues); return; }
      node(root, 'p', '请选择同一份试卷。重定位成功后，作答记录、错题和收藏会关联到新位置。');
      const actions = node(root, 'div', undefined, 'shuati-actions');
      button(actions, '取消', () => modal.close());
      const save = button(actions, '确认重定位', () => {
        save.disabled = true;
        return this.run(async () => {
          try {
            await this.plugin.update(data => {
              if (this.app.vault.getAbstractFileByPath(path) !== file) throw new Error('新位置已变化，请重新选择笔记');
              return study.relocatePaper(data, paper.id, path, parsed);
            });
            modal.close();
            new Notice('题库已重定位');
          } finally { save.disabled = false; }
        });
      }, true);
    });
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
        this.start({ mode: 'exam', kind: 'paper', paperId: paper.id, title: paper.title, shuffle: this.shuffle }, paper.questionIds, minutes);
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
    this.bindHotkey(button(actions, '上一题', () => this.jump(session, session.cursor - 1)), 'previous').disabled = session.cursor === 0;
    node(actions, 'span', `${session.cursor + 1} / ${total}`, 'shuati-muted');
    this.bindHotkey(button(actions, '下一题', () => this.jump(session, session.cursor + 1)), 'next').disabled = session.cursor === total - 1;
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
      control.disabled = Boolean(result) || session.completed !== undefined;
      if (result && question.answers.includes(option.key)) label.dataset.result = 'correct';
      if (result && selected.includes(option.key) && !question.answers.includes(option.key)) label.dataset.result = 'wrong';
      const optionKey = node(label, 'span', `${option.key}.`, 'shuati-option-key');
      if (!control.disabled) this.bindHotkey(control, actionForOption(question.type, option.key), optionKey);
      this.renderMarkdown(label, option.text, question.path, renderId);
      control.addEventListener('change', () => {
        const keys = [...options.querySelectorAll('input:checked')].map(input => input.value);
        const update = () => this.plugin.update(data => study.setSelection(data, session.id, question.id, keys));
        // Enable grading before the save finishes. Both actions use the same ordered write queue.
        if (session.mode === 'practice') this.refreshSelection(root, session, question, options);
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
      this.bindHotkey(grade, 'grade');
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
    this.addSettingTab(new ShuatiSettings(this));
    this.addRibbonIcon('list-checks', '打开刷题', () => this.openView());
    this.addCommand({ id: 'open', name: '打开刷题', callback: () => this.openView() });
    this.addCommand({ id: 'import-note', name: '导入当前笔记为试卷', callback: () => this.previewImport().catch(error => new Notice(error.message)) });
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      const newPath = file.path;
      this.update(data => study.moveVaultPath(data, oldPath, newPath), data => study.usesVaultPath(data, oldPath))
        .then(changed => { if (changed) this.redrawViews(); }).catch(error => new Notice(error.message));
    }));
  }

  update(mutation, shouldUpdate = () => true) {
    const write = this.writes.then(async () => {
      if (!shouldUpdate(this.data)) return;
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

  async readPaper(file, path) {
    const read = note => this.app.vault.read(note);
    return resolvePaperMedia(parsePaper(await read(file)), path, async (link, source) => {
      const target = this.app.metadataCache.getFirstLinkpathDest(link, source);
      if (!(target instanceof TFile)) return null;
      return { path: target.path, extension: target.extension.toLowerCase(), content: target.extension === 'md' ? await read(target) : undefined };
    });
  }

  async previewImport() {
    const active = this.app.workspace.getActiveFile();
    const recent = active ?? this.app.vault.getAbstractFileByPath(this.app.workspace.getLastOpenFiles()[0] ?? '');
    if (!(recent instanceof TFile) || recent.extension !== 'md') throw new Error('请先打开要导入的 Markdown 笔记');
    const parsed = await this.readPaper(recent, recent.path);
    dialog(this.app, parsed.issues.length ? '请修正试卷' : '导入试卷', (root, modal) => {
      node(root, 'p', recent.path, 'shuati-muted');
      if (parsed.issues.length) {
        renderImportIssues(root, parsed.issues);
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
