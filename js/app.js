/*
 * CBT Mock Test
 * A computer based test (CBT) runner for SSC Junior Engineer practice.
 * Plain HTML/CSS/JS with no build step, so it runs on GitHub Pages or any static host.
 *
 * Flow: setup (load JSON + settings) -> instructions -> exam -> result.
 * Exam progress is saved in localStorage, so a page refresh doesn't lose the test.
 */
(function () {
  'use strict';

  /* ======================================================================
   * Constants
   * ==================================================================== */
  const SESSION_KEY = 'cbt.session.v1';
  const PREFS_KEY = 'cbt.prefs.v1';
  const DEFAULTS = { duration: 120, correct: 1, wrong: 0.25 };

  const STATUS = {
    an: 'Answered',
    na: 'Not Answered',
    nv: 'Not Visited',
    mr: 'Marked for Review',
    am: 'Answered & Marked for Review'
  };
  const STATUS_ORDER = ['an', 'na', 'nv', 'mr', 'am'];
  const STATUS_DESC = {
    nv: 'You have not visited the question yet.',
    na: 'You have visited the question but not answered it.',
    an: 'You have answered the question.',
    mr: 'You have not answered the question but have marked it for review.',
    am: 'You have answered the question and marked it for review. This answer will be evaluated.'
  };

  const MATHJAX_URL = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js';
  const MATH_HINT = /\\\(|\\\[|\$\$/;
  // Text is treated as HTML only when it contains a real tag from the allowed list.
  // This keeps plain text such as "a<b and c>d" from being parsed as markup.
  const HTML_HINT = /<\/?(?:b|i|u|em|strong|sub|sup|br|p|span|div|ul|ol|li|table|thead|tbody|tfoot|tr|td|th|img|code|pre|small|hr)(?:\s+[a-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))*\s*\/?>/i;
  const ALLOWED_TAGS = new Set(['B', 'I', 'U', 'EM', 'STRONG', 'SUB', 'SUP', 'BR', 'P', 'SPAN', 'DIV', 'UL', 'OL', 'LI',
    'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'IMG', 'CODE', 'PRE', 'SMALL', 'HR']);
  const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'BASE', 'FORM', 'INPUT',
    'BUTTON', 'TEXTAREA', 'SELECT', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH', 'VIDEO', 'AUDIO', 'CANVAS']);
  const ALLOWED_ATTRS = { IMG: ['src', 'alt', 'width', 'height'], TD: ['colspan', 'rowspan'], TH: ['colspan', 'rowspan'] };

  const AVATAR_SVG = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="6" fill="#cfd8e3"/>' +
    '<circle cx="32" cy="25" r="11" fill="#8a9bb0"/><path d="M12 58c2-12 10-18 20-18s18 6 20 18z" fill="#8a9bb0"/></svg>';

  const TEMPLATE = {
    title: 'SSC JE Mock Test 1',
    duration: 120,
    marks: { correct: 1, wrong: 0.25 },
    instructions: ['Optional: any extra instructions you want to show before the test.'],
    sections: [
      {
        name: 'General Intelligence & Reasoning',
        questions: [
          {
            id: 'R1',
            question: 'Find the next number in the series: 2, 6, 12, 20, 30, ?',
            options: ['40', '42', '44', '36'],
            answer: 'B',
            explanation: 'The terms are n × (n + 1): 6 × 7 = 42.'
          }
        ]
      },
      {
        name: 'General Awareness',
        questions: [
          {
            id: 'G1',
            question: "Which gas makes up the largest share of the Earth's atmosphere?",
            question_hi: 'पृथ्वी के वायुमंडल में सबसे अधिक कौन-सी गैस है?',
            options: ['Oxygen', 'Nitrogen', 'Argon', 'Carbon dioxide'],
            options_hi: ['ऑक्सीजन', 'नाइट्रोजन', 'आर्गन', 'कार्बन डाइऑक्साइड'],
            answer: 'B',
            explanation: 'Nitrogen is about 78% of dry air by volume.'
          }
        ]
      },
      {
        name: 'General Engineering (Civil & Structural)',
        questions: [
          {
            id: 'C1',
            question: 'The maximum bending moment in a simply supported beam of span \\(L\\) with a UDL \\(w\\) per unit length is:',
            options: ['\\(wL^2/2\\)', '\\(wL^2/8\\)', '\\(wL^2/12\\)', '\\(wL/4\\)'],
            answer: 'B',
            explanation: 'It occurs at mid-span: \\(M = wL^2/8\\).'
          },
          {
            id: 'C2',
            question: 'In cement chemistry, C<sub>3</sub>S stands for:',
            options: ['Dicalcium silicate', 'Tricalcium aluminate', 'Tricalcium silicate', 'Tetracalcium aluminoferrite'],
            answer: 'C',
            explanation: 'C = CaO and S = SiO<sub>2</sub>, so C<sub>3</sub>S = 3CaO·SiO<sub>2</sub>.',
            marks: 1,
            negative: 0.25
          }
        ]
      }
    ]
  };

  /* ======================================================================
   * State
   * ==================================================================== */
  let loadedTest = null;   // normalized test chosen on the setup screen
  let session = null;      // the running or finished exam (persisted)
  let qEnteredAt = 0;      // when the current question was opened (for time-per-question)
  let timerId = null;
  let tickCount = 0;
  let storageWarned = false;
  let reviewFilter = 'all';
  let toastTimer = null;
  let mathPromise = null;

  /* ======================================================================
   * Small helpers
   * ==================================================================== */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const letter = i => String.fromCharCode(65 + i);
  const round2 = n => Math.round(n * 100) / 100;
  const fmtNum = n => String(round2(n));
  const str = v => (v == null ? '' : String(v));
  const chk = sel => $(sel).checked;
  const setChk = (sel, v) => { $(sel).checked = !!v; };

  function num(v) {
    if (v == null || String(v).trim() === '') return null;
    const n = Number(v);
    return isFinite(n) ? n : null;
  }

  function pick(obj, keys) {
    for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
    return undefined;
  }

  const store = {
    get(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } },
    del(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }
  };

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeHtml(s) { return str(s).replace(/[&<>"']/g, c => ESC[c]); }

  function safeUrl(u) {
    u = str(u).trim();
    if (/^https?:\/\//i.test(u)) return u;
    if (/^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);/i.test(u)) return u;
    if (!u.startsWith('//') && /^[\w\-./% ]+(?:\?[\w\-.=&%]*)?$/.test(u)) return u; // relative path
    return '';
  }

  /** Remove everything except a small set of formatting tags. */
  function sanitize(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    cleanNode(tpl.content);
    return tpl.innerHTML;
  }

  function cleanNode(node) {
    Array.from(node.childNodes).forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) return;
      if (child.nodeType !== Node.ELEMENT_NODE) { child.remove(); return; }
      const tag = child.tagName.toUpperCase();
      if (DROP_TAGS.has(tag)) { child.remove(); return; }
      if (!ALLOWED_TAGS.has(tag)) {           // unknown tag: keep its content, drop the tag
        cleanNode(child);
        child.replaceWith(...Array.from(child.childNodes));
        return;
      }
      const allowed = ALLOWED_ATTRS[tag] || [];
      Array.from(child.attributes).forEach(a => {
        const name = a.name.toLowerCase();
        if (!allowed.includes(name)) { child.removeAttribute(a.name); return; }
        if (name === 'src') {
          const safe = safeUrl(a.value);
          if (safe) child.setAttribute('src', safe); else child.removeAttribute('src');
        }
      });
      cleanNode(child);
    });
  }

  /** Render question/option/explanation text: plain text is escaped, simple HTML is sanitized. */
  function rich(s) {
    s = str(s);
    if (HTML_HINT.test(s)) return sanitize(s);
    return escapeHtml(s).replace(/\n/g, '<br>');
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function fmtClock(ms) {
    const t = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return [h, m, s].map(x => String(x).padStart(2, '0')).join(':');
  }

  function fmtSpent(ms) {
    const t = Math.round(Math.max(0, ms) / 1000);
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    const pad = x => String(x).padStart(2, '0');
    if (h) return `${h}h ${pad(m)}m ${pad(s)}s`;
    if (m) return `${m}m ${pad(s)}s`;
    return `${s}s`;
  }

  function toast(msg, ms = 2800) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  function showScreen(name) {
    $$('.screen').forEach(s => { s.hidden = s.id !== 'screen-' + name; });
    hideSecTip();
    window.scrollTo(0, 0);
  }

  /* ======================================================================
   * Modal
   * ==================================================================== */
  function openModal({ title, html, buttons, dismissible = true }) {
    const m = $('#modal');
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = html;
    $('#modal-body').scrollTop = 0;
    const foot = $('#modal-foot');
    foot.innerHTML = '';
    (buttons || [{ label: 'Close', cls: 'btn-primary' }]).forEach(b => {
      const el = document.createElement('button');
      el.className = 'btn ' + (b.cls || '');
      el.textContent = b.label;
      el.addEventListener('click', () => { closeModal(); if (b.onClick) b.onClick(); });
      foot.appendChild(el);
    });
    m.dataset.dismissible = dismissible ? '1' : '';
    m.hidden = false;
    if (foot.lastElementChild) foot.lastElementChild.focus();
  }

  function closeModal() {
    $('#modal').hidden = true;
    $('#modal-body').innerHTML = '';
  }

  /* ======================================================================
   * Math (MathJax is loaded only when the test contains formulas)
   * ==================================================================== */
  function loadMath() {
    if (mathPromise) return mathPromise;
    window.MathJax = {
      tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]'], ['$$', '$$']] },
      svg: { fontCache: 'global' },
      startup: { typeset: false }
    };
    mathPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = MATHJAX_URL;
      s.async = true;
      s.onload = () => {
        const p = window.MathJax && window.MathJax.startup && window.MathJax.startup.promise;
        (p || Promise.resolve()).then(resolve, reject);
      };
      s.onerror = () => reject(new Error('MathJax failed to load'));
      document.head.appendChild(s);
    });
    return mathPromise;
  }

  function typeset(el) {
    if (!session || !session.exam.hasMath) return;
    loadMath()
      .then(() => window.MathJax.typesetPromise([el]))
      .catch(() => { /* formulas stay as plain TeX if MathJax can't load */ });
  }

  function clearMath(el) {
    if (window.MathJax && typeof window.MathJax.typesetClear === 'function') {
      try { window.MathJax.typesetClear([el]); } catch (e) { /* ignore */ }
    }
  }

  /* ======================================================================
   * Reading and checking the question JSON
   * ==================================================================== */
  function toList(v) {
    if (Array.isArray(v)) return { list: v, keys: null };
    if (v && typeof v === 'object') { const keys = Object.keys(v); return { list: keys.map(k => v[k]), keys }; }
    return { list: null, keys: null };
  }

  /** Accepts "B", "(b)", "Option B", a 0-based index, an options-object key, or the exact option text. */
  function resolveAnswer(a, options, keys) {
    const n = options.length;
    if (a === undefined || a === null || a === '') return null;
    if (typeof a === 'number') return Number.isInteger(a) && a >= 0 && a < n ? a : null;
    const s = String(a).trim();
    if (keys) {
      const k = keys.findIndex(x => String(x).trim().toLowerCase() === s.toLowerCase());
      if (k >= 0) return k;
    }
    if (/^\d+$/.test(s)) { const i = Number(s); return i < n ? i : null; }
    const m = s.match(/^\(?\s*(?:option\s*)?([a-z])\s*[).]?$/i);
    if (m) { const i = m[1].toUpperCase().charCodeAt(0) - 65; return i < n ? i : null; }
    const t = options.findIndex(o => str(o).trim() === s);
    return t >= 0 ? t : null;
  }

  function groupBySection(questions) {
    const map = new Map();
    questions.forEach(q => {
      const name = str((q && typeof q === 'object' && (q.section || q.subject)) || 'General').trim() || 'General';
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(q);
    });
    return Array.from(map, ([name, qs]) => ({ name, questions: qs }));
  }

  function normalizeQuestion(q, label, errors, warnings) {
    if (!q || typeof q !== 'object' || Array.isArray(q)) { errors.push(`${label}: must be an object.`); return null; }
    const text = pick(q, ['question', 'q', 'text', 'prompt']);
    const image = pick(q, ['image', 'img', 'figure']);
    const { list: options, keys } = toList(pick(q, ['options', 'choices', 'opts']));
    if (!options || options.length < 2) { errors.push(`${label}: "options" needs at least 2 choices.`); return null; }
    if (str(text).trim() === '' && !image) errors.push(`${label}: "question" text is missing.`);

    const answer = resolveAnswer(pick(q, ['answer', 'correct', 'ans', 'correctAnswer', 'key']), options, keys);
    if (answer === null) {
      errors.push(`${label}: "answer" is missing or invalid. Use a letter "A" to "${letter(options.length - 1)}" or a 0-based index.`);
    }

    let optionsHi = toList(pick(q, ['options_hi', 'optionsHi', 'choices_hi'])).list;
    if (optionsHi && optionsHi.length !== options.length) {
      warnings.push(`${label}: "options_hi" has a different number of options, so the Hindi options were ignored.`);
      optionsHi = null;
    }

    const out = {
      id: q.id != null ? String(q.id) : '',
      text: str(text),
      textHi: str(pick(q, ['question_hi', 'questionHi', 'q_hi'])),
      options: options.map(str),
      optionsHi: optionsHi ? optionsHi.map(str) : null,
      answer,
      explanation: str(pick(q, ['explanation', 'solution', 'exp'])),
      explanationHi: str(pick(q, ['explanation_hi', 'explanationHi', 'solution_hi'])),
      image: image ? String(image) : ''
    };
    const pm = num(q.marks);
    const nm = num(pick(q, ['negative', 'negativeMarks']));
    if (pm != null) out.marks = pm;
    if (nm != null) out.negative = Math.abs(nm);
    return out;
  }

  function normalizeTest(data) {
    const errors = [], warnings = [];
    let meta = {}, rawSections = null;

    if (Array.isArray(data)) {
      rawSections = groupBySection(data);
    } else if (data && typeof data === 'object') {
      meta = data;
      if (Array.isArray(data.sections)) {
        rawSections = data.sections.map((s, i) => ({
          name: str((s && (s.name || s.title || s.section)) || `Section ${i + 1}`),
          questions: s && (s.questions || s.items)
        }));
      } else if (Array.isArray(data.questions)) {
        rawSections = groupBySection(data.questions);
      }
    }
    if (!rawSections) {
      errors.push('The JSON must be a list of questions, or an object with a "sections" or "questions" list.');
      return { test: null, errors, warnings };
    }

    let count = 0;
    const sections = [];
    rawSections.forEach((s, si) => {
      const name = s.name.trim() || `Section ${si + 1}`;
      if (!Array.isArray(s.questions)) { errors.push(`Section "${name}": "questions" must be a list.`); return; }
      const qs = [];
      s.questions.forEach((q, qi) => {
        count++;
        const label = `Section "${name}", question ${qi + 1}${q && q.id != null ? ` (id ${q.id})` : ''}`;
        const nq = normalizeQuestion(q, label, errors, warnings);
        if (nq) qs.push(nq);
      });
      if (!qs.length) { warnings.push(`Section "${name}" has no usable questions, so it was skipped.`); return; }
      sections.push({ name, questions: qs });
    });
    if (!count) errors.push('No questions were found.');

    const marks = meta.marks && typeof meta.marks === 'object' ? meta.marks : {};
    const wrong = num(pick(marks, ['wrong', 'negative', 'incorrect'])) ?? num(meta.negativeMarks);
    const test = {
      title: str(meta.title || meta.name || 'Mock Test'),
      duration: num(pick(meta, ['duration', 'durationMinutes', 'time'])),
      correct: num(pick(marks, ['correct', 'positive', 'right'])) ?? num(meta.positiveMarks),
      wrong: wrong == null ? null : Math.abs(wrong),
      instructions: Array.isArray(meta.instructions) ? meta.instructions.map(str)
        : meta.instructions ? [str(meta.instructions)] : [],
      sections
    };
    return { test, errors, warnings };
  }

  /* ======================================================================
   * Building an exam session
   * ==================================================================== */
  function shuffleOptions(q) {
    const perm = shuffle(q.options.map((_, i) => i));
    return Object.assign({}, q, {
      options: perm.map(i => q.options[i]),
      optionsHi: q.optionsHi ? perm.map(i => q.optionsHi[i]) : null,
      answer: perm.indexOf(q.answer)
    });
  }

  function buildExam(test, settings) {
    const sections = [], questions = [];
    test.sections.forEach((s, si) => {
      let qs = s.questions.map(q => Object.assign({}, q));
      if (settings.shuffleQ) qs = shuffle(qs);
      if (settings.shuffleO) qs = qs.map(shuffleOptions);
      sections.push({ name: s.name, start: questions.length, count: qs.length });
      qs.forEach(q => { q.sec = si; questions.push(q); });
    });
    const allText = q => [q.text, q.textHi, q.explanation, q.explanationHi].concat(q.options, q.optionsHi || []).join(' ');
    return {
      title: settings.title,
      sections,
      questions,
      instructions: test.instructions || [],
      hasHindi: questions.some(q => q.textHi || q.optionsHi),
      hasMath: questions.some(q => MATH_HINT.test(allText(q)))
    };
  }

  /** Turn a finished exam back into a test so it can be retaken. */
  function testFromExam(ex) {
    return {
      title: ex.title, duration: null, correct: null, wrong: null,
      instructions: ex.instructions || [],
      sections: ex.sections.map(s => ({
        name: s.name,
        questions: ex.questions.slice(s.start, s.start + s.count).map(q => {
          const c = Object.assign({}, q);
          delete c.sec;
          return c;
        })
      }))
    };
  }

  function newSession(exam, settings) {
    return {
      v: 1,
      exam,
      settings,
      phase: 'instructions',
      // s = saved answer index, m = marked for review, v = visited, t = time spent (ms)
      resp: exam.questions.map(() => ({ s: null, m: false, v: false, t: 0 })),
      cur: 0,
      pending: null,       // option currently selected on screen (may not be saved yet)
      lastInSec: {},
      lang: 'en',
      startedAt: null,
      endAt: null,
      submittedAt: null,
      autoSubmitted: false,
      warned: false,
      result: null
    };
  }

  function isValidSession(s) {
    return !!(s && s.v === 1 && s.exam && Array.isArray(s.exam.questions) && Array.isArray(s.resp) &&
      s.resp.length === s.exam.questions.length && s.settings);
  }

  function persist() {
    if (!session) return;
    if (!store.set(SESSION_KEY, session) && !storageWarned) {
      storageWarned = true;
      toast('This browser could not save your progress. Avoid refreshing the page.', 5000);
    }
  }

  /* ======================================================================
   * Setup screen
   * ==================================================================== */
  function setTab(name) {
    $$('.tab').forEach(t => {
      const on = t.dataset.tab === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.tab-panel').forEach(p => { p.hidden = p.dataset.panel !== name; });
  }

  function setStatus(kind, html) {
    const el = $('#load-status');
    el.className = 'load-status ' + kind;
    el.innerHTML = html;
    el.hidden = false;
  }

  function updateStart() {
    const ready = !!loadedTest;
    $('#btn-start').disabled = !ready;
    if (ready) {
      const total = loadedTest.sections.reduce((a, s) => a + s.questions.length, 0);
      $('#start-hint').textContent = `${total} questions ready.`;
    } else {
      $('#start-hint').textContent = 'Load a question paper first.';
    }
  }

  function showLoadResult(res, label) {
    if (res.errors.length) {
      loadedTest = null;
      updateStart();
      const n = res.errors.length;
      const shown = res.errors.slice(0, 12).map(e => `<li>${escapeHtml(e)}</li>`).join('');
      const more = n > 12 ? `<li>…and ${n - 12} more</li>` : '';
      setStatus('error', `<b>Found ${n} problem${n > 1 ? 's' : ''} in ${escapeHtml(label)}.</b> Fix ${n > 1 ? 'them' : 'it'} and load the questions again.<ul>${shown}${more}</ul>`);
      return;
    }
    const t = res.test;
    loadedTest = t;
    $('#set-title').value = t.title;
    if (t.duration != null && t.duration > 0) $('#set-duration').value = t.duration;
    else if (!$('#set-duration').value) $('#set-duration').value = DEFAULTS.duration;
    if (t.correct != null) $('#set-correct').value = t.correct;
    else if (!$('#set-correct').value) $('#set-correct').value = DEFAULTS.correct;
    if (t.wrong != null) $('#set-wrong').value = t.wrong;
    else if (!$('#set-wrong').value) $('#set-wrong').value = DEFAULTS.wrong;

    const total = t.sections.reduce((a, s) => a + s.questions.length, 0);
    const warn = res.warnings.length
      ? `<details><summary>${res.warnings.length} warning${res.warnings.length > 1 ? 's' : ''}</summary><ul>${res.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul></details>`
      : '';
    setStatus('ok',
      `<div>Loaded <b>${escapeHtml(t.title)}</b> from ${escapeHtml(label)}: ${total} question${total > 1 ? 's' : ''} in ${t.sections.length} section${t.sections.length > 1 ? 's' : ''}.</div>` +
      `<ul class="sec-list">${t.sections.map(s => `<li>${escapeHtml(s.name)} <span class="muted">· ${s.questions.length}</span></li>`).join('')}</ul>${warn}`);
    updateStart();
  }

  function loadFromText(text, label) {
    let data;
    try {
      data = JSON.parse(String(text).replace(/^\uFEFF/, ''));
    } catch (e) {
      showLoadResult({ errors: [`This is not valid JSON (${e.message}).`], warnings: [] }, label);
      return;
    }
    showLoadResult(normalizeTest(data), label);
  }

  async function loadFromUrl(url, label) {
    setStatus('loading', `Loading ${escapeHtml(label)}…`);
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      loadFromText(await res.text(), label);
    } catch (e) {
      showLoadResult({ errors: [`Could not download the file (${e.message}).`], warnings: [] }, label);
    }
  }

  async function loadLibrary() {
    const box = $('#library-list');
    try {
      const res = await fetch('tests/index.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const tests = (Array.isArray(data) ? data : data.tests || []).filter(t => t && t.file);
      if (!tests.length) {
        box.innerHTML = '<p class="muted">No tests are listed in <code>tests/index.json</code> yet.</p>';
        return;
      }
      box.innerHTML = tests.map(t => `
        <div class="lib-item">
          <div>
            <div class="lib-title">${escapeHtml(t.title || t.file)}</div>
            ${t.description ? `<div class="lib-desc muted">${escapeHtml(t.description)}</div>` : ''}
          </div>
          <button class="btn" data-file="${escapeHtml(t.file)}" data-title="${escapeHtml(t.title || t.file)}">Select</button>
        </div>`).join('');
    } catch (e) {
      const local = location.protocol === 'file:';
      box.innerHTML = `<p class="muted">The test library isn't available${local
        ? ' when the page is opened straight from your computer. Use <b>Upload JSON</b> or <b>Paste JSON</b>, or start a local web server (see README.md).'
        : '. Check that <code>tests/index.json</code> exists.'}</p>`;
      if (local) setTab('upload');
    }
  }

  function readFile(file) {
    const rd = new FileReader();
    rd.onload = () => loadFromText(rd.result, file.name);
    rd.onerror = () => showLoadResult({ errors: ['The file could not be read.'], warnings: [] }, file.name);
    rd.readAsText(file);
  }

  function downloadTemplate() {
    const blob = new Blob([JSON.stringify(TEMPLATE, null, 2) + '\n'], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cbt-question-template.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function showFormatHelp() {
    const example = JSON.stringify({
      title: 'SSC JE Civil Mock 1',
      duration: 120,
      marks: { correct: 1, wrong: 0.25 },
      sections: [{
        name: 'General Intelligence & Reasoning',
        questions: [{
          question: 'Find the next number: 3, 7, 15, 31, ?',
          options: ['61', '63', '65', '62'],
          answer: 'B',
          explanation: 'Each term is (previous × 2) + 1.'
        }]
      }]
    }, null, 2);
    const row = (k, v) => `<tr><td><code>${k}</code></td><td>${v}</td></tr>`;
    openModal({
      title: 'Question paper format (JSON)',
      html: `<pre class="code">${escapeHtml(example)}</pre>
        <div class="table-wrap"><table class="tbl tbl-compact fmt"><tbody>
          ${row('title', 'Name of the test.')}
          ${row('duration', 'Minutes. Optional; you can also set it on the start screen.')}
          ${row('marks', '<code>{"correct": 1, "wrong": 0.25}</code>. Optional.')}
          ${row('instructions', 'Optional list of extra instructions shown before the test.')}
          ${row('sections', 'List of sections, each with a <code>name</code> and a <code>questions</code> list.')}
          ${row('question', 'Question text. Simple HTML (<code>&lt;b&gt;</code>, <code>&lt;sub&gt;</code>, <code>&lt;sup&gt;</code>, <code>&lt;br&gt;</code>, <code>&lt;table&gt;</code>, <code>&lt;img&gt;</code>) and math such as <code>\\(x^2\\)</code> work.')}
          ${row('options', 'List of 2 or more choices (usually 4).')}
          ${row('answer', 'The correct option as a letter: <code>"A"</code>, <code>"B"</code>, <code>"C"</code> or <code>"D"</code>. A number is read as a 0-based index (0 = A).')}
          ${row('explanation', 'Optional. Shown in the answer review after the test.')}
          ${row('image', 'Optional picture: a web address or a path such as <code>images/q12.png</code>.')}
          ${row('question_hi, options_hi, explanation_hi', 'Optional Hindi version. Adds a <b>View in</b> language switch.')}
          ${row('marks, negative', 'Optional, on a single question: marks for just that question.')}
        </tbody></table></div>
        <p class="muted">You can also use one flat <code>"questions"</code> list where every question has a <code>"section"</code> name.</p>`,
      buttons: [{ label: 'Download template', onClick: downloadTemplate }, { label: 'Close', cls: 'btn-primary' }]
    });
  }

  function applyPrefs() {
    const p = store.get(PREFS_KEY) || {};
    $('#set-name').value = p.name || '';
    $('#set-roll').value = p.roll || '';
    setChk('#set-strict', p.strict !== false);
    setChk('#set-fullscreen', p.fullscreen !== false);
    setChk('#set-instructions', p.showInstructions !== false);
    setChk('#set-calc', p.calculator !== false);
    setChk('#set-shuffle-q', p.shuffleQ);
    setChk('#set-shuffle-o', p.shuffleO);
    $('#set-duration').value = DEFAULTS.duration;
    $('#set-correct').value = DEFAULTS.correct;
    $('#set-wrong').value = DEFAULTS.wrong;
  }

  function savePrefs(st) {
    store.set(PREFS_KEY, {
      name: st.name, roll: st.roll, strict: st.strict, fullscreen: st.fullscreen,
      showInstructions: st.showInstructions, calculator: st.calculator, shuffleQ: st.shuffleQ, shuffleO: st.shuffleO
    });
  }

  function fillSettings(st) {
    $('#set-title').value = st.title;
    $('#set-duration').value = st.duration;
    $('#set-correct').value = st.correct;
    $('#set-wrong').value = st.wrong;
    $('#set-name').value = st.name || '';
    $('#set-roll').value = st.roll || '';
    setChk('#set-strict', st.strict);
    setChk('#set-fullscreen', st.fullscreen);
    setChk('#set-instructions', st.showInstructions);
    setChk('#set-calc', st.calculator !== false);
    setChk('#set-shuffle-q', st.shuffleQ);
    setChk('#set-shuffle-o', st.shuffleO);
  }

  function fieldError(sel, msg) {
    toast(msg);
    const el = $(sel);
    el.focus();
    if (el.select) el.select();
  }

  function onStart() {
    if (!loadedTest) return;
    const duration = num($('#set-duration').value);
    const correct = num($('#set-correct').value);
    const wrong = num($('#set-wrong').value);
    if (duration == null || duration <= 0) return fieldError('#set-duration', 'Enter the test duration in minutes.');
    if (correct == null || correct < 0) return fieldError('#set-correct', 'Enter the marks for a correct answer.');
    if (wrong == null) return fieldError('#set-wrong', 'Enter the negative marks for a wrong answer (0 for none).');

    const settings = {
      title: $('#set-title').value.trim() || loadedTest.title,
      name: $('#set-name').value.trim(),
      roll: $('#set-roll').value.trim(),
      duration,
      correct,
      wrong: Math.abs(wrong),
      strict: chk('#set-strict'),
      fullscreen: chk('#set-fullscreen'),
      showInstructions: chk('#set-instructions'),
      calculator: chk('#set-calc'),
      shuffleQ: chk('#set-shuffle-q'),
      shuffleO: chk('#set-shuffle-o')
    };
    savePrefs(settings);
    session = newSession(buildExam(loadedTest, settings), settings);
    if (settings.showInstructions) showInstructions();
    else startExam();
  }

  function renderBanner() {
    const b = $('#resume-banner');
    const s = store.get(SESSION_KEY);
    if (isValidSession(s) && s.phase === 'result' && s.result) {
      b.innerHTML = `<div><b>Last result:</b> ${escapeHtml(s.exam.title)}, score ${fmtNum(s.result.tot.score)} / ${fmtNum(s.result.tot.max)}</div>
        <button class="btn" id="banner-view">View result</button>`;
      b.hidden = false;
      $('#banner-view').addEventListener('click', () => { session = s; showResult(); });
    } else {
      b.hidden = true;
    }
  }

  function showSetup() {
    showScreen('setup');
    renderBanner();
  }

  /** Go back to setup with the given session's test and settings loaded. */
  function setupFromSession(s, label) {
    loadedTest = testFromExam(s.exam);
    showSetup();
    showLoadResult({ test: loadedTest, errors: [], warnings: [] }, label);
    fillSettings(s.settings);
  }

  function bindSetup() {
    $$('.tab').forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab)));

    $('#library-list').addEventListener('click', e => {
      const b = e.target.closest('[data-file]');
      if (!b) return;
      $$('.lib-item').forEach(x => x.classList.toggle('selected', x.contains(b)));
      loadFromUrl(b.dataset.file, b.dataset.file.split('/').pop());
    });

    const dz = $('#drop-zone');
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', e => {
      const f = e.dataTransfer && e.dataTransfer.files[0];
      if (f) readFile(f);
    });
    $('#file-input').addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) readFile(f);
      e.target.value = '';
    });
    // Stop the browser from opening a file dropped outside the drop zone.
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => e.preventDefault());

    $('#paste-load').addEventListener('click', () => {
      const t = $('#paste-input').value.trim();
      if (!t) { toast('Paste your JSON into the box first.'); return; }
      loadFromText(t, 'the pasted text');
    });
    $('#format-help').addEventListener('click', showFormatHelp);
    $('#dl-template').addEventListener('click', downloadTemplate);
    $('#btn-start').addEventListener('click', onStart);
  }

  /* ======================================================================
   * Instructions
   * ==================================================================== */
  function instructionsHtml() {
    const ex = session.exam, st = session.settings;
    let n = 0;
    const li = html => `<li value="${++n}">${html}</li>`;
    const perQ = ex.questions.some(q => q.marks != null || q.negative != null);
    const rows = ex.sections.map(s => {
      const max = ex.questions.slice(s.start, s.start + s.count).reduce((a, q) => a + (q.marks ?? st.correct), 0);
      return { name: s.name, count: s.count, max };
    });
    const totalMax = rows.reduce((a, r) => a + r.max, 0);
    const legend = ['nv', 'na', 'an', 'mr', 'am']
      .map(k => `<li><span class="lg-ico st-${k}"></span><span>${STATUS_DESC[k]}</span></li>`).join('');

    return `
      <h3>General instructions</h3>
      <ol>
        ${li(`The test lasts <b>${fmtNum(st.duration)} minutes</b>. The countdown timer at the top right of the screen shows the time left. When it reaches zero, the test is submitted automatically; you don't need to click Submit.`)}
        ${li(`The Question Palette on the right of the screen shows the status of each question:<ul class="legend-list">${legend}</ul>`)}
        ${st.calculator !== false ? li('Click <b>Calculator</b> at the top of the screen to open the on-screen scientific calculator. You can drag it by its title bar.') : ''}
        ${li('<b>Marked for Review</b> means you want to look at the question again. If a question is answered <i>and</i> marked for review, its answer will be evaluated.')}
      </ol>
      <h3>Navigating to a question</h3>
      <ol>
        ${li(`Click a question number in the palette to go straight to that question.${st.strict ? ' <b>This does not save the answer to your current question.</b>' : ''}`)}
        ${li('Click <b>Save &amp; Next</b> to save your answer and go to the next question.')}
        ${li('Click <b>Mark for Review &amp; Next</b> to save your answer, mark the question for review and go to the next question.')}
        ${li(`Click <b>« Back</b> to go to the previous question${st.strict ? ' (this does not save your answer either)' : ''}.`)}
      </ol>
      <h3>Answering a question</h3>
      <ol>
        ${li('To choose an answer, click one of the options.')}
        ${li('To remove your chosen answer, click <b>Clear Response</b>.')}
        ${li(st.strict
          ? 'To change your answer, click a different option and then click <b>Save &amp; Next</b>. An answer counts only after you click <b>Save &amp; Next</b> or <b>Mark for Review &amp; Next</b>.'
          : 'Your answer is saved as soon as you click an option. To change it, click a different option.')}
      </ol>
      <h3>Sections</h3>
      <ol>
        ${li(`This test has <b>${ex.sections.length} section${ex.sections.length > 1 ? 's' : ''}</b>, shown as tabs above the question. Click a tab to see its questions. Point at a tab to see a status summary for that section.`)}
        ${li('After the last question of a section, <b>Save &amp; Next</b> takes you to the first question of the next section. You can move between sections at any time.')}
      </ol>
      <h3>About this test</h3>
      <div class="table-wrap"><table class="tbl tbl-compact">
        <thead><tr><th>Section</th><th>Questions</th><th>Maximum marks</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${escapeHtml(r.name)}</td><td>${r.count}</td><td>${fmtNum(r.max)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td><td>${ex.questions.length}</td><td>${fmtNum(totalMax)}</td></tr></tfoot>
      </table></div>
      <p>Marking: <span class="pos">+${fmtNum(st.correct)}</span> for each correct answer, <span class="neg">−${fmtNum(st.wrong)}</span> for each wrong answer and 0 for a question you don't answer.${perQ ? ' Some questions carry different marks; these are shown above the question.' : ''}</p>
      ${ex.hasHindi ? '<p>Use <b>View in</b> above a question to switch between English and Hindi.</p>' : ''}
      ${ex.instructions.length ? `<h3>Additional instructions</h3><ul>${ex.instructions.map(t => `<li>${rich(t)}</li>`).join('')}</ul>` : ''}
    `;
  }

  function candidateHtml() {
    const st = session.settings;
    return `<b>${escapeHtml(st.name || 'Candidate')}</b>${st.roll ? `<small>Roll No. ${escapeHtml(st.roll)}</small>` : ''}`;
  }

  function showInstructions() {
    session.phase = 'instructions';
    persist();
    showScreen('instructions');
    $('#ins-title').textContent = session.exam.title;
    $('#ins-content').innerHTML = instructionsHtml();
    $('#ins-cand').innerHTML = candidateHtml();
    $('#ins-agree').checked = false;
    $('#ins-begin').disabled = true;
    $('#ins-main').scrollTop = 0;
  }

  function bindInstructions() {
    $('#ins-agree').addEventListener('change', e => { $('#ins-begin').disabled = !e.target.checked; });
    $('#ins-begin').addEventListener('click', startExam);
    $('#ins-back').addEventListener('click', () => {
      const s = session;
      session = null;
      store.del(SESSION_KEY);
      setupFromSession(s, 'your last selection');
    });
  }

  /* ======================================================================
   * Exam
   * ==================================================================== */
  function statusOf(g) {
    const r = session.resp[g];
    if (!r.v) return 'nv';
    const answered = r.s !== null;
    if (r.m) return answered ? 'am' : 'mr';
    return answered ? 'an' : 'na';
  }

  function countStatus(start, count) {
    const c = { nv: 0, na: 0, an: 0, mr: 0, am: 0 };
    for (let g = start; g < start + count; g++) c[statusOf(g)]++;
    return c;
  }

  function startExam() {
    const now = Date.now();
    session.phase = 'exam';
    session.startedAt = now;
    session.endAt = now + session.settings.duration * 60000;
    session.cur = 0;
    session.pending = session.resp[0].s;
    if (session.settings.fullscreen) enterFullscreen();
    showExam();
  }

  function showExam() {
    showScreen('exam');
    const ex = session.exam;
    $('#ex-title').textContent = ex.title;
    $('#ex-cand').innerHTML = candidateHtml();
    $('#ex-lang-wrap').hidden = !ex.hasHindi;
    $('#ex-lang').value = session.lang;
    $('#ex-calc').hidden = session.settings.calculator === false;
    closeCalc();
    session.lastInSec[ex.questions[session.cur].sec] = session.cur;
    qEnteredAt = Date.now();
    renderQuestion();
    persist();
    updateFsButton();
    startTimer();
  }

  function resumeExam() {
    if (Date.now() >= session.endAt) {
      qEnteredAt = 0;
      submitExam(true);
      return;
    }
    showExam();
    toast('Your test was restored. The timer kept running while the page was closed.', 4500);
  }

  function renderQuestion() {
    const ex = session.exam, g = session.cur, q = ex.questions[g], r = session.resp[g];
    r.v = true;
    const hi = session.lang === 'hi';
    const text = hi && q.textHi ? q.textHi : q.text;
    const opts = hi && q.optionsHi ? q.optionsHi : q.options;

    $('#ex-qno').textContent = g + 1;
    $('#ex-pos').textContent = '+' + fmtNum(q.marks ?? session.settings.correct);
    $('#ex-neg').textContent = '−' + fmtNum(q.negative ?? session.settings.wrong);

    const box = $('#ex-content');
    clearMath(box);
    const src = q.image ? safeUrl(q.image) : '';
    const img = src ? `<div class="q-img"><img src="${escapeHtml(src)}" alt="Figure for question ${g + 1}"></div>` : '';
    box.innerHTML =
      `<div class="q-text">${rich(text)}</div>${img}` +
      `<div class="options" role="radiogroup" aria-label="Options">` +
      opts.map((o, i) => {
        const on = session.pending === i;
        return `<label class="opt${on ? ' sel' : ''}" data-i="${i}">` +
          `<input type="radio" name="opt" value="${i}"${on ? ' checked' : ''}>` +
          `<span class="opt-key">${letter(i)}.</span><span class="opt-text">${rich(o)}</span></label>`;
      }).join('') +
      `</div>`;
    box.scrollTop = 0;
    typeset(box);

    $('#ex-back').disabled = g === 0;
    renderTabs();
    renderPalette();
  }

  function renderTabs() {
    const ex = session.exam, curSec = ex.questions[session.cur].sec;
    $('#ex-tabs').innerHTML = ex.sections.map((s, i) =>
      `<button class="sec-tab${i === curSec ? ' active' : ''}" data-sec="${i}" aria-pressed="${i === curSec}">` +
      `<span>${escapeHtml(s.name)}</span><span class="sec-info" aria-hidden="true">i</span></button>`).join('');
    const active = $('#ex-tabs .sec-tab.active');
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function renderPalette() {
    const ex = session.exam, sec = ex.sections[ex.questions[session.cur].sec];
    $('#ex-pal-sec').textContent = sec.name;
    let html = '';
    for (let g = sec.start; g < sec.start + sec.count; g++) {
      const st = statusOf(g);
      html += `<button class="qbtn st-${st}${g === session.cur ? ' current' : ''}" data-g="${g}" ` +
        `title="Question ${g + 1}: ${STATUS[st]}" aria-label="Question ${g + 1}, ${STATUS[st]}">${g + 1}</button>`;
    }
    $('#ex-grid').innerHTML = html;

    const c = countStatus(sec.start, sec.count);
    $('#ex-legend').innerHTML = STATUS_ORDER.map(k =>
      `<div class="lg-item lg-${k}"><span class="lg-ico st-${k}">${c[k]}</span><span>${STATUS[k]}${k === 'am' ? ' <span class="muted">(will be evaluated)</span>' : ''}</span></div>`).join('');
  }

  function showSecTip(btn) {
    if (!session) return;
    const tip = $('#sec-tip');
    const s = session.exam.sections[Number(btn.dataset.sec)];
    const c = countStatus(s.start, s.count);
    tip.innerHTML = `<div class="tip-title">${escapeHtml(s.name)} <span class="muted">(${s.count} questions)</span></div>` +
      STATUS_ORDER.map(k => `<div class="tip-row"><span class="lg-ico st-${k}">${c[k]}</span><span>${STATUS[k]}</span></div>`).join('');
    tip.hidden = false;
    const r = btn.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(r.left, window.innerWidth - tip.offsetWidth - 8)) + 'px';
    tip.style.top = (r.bottom + 6) + 'px';
  }

  function hideSecTip() { const t = $('#sec-tip'); if (t) t.hidden = true; }

  /** Add the time spent on the current question since it was opened. */
  function flushTime() {
    if (!session || session.phase !== 'exam' || !qEnteredAt) return;
    const now = Date.now();
    session.resp[session.cur].t += now - qEnteredAt;
    qEnteredAt = now;
  }

  function goTo(g, force) {
    if (g < 0 || g >= session.exam.questions.length) return;
    closePalette();
    if (g === session.cur && !force) return;
    flushTime();
    session.cur = g;
    session.pending = session.resp[g].s;   // an unsaved selection on the old question is dropped
    session.lastInSec[session.exam.questions[g].sec] = g;
    renderQuestion();
    persist();
  }

  function commitAndNext(mark) {
    const r = session.resp[session.cur];
    r.s = session.pending;
    r.m = mark;
    goTo((session.cur + 1) % session.exam.questions.length, true);
  }

  function clearResponse() {
    session.pending = null;
    session.resp[session.cur].s = null;
    $$('#ex-content input[name="opt"]').forEach(i => { i.checked = false; });
    $$('#ex-content .opt').forEach(o => o.classList.remove('sel'));
    renderPalette();
    persist();
  }

  function onOptionChange(e) {
    if (e.target.name !== 'opt') return;
    session.pending = Number(e.target.value);
    if (!session.settings.strict) {
      session.resp[session.cur].s = session.pending;
      renderPalette();
    }
    $$('#ex-content .opt').forEach(o => o.classList.toggle('sel', Number(o.dataset.i) === session.pending));
    persist();
  }

  function openPalette() { $('#ex-palette').classList.add('open'); $('#ex-backdrop').hidden = false; }
  function closePalette() { $('#ex-palette').classList.remove('open'); $('#ex-backdrop').hidden = true; }

  /* ---------- Scientific calculator ---------- */
  const CALC_NAMES = ['sin⁻¹', 'cos⁻¹', 'tan⁻¹', 'sin', 'cos', 'tan', 'log', 'ln', 'Ans', 'π', 'e', '√'];
  // [label, text to insert or action, style class]
  const CALC_KEYS = [
    ['Deg', '@deg', 'fn'], ['(', '(', 'fn'], [')', ')', 'fn'], ['⌫', '@back', 'del'], ['C', '@clear', 'del'],
    ['sin', 'sin(', 'fn'], ['cos', 'cos(', 'fn'], ['tan', 'tan(', 'fn'], ['π', 'π', 'fn'], ['e', 'e', 'fn'],
    ['sin⁻¹', 'sin⁻¹(', 'fn'], ['cos⁻¹', 'cos⁻¹(', 'fn'], ['tan⁻¹', 'tan⁻¹(', 'fn'], ['log', 'log(', 'fn'], ['ln', 'ln(', 'fn'],
    ['x²', '^2', 'fn'], ['xʸ', '^', 'fn'], ['√', '√(', 'fn'], ['n!', '!', 'fn'], ['1/x', '@inv', 'fn'],
    ['7', '7', ''], ['8', '8', ''], ['9', '9', ''], ['÷', '÷', 'op'], ['%', '%', 'op'],
    ['4', '4', ''], ['5', '5', ''], ['6', '6', ''], ['×', '×', 'op'], ['Ans', 'Ans', 'fn'],
    ['1', '1', ''], ['2', '2', ''], ['3', '3', ''], ['−', '−', 'op'], ['EXP', 'E', 'fn'],
    ['0', '0', ''], ['.', '.', ''], ['+', '+', 'op'], ['=', '@eq', 'eq']
  ];
  const calc = { expr: '', res: '0', ans: 0, deg: true, done: false };

  /** Evaluate a calculator expression with a small parser (no eval). Throws on any error. */
  function calcEval(src, deg, ans) {
    const toks = [];
    let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (ch === ' ') { i++; continue; }
      const m = /^(?:\d+\.?\d*|\.\d+)(?:E[+\-−]?\d+)?/.exec(src.slice(i));
      if (m) { toks.push({ t: 'n', v: Number(m[0].replace('−', '-')) }); i += m[0].length; continue; }
      const name = CALC_NAMES.find(n => src.startsWith(n, i));
      if (name) { toks.push({ t: 'id', v: name }); i += name.length; continue; }
      const op = { '−': '-', '×': '*', '÷': '/' }[ch] || ch;
      if (!'+-*/^()!%'.includes(op)) throw new Error('syntax');
      toks.push({ t: op });
      i++;
    }
    let p = 0;
    const peek = () => toks[p];
    const eat = t => (peek() && peek().t === t ? (p++, true) : false);
    const toRad = x => (deg ? x * Math.PI / 180 : x);
    const fromRad = x => (deg ? x * 180 / Math.PI : x);
    const tidy = x => (Math.abs(x) < 1e-12 ? 0 : x);
    const fns = {
      'sin': x => tidy(Math.sin(toRad(x))),
      'cos': x => tidy(Math.cos(toRad(x))),
      'tan': x => { if (Math.abs(Math.cos(toRad(x))) < 1e-12) throw new Error('math'); return tidy(Math.tan(toRad(x))); },
      'sin⁻¹': x => fromRad(Math.asin(x)),
      'cos⁻¹': x => fromRad(Math.acos(x)),
      'tan⁻¹': x => fromRad(Math.atan(x)),
      'log': x => Math.log10(x),
      'ln': x => Math.log(x),
      '√': x => Math.sqrt(x)
    };
    const fact = n => {
      if (n < 0 || n > 170 || !Number.isInteger(n)) throw new Error('math');
      let r = 1;
      for (let k = 2; k <= n; k++) r *= k;
      return r;
    };
    const close = () => { if (!eat(')') && peek()) throw new Error('syntax'); };   // a missing final ")" is allowed
    function expr() {
      let v = term();
      for (;;) {
        if (eat('+')) v += term();
        else if (eat('-')) v -= term();
        else return v;
      }
    }
    function term() {
      let v = unary();
      for (;;) {
        const t = peek();
        if (eat('*')) v *= unary();
        else if (eat('/')) v /= unary();
        else if (t && (t.t === 'n' || t.t === 'id' || t.t === '(')) v *= power();   // 2π, 3(4+1)
        else return v;
      }
    }
    function unary() {
      if (eat('-')) return -unary();
      if (eat('+')) return unary();
      return power();
    }
    function power() {
      const v = postfix();
      return eat('^') ? Math.pow(v, unary()) : v;
    }
    function postfix() {
      let v = primary();
      for (;;) {
        if (eat('!')) v = fact(v);
        else if (eat('%')) v /= 100;
        else return v;
      }
    }
    function primary() {
      const t = peek();
      if (!t) throw new Error('syntax');
      p++;
      if (t.t === 'n') return t.v;
      if (t.t === '(') { const v = expr(); close(); return v; }
      if (t.t === 'id') {
        if (t.v === 'π') return Math.PI;
        if (t.v === 'e') return Math.E;
        if (t.v === 'Ans') return ans;
        if (!eat('(')) throw new Error('syntax');
        const v = expr();
        close();
        return fns[t.v](v);
      }
      throw new Error('syntax');
    }
    const v = expr();
    if (p < toks.length || !isFinite(v)) throw new Error('math');
    return v;
  }

  function calcRender() {
    $('#calc-expr').textContent = calc.expr;
    $('#calc-res').textContent = calc.res;
    const d = $('#calc-keys [data-k="@deg"]');
    if (d) d.textContent = calc.deg ? 'Deg' : 'Rad';
  }

  function calcPress(k) {
    if (k === '@clear') { calc.expr = ''; calc.res = '0'; calc.done = false; }
    else if (k === '@deg') { calc.deg = !calc.deg; }
    else if (k === '@back') {
      if (calc.done) { calc.expr = ''; calc.done = false; }
      else {
        const fn = CALC_NAMES.map(n => n + '(').concat(CALC_NAMES).find(n => calc.expr.endsWith(n));
        calc.expr = calc.expr.slice(0, -(fn ? fn.length : 1));
      }
    }
    else if (k === '@eq') {
      if (!calc.expr) return;
      try {
        const v = calcEval(calc.expr, calc.deg, calc.ans);
        calc.ans = v;
        calc.res = String(parseFloat(v.toPrecision(10))).replace('-', '−');
        calc.done = true;
      } catch (e) {
        calc.res = 'Error';
      }
    }
    else if (k === '@inv') {
      const inner = calc.done ? 'Ans' : calc.expr;
      if (!inner) return;
      calc.expr = '1÷(' + inner + ')';
      calc.done = false;
    }
    else {
      if (calc.done) {             // after "=": an operator continues from the answer, anything else starts fresh
        calc.expr = /^[+−×÷^!%]/.test(k) ? 'Ans' : '';
        calc.done = false;
      }
      calc.expr += k;
    }
    calcRender();
  }

  function openCalc() { $('#calc').hidden = false; calcRender(); $('#calc').focus(); }
  function closeCalc() { $('#calc').hidden = true; }

  function bindCalc() {
    const panel = $('#calc');
    $('#calc-keys').innerHTML = CALC_KEYS.map(([label, k, cls]) =>
      `<button class="ck ${cls}" data-k="${escapeHtml(k)}">${escapeHtml(label)}</button>`).join('');
    $('#calc-keys').addEventListener('click', e => {
      const b = e.target.closest('.ck');
      if (b) calcPress(b.dataset.k);
    });
    $('#ex-calc').addEventListener('click', () => (panel.hidden ? openCalc() : closeCalc()));
    $('#calc-close').addEventListener('click', closeCalc);

    // Keyboard input while the calculator has focus.
    const keyMap = { '*': '×', '/': '÷', '-': '−', 'Enter': '@eq', '=': '@eq', 'Backspace': '@back', 'Delete': '@clear', 'c': '@clear', 'C': '@clear', 'p': 'π' };
    panel.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') { e.stopPropagation(); closeCalc(); return; }
      const k = keyMap[e.key] || (/^[0-9.+^()!%e]$/.test(e.key) ? e.key : null);
      if (!k) return;
      e.preventDefault();
      e.stopPropagation();
      calcPress(k);
    });

    // Drag by the title bar.
    const head = $('#calc-head');
    let drag = null;
    head.addEventListener('pointerdown', e => {
      if (e.target.closest('.calc-close')) return;
      const r = panel.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      if (head.setPointerCapture) head.setPointerCapture(e.pointerId);
    });
    head.addEventListener('pointermove', e => {
      if (!drag) return;
      const x = Math.max(0, Math.min(e.clientX - drag.dx, window.innerWidth - panel.offsetWidth));
      const y = Math.max(0, Math.min(e.clientY - drag.dy, window.innerHeight - 40));
      panel.style.left = x + 'px';
      panel.style.top = y + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    });
    ['pointerup', 'pointercancel'].forEach(ev => head.addEventListener(ev, () => { drag = null; }));
  }

  /* ---------- Timer ---------- */
  function startTimer() {
    stopTimer();
    tick();
    timerId = setInterval(tick, 500);
  }

  function stopTimer() {
    if (timerId) clearInterval(timerId);
    timerId = null;
  }

  function tick() {
    if (!session || session.phase !== 'exam') { stopTimer(); return; }
    const left = session.endAt - Date.now();
    $('#ex-timer').textContent = fmtClock(left);
    $('#ex-timer-wrap').classList.toggle('warn', left <= 5 * 60000);
    if (left <= 0) {
      stopTimer();
      submitExam(true);
      return;
    }
    if (!session.warned && left <= 5 * 60000 && session.settings.duration > 5) {
      session.warned = true;
      toast('5 minutes left.', 4000);
      persist();
    }
    if (++tickCount % 20 === 0) { flushTime(); persist(); }   // about every 10 seconds
  }

  /* ---------- Full screen ---------- */
  function isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }

  function enterFullscreen() {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!fn) return;
    try { const p = fn.call(el); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
  }

  function exitFullscreen() {
    if (!isFullscreen()) return;
    const fn = document.exitFullscreen || document.webkitExitFullscreen;
    try { const p = fn.call(document); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
  }

  function updateFsButton() {
    const b = $('#ex-fullscreen');
    const supported = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
    b.hidden = !supported;
    b.textContent = isFullscreen() ? 'Exit full screen' : 'Full screen';
  }

  /* ---------- Submit ---------- */
  function confirmSubmit() {
    flushTime();
    const ex = session.exam;
    const tot = { q: 0, an: 0, na: 0, mr: 0, am: 0, nv: 0 };
    const rows = ex.sections.map(s => {
      const c = countStatus(s.start, s.count);
      tot.q += s.count;
      STATUS_ORDER.forEach(k => { tot[k] += c[k]; });
      return `<tr><td>${escapeHtml(s.name)}</td><td>${s.count}</td><td>${c.an}</td><td>${c.na}</td><td>${c.mr}</td><td>${c.am}</td><td>${c.nv}</td></tr>`;
    }).join('');
    const r = session.resp[session.cur];
    const unsaved = session.settings.strict && session.pending !== null && session.pending !== r.s;
    openModal({
      title: 'Submit test',
      html: `<div class="table-wrap"><table class="tbl tbl-compact">
          <thead><tr><th>Section</th><th>Questions</th><th>Answered</th><th>Not answered</th><th>Marked for review</th><th>Answered &amp; marked</th><th>Not visited</th></tr></thead>
          <tbody>${rows}</tbody>
          ${ex.sections.length > 1 ? `<tfoot><tr><td>Total</td><td>${tot.q}</td><td>${tot.an}</td><td>${tot.na}</td><td>${tot.mr}</td><td>${tot.am}</td><td>${tot.nv}</td></tr></tfoot>` : ''}
        </table></div>
        ${unsaved ? `<p class="warn-text">Your selection on Question ${session.cur + 1} is not saved. Go back and click Save &amp; Next if you want it to count.</p>` : ''}
        <p>Time left: <b>${fmtClock(session.endAt - Date.now())}</b></p>
        <p><b>Are you sure you want to submit the test?</b> You can't change your answers after you submit.</p>`,
      buttons: [{ label: 'No, go back' }, { label: 'Yes, submit', cls: 'btn-primary', onClick: () => submitExam(false) }]
    });
  }

  function submitExam(auto) {
    if (!session || session.phase !== 'exam') return;
    flushTime();
    stopTimer();
    qEnteredAt = 0;
    session.phase = 'result';
    session.submittedAt = Math.min(Date.now(), session.endAt);
    session.autoSubmitted = !!auto;
    session.result = computeResult(session);
    persist();
    exitFullscreen();
    closeModal();
    closePalette();
    closeCalc();
    showResult();
    if (auto) {
      openModal({
        title: 'Time is up',
        html: '<p>Your time is over, so the test was submitted automatically.</p>',
        buttons: [{ label: 'View result', cls: 'btn-primary' }]
      });
    }
  }

  function bindExam() {
    $('#ex-content').addEventListener('change', onOptionChange);
    $('#ex-save').addEventListener('click', () => commitAndNext(false));
    $('#ex-mark').addEventListener('click', () => commitAndNext(true));
    $('#ex-clear').addEventListener('click', clearResponse);
    $('#ex-back').addEventListener('click', () => { if (session.cur > 0) goTo(session.cur - 1); });
    $('#ex-submit').addEventListener('click', confirmSubmit);

    $('#ex-grid').addEventListener('click', e => {
      const b = e.target.closest('.qbtn');
      if (b) goTo(Number(b.dataset.g));
    });

    const tabs = $('#ex-tabs');
    tabs.addEventListener('click', e => {
      const b = e.target.closest('.sec-tab');
      if (!b) return;
      hideSecTip();
      const si = Number(b.dataset.sec);
      if (session.exam.questions[session.cur].sec === si) return;
      goTo(session.lastInSec[si] ?? session.exam.sections[si].start);
    });
    tabs.addEventListener('mouseover', e => { const b = e.target.closest('.sec-tab'); if (b) showSecTip(b); });
    tabs.addEventListener('mouseleave', hideSecTip);
    tabs.addEventListener('scroll', hideSecTip);

    $('#ex-lang').addEventListener('change', e => { session.lang = e.target.value; renderQuestion(); persist(); });
    $('#ex-instr').addEventListener('click', () => openModal({
      title: 'Instructions',
      html: `<div class="ins-content">${instructionsHtml()}</div>`,
      buttons: [{ label: 'Close', cls: 'btn-primary' }]
    }));
    $('#ex-fullscreen').addEventListener('click', () => (isFullscreen() ? exitFullscreen() : enterFullscreen()));
    document.addEventListener('fullscreenchange', updateFsButton);
    document.addEventListener('webkitfullscreenchange', updateFsButton);
    $('#ex-palette-toggle').addEventListener('click', () => (
      $('#ex-palette').classList.contains('open') ? closePalette() : openPalette()));
    $('#ex-backdrop').addEventListener('click', closePalette);

    // Like a real CBT: no right-click, copying or dragging question text.
    const screen = $('#screen-exam');
    ['contextmenu', 'copy', 'cut', 'dragstart'].forEach(ev => screen.addEventListener(ev, e => e.preventDefault()));
  }

  /* ======================================================================
   * Result
   * ==================================================================== */
  function computeResult(s) {
    const ex = s.exam, st = s.settings;
    const secs = ex.sections.map(sec => ({ name: sec.name, total: sec.count, attempted: 0, correct: 0, wrong: 0, score: 0, max: 0, time: 0 }));
    const items = ex.questions.map((q, g) => {
      const r = s.resp[g], row = secs[q.sec];
      const pos = q.marks ?? st.correct, neg = q.negative ?? st.wrong;
      row.max += pos;
      row.time += r.t;
      if (r.s === null) return { outcome: 'skip', marks: 0 };
      row.attempted++;
      if (r.s === q.answer) { row.correct++; row.score += pos; return { outcome: 'right', marks: pos }; }
      row.wrong++;
      row.score -= neg;
      return { outcome: 'wrong', marks: -neg };
    });
    const keys = ['total', 'attempted', 'correct', 'wrong', 'score', 'max', 'time'];
    const tot = secs.reduce((a, x) => { keys.forEach(k => { a[k] += x[k]; }); return a; },
      { total: 0, attempted: 0, correct: 0, wrong: 0, score: 0, max: 0, time: 0 });
    secs.forEach(x => { x.score = round2(x.score); x.max = round2(x.max); });
    tot.score = round2(tot.score);
    tot.max = round2(tot.max);
    return { secs, tot, items };
  }

  function showResult() {
    const s = session, ex = s.exam;
    if (!s.result) s.result = computeResult(s);
    const R = s.result, T = R.tot;
    showScreen('result');

    $('#rs-title').textContent = ex.title;
    const taken = Math.max(0, (s.submittedAt || Date.now()) - (s.startedAt || Date.now()));
    $('#rs-meta').innerHTML = [
      s.settings.name && `Candidate: <b>${escapeHtml(s.settings.name)}</b>`,
      s.settings.roll && `Roll No. ${escapeHtml(s.settings.roll)}`,
      s.submittedAt && `Submitted ${escapeHtml(new Date(s.submittedAt).toLocaleString())}${s.autoSubmitted ? ' (time up)' : ''}`
    ].filter(Boolean).join(' · ');
    $('#rs-score').innerHTML = `${fmtNum(T.score)}<span> / ${fmtNum(T.max)}</span>`;

    const acc = T.attempted ? `${Math.round((T.correct / T.attempted) * 1000) / 10}%` : '—';
    const stat = (label, value, cls) => `<div class="stat ${cls || ''}"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`;
    $('#rs-stats').innerHTML =
      stat('Questions', T.total) +
      stat('Attempted', T.attempted) +
      stat('Correct', T.correct, 'good') +
      stat('Wrong', T.wrong, 'bad') +
      stat('Not attempted', T.total - T.attempted) +
      stat('Accuracy', acc) +
      stat('Time taken', `${fmtSpent(taken)} <small>of ${fmtNum(s.settings.duration)} min</small>`);

    const secRow = (x, cell) => `<tr><${cell}>${escapeHtml(x.name)}</${cell}><td>${x.total}</td><td>${x.attempted}</td><td>${x.correct}</td><td>${x.wrong}</td><td><b>${fmtNum(x.score)}</b> / ${fmtNum(x.max)}</td><td>${fmtSpent(x.time)}</td></tr>`;
    $('#rs-sections').innerHTML =
      '<thead><tr><th>Section</th><th>Questions</th><th>Attempted</th><th>Correct</th><th>Wrong</th><th>Score</th><th>Time spent</th></tr></thead>' +
      `<tbody>${R.secs.map(x => secRow(x, 'td')).join('')}</tbody>` +
      (R.secs.length > 1 ? `<tfoot>${secRow(Object.assign({ name: 'Total' }, T), 'td')}</tfoot>` : '');

    reviewFilter = 'all';
    renderFilters();
    renderReview();
  }

  function renderFilters() {
    const s = session, R = s.result;
    const counts = { all: R.items.length, right: 0, wrong: 0, skip: 0, marked: 0 };
    R.items.forEach((it, g) => { counts[it.outcome]++; if (s.resp[g].m) counts.marked++; });
    const labels = { all: 'All', right: 'Correct', wrong: 'Wrong', skip: 'Not attempted', marked: 'Marked for review' };
    $('#rs-filters').innerHTML = Object.keys(labels).map(k =>
      `<button class="chip${reviewFilter === k ? ' active' : ''}" data-filter="${k}" aria-pressed="${reviewFilter === k}">${labels[k]} (${counts[k]})</button>`).join('');
  }

  function renderReview() {
    const s = session, ex = s.exam, R = s.result, hi = s.lang === 'hi';
    const labels = { right: 'Correct', wrong: 'Wrong', skip: 'Not attempted' };
    let html = '';
    ex.questions.forEach((q, g) => {
      const it = R.items[g], r = s.resp[g];
      if (reviewFilter === 'marked' ? !r.m : reviewFilter !== 'all' && it.outcome !== reviewFilter) return;
      const text = hi && q.textHi ? q.textHi : q.text;
      const opts = hi && q.optionsHi ? q.optionsHi : q.options;
      const exp = hi && q.explanationHi ? q.explanationHi : q.explanation;
      const src = q.image ? safeUrl(q.image) : '';
      html += `<article class="rv rv-${it.outcome}">
        <header class="rv-head">
          <span class="rv-no">Q${g + 1}</span>
          <span class="rv-sec">${escapeHtml(ex.sections[q.sec].name)}</span>
          <span class="badge b-${it.outcome}">${labels[it.outcome]}</span>
          ${r.m ? '<span class="badge b-marked">Marked</span>' : ''}
          <span class="rv-time">Time spent: ${fmtSpent(r.t)}</span>
          <span class="rv-marks ${it.marks > 0 ? 'pos' : it.marks < 0 ? 'neg' : 'muted'}">${it.marks > 0 ? '+' : ''}${fmtNum(it.marks)}</span>
        </header>
        <div class="rv-q">${rich(text)}</div>
        ${src ? `<div class="q-img"><img src="${escapeHtml(src)}" alt="Figure for question ${g + 1}"></div>` : ''}
        <ol class="rv-opts">${opts.map((o, i) => {
          const isAns = i === q.answer, isYou = i === r.s;
          const cls = isAns ? 'is-correct' : isYou ? 'is-wrong' : '';
          const tags = (isAns ? '<em class="tag tag-ok">Correct answer</em>' : '') + (isYou ? '<em class="tag tag-you">Your answer</em>' : '');
          return `<li class="${cls}"><span class="opt-key">${letter(i)}.</span><span class="opt-text">${rich(o)}</span>${tags ? `<span class="tags">${tags}</span>` : ''}</li>`;
        }).join('')}</ol>
        ${exp ? `<div class="rv-exp"><b>Explanation:</b> ${rich(exp)}</div>` : ''}
      </article>`;
    });
    const box = $('#rs-review');
    clearMath(box);
    box.innerHTML = html || '<p class="muted">No questions in this view.</p>';
    typeset(box);
  }

  function bindResult() {
    $('#rs-print').addEventListener('click', () => window.print());
    $('#rs-filters').addEventListener('click', e => {
      const b = e.target.closest('[data-filter]');
      if (!b) return;
      reviewFilter = b.dataset.filter;
      renderFilters();
      renderReview();
    });
    $('#rs-retake').addEventListener('click', () => {
      setupFromSession(session, 'your last attempt');
      $('#settings-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('#rs-home').addEventListener('click', showSetup);
  }

  /* ======================================================================
   * Global events and start-up
   * ==================================================================== */
  function bindGlobal() {
    $('#modal').addEventListener('click', e => {
      if (e.target === e.currentTarget && e.currentTarget.dataset.dismissible === '1') closeModal();
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const m = $('#modal');
      if (!m.hidden) { if (m.dataset.dismissible === '1') closeModal(); }
      else closePalette();
    });
    window.addEventListener('beforeunload', e => {
      if (session && session.phase === 'exam') {
        flushTime();
        persist();
        e.preventDefault();
        e.returnValue = '';
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && session && session.phase === 'exam') { flushTime(); persist(); }
    });
    window.addEventListener('resize', hideSecTip);
  }

  function init() {
    $$('.avatar').forEach(a => { a.innerHTML = AVATAR_SVG; });
    bindSetup();
    bindInstructions();
    bindExam();
    bindCalc();
    bindResult();
    bindGlobal();
    applyPrefs();

    const libraryReady = loadLibrary();
    const saved = store.get(SESSION_KEY);
    if (isValidSession(saved) && saved.phase === 'exam') {
      session = saved;
      resumeExam();
      return;
    }
    if (isValidSession(saved) && saved.phase === 'instructions') {
      session = saved;
      showInstructions();
      return;
    }

    showSetup();
    const param = new URLSearchParams(location.search).get('test');
    if (param) {
      libraryReady.then(() => {
        setTab('library');
        loadFromUrl(param, param.split('/').pop());
      });
    }
  }

  init();
})();
