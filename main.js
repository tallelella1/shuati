// Built from src/main.cjs by npm run build.
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/parser.cjs
var require_parser = __commonJS({
  "src/parser.cjs"(exports2, module2) {
    var TYPES = { \u5355\u9009: "single", \u591A\u9009: "multiple", \u5224\u65AD: "judge" };
    var OPTION = /^[-*+]\s+([A-HTF])[.．、:：)）]\s*(.*)$/i;
    var ANSWER = /^(?:\*\*)?(?:正确答案|答案)(?:\*\*)?\s*[:：]\s*(?:\*\*)?\s*(.*?)\s*$/;
    var EXPLANATION = /^(?:\*\*)?(?:答案解析|解析)(?:\*\*)?\s*[:：]\s*(?:\*\*)?\s*(.*)$/;
    function parseBlock(lines, number, module3, type) {
      const stem = [], options = [], explanation = [];
      let rawAnswer;
      let phase = "stem";
      for (const line of lines) {
        const answer = line.match(ANSWER);
        const note = line.match(EXPLANATION);
        const option = line.match(OPTION);
        if (phase === "explanation") explanation.push(line);
        else if (answer) {
          if (rawAnswer !== void 0) throw new Error("\u5B58\u5728\u91CD\u590D\u7684\u7B54\u6848\u884C");
          rawAnswer = answer[1].replace(/^\*\*|\*\*$/g, "").trim().toUpperCase();
          phase = "answer";
        } else if (note) {
          explanation.push(note[1]);
          phase = "explanation";
        } else if (option) {
          if (phase === "answer") throw new Error("\u7B54\u6848\u884C\u540E\u51FA\u73B0\u9009\u9879");
          options.push({ key: option[1].toUpperCase(), lines: [option[2]] });
          phase = "options";
        } else if (phase === "stem") stem.push(line);
        else if (phase === "options") options.at(-1).lines.push(line);
        else if (line.trim()) throw new Error("\u7B54\u6848\u884C\u540E\u8BF7\u4EE5\u201C\u89E3\u6790\uFF1A\u201D\u5F00\u5934");
      }
      const body = stem.join("\n").trim();
      if (!body) throw new Error("\u9898\u5E72\u4E3A\u7A7A");
      if (options.length < 2) throw new Error("\u81F3\u5C11\u9700\u8981\u4E24\u4E2A\u9009\u9879");
      if (rawAnswer === void 0) throw new Error("\u7F3A\u5C11\u7B54\u6848\u884C");
      const keys = options.map((option) => option.key);
      if (new Set(keys).size !== keys.length) throw new Error("\u9009\u9879\u952E\u91CD\u590D");
      let answers;
      if (type === "judge") {
        if (keys.length !== 2 || !["AB", "FT"].includes([...keys].sort().join(""))) {
          throw new Error("\u5224\u65AD\u9898\u8BF7\u4F7F\u7528 T/F\uFF0C\u6216\u4EE5\u201C\u6B63\u786E/\u9519\u8BEF\u201D\u4E3A\u5185\u5BB9\u7684 A/B");
        }
        const mapping = new Map(options.map(({ key, lines: [first] }) => [key, keys.includes("T") ? key : /^(正确|对|√|T)$/i.test(first.trim()) ? "T" : /^(错误|错|×|F)$/i.test(first.trim()) ? "F" : ""]));
        if ([...mapping.values()].sort().join("") !== "FT") throw new Error("A/B \u5224\u65AD\u9009\u9879\u5FC5\u987B\u5BF9\u5E94\u6B63\u786E\u548C\u9519\u8BEF");
        const answer = mapping.get(rawAnswer) || { \u6B63\u786E: "T", \u5BF9: "T", \u9519\u8BEF: "F", \u9519: "F", T: "T", F: "F", "\u221A": "T", "\xD7": "F" }[rawAnswer];
        if (answer !== "T" && answer !== "F") throw new Error("\u5224\u65AD\u9898\u7B54\u6848\u65E0\u6548");
        answers = [answer];
        for (const option of options) option.key = mapping.get(option.key);
      } else {
        if (keys.some((key) => !/^[A-H]$/.test(key))) throw new Error("\u9009\u62E9\u9898\u7684\u9009\u9879\u952E\u5E94\u4E3A A \u5230 H");
        if (!/^[A-H]+(?:[\s,，、]+[A-H]+)*$/.test(rawAnswer)) throw new Error("\u7B54\u6848\u683C\u5F0F\u65E0\u6548\uFF0C\u4F8B\u5982 A \u6216 ABC");
        answers = rawAnswer.match(/[A-H]/g).sort();
        if (new Set(answers).size !== answers.length) throw new Error("\u7B54\u6848\u952E\u91CD\u590D");
        if (answers.some((key) => !keys.includes(key))) throw new Error("\u7B54\u6848\u4E2D\u6709\u4E0D\u5B58\u5728\u7684\u9009\u9879\u952E");
        if (type === "single" && answers.length !== 1) throw new Error("\u5355\u9009\u9898\u5FC5\u987B\u53EA\u6709\u4E00\u4E2A\u7B54\u6848");
      }
      const choices = options.map(({ key, lines: lines2 }) => ({ key, text: lines2.join("\n").trim() }));
      if (choices.some((option) => !option.text)) throw new Error("\u9009\u9879\u5185\u5BB9\u4E3A\u7A7A");
      return { number, module: module3, type, stem: body, options: choices, answers, explanation: explanation.join("\n").trim() };
    }
    function parsePaper2(text) {
      const lines = text.replace(/^\uFEFF/, "").split(/\r\n?|\n/);
      const questions = [], issues = [], seen = /* @__PURE__ */ new Set();
      let title = "", current;
      function flush() {
        if (!current) return;
        const { line, header, content } = current;
        const match = header.match(/^(\d+)\s*[·|｜]\s*([^·|｜]+?)\s*[·|｜]\s*(单选|多选|判断)(?:题)?$/);
        const number = match ? Number(match[1]) : void 0;
        try {
          if (!match || !Number.isSafeInteger(number) || number < 1 || !match[2].trim()) {
            throw new Error("\u9898\u76EE\u6807\u9898\u5E94\u4E3A\u201C## \u9898\u53F7 \xB7 \u6A21\u5757 \xB7 \u9898\u578B\u201D");
          }
          if (seen.has(number)) throw new Error("\u9898\u53F7\u91CD\u590D");
          seen.add(number);
          questions.push({ ...parseBlock(content, number, match[2].trim(), TYPES[match[3]]), line });
        } catch (error) {
          issues.push({ line, number, message: error.message });
        }
      }
      for (const [index, line] of lines.entries()) {
        const header = line.match(/^##\s+(.+?)\s*$/);
        const heading = line.match(/^#\s+(.+?)\s*$/);
        if (header) {
          flush();
          current = { line: index + 1, header: header[1], content: [] };
        } else if (heading && !current && !title) title = heading[1].trim();
        else if (current) current.content.push(line);
      }
      flush();
      if (!title) issues.unshift({ line: 1, message: "\u7F3A\u5C11\u4E00\u7EA7\u6807\u9898\u4F5C\u4E3A\u5377\u540D" });
      if (!questions.length && !issues.length) issues.push({ line: 1, message: "\u6CA1\u6709\u9898\u76EE" });
      return { title, questions, issues };
    }
    function isCorrect(question, selected) {
      return selected.length === question.answers.length && new Set(selected).size === selected.length && selected.every((key) => question.answers.includes(key));
    }
    module2.exports = { parsePaper: parsePaper2, isCorrect };
  }
});

// src/media.cjs
var require_media = __commonJS({
  "src/media.cjs"(exports2, module2) {
    var IMAGE = /^(png|jpe?g|gif|webp|avif|bmp|svg)$/i;
    var EMBED = /!\[\[([^\]\n]+)\]\]|!\[([^\]\n]*)\]\(\s*(?:<([^>\n]+)>|([^\s)]+))(?:\s+"[^"\n]*")?\s*\)/g;
    var REMAINING_IMAGE = /!\[(?:\[|[^\]\n]*\](?:\s*[\[(])?)|<(?:img|picture|source|iframe|video|audio|object|embed|svg)\b/i;
    async function resolvePaperMedia2(parsed, origin, resolve) {
      const issues = [...parsed.issues];
      const cache = /* @__PURE__ */ new Map();
      const lookup = (reference, source) => {
        const key = JSON.stringify([source, reference]);
        if (!cache.has(key)) cache.set(key, Promise.resolve().then(() => resolve(reference, source)));
        return cache.get(key);
      };
      async function expand(text, source, trail, report, field) {
        let result = "";
        let offset = 0;
        function plain(fragment) {
          if (REMAINING_IMAGE.test(fragment)) report(`${field}\u542B\u4E0D\u652F\u6301\u7684\u5D4C\u5165\uFF0C\u8BF7\u4F7F\u7528 ![[\u672C\u5730\u56FE\u7247]] \u6216 ![[\u6750\u6599\u7B14\u8BB0]]`);
          return fragment;
        }
        for (const match of text.matchAll(EMBED)) {
          result += plain(text.slice(offset, match.index));
          offset = match.index + match[0].length;
          const [root, size] = match[1]?.split("|", 2) ?? [match[3] ?? match[4], void 0];
          const value = root.trim();
          let reference = value;
          try {
            if (!match[1]) reference = decodeURIComponent(value);
          } catch {
          }
          if (!reference || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference) || reference.includes("#")) {
            report(`${field}\u53EA\u652F\u6301\u672C\u5730\u56FE\u7247\u6216\u6574\u7BC7\u6750\u6599\u7B14\u8BB0\uFF1A${reference || "\u7A7A\u5F15\u7528"}`);
            continue;
          }
          const target = await lookup(reference, source);
          if (!target) {
            report(`${field}\u627E\u4E0D\u5230\u9644\u4EF6\u6216\u6750\u6599\uFF1A${reference}`);
            continue;
          }
          if (target.extension === "md" && match[1]) {
            if (trail.includes(target.path)) {
              report(`${field}\u7684\u6750\u6599\u5F15\u7528\u5F62\u6210\u5FAA\u73AF\uFF1A${reference}`);
              continue;
            }
            result += "\n\n" + await expand(target.content, target.path, [...trail, target.path], report, field) + "\n\n";
          } else if (IMAGE.test(target.extension)) {
            const width = size && /^\d+(?:x\d+)?$/.test(size) ? `|${size}` : "";
            result += `![[/${target.path}${width}]]`;
          } else report(`${field}\u4E0D\u652F\u6301\u6B64\u9644\u4EF6\u7C7B\u578B\uFF1A${reference}`);
        }
        return (result + plain(text.slice(offset))).trim();
      }
      if (issues.length) return { ...parsed, issues };
      const questions = [];
      for (const question of parsed.questions) {
        const report = (message) => issues.push({ line: question.line, number: question.number, message });
        const field = (text, name) => expand(text, origin, [origin], report, name);
        const stem = await field(question.stem, "\u9898\u5E72");
        const options = [];
        for (const option of question.options) options.push({ ...option, text: await field(option.text, `\u9009\u9879 ${option.key}`) });
        const explanation = await field(question.explanation, "\u89E3\u6790");
        questions.push({ ...question, stem, options, explanation });
      }
      return { ...parsed, questions, issues };
    }
    module2.exports = { resolvePaperMedia: resolvePaperMedia2 };
  }
});

