const TYPES = { 单选: 'single', 多选: 'multiple', 判断: 'judge' };
const OPTION = /^[-*+]\s+([A-HTF])[.．、:：)）]\s*(.*)$/i;
const ANSWER = /^(?:\*\*)?(?:正确答案|答案)(?:\*\*)?\s*[:：]\s*(?:\*\*)?\s*(.*?)\s*$/;
const EXPLANATION = /^(?:\*\*)?(?:答案解析|解析)(?:\*\*)?\s*[:：]\s*(?:\*\*)?\s*(.*)$/;

function parseBlock(lines, number, module, type) {
  const stem = [], options = [], explanation = [];
  let rawAnswer;
  let phase = 'stem';
  for (const line of lines) {
    const answer = line.match(ANSWER);
    const note = line.match(EXPLANATION);
    const option = line.match(OPTION);
    if (phase === 'explanation') explanation.push(line);
    else if (answer) {
      if (rawAnswer !== undefined) throw new Error('存在重复的答案行');
      rawAnswer = answer[1].replace(/^\*\*|\*\*$/g, '').trim().toUpperCase();
      phase = 'answer';
    } else if (note) {
      explanation.push(note[1]);
      phase = 'explanation';
    } else if (option) {
      if (phase === 'answer') throw new Error('答案行后出现选项');
      options.push({ key: option[1].toUpperCase(), lines: [option[2]] });
      phase = 'options';
    } else if (phase === 'stem') stem.push(line);
    else if (phase === 'options') options.at(-1).lines.push(line);
    else if (line.trim()) throw new Error('答案行后请以“解析：”开头');
  }
  const body = stem.join('\n').trim();
  if (!body) throw new Error('题干为空');
  if (options.length < 2) throw new Error('至少需要两个选项');
  if (rawAnswer === undefined) throw new Error('缺少答案行');
  const keys = options.map(option => option.key);
  if (new Set(keys).size !== keys.length) throw new Error('选项键重复');
  let answers;
  if (type === 'judge') {
    if (keys.length !== 2 || !['AB', 'FT'].includes([...keys].sort().join(''))) {
      throw new Error('判断题请使用 T/F，或以“正确/错误”为内容的 A/B');
    }
    const mapping = new Map(options.map(({ key, lines: [first] }) => [key, keys.includes('T') ? key
      : /^(正确|对|√|T)$/i.test(first.trim()) ? 'T' : /^(错误|错|×|F)$/i.test(first.trim()) ? 'F' : '']));
    if ([...mapping.values()].sort().join('') !== 'FT') throw new Error('A/B 判断选项必须对应正确和错误');
    const answer = mapping.get(rawAnswer) || ({ 正确: 'T', 对: 'T', 错误: 'F', 错: 'F', T: 'T', F: 'F', '√': 'T', '×': 'F' })[rawAnswer];
    if (answer !== 'T' && answer !== 'F') throw new Error('判断题答案无效');
    answers = [answer];
    for (const option of options) option.key = mapping.get(option.key);
  } else {
    if (keys.some(key => !/^[A-H]$/.test(key))) throw new Error('选择题的选项键应为 A 到 H');
    if (!/^[A-H]+(?:[\s,，、]+[A-H]+)*$/.test(rawAnswer)) throw new Error('答案格式无效，例如 A 或 ABC');
    answers = rawAnswer.match(/[A-H]/g).sort();
    if (new Set(answers).size !== answers.length) throw new Error('答案键重复');
    if (answers.some(key => !keys.includes(key))) throw new Error('答案中有不存在的选项键');
    if (type === 'single' && answers.length !== 1) throw new Error('单选题必须只有一个答案');
  }
  const choices = options.map(({ key, lines }) => ({ key, text: lines.join('\n').trim() }));
  if (choices.some(option => !option.text)) throw new Error('选项内容为空');
  return { number, module, type, stem: body, options: choices, answers, explanation: explanation.join('\n').trim() };
}

function parsePaper(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n?|\n/);
  const questions = [], issues = [], seen = new Set();
  let title = '', current;
  function flush() {
    if (!current) return;
    const { line, header, content } = current;
    const match = header.match(/^(\d+)\s*[·|｜]\s*([^·|｜]+?)\s*[·|｜]\s*(单选|多选|判断)(?:题)?$/);
    const number = match ? Number(match[1]) : undefined;
    try {
      if (!match || !Number.isSafeInteger(number) || number < 1 || !match[2].trim()) {
        throw new Error('题目标题应为“## 题号 · 模块 · 题型”');
      }
      if (seen.has(number)) throw new Error('题号重复');
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
  if (!title) issues.unshift({ line: 1, message: '缺少一级标题作为卷名' });
  if (!questions.length && !issues.length) issues.push({ line: 1, message: '没有题目' });
  return { title, questions, issues };
}

function isCorrect(question, selected) {
  return selected.length === question.answers.length && new Set(selected).size === selected.length
    && selected.every(key => question.answers.includes(key));
}

module.exports = { parsePaper, isCorrect };
