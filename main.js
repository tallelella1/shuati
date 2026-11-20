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
    function mapStoredImages(text, mapPath) {
      return text.replace(
        /!\[\[\/([^|\]\n]+)(\|\d+(?:x\d+)?)?\]\]/g,
        (_, path, size = "") => `![[/${mapPath(path)}${size}]]`
      );
    }
    function mapQuestionImages(question, mapPath) {
      return {
        ...question,
        stem: mapStoredImages(question.stem, mapPath),
        options: question.options.map((option) => ({ ...option, text: mapStoredImages(option.text, mapPath) })),
        explanation: mapStoredImages(question.explanation, mapPath)
      };
    }
    module2.exports = { resolvePaperMedia: resolvePaperMedia2, mapQuestionImages };
  }
});

// src/study.cjs
var require_study = __commonJS({
  "src/study.cjs"(exports2, module2) {
    var { isCorrect } = require_parser();
    var { mapQuestionImages } = require_media();
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
      const paper = { ...existing, id, path, title: existing?.customTitle ?? parsed.title, questionIds };
      data.papers[id] = paper;
      return paper;
    }
    function requirePaper(data, id) {
      const paper = data.papers[id];
      if (!paper) throw new Error("\u9898\u5E93\u5DF2\u5220\u9664");
      return paper;
    }
    function renamePaper(data, id, title) {
      const paper = requirePaper(data, id);
      const name = title.trim();
      if (!name) throw new Error("\u9898\u5E93\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
      paper.title = paper.customTitle = name;
    }
    function deletePaper(data, id) {
      if (!data.papers[id]) return false;
      delete data.papers[id];
      const removed = /* @__PURE__ */ new Set();
      for (const question of Object.values(data.versions)) {
        if (question.paperId !== id) continue;
        removed.add(question.id);
        delete data.versions[question.id];
        delete data.progress[question.id];
      }
      for (const session of Object.values(data.sessions)) {
        const remaining = session.questionIds.filter((questionId) => !removed.has(questionId));
        if (session.paperId === id || !remaining.length) {
          delete data.sessions[session.id];
        } else if (remaining.length !== session.questionIds.length) {
          const beforeCursor = session.questionIds.slice(0, session.cursor).filter((questionId) => !removed.has(questionId));
          session.cursor = Math.min(beforeCursor.length, remaining.length - 1);
          session.questionIds = remaining;
          for (const store of [session.selected, session.results]) {
            for (const questionId of Object.keys(store)) if (removed.has(questionId)) delete store[questionId];
          }
        }
      }
      return true;
    }
    var withinPath = (path, root) => path === root || path.startsWith(`${root}/`);
    function mentionsImagePath(question, root) {
      const prefix = `![[/${root}`;
      const matches = (text) => text.includes(`${prefix}]]`) || text.includes(`${prefix}|`) || text.includes(`${prefix}/`);
      return matches(question.stem) || matches(question.explanation) || question.options.some((option) => matches(option.text));
    }
    function usesVaultPath(data, root) {
      return Object.values(data.papers).some((paper) => withinPath(paper.path, root)) || Object.values(data.versions).some((question) => withinPath(question.path, root) || mentionsImagePath(question, root));
    }
    function moveVaultPath(data, oldPath, newPath) {
      const move = (path) => withinPath(path, oldPath) ? newPath + path.slice(oldPath.length) : path;
      for (const paper of Object.values(data.papers)) paper.path = move(paper.path);
      for (const question of Object.values(data.versions)) {
        question.path = move(question.path);
        if (mentionsImagePath(question, oldPath)) data.versions[question.id] = mapQuestionImages(question, move);
      }
      return true;
    }
    function relocationContent(question, imagePaths) {
      const mapped = mapQuestionImages(question, (path) => {
        imagePaths.push(path);
        return path.slice(path.lastIndexOf("/") + 1);
      });
      return JSON.stringify([mapped.number, mapped.module, signature(mapped), mapped.explanation]);
    }
    function relocatePaper(data, id, path, parsed) {
      const paper = requirePaper(data, id);
      if (Object.values(data.papers).some((p) => p.id !== id && p.path === path)) throw new Error("\u8BE5\u7B14\u8BB0\u5DF2\u5BFC\u5165\u4E3A\u53E6\u4E00\u5957\u9898\u5E93");
      if (parsed.issues.length || !parsed.questions.length) throw new Error("\u8BF7\u5148\u4FEE\u6B63\u65B0\u4F4D\u7F6E\u7684\u8BD5\u5377\u53CA\u56FE\u7247\u5F15\u7528");
      const mismatch = () => new Error("\u65B0\u4F4D\u7F6E\u7684\u9898\u76EE\u6216\u89E3\u6790\u4E0E\u5DF2\u5BFC\u5165\u7248\u672C\u4E0D\u4E00\u81F4\uFF0C\u8BF7\u9009\u62E9\u540C\u4E00\u4EFD\u8BD5\u5377");
      if (paper.questionIds.length !== parsed.questions.length) throw mismatch();
      const moves = /* @__PURE__ */ new Map(), sources = /* @__PURE__ */ new Map();
      for (const [index, questionId] of paper.questionIds.entries()) {
        const before = [], after = [];
        if (relocationContent(data.versions[questionId], before) !== relocationContent(parsed.questions[index], after)) throw mismatch();
        for (const [i, from] of before.entries()) {
          const to = after[i];
          if (moves.has(from) && moves.get(from) !== to || sources.has(to) && sources.get(to) !== from) {
            throw new Error("\u56FE\u7247\u5F15\u7528\u5BF9\u5E94\u5173\u7CFB\u4E0D\u4E00\u81F4\uFF0C\u8BF7\u68C0\u67E5\u65B0\u4F4D\u7F6E\u7684\u9644\u4EF6");
          }
          moves.set(from, to);
          sources.set(to, from);
        }
      }
      paper.path = path;
      for (const question of Object.values(data.versions)) {
        if (question.paperId !== id) continue;
        data.versions[question.id] = mapQuestionImages({ ...question, path }, (from) => moves.get(from) ?? from);
      }
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
      if (scope.paperId) requirePaper(data, scope.paperId);
      if (questionIds.some((id2) => !data.versions[id2])) throw new Error("\u90E8\u5206\u9898\u76EE\u5DF2\u5220\u9664\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9");
      const id = allocate(data, "session");
      const session = { ...scope, id, questionIds: [...questionIds], cursor: 0, selected: {}, results: {}, started: now };
      if (minutes) session.deadline = now + minutes * 6e4;
      data.sessions[id] = session;
      return session;
    }
    function deleteSession(data, sessionId) {
      const session = data.sessions[sessionId];
      if (!session) return;
      if (session.completed !== void 0) throw new Error("\u8BE5\u8BB0\u5F55\u5DF2\u5B8C\u6210\u4F5C\u7B54\uFF0C\u65E0\u6CD5\u5220\u9664");
      delete data.sessions[sessionId];
    }
    function setSelection(data, sessionId, id, selected, now = Date.now()) {
      const session = data.sessions[sessionId];
      if (!session || expire(data, sessionId, now) || session.completed !== void 0 || session.results[id] || !session.questionIds.includes(id)) return;
      const question = data.versions[id];
      if (question.type !== "multiple" && selected.length > 1 || new Set(selected).size !== selected.length || selected.some((key) => !question.options.some((option) => option.key === key))) throw new Error("\u9009\u9879\u65E0\u6548");
      session.selected[id] = [...selected];
    }
    function grade(data, sessionId, id) {
      const session = data.sessions[sessionId];
      if (!session || session.completed !== void 0 || session.mode !== "practice" || session.results[id] || !session.questionIds.includes(id)) return;
      const selected = session.selected[id] ?? [];
      if (selected.length) session.results[id] = record(data, id, selected);
    }
    function submit(data, sessionId, now = Date.now()) {
      const session = data.sessions[sessionId];
      if (!session || session.completed !== void 0) return;
      for (const id of session.questionIds) {
        if (!session.results[id]) session.results[id] = session.mode === "exam" ? record(data, id, session.selected[id] ?? []) : "unanswered";
      }
      session.completed = Math.min(now, session.deadline ?? now);
    }
    function expire(data, sessionId, now = Date.now()) {
      const session = data.sessions[sessionId];
      if (!session || session.completed !== void 0 || session.deadline === void 0 || now < session.deadline) return false;
      submit(data, sessionId, now);
      return true;
    }
    function toggleBookmark(data, id) {
      if (!data.versions[id]) return;
      const previous = data.progress[id] ?? {};
      data.progress[id] = { ...previous, bookmarked: !previous.bookmarked };
    }
    module2.exports = {
      newData,
      importPaper,
      renamePaper,
      deletePaper,
      usesVaultPath,
      moveVaultPath,
      relocatePaper,
      pickQuestions,
      record,
      startSession,
      deleteSession,
      setSelection,
      grade,
      submit,
      expire,
      toggleBookmark
    };
  }
});