// src/study.cjs
var require_study = __commonJS({
  "src/study.cjs"(exports2, module2) {
    var { isCorrect } = require_parser();
    function newData() {
      return { schema: 1, nextId: 1, papers: {}, versions: {}, progress: {}, sessions: {} };
    }
    function allocate(data, prefix) {
      return `${prefix}-${data.nextId++}`;
    }
    var signature = (q) => JSON.stringify([q.type, q.stem, q.options, q.answers]);
    function importPaper(data, path, parsed) {
      if (parsed.issues.length || !parsed.questions.length) throw new Error("\u8BF7\u5148\u4FEE\u6B63\u8BD5\u5377\u5BFC\u5165\u9519\u8BEF");
      const existing = Object.values(data.papers).find((paper2) => paper2.path === path);
      const id = existing?.id ?? allocate(data, "paper");
      const previous = new Map((existing?.questionIds ?? []).map((id2) => [data.versions[id2].number, data.versions[id2]]));
      const questionIds = parsed.questions.map(({ line, ...question }) => {
        const old = previous.get(question.number);
        const questionId = old && signature(old) === signature(question) ? old.id : allocate(data, "q");
        data.versions[questionId] = { ...question, id: questionId, paperId: id, path };
        return questionId;
      });
      const paper = { id, path, title: parsed.title, questionIds };
      data.papers[id] = paper;
      return paper;
    }
    function pickQuestions(data, { kind, paperId, module: module3, unanswered = false }) {
      const papers = paperId ? [data.papers[paperId]].filter(Boolean) : Object.values(data.papers);
      return papers.flatMap((paper) => paper.questionIds).filter((id) => {
        const progress = data.progress[id];
        return (!module3 || data.versions[id].module === module3) && (kind !== "wrong" || progress?.isWrong) && (kind !== "bookmarked" || progress?.bookmarked) && (!unanswered || !progress?.attempts);
      });
    }
    function record(data, questionId, selected) {
      if (!selected.length) return "unanswered";
      const correct = isCorrect(data.versions[questionId], selected);
      const previous = data.progress[questionId] ?? {};
      data.progress[questionId] = {
        ...previous,
        attempts: (previous.attempts ?? 0) + 1,
        wrongCount: (previous.wrongCount ?? 0) + Number(!correct),
        isWrong: !correct
      };
      return correct ? "correct" : "wrong";
    }
    function startSession(data, scope, questionIds, minutes, now = Date.now()) {
      if (!questionIds.length) throw new Error("\u6CA1\u6709\u53EF\u4F5C\u7B54\u7684\u9898\u76EE");
      const id = allocate(data, "session");
      const session = { ...scope, id, questionIds: [...questionIds], cursor: 0, selected: {}, results: {}, started: now };
      if (minutes) session.deadline = now + minutes * 6e4;
      data.sessions[id] = session;
      return session;
    }
    function setSelection(data, sessionId, id, selected, now = Date.now()) {
      const session = data.sessions[sessionId];
      if (expire(data, sessionId, now) || session.completed || session.results[id] || !session.questionIds.includes(id)) return;
      const question = data.versions[id];
      if (question.type !== "multiple" && selected.length > 1 || new Set(selected).size !== selected.length || selected.some((key) => !question.options.some((option) => option.key === key))) throw new Error("\u9009\u9879\u65E0\u6548");
      session.selected[id] = [...selected];
    }
    function grade(data, sessionId, id) {
      const session = data.sessions[sessionId];
      if (session.completed || session.mode !== "practice" || session.results[id] || !session.questionIds.includes(id)) return;
      const selected = session.selected[id] ?? [];
      if (selected.length) session.results[id] = record(data, id, selected);
    }
    function submit(data, sessionId, now = Date.now()) {
      const session = data.sessions[sessionId];
      if (session.completed) return;
      for (const id of session.questionIds) {
        if (!session.results[id]) session.results[id] = session.mode === "exam" ? record(data, id, session.selected[id] ?? []) : "unanswered";
      }
      session.completed = Math.min(now, session.deadline ?? now);
    }
    function expire(data, sessionId, now = Date.now()) {
      const session = data.sessions[sessionId];
      if (session.completed || session.deadline === void 0 || now < session.deadline) return false;
      submit(data, sessionId, now);
      return true;
    }
    function toggleBookmark(data, id) {
      const previous = data.progress[id] ?? {};
      data.progress[id] = { ...previous, bookmarked: !previous.bookmarked };
    }
    module2.exports = { newData, importPaper, pickQuestions, record, startSession, setSelection, grade, submit, expire, toggleBookmark };
  }
});

