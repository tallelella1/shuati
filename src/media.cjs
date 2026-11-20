const IMAGE = /^(png|jpe?g|gif|webp|avif|bmp|svg)$/i;
// Match Obsidian embeds and inline Markdown image syntax, including angle-bracket paths.
const EMBED = /!\[\[([^\]\n]+)\]\]|!\[([^\]\n]*)\]\(\s*(?:<([^>\n]+)>|([^\s)]+))(?:\s+"[^"\n]*")?\s*\)/g;
const REMAINING_IMAGE = /!\[(?:\[|[^\]\n]*\](?:\s*[\[(])?)|<(?:img|picture|source|iframe|video|audio|object|embed|svg)\b/i;

async function resolvePaperMedia(parsed, origin, resolve) {
  const issues = [...parsed.issues];
  const cache = new Map();
  const lookup = (reference, source) => {
    const key = JSON.stringify([source, reference]);
    if (!cache.has(key)) cache.set(key, Promise.resolve().then(() => resolve(reference, source)));
    return cache.get(key);
  };

  async function expand(text, source, trail, report, field) {
    let result = '';
    let offset = 0;
    function plain(fragment) {
      if (REMAINING_IMAGE.test(fragment)) report(`${field}含不支持的嵌入，请使用 ![[本地图片]] 或 ![[材料笔记]]`);
      return fragment;
    }
    for (const match of text.matchAll(EMBED)) {
      result += plain(text.slice(offset, match.index));
      offset = match.index + match[0].length;
      const [root, size] = match[1]?.split('|', 2) ?? [match[3] ?? match[4], undefined];
      const value = root.trim();
      let reference = value;
      try { if (!match[1]) reference = decodeURIComponent(value); } catch { /* validation below */ }
      if (!reference || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference) || reference.includes('#')) {
        report(`${field}只支持本地图片或整篇材料笔记：${reference || '空引用'}`);
        continue;
      }
      const target = await lookup(reference, source);
      if (!target) { report(`${field}找不到附件或材料：${reference}`); continue; }
      if (target.extension === 'md' && match[1]) {
        if (trail.includes(target.path)) { report(`${field}的材料引用形成循环：${reference}`); continue; }
        result += '\n\n' + await expand(target.content, target.path, [...trail, target.path], report, field) + '\n\n';
      } else if (IMAGE.test(target.extension)) {
        const width = size && /^\d+(?:x\d+)?$/.test(size) ? `|${size}` : '';
        result += `![[/${target.path}${width}]]`;
      } else report(`${field}不支持此附件类型：${reference}`);
    }
    return (result + plain(text.slice(offset))).trim();
  }

  if (issues.length) return { ...parsed, issues };
  const questions = [];
  for (const question of parsed.questions) {
    const report = message => issues.push({ line: question.line, number: question.number, message });
    const field = (text, name) => expand(text, origin, [origin], report, name);
    const stem = await field(question.stem, '题干');
    const options = [];
    for (const option of question.options) options.push({ ...option, text: await field(option.text, `选项 ${option.key}`) });
    const explanation = await field(question.explanation, '解析');
    questions.push({ ...question, stem, options, explanation });
  }
  return { ...parsed, questions, issues };
}

// These embeds have already been resolved to a vault path at import time.
function mapStoredImages(text, mapPath) {
  return text.replace(/!\[\[\/([^|\]\n]+)(\|\d+(?:x\d+)?)?\]\]/g,
    (_, path, size = '') => `![[/${mapPath(path)}${size}]]`);
}

function mapQuestionImages(question, mapPath) {
  return {
    ...question,
    stem: mapStoredImages(question.stem, mapPath),
    options: question.options.map(option => ({ ...option, text: mapStoredImages(option.text, mapPath) })),
    explanation: mapStoredImages(question.explanation, mapPath),
  };
}

module.exports = { resolvePaperMedia, mapQuestionImages };