// src/hotkeys.cjs
var require_hotkeys = __commonJS({
  "src/hotkeys.cjs"(exports2, module2) {
    var DEFAULT_HOTKEYS = Object.freeze({
      A: "1",
      B: "2",
      C: "3",
      D: "4",
      E: "",
      F: "",
      G: "",
      H: "",
      previous: "ArrowLeft",
      next: "ArrowRight",
      grade: "Enter"
    });
    var MODIFIERS = [["Ctrl", "ctrlKey"], ["Alt", "altKey"], ["Shift", "shiftKey"], ["Meta", "metaKey"]];
    var NAMED_KEYS = /* @__PURE__ */ new Set(["Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);
    function readHotkeys2(saved) {
      return Object.fromEntries(Object.entries(DEFAULT_HOTKEYS).map(([action, key]) => [
        action,
        typeof saved?.[action] === "string" ? saved[action] : key
      ]));
    }
    function recordKey2(event) {
      if (event.isComposing || event.keyCode === 229 || event.repeat || event.getModifierState?.("AltGraph")) return "";
      const key = event.key;
      if (!NAMED_KEYS.has(key) && !/^[a-z0-9]$/i.test(key ?? "")) return "";
      const modifiers = MODIFIERS.filter(([, field]) => event[field]).map(([name]) => name);
      return [...modifiers, key.length === 1 ? key.toUpperCase() : key].join("+");
    }
    function matchHotkey2(hotkeys, event) {
      const key = recordKey2(event);
      return key ? Object.keys(hotkeys).find((action) => hotkeys[action] === key) : void 0;
    }
    function actionForOption2(type, key) {
      if (type === "judge") return key === "T" ? "A" : "B";
      return key;
    }
    function keyLabel2(key) {
      const arrows = { ArrowLeft: "\u2190", ArrowRight: "\u2192", ArrowUp: "\u2191", ArrowDown: "\u2193" };
      return key.split("+").map((part) => arrows[part] ?? part).join("+");
    }
    module2.exports = { readHotkeys: readHotkeys2, recordKey: recordKey2, matchHotkey: matchHotkey2, actionForOption: actionForOption2, keyLabel: keyLabel2 };
  }
});

// src/main.cjs
var { ItemView, Plugin, Modal, FuzzySuggestModal, Notice, Component, MarkdownRenderer, TFile, PluginSettingTab, Setting } = require("obsidian");
var { parsePaper } = require_parser();
var { resolvePaperMedia } = require_media();
var study = require_study();
var { readHotkeys, recordKey, matchHotkey, actionForOption, keyLabel } = require_hotkeys();
var VIEW = "shuati-study";
var TAB_NAMES = { paper: "\u8BD5\u5377", wrong: "\u9519\u9898", bookmarked: "\u6536\u85CF" };
var TYPE_NAMES = { single: "\u5355\u9009", multiple: "\u591A\u9009", judge: "\u5224\u65AD" };
var HOTKEY_NAMES = {
  A: "\u9009\u9879 A / \u5224\u65AD\u6B63\u786E",
  B: "\u9009\u9879 B / \u5224\u65AD\u9519\u8BEF",
  C: "\u9009\u9879 C",
  D: "\u9009\u9879 D",
  E: "\u9009\u9879 E",
  F: "\u9009\u9879 F",
  G: "\u9009\u9879 G",
  H: "\u9009\u9879 H",
  previous: "\u4E0A\u4E00\u9898",
  next: "\u4E0B\u4E00\u9898",
  grade: "\u63D0\u4EA4\u672C\u9898\uFF08\u7EC3\u4E60\uFF09"
};
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
var paperTitleOrder = new Intl.Collator("zh-Hans-CN-u-co-pinyin", { sensitivity: "base", numeric: true });
function sortedPapers(papers) {
  return Object.values(papers).sort((a, b) => paperTitleOrder.compare(a.title, b.title));
}
function paperLabel(paper) {
  return `${paper.title}\uFF08${paper.questionIds.length} \u9898\uFF09`;
}
function renderImportIssues(root, issues) {
  const list = node(root, "ul", void 0, "shuati-errors");
  for (const issue of issues) {
    node(list, "li", `${issue.number ? `\u7B2C ${issue.number} \u9898 \xB7 ` : ""}\u7B2C ${issue.line} \u884C \xB7 ${issue.message}`);
  }
}
var PaperNotePicker = class extends FuzzySuggestModal {
  constructor(app, choose) {
    super(app);
    this.choose = choose;
    this.setPlaceholder("\u641C\u7D22\u5E93\u5185 Markdown \u7B14\u8BB0");
  }
  getItems() {
    return this.app.vault.getMarkdownFiles();
  }
  getItemText(file) {
    return file.path;
  }
  onChooseItem(file) {
    this.choose(file);
  }
};
var ShuatiSettings = class extends PluginSettingTab {
  constructor(plugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }
  display() {
    const root = this.containerEl;
    root.replaceChildren();
    const hotkeys = readHotkeys(this.plugin.data.hotkeys);
    new Setting(root).setName("\u81EA\u5B9A\u4E49\u7B54\u9898\u5FEB\u6377\u952E").setHeading();
    node(root, "p", "\u70B9\u51FB\u8F93\u5165\u6846\u540E\u6309\u952E\u5F55\u5165\u3002\u652F\u6301\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u65B9\u5411\u952E\u3001Enter \u548C\u4FEE\u9970\u952E\u7EC4\u5408\u3002\u6309 Backspace \u6216 Delete \u6E05\u9664\u7ED1\u5B9A\u3002", "setting-item-description");
    for (const [action, name] of Object.entries(HOTKEY_NAMES)) {
      new Setting(root).setName(name).addText((text) => {
        const input = text.inputEl;
        text.setPlaceholder("\u672A\u7ED1\u5B9A").setValue(keyLabel(hotkeys[action]));
        input.readOnly = true;
        input.setAttribute("aria-label", name);
        input.addEventListener("keydown", async (event) => {
          if (event.key === "Tab" || event.key === "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          if (event.repeat || event.isComposing || event.keyCode === 229) return;
          const clear = event.key === "Backspace" || event.key === "Delete";
          const key = clear ? "" : recordKey(event);
          if (!clear && !key) return;
          try {
            await this.plugin.update((data) => {
              const current = readHotkeys(data.hotkeys);
              const conflict = key && Object.keys(current).find((other) => other !== action && current[other] === key);
              if (conflict) throw new Error(`${keyLabel(key)} \u5DF2\u7ED1\u5B9A\u5230\u300C${HOTKEY_NAMES[conflict]}\u300D`);
              data.hotkeys = { ...current, [action]: key };
            });
            text.setValue(keyLabel(readHotkeys(this.plugin.data.hotkeys)[action]));
            this.plugin.redrawViews();
          } catch (error) {
            new Notice(error.message);
          }
        });
      });
    }
    new Setting(root).setName("\u6062\u590D\u9ED8\u8BA4\u5FEB\u6377\u952E").addButton((button2) => button2.setButtonText("\u6062\u590D\u9ED8\u8BA4").onClick(async () => {
      try {
        await this.plugin.update((data) => {
          delete data.hotkeys;
        });
        this.display();
        this.plugin.redrawViews();
      } catch (error) {
        new Notice(error.message);
      }
    }));
  }
};
var ShuatiView = class _ShuatiView extends ItemView {
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
    this.contentEl.tabIndex = 0;
    this.registerDomEvent(this.contentEl, "keydown", (event) => this.handleHotkey(event));
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
  handleHotkey(event) {
    const target = event.target;
    const activeView = this.app.workspace.getActiveViewOfType(_ShuatiView);
    if (event.defaultPrevented || activeView !== this || !target?.closest || target.closest('input:not([type="radio"]):not([type="checkbox"]), textarea, select, [contenteditable], [role="textbox"]')) return;
    if (Array.from(this.contentEl.ownerDocument.querySelectorAll(".modal-container")).some((modal) => modal.getClientRects().length)) return;
    if (event.key === "Enter" && target.closest('button, a[href], summary, [role="button"]')) return;
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
    if (key) node(hintParent, "kbd", keyLabel(key), "shuati-key");
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
    const container = node(this.contentEl, "div", void 0, "shuati-shell");
    const session = this.plugin.data.sessions[this.sessionId];
    if (session) this.renderSession(container, session, renderId);
    else this.renderHome(container);
    if (hadFocus && !this.contentEl.contains(this.contentEl.ownerDocument.activeElement)) {
      this.contentEl.focus({ preventScroll: true });
    }
  }
  renderHome(root) {
    const data = this.plugin.data;
    const header = node(root, "header", void 0, "shuati-top");
    const heading = node(header, "h1", "\u5237\u9898");
    heading.id = `shuati-heading-${this.leaf.id}`;
    button(header, "\u5BFC\u5165\u5F53\u524D\u7B14\u8BB0", () => this.run(() => this.plugin.previewImport()), true);
    const tabs = node(root, "nav", void 0, "shuati-tabs");
    tabs.setAttribute("aria-labelledby", heading.id);
    for (const [name, label] of Object.entries(TAB_NAMES)) {
      const tab = button(tabs, label, () => {
        this.tab = name;
        this.module = "";
        this.unanswered = false;
        this.render();
      });
      tab.setAttribute("aria-pressed", String(this.tab === name));
    }
    const papers = sortedPapers(data.papers);
    if (!papers.length) {
      node(root, "p", "\u6253\u5F00\u9898\u5E93\u7B14\u8BB0\uFF0C\u5728\u547D\u4EE4\u9762\u677F\u8FD0\u884C\u300C\u5BFC\u5165\u5F53\u524D\u7B14\u8BB0\u4E3A\u8BD5\u5377\u300D\u3002", "shuati-empty");
      return;
    }
    if (!data.papers[this.paperId]) this.paperId = this.tab === "paper" ? papers[0].id : "";
    const filters = node(root, "div", void 0, "shuati-filters");
    const paperChoices = papers.map((paper2) => [paper2.id, paperLabel(paper2)]);
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
    if (this.tab === "paper") {
      button(actions, "\u6574\u5377\u6A21\u8003", () => this.configureExam(paper));
      button(actions, "\u7BA1\u7406\u9898\u5E93", () => this.choosePaperToManage());
    }
    if (this.tab !== "paper" && ids.length) this.renderReviewList(root, data, ids);
    this.renderSessions(root, data);
  }
  choosePaperToManage() {
    dialog(this.app, "\u9009\u62E9\u8981\u7BA1\u7406\u7684\u9898\u5E93", (root, modal) => {
      const list = node(root, "ul", void 0, "shuati-list shuati-paper-list");
      for (const paper of sortedPapers(this.plugin.data.papers)) {
        const row = node(list, "li");
        const choice = button(row, paperLabel(paper), () => {
          modal.close();
          const current = this.plugin.data.papers[paper.id];
          if (current) this.managePaper(current);
          else new Notice("\u9898\u5E93\u5DF2\u5220\u9664");
        });
        choice.title = paper.path;
      }
    });
  }
  managePaper(paper) {
    dialog(this.app, "\u7BA1\u7406\u9898\u5E93", (root, modal) => {
      node(root, "p", paper.title);
      const source = this.app.vault.getAbstractFileByPath(paper.path);
      node(root, "p", `${source ? "\u6E90\u7B14\u8BB0" : "\u672A\u627E\u5230\u6E90\u7B14\u8BB0"} \xB7 ${paper.path}`, "shuati-muted shuati-path");
      const actions = node(root, "div", void 0, "shuati-actions");
      const openAction = (action) => () => {
        modal.close();
        action();
      };
      button(actions, "\u8FD4\u56DE\u9898\u5E93\u9009\u62E9", openAction(() => this.choosePaperToManage()));
      button(actions, "\u91CD\u547D\u540D", openAction(() => this.renamePaper(paper)));
      button(actions, "\u91CD\u5B9A\u4F4D\u9898\u5E93", openAction(() => {
        new PaperNotePicker(this.app, (file) => this.run(() => this.previewRelocation(paper, file), false)).open();
      }));
      button(actions, "\u5220\u9664\u9898\u5E93", openAction(() => this.confirmDeletePaper(paper))).classList.add("mod-warning");
    });
  }
  renamePaper(paper) {
    dialog(this.app, "\u91CD\u547D\u540D\u9898\u5E93", (root, modal) => {
      const label = node(root, "label", void 0, "shuati-field");
      node(label, "span", "\u9898\u5E93\u540D\u79F0");
      const input = node(label, "input", void 0, "shuati-paper-name");
      input.type = "text";
      input.value = paper.title;
      const actions = node(root, "div", void 0, "shuati-actions");
      button(actions, "\u53D6\u6D88", () => modal.close());
      const save = button(actions, "\u4FDD\u5B58\u540D\u79F0", () => {
        save.disabled = true;
        return this.run(async () => {
          try {
            await this.plugin.update((data) => study.renamePaper(data, paper.id, input.value));
            modal.close();
            new Notice("\u9898\u5E93\u5DF2\u91CD\u547D\u540D");
          } finally {
            save.disabled = false;
          }
        });
      }, true);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.isComposing) save.click();
      });
    });
  }
  confirmDeletePaper(paper) {
    dialog(this.app, "\u5220\u9664\u9898\u5E93", (root, modal) => {
      node(root, "p", `${paper.title} \xB7 ${paper.questionIds.length} \u9898`);
      node(root, "p", "\u5C06\u5220\u9664\u5237\u9898\u63D2\u4EF6\u4E2D\u8FD9\u5957\u9898\u5E93\u7684\u9898\u76EE\u3001\u8FDB\u5EA6\u3001\u9519\u9898\u3001\u6536\u85CF\u548C\u76F8\u5173\u4F5C\u7B54\u3002\u8DE8\u9898\u5E93\u4F5C\u7B54\u4E2D\uFF0C\u4EC5\u79FB\u9664\u8FD9\u5957\u9898\u5E93\u7684\u9898\u76EE\u3002\u6E90\u7B14\u8BB0\u548C\u9644\u4EF6\u4ECD\u4FDD\u5B58\u5728\u5E93\u4E2D\u3002");
      const actions = node(root, "div", void 0, "shuati-actions");
      button(actions, "\u53D6\u6D88", () => modal.close());
      const remove = button(actions, "\u786E\u8BA4\u5220\u9664", () => {
        remove.disabled = true;
        return this.run(async () => {
          try {
            await this.plugin.update((data) => study.deletePaper(data, paper.id));
            modal.close();
            new Notice("\u9898\u5E93\u5DF2\u5220\u9664");
          } finally {
            remove.disabled = false;
          }
        });
      });
      remove.classList.add("mod-warning");
    });
  }
  async previewRelocation(paper, file) {
    const path = file.path;
    const parsed = await this.plugin.readPaper(file, path);
    dialog(this.app, parsed.issues.length ? "\u68C0\u67E5\u65B0\u4F4D\u7F6E\u7684\u8BD5\u5377" : "\u786E\u8BA4\u91CD\u5B9A\u4F4D\u9898\u5E93", (root, modal) => {
      node(root, "p", `\u539F\u4F4D\u7F6E \xB7 ${paper.path}`, "shuati-muted shuati-path");
      node(root, "p", `\u65B0\u4F4D\u7F6E \xB7 ${path}`, "shuati-path");
      if (parsed.issues.length) {
        renderImportIssues(root, parsed.issues);
        return;
      }
      node(root, "p", "\u8BF7\u9009\u62E9\u540C\u4E00\u4EFD\u8BD5\u5377\u3002\u91CD\u5B9A\u4F4D\u6210\u529F\u540E\uFF0C\u4F5C\u7B54\u8BB0\u5F55\u3001\u9519\u9898\u548C\u6536\u85CF\u4F1A\u5173\u8054\u5230\u65B0\u4F4D\u7F6E\u3002");
      const actions = node(root, "div", void 0, "shuati-actions");
      button(actions, "\u53D6\u6D88", () => modal.close());
      const save = button(actions, "\u786E\u8BA4\u91CD\u5B9A\u4F4D", () => {
        save.disabled = true;
        return this.run(async () => {
          try {
            await this.plugin.update((data) => {
              if (this.app.vault.getAbstractFileByPath(path) !== file) throw new Error("\u65B0\u4F4D\u7F6E\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u7B14\u8BB0");
              return study.relocatePaper(data, paper.id, path, parsed);
            });
            modal.close();
            new Notice("\u9898\u5E93\u5DF2\u91CD\u5B9A\u4F4D");
          } finally {
            save.disabled = false;
          }
        });
      }, true);
    });
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
      const description = `${session.title} \xB7 ${label} \xB7 ${date}`;
      button(row, description, () => this.resume(session.id));
      if (session.completed === void 0) {
        const remove = button(row, "\u5220\u9664", () => this.confirmDeleteSession(session, description));
        remove.setAttribute("aria-label", `\u5220\u9664 ${description}`);
      }
    }
  }
  confirmDeleteSession(session, description) {
    dialog(this.app, "\u5220\u9664\u7EE7\u7EED\u4F5C\u7B54\u8BB0\u5F55", (root, modal) => {
      node(root, "p", description);
      node(root, "p", "\u5220\u9664\u540E\u5C06\u65E0\u6CD5\u7EE7\u7EED\u672C\u6B21\u4F5C\u7B54\u3002\u5DF2\u8BB0\u5165\u7684\u7B54\u9898\u7ED3\u679C\u548C\u6536\u85CF\u4ECD\u4F1A\u4FDD\u7559\u3002");
      const actions = node(root, "div", void 0, "shuati-actions");
      button(actions, "\u53D6\u6D88", () => modal.close());
      const remove = button(actions, "\u786E\u8BA4\u5220\u9664", () => {
        remove.disabled = true;
        return this.run(async () => {
          try {
            await this.plugin.update((data) => study.deleteSession(data, session.id));
            modal.close();
          } finally {
            remove.disabled = false;
          }
        });
      });
      remove.classList.add("mod-warning");
    });
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
      if (!session) return;
      if (session.deadline !== void 0 && session.completed === void 0 && Date.now() >= session.deadline) {
        await this.plugin.update((data) => study.expire(data, id));
        session = this.plugin.data.sessions[id];
        if (!session) return;
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
    this.bindHotkey(button(actions, "\u4E0A\u4E00\u9898", () => this.jump(session, session.cursor - 1)), "previous").disabled = session.cursor === 0;
    node(actions, "span", `${session.cursor + 1} / ${total}`, "shuati-muted");
    this.bindHotkey(button(actions, "\u4E0B\u4E00\u9898", () => this.jump(session, session.cursor + 1)), "next").disabled = session.cursor === total - 1;
    if (!done && session.mode === "practice") {
      button(actions, "\u7B54\u9898\u5361", () => this.openPracticeCard(session.id));
    }
    if (!done) button(actions, session.mode === "exam" ? "\u4EA4\u5377" : "\u7ED3\u675F\u7EC3\u4E60", () => this.confirmSubmit(session), true);
  }
  openPracticeCard(sessionId) {
    const session = this.plugin.data.sessions[sessionId];
    if (!session) return;
    dialog(this.app, "\u7B54\u9898\u5361", (root, modal) => {
      this.renderCard(root, session, (index) => {
        modal.close();
        this.contentEl.scrollTop = 0;
        return this.jump(session, index);
      });
    });
  }
  renderCard(root, session, onJump = (index) => this.jump(session, index)) {
    const card = node(root, "div", void 0, "shuati-grid");
    for (const [index, id] of session.questionIds.entries()) {
      const q = this.plugin.data.versions[id];
      const item = button(card, String(q.number), () => onJump(index));
      const result = session.results[id];
      const selected = Boolean(session.selected[id]?.length);
      let status = "\u672A\u7B54";
      if (result) status = RESULT_NAMES[result];
      else if (selected) status = session.mode === "practice" ? "\u5DF2\u9009\uFF0C\u672A\u63D0\u4EA4" : "\u5DF2\u7B54";
      item.setAttribute("aria-label", `\u7B2C ${q.number} \u9898\uFF0C${status}`);
      item.dataset.status = result ?? (selected ? "selected" : "unanswered");
      if (index === session.cursor) item.setAttribute("aria-current", "step");
    }
  }
  jump(session, cursor) {
    return this.run(() => this.plugin.update((data) => {
      const current = data.sessions[session.id];
      if (current && cursor >= 0 && cursor < current.questionIds.length) current.cursor = cursor;
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
      control.disabled = Boolean(result) || session.completed !== void 0;
      if (result && question.answers.includes(option.key)) label.dataset.result = "correct";
      if (result && selected.includes(option.key) && !question.answers.includes(option.key)) label.dataset.result = "wrong";
      const optionKey = node(label, "span", `${option.key}.`, "shuati-option-key");
      if (!control.disabled) this.bindHotkey(control, actionForOption(question.type, option.key), optionKey);
      this.renderMarkdown(label, option.text, question.path, renderId);
      control.addEventListener("change", () => {
        const keys = [...options.querySelectorAll("input:checked")].map((input) => input.value);
        const update = () => this.plugin.update((data) => study.setSelection(data, session.id, question.id, keys));
        if (session.mode === "practice") this.refreshSelection(root, session, question, options);
        this.run(update, false).then(() => {
          const current = this.plugin.data.sessions[session.id];
          if (renderId !== this.renderId) return;
          if (!current || current.completed !== void 0) this.render();
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
      this.bindHotkey(grade, "grade");
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
    this.addSettingTab(new ShuatiSettings(this));
    this.addRibbonIcon("list-checks", "\u6253\u5F00\u5237\u9898", () => this.openView());
    this.addCommand({ id: "open", name: "\u6253\u5F00\u5237\u9898", callback: () => this.openView() });
    this.addCommand({ id: "import-note", name: "\u5BFC\u5165\u5F53\u524D\u7B14\u8BB0\u4E3A\u8BD5\u5377", callback: () => this.previewImport().catch((error) => new Notice(error.message)) });
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      const newPath = file.path;
      this.update((data) => study.moveVaultPath(data, oldPath, newPath), (data) => study.usesVaultPath(data, oldPath)).then((changed) => {
        if (changed) this.redrawViews();
      }).catch((error) => new Notice(error.message));
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
  async readPaper(file, path) {
    const read = (note) => this.app.vault.read(note);
    return resolvePaperMedia(parsePaper(await read(file)), path, async (link, source) => {
      const target = this.app.metadataCache.getFirstLinkpathDest(link, source);
      if (!(target instanceof TFile)) return null;
      return { path: target.path, extension: target.extension.toLowerCase(), content: target.extension === "md" ? await read(target) : void 0 };
    });
  }
  async previewImport() {
    const active = this.app.workspace.getActiveFile();
    const recent = active ?? this.app.vault.getAbstractFileByPath(this.app.workspace.getLastOpenFiles()[0] ?? "");
    if (!(recent instanceof TFile) || recent.extension !== "md") throw new Error("\u8BF7\u5148\u6253\u5F00\u8981\u5BFC\u5165\u7684 Markdown \u7B14\u8BB0");
    const parsed = await this.readPaper(recent, recent.path);
    dialog(this.app, parsed.issues.length ? "\u8BF7\u4FEE\u6B63\u8BD5\u5377" : "\u5BFC\u5165\u8BD5\u5377", (root, modal) => {
      node(root, "p", recent.path, "shuati-muted");
      if (parsed.issues.length) {
        renderImportIssues(root, parsed.issues);
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