// src/main.cjs
var { ItemView, Plugin, Modal, Notice, Component, MarkdownRenderer, TFile } = require("obsidian");
var { parsePaper } = require_parser();
var { resolvePaperMedia } = require_media();
var study = require_study();
var VIEW = "shuati-study";
var TAB_NAMES = { paper: "\u8BD5\u5377", wrong: "\u9519\u9898", bookmarked: "\u6536\u85CF" };
var TYPE_NAMES = { single: "\u5355\u9009", multiple: "\u591A\u9009", judge: "\u5224\u65AD" };
var RESULT_NAMES = { correct: "\u7B54\u5BF9", wrong: "\u7B54\u9519", unanswered: "\u672A\u7B54" };
function node(parent, tag, text, className) {
  const element = parent.ownerDocument.createElement(tag);
  if (text !== void 0) element.textContent = text;
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
}
function button(parent, text, handler, primary = false) {
  const element = node(parent, "button", text, primary ? "mod-cta" : void 0);
  element.type = "button";
  element.addEventListener("click", handler);
  return element;
}
function select(parent, label, choices, value) {
  const wrapper = node(parent, "label", void 0, "shuati-field");
  node(wrapper, "span", label);
  const input = node(wrapper, "select");
  for (const [id, name] of choices) {
    const option = node(input, "option", name);
    option.value = id;
  }
  input.value = value;
  return input;
}
function dialog(app, title, fill) {
  const modal = new Modal(app);
  modal.setTitle(title);
  modal.contentEl.classList.add("shuati-modal");
  fill(modal.contentEl, modal);
  modal.onClose = () => modal.contentEl.replaceChildren();
  modal.open();
  return modal;
}
var ShuatiView = class extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.tab = "paper";
    this.paperId = "";
    this.module = "";
    this.unanswered = false;
    this.sessionId = "";
    this.showCard = false;
    this.rawTimer = null;
    this.markdown = null;
    this.renderId = 0;
  }
  getViewType() {
    return VIEW;
  }
  getDisplayText() {
    return "\u5237\u9898";
  }
  getIcon() {
    return "list-checks";
  }
  async onOpen() {
    this.contentEl.classList.add("shuati-view");
    this.registerInterval(window.setInterval(() => this.tick(), 1e3));
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
    }).catch((error) => {
      console.error("Shuati", error);
      new Notice(`\u5237\u9898 \xB7 ${error.message}`);
      if (redraw) this.plugin.redrawViews();
    });
  }
  render() {
    const renderId = ++this.renderId;
    this.clearMarkdown();
    this.markdown = this.addChild(new Component());
    this.rawTimer = null;
    this.contentEl.replaceChildren();
    const container = node(this.contentEl, "div", void 0, "shuati-shell");
    const session = this.plugin.data.sessions[this.sessionId];
    if (session) this.renderSession(container, session, renderId);
    else this.renderHome(container);
  }
  renderHome(root) {
    const data = this.plugin.data;
    const header = node(root, "header", void 0, "shuati-top");
    node(header, "h1", "\u5237\u9898");
    button(header, "\u5BFC\u5165\u5F53\u524D\u7B14\u8BB0", () => this.run(() => this.plugin.previewImport()), true);
    const tabs = node(root, "nav", void 0, "shuati-tabs");
    tabs.setAttribute("aria-label", "\u5237\u9898\u5206\u7C7B");
    for (const [name, label] of Object.entries(TAB_NAMES)) {
      const tab = button(tabs, label, () => {
        this.tab = name;
        this.module = "";
        this.unanswered = false;
        this.render();
      });
      tab.setAttribute("aria-pressed", String(this.tab === name));
    }
    const papers = Object.values(data.papers);
    if (!papers.length) {
      node(root, "p", "\u6253\u5F00\u9898\u5E93\u7B14\u8BB0\uFF0C\u5728\u547D\u4EE4\u9762\u677F\u8FD0\u884C\u300C\u5BFC\u5165\u5F53\u524D\u7B14\u8BB0\u4E3A\u8BD5\u5377\u300D\u3002", "shuati-empty");
      return;
    }
    if (!data.papers[this.paperId]) this.paperId = this.tab === "paper" ? papers[0].id : "";
    const filters = node(root, "div", void 0, "shuati-filters");
    const paperChoices = papers.map((paper2) => [paper2.id, `${paper2.title}\uFF08${paper2.questionIds.length} \u9898\uFF09`]);
    if (this.tab !== "paper") paperChoices.unshift(["", "\u5168\u90E8\u8BD5\u5377"]);
    const paperInput = select(filters, "\u8BD5\u5377", paperChoices, this.paperId);
    paperInput.addEventListener("change", () => {
      this.paperId = paperInput.value;
      this.module = "";
      this.render();
    });
    const baseScope = { kind: this.tab, paperId: this.paperId };
    const moduleNames = [...new Set(study.pickQuestions(data, baseScope).map((id) => data.versions[id].module))];
    if (!moduleNames.includes(this.module)) this.module = "";
    const moduleInput = select(filters, "\u6A21\u5757", [["", "\u5168\u90E8\u6A21\u5757"], ...moduleNames.map((name) => [name, name])], this.module);
    moduleInput.addEventListener("change", () => {
      this.module = moduleInput.value;
      this.render();
    });
    if (this.tab === "paper") {
      const wrapper = node(filters, "label", void 0, "shuati-check");
      const input = node(wrapper, "input");
      input.type = "checkbox";
      input.checked = this.unanswered;
      input.addEventListener("change", () => {
        this.unanswered = input.checked;
        this.render();
      });
      node(wrapper, "span", "\u53EA\u7EC3\u672A\u7B54\u9898");
    }
    const scope = { ...baseScope, module: this.module, unanswered: this.unanswered };
    const ids = study.pickQuestions(data, scope);
    node(root, "p", `\u53EF\u7EC3 ${ids.length} \u9898`, "shuati-muted");
    const actions = node(root, "div", void 0, "shuati-actions");
    const paper = data.papers[this.paperId];
    const title = paper?.title ?? TAB_NAMES[this.tab];
    button(actions, this.tab === "wrong" ? "\u91CD\u5237\u9519\u9898" : "\u5F00\u59CB\u7EC3\u4E60", () => this.start({ ...scope, title, mode: "practice" }, ids), true).disabled = !ids.length;
    if (this.tab === "paper") button(actions, "\u6574\u5377\u6A21\u8003", () => this.configureExam(paper));
    if (this.tab !== "paper" && ids.length) this.renderReviewList(root, data, ids);
    this.renderSessions(root, data);
  }
  renderReviewList(root, data, ids) {
    const list = node(root, "ul", void 0, "shuati-list");
    for (const id of ids) {
      const q = data.versions[id];
      const progress = data.progress[id];
      const text = `${data.papers[q.paperId].title} \xB7 \u7B2C ${q.number} \u9898 \xB7 ${q.module}`;
      const row = node(list, "li");
      button(row, text, () => this.start({ mode: "practice", kind: this.tab, paperId: q.paperId, title: text }, [id]));
      if (progress?.wrongCount) node(row, "span", `\u7D2F\u8BA1\u7B54\u9519 ${progress.wrongCount} \u6B21`, "shuati-muted");
    }
  }
  renderSessions(root, data) {
    const sessions = Object.values(data.sessions).reverse();
    const active = sessions.filter((session) => session.completed === void 0);
    const history = sessions.filter((session) => session.completed !== void 0);
    if (active.length) this.sessionList(root, "\u7EE7\u7EED\u4F5C\u7B54", active);
    if (history.length) this.sessionList(root, "\u4F5C\u7B54\u8BB0\u5F55", history, true);
  }
  sessionList(root, title, sessions, collapsed = false) {
    const section = node(root, collapsed ? "details" : "section", void 0, "shuati-section");
    node(section, collapsed ? "summary" : "h2", title);
    const list = node(section, "ul", void 0, "shuati-list");
    for (const session of sessions) {
      const label = session.mode === "exam" ? "\u6A21\u8003" : "\u7EC3\u4E60";
      const row = node(list, "li");
      const date = new Date(session.started).toLocaleString();
      button(row, `${session.title} \xB7 ${label} \xB7 ${date}`, () => this.resume(session.id));
    }
  }
  configureExam(paper) {
    dialog(this.app, "\u6574\u5377\u6A21\u8003", (root, modal) => {
      node(root, "p", `${paper.title} \xB7 ${paper.questionIds.length} \u9898`);
      const label = node(root, "label", void 0, "shuati-field");
      node(label, "span", "\u9650\u65F6\uFF08\u5206\u949F\uFF0C\u53EF\u7559\u7A7A\uFF09");
      const input = node(label, "input");
      input.type = "number";
      input.min = "1";
      input.step = "1";
      button(root, "\u5F00\u59CB\u6A21\u8003", () => {
        const minutes = input.value === "" ? void 0 : Number(input.value);
        if (input.validity.badInput || minutes !== void 0 && (!Number.isSafeInteger(minutes) || minutes < 1 || !Number.isSafeInteger(Date.now() + minutes * 6e4))) {
          new Notice("\u9650\u65F6\u8BF7\u8F93\u5165\u6709\u6548\u7684\u6B63\u6574\u6570\u5206\u949F");
          return;
        }
        modal.close();
        this.start({ mode: "exam", kind: "paper", paperId: paper.id, title: paper.title }, paper.questionIds, minutes);
      }, true);
    });
  }
  start(scope, ids, minutes) {
    return this.run(async () => {
      const session = await this.plugin.update((data) => study.startSession(data, scope, ids, minutes));
      this.sessionId = session.id;
      this.showCard = scope.mode === "exam";
    });
  }
  resume(id) {
    return this.run(async () => {
      let session = this.plugin.data.sessions[id];
      if (session.deadline !== void 0 && session.completed === void 0 && Date.now() >= session.deadline) {
        await this.plugin.update((data) => study.expire(data, id));
        session = this.plugin.data.sessions[id];
      }
      this.sessionId = id;
      this.showCard = session.mode === "exam";
    });
  }
  tick() {
    const session = this.plugin.data.sessions[this.sessionId];
    if (!session || session.completed !== void 0 || session.deadline === void 0) return;
    const seconds = Math.max(0, Math.ceil((session.deadline - Date.now()) / 1e3));
    if (this.rawTimer) {
      const minutes = Math.floor(seconds / 60);
      this.rawTimer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    }
    if (!seconds && !this.expiring) {
      this.expiring = true;
      this.run(() => this.plugin.update((data) => study.expire(data, session.id))).finally(() => {
        this.expiring = false;
      });
    }
  }
  renderSession(root, session, renderId) {
    const done = session.completed !== void 0;
    const header = node(root, "header", void 0, "shuati-top");
    button(header, "\u8FD4\u56DE\u9898\u5E93", () => {
      this.sessionId = "";
      this.render();
    });
    node(header, "h1", session.title);
    if (!done && session.deadline !== void 0) {
      this.rawTimer = node(header, "span", void 0, "shuati-timer");
      this.rawTimer.setAttribute("aria-label", "\u5269\u4F59\u65F6\u95F4");
      this.tick();
    }
    const total = session.questionIds.length;
    if (done) {
      const results = Object.values(session.results);
      const count = (kind) => results.filter((result2) => result2 === kind).length;
      node(root, "p", `\u6210\u7EE9 ${count("correct")} / ${total} \xB7 \u7B54\u9519 ${count("wrong")} \xB7 \u672A\u7B54 ${count("unanswered")}`, "shuati-score");
    } else {
      const answered = session.mode === "exam" ? Object.values(session.selected).filter((keys) => keys.length).length : Object.keys(session.results).length;
      node(root, "p", `\u5DF2\u7B54 ${answered} / ${total}`, "shuati-muted shuati-progress");
    }
    if (session.mode === "exam" || done) {
      const toggle = button(root, this.showCard ? "\u6536\u8D77\u7B54\u9898\u5361" : "\u5C55\u5F00\u7B54\u9898\u5361", () => {
        this.showCard = !this.showCard;
        this.render();
      });
      toggle.setAttribute("aria-expanded", String(this.showCard));
      if (this.showCard) this.renderCard(root, session);
    }
    const id = session.questionIds[session.cursor];
    const question = this.plugin.data.versions[id];
    const result = session.results[id];
    this.renderQuestion(root, session, question, result, renderId);
    const actions = node(root, "footer", void 0, "shuati-actions shuati-footer");
    button(actions, "\u4E0A\u4E00\u9898", () => this.jump(session, session.cursor - 1)).disabled = session.cursor === 0;
    node(actions, "span", `${session.cursor + 1} / ${total}`, "shuati-muted");
    button(actions, "\u4E0B\u4E00\u9898", () => this.jump(session, session.cursor + 1)).disabled = session.cursor === total - 1;
    if (!done) button(actions, session.mode === "exam" ? "\u4EA4\u5377" : "\u7ED3\u675F\u7EC3\u4E60", () => this.confirmSubmit(session), true);
  }
  renderCard(root, session) {
    const card = node(root, "div", void 0, "shuati-grid");
    for (const [index, id] of session.questionIds.entries()) {
      const q = this.plugin.data.versions[id];
      const item = button(card, String(q.number), () => this.jump(session, index));
      const result = session.results[id];
      const status = result ? RESULT_NAMES[result] : session.selected[id]?.length ? "\u5DF2\u7B54" : "\u672A\u7B54";
      item.setAttribute("aria-label", `\u7B2C ${q.number} \u9898\uFF0C${status}`);
      item.dataset.status = result ?? (session.selected[id]?.length ? "selected" : "unanswered");
      if (index === session.cursor) item.setAttribute("aria-current", "step");
    }
  }
  jump(session, cursor) {
    return this.run(() => this.plugin.update((data) => {
      const current = data.sessions[session.id];
      if (cursor >= 0 && cursor < current.questionIds.length) current.cursor = cursor;
    }));
  }
  confirmSubmit(session) {
    const exam = session.mode === "exam";
    dialog(this.app, exam ? "\u786E\u8BA4\u4EA4\u5377" : "\u7ED3\u675F\u672C\u6B21\u7EC3\u4E60", (root, modal) => {
      const ungraded = session.questionIds.filter((id) => exam ? !session.selected[id]?.length : !session.results[id]).length;
      node(root, "p", ungraded ? `\u8FD8\u6709 ${ungraded} \u9053\u9898${exam ? "\u672A\u4F5C\u7B54" : "\u672A\u5224\u5206"}\u3002` : "\u5DF2\u5B8C\u6210\u5168\u90E8\u9898\u76EE\u3002");
      const actions = node(root, "div", void 0, "shuati-actions");
      button(actions, "\u7EE7\u7EED\u4F5C\u7B54", () => modal.close());
      button(actions, exam ? "\u786E\u8BA4\u4EA4\u5377" : "\u7ED3\u675F\u7EC3\u4E60", () => {
        modal.close();
        this.showCard = true;
        return this.run(() => this.plugin.update((data) => study.submit(data, session.id)));
      }, true);
    });
  }
  renderQuestion(root, session, question, result, renderId) {
    const article = node(root, "article", void 0, "shuati-question");
    const top = node(article, "div", void 0, "shuati-top");
    node(top, "h2", `\u7B2C ${question.number} \u9898 \xB7 ${question.module} \xB7 ${TYPE_NAMES[question.type]}`);
    const progress = this.plugin.data.progress[question.id];
    const star = button(top, progress?.bookmarked ? "\u53D6\u6D88\u6536\u85CF" : "\u6536\u85CF", () => this.run(() => this.plugin.update((data) => study.toggleBookmark(data, question.id))));
    star.setAttribute("aria-pressed", String(Boolean(progress?.bookmarked)));
    if (progress?.wrongCount) node(article, "p", `\u7D2F\u8BA1\u7B54\u9519 ${progress.wrongCount} \u6B21`, "shuati-muted");
    this.renderMarkdown(article, question.stem, question.path, renderId);
    const options = node(article, "fieldset", void 0, "shuati-options");
    node(options, "legend", question.type === "multiple" ? "\u9009\u62E9\u6240\u6709\u6B63\u786E\u9009\u9879" : "\u9009\u62E9\u4E00\u4E2A\u9009\u9879");
    const selected = session.selected[question.id] ?? [];
    for (const option of question.options) {
      const label = node(options, "label", void 0, "shuati-option");
      const control = node(label, "input");
      control.type = question.type === "multiple" ? "checkbox" : "radio";
      control.name = `shuati-option-${session.id}-${this.leaf.id}`;
      control.value = option.key;
      control.setAttribute("aria-label", option.key);
      control.checked = selected.includes(option.key);
      control.disabled = Boolean(result);
      if (result && question.answers.includes(option.key)) label.dataset.result = "correct";
      if (result && selected.includes(option.key) && !question.answers.includes(option.key)) label.dataset.result = "wrong";
      node(label, "span", `${option.key}.`, "shuati-option-key");
      this.renderMarkdown(label, option.text, question.path, renderId);
      control.addEventListener("change", () => {
        const keys = [...options.querySelectorAll("input:checked")].map((input) => input.value);
        const update = () => this.plugin.update((data) => study.setSelection(data, session.id, question.id, keys));
        this.run(update, false).then(() => {
          const current = this.plugin.data.sessions[session.id];
          if (renderId !== this.renderId) return;
          if (current.completed !== void 0) this.render();
          else this.refreshSelection(root, current, question, options);
        });
      });
    }
    if (result) {
      const feedback = node(article, "div", void 0, "shuati-feedback");
      feedback.dataset.result = result;
      node(feedback, "strong", `${RESULT_NAMES[result]} \xB7 \u6B63\u786E\u7B54\u6848 ${question.answers.join("\u3001")}`);
      if (question.explanation) this.renderMarkdown(feedback, question.explanation, question.path, renderId);
    } else if (session.mode === "practice") {
      const grade = button(article, "\u63D0\u4EA4\u672C\u9898", () => this.run(() => this.plugin.update((data) => study.grade(data, session.id, question.id))), true);
      grade.classList.add("shuati-grade");
      grade.disabled = !selected.length;
    }
  }
  refreshSelection(root, session, question, options) {
    if (session.mode === "practice") {
      const grade = root.querySelector(".shuati-grade");
      if (grade) grade.disabled = !options.querySelector("input:checked");
    } else {
      const progress = root.querySelector(".shuati-progress");
      if (progress) progress.textContent = `\u5DF2\u7B54 ${Object.values(session.selected).filter((keys) => keys.length).length} / ${session.questionIds.length}`;
      const card = root.querySelector(".shuati-grid");
      const item = card?.children[session.cursor];
      if (item) {
        const answered = Boolean(session.selected[question.id]?.length);
        item.dataset.status = answered ? "selected" : "unanswered";
        item.setAttribute("aria-label", `\u7B2C ${question.number} \u9898\uFF0C${answered ? "\u5DF2\u7B54" : "\u672A\u7B54"}`);
      }
    }
  }
  renderMarkdown(parent, markdown, source, renderId) {
    const target = node(parent, "div", void 0, "shuati-markdown markdown-rendered");
    MarkdownRenderer.render(this.app, markdown, target, source, this.markdown).then(() => {
      if (renderId !== this.renderId) return;
      for (const img of target.querySelectorAll("img")) {
        img.classList.add("shuati-image");
        img.title = "\u67E5\u770B\u5927\u56FE";
        img.tabIndex = 0;
        const zoom = (event) => {
          event.preventDefault();
          event.stopPropagation();
          dialog(this.app, "\u9898\u56FE", (root) => {
            const large = node(root, "img", void 0, "shuati-zoom");
            large.src = img.currentSrc || img.src;
            large.alt = img.alt;
          });
        };
        img.addEventListener("click", zoom);
        img.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") zoom(event);
        });
      }
    }).catch((error) => {
      if (renderId === this.renderId) target.textContent = `\u6E32\u67D3\u5931\u8D25\uFF1A${error.message}`;
    });
  }
};
var ShuatiPlugin = class extends Plugin {
  async onload() {
    const saved = await this.loadData();
    if (saved && (saved.schema !== 1 || !Number.isSafeInteger(saved.nextId) || saved.nextId < 1 || ["papers", "versions", "progress", "sessions"].some((key) => !saved[key] || typeof saved[key] !== "object" || Array.isArray(saved[key])))) {
      throw new Error("\u5237\u9898\u5B58\u6863\u683C\u5F0F\u65E0\u6548\uFF0C\u539F\u6587\u4EF6\u5DF2\u4FDD\u7559");
    }
    this.data = saved ?? study.newData();
    this.writes = Promise.resolve();
    this.registerView(VIEW, (leaf) => new ShuatiView(leaf, this));
    this.addRibbonIcon("list-checks", "\u6253\u5F00\u5237\u9898", () => this.openView());
    this.addCommand({ id: "open", name: "\u6253\u5F00\u5237\u9898", callback: () => this.openView() });
    this.addCommand({ id: "import-note", name: "\u5BFC\u5165\u5F53\u524D\u7B14\u8BB0\u4E3A\u8BD5\u5377", callback: () => this.previewImport().catch((error) => new Notice(error.message)) });
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      const toPath = (path) => path === oldPath ? file.path : path.startsWith(`${oldPath}/`) ? file.path + path.slice(oldPath.length) : path;
      if (!Object.values(this.data.papers).some((paper) => toPath(paper.path) !== paper.path)) return;
      this.update((data) => {
        for (const paper of Object.values(data.papers)) paper.path = toPath(paper.path);
        for (const question of Object.values(data.versions)) question.path = toPath(question.path);
      }).then(() => this.redrawViews()).catch((error) => new Notice(error.message));
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
    this.writes = write.catch(() => {
    });
    return write;
  }
  redrawViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) leaf.view.render();
  }
  async openView() {
    let [leaf] = this.app.workspace.getLeavesOfType(VIEW);
    if (!leaf) {
      leaf = this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    return leaf.view;
  }
  async previewImport() {
    const active = this.app.workspace.getActiveFile();
    const recent = active ?? this.app.vault.getAbstractFileByPath(this.app.workspace.getLastOpenFiles()[0] ?? "");
    if (!(recent instanceof TFile) || recent.extension !== "md") throw new Error("\u8BF7\u5148\u6253\u5F00\u8981\u5BFC\u5165\u7684 Markdown \u7B14\u8BB0");
    const read = (file) => this.app.vault.read(file);
    const parsed = await resolvePaperMedia(parsePaper(await read(recent)), recent.path, async (link, source) => {
      const file = this.app.metadataCache.getFirstLinkpathDest(link, source);
      if (!(file instanceof TFile)) return null;
      return { path: file.path, extension: file.extension.toLowerCase(), content: file.extension === "md" ? await read(file) : void 0 };
    });
    dialog(this.app, parsed.issues.length ? "\u8BF7\u4FEE\u6B63\u8BD5\u5377" : "\u5BFC\u5165\u8BD5\u5377", (root, modal) => {
      node(root, "p", recent.path, "shuati-muted");
      if (parsed.issues.length) {
        const list = node(root, "ul", void 0, "shuati-errors");
        for (const issue of parsed.issues) {
          node(list, "li", `${issue.number ? `\u7B2C ${issue.number} \u9898 \xB7 ` : ""}\u7B2C ${issue.line} \u884C \xB7 ${issue.message}`);
        }
        return;
      }
      node(root, "p", `${parsed.title} \xB7 ${parsed.questions.length} \u9898`);
      const save = button(root, "\u786E\u8BA4\u5BFC\u5165", async () => {
        save.disabled = true;
        try {
          const paper = await this.update((data) => study.importPaper(data, recent.path, parsed));
          modal.close();
          const view = await this.openView();
          view.paperId = paper.id;
          view.tab = "paper";
          view.module = "";
          view.unanswered = false;
          view.sessionId = "";
          this.redrawViews();
          new Notice(`\u5DF2\u5BFC\u5165 ${paper.questionIds.length} \u9898`);
        } catch (error) {
          new Notice(`\u5BFC\u5165\u5931\u8D25\uFF1A${error.message}`);
          save.disabled = false;
        }
      }, true);
    });
  }
};
module.exports = ShuatiPlugin;
