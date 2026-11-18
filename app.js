/* Club Sorting Hat — app.js
   Plain JavaScript, no build step. Sections:
   1. Config (edit these)   2. State + helpers   3. Data loading
   4. Quiz                  5. Matching algorithm (scoreClub)
   6. Results               7. Browse all        8. Test mode   9. Startup */
'use strict';

/* ==========================================================================
   1. CONFIG — the knobs your team is most likely to change
   ========================================================================== */

// Google Form the "Give feedback" link opens. Paste your form's share link here.
const FEEDBACK_FORM_URL = 'https://forms.gle/REPLACE-WITH-YOUR-FORM-ID';

// Maximum points each criterion can earn. They add up to 100.
// When a criterion doesn't apply (question skipped, "Doesn't matter", "No preference"),
// its points are redistributed proportionally across the criteria that do apply.
const SCORING_WEIGHTS = {
  interest: 30,   // interest areas (Q4) vs club.interestTags
  motivation: 20, // reasons for joining (Q1) vs club.motivationTags
  time: 15,       // weekly hours (Q5) vs club.weeklyHours
  schedule: 10,   // free evenings (Q6) vs club.meetingDays
  major: 10,      // college (Q2) + "related to major?" (Q3) vs club.relatedColleges
  vibe: 10,       // relaxed-to-competitive slider (Q8) vs club.vibe
  size: 5,        // preferred group size (Q7) vs club.size
};

// Subtracted when the student has no experience and the club is not beginner friendly.
const BEGINNER_PENALTY = 15;

// Student said "Yes, related to my major" and the club is open to any major ("Any"):
// the share of the major points it still earns (0 = none, 1 = full).
const MAJOR_OPEN_TO_ALL_SHARE = 0.3;

const SORTING_DELAY_MS = 1500; // length of the "Sorting you..." screen
const TOP_COUNT = 5;           // main results
const ALSO_COUNT = 3;          // "Also worth a look" (matches 6-8)

const HOURS_BUCKETS = ['Under 2 hours', '2-5 hours', '5-10 hours', '10+ hours'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SIZE_LABELS = { Small: 'Small (under 30)', Medium: 'Medium (30-100)', Large: 'Large (100+)' };

// Friendlier wording of the Q1 options for "Why you matched" bullets.
const MOTIVATION_PHRASES = {
  'Build my resume / career': 'build your resume and career',
  'Explore a hobby': 'explore a hobby',
  'Make friends / social': 'make friends',
  'Give back / community service': 'give back to the community',
  'Learn a new skill': 'learn a new skill',
  'Connect with my culture or identity': 'connect with your culture or identity',
  'Compete (sports or competitions)': 'compete',
};

const TEST_MODE = new URLSearchParams(window.location.search).get('test') === '1';

/* ==========================================================================
   2. STATE + HELPERS
   ========================================================================== */

const state = {
  questions: [],
  clubs: [],
  answers: {},          // { questionId: value } — kept in memory only
  index: 0,             // current question
  skipped: new Set(),   // question ids the student skipped
  results: [],          // ranked [{ club, score, reasons, ... }]
  filters: { category: '', day: '', hours: '' },
  timing: null,
};

const $ = (selector, root = document) => root.querySelector(selector);

// Small DOM builder: el('p', { class: 'x', text: 'Hi' }, child1, child2)
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (['checked', 'disabled', 'selected', 'value'].includes(key)) node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child !== null && child !== undefined && child !== false) node.append(child);
  }
  return node;
}

function joinList(items) {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function shortHours(bucket) {
  return bucket.replace('Under', 'under').replace(' hours', ' hrs');
}

function shortDays(days) {
  return DAYS.filter(d => days.includes(d)).map(d => d.slice(0, 3)).join(', ');
}

function isAnswered(value) {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function formatMs(ms) {
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function parseLocalDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Returns the club's next event if it is today or later, otherwise null.
function upcomingEvent(club) {
  const event = club.nextEvent;
  if (!event || !event.date) return null;
  const date = parseLocalDate(event.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today ? { ...event, dateObj: date } : null;
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.hidden = screen.id !== `screen-${name}`;
  });
  window.scrollTo(0, 0);
  const heading = $(`#screen-${name} [data-focus]`);
  if (heading) heading.focus({ preventScroll: true });
}

/* ==========================================================================
   3. DATA LOADING
   ========================================================================== */

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

async function loadData() {
  const [questionData, clubData] = await Promise.all([
    fetchJson('data/questions.json'),
    fetchJson('data/clubs.json'),
  ]);
  state.questions = questionData.questions;
  state.clubs = clubData.clubs;
}

function showLoadError(error) {
  const box = $('#load-error');
  box.hidden = false;
  const onFile = window.location.protocol === 'file:';
  box.replaceChildren(
    el('strong', { text: "Couldn't load the club data. " }),
    onFile
      ? el('span', {}, 'Browsers block reading data files when a page is opened straight from your computer. Run a tiny local server in this folder, for example ',
          el('code', { text: 'python -m http.server' }), ', then open ', el('code', { text: 'http://localhost:8000' }), '. See README.md.')
      : el('span', { text: `Check that data/clubs.json and data/questions.json exist and are valid JSON. (${error.message})` }),
  );
  console.error('[Club Sorting Hat] Data failed to load:', error);
}

/* ==========================================================================
   4. QUIZ
   ========================================================================== */

function startQuiz() {
  state.answers = {};
  state.skipped = new Set();
  state.index = 0;
  state.filters = { category: '', day: '', hours: '' };
  state.timing = { quizStart: performance.now(), quizEnd: null, perQuestion: {}, enteredAt: null };
  showScreen('quiz');
  renderQuestion();
}

function currentQuestion() {
  return state.questions[state.index];
}

function renderQuestion() {
  const q = currentQuestion();
  const total = state.questions.length;
  const number = state.index + 1;

  $('#progress-text').textContent = `Question ${number} of ${total}`;
  const bar = $('#progress');
  bar.setAttribute('aria-valuenow', number);
  bar.setAttribute('aria-valuemax', total);
  $('#progress-fill').style.width = `${(number / total) * 100}%`;

  $('#question-title').textContent = q.text;
  $('#question-hint').textContent = q.hint || '';
  $('#question-body').replaceChildren(renderInput(q));
  $('#question-status').textContent = '';
  $('#question-error').textContent = '';
  $('#skip-btn').hidden = Boolean(q.required);
  $('#next-btn').textContent = number === total ? 'See my matches' : 'Next';

  if (q.type === 'multi') enforceMax(q);
  state.timing.enteredAt = performance.now();
  $('#question-title').focus({ preventScroll: true });
}

function renderInput(q) {
  const saved = state.answers[q.id];
  if (q.type === 'single') return renderChoices(q, 'radio', saved);
  if (q.type === 'multi') return renderChoices(q, 'checkbox', saved);
  if (q.type === 'select') return renderSelect(q, saved);
  if (q.type === 'slider') return renderSlider(q, saved);
  return el('p', { class: 'error', text: `Unknown question type "${q.type}" in questions.json` });
}

function renderChoices(q, inputType, saved) {
  const group = el('fieldset', { class: 'choices', 'aria-labelledby': 'question-title', 'aria-describedby': q.hint ? 'question-hint' : null });
  q.options.forEach((option, i) => {
    const id = `${q.id}-${i}`;
    const checked = inputType === 'radio' ? saved === option : Array.isArray(saved) && saved.includes(option);
    const input = el('input', { type: inputType, id, name: q.id, value: option, checked });
    input.addEventListener('change', () => onChoiceChange(q, inputType));
    group.append(el('label', { class: 'choice', for: id }, input, el('span', { text: option })));
  });
  return group;
}

function onChoiceChange(q, inputType) {
  const inputs = [...document.querySelectorAll(`#question-body input[name="${q.id}"]`)];
  if (inputType === 'radio') {
    const checked = inputs.find(input => input.checked);
    state.answers[q.id] = checked ? checked.value : undefined;
  } else {
    state.answers[q.id] = inputs.filter(input => input.checked).map(input => input.value);
    enforceMax(q);
  }
  state.skipped.delete(q.id);
  $('#question-error').textContent = '';
}

// For multi-select questions with a "max", disable the remaining boxes once the limit is hit.
function enforceMax(q) {
  if (!q.max) return;
  const inputs = [...document.querySelectorAll(`#question-body input[name="${q.id}"]`)];
  const count = inputs.filter(input => input.checked).length;
  inputs.forEach(input => { if (!input.checked) input.disabled = count >= q.max; });
  $('#question-status').textContent = count >= q.max
    ? `You've picked ${q.max}. Uncheck one to change your picks.`
    : '';
}

function renderSelect(q, saved) {
  const id = `${q.id}-select`;
  const select = el('select', { id, 'aria-describedby': q.hint ? 'question-hint' : null },
    el('option', { value: '', text: q.placeholder || 'Choose one' }),
    q.options.map(option => el('option', { value: option, text: option, selected: saved === option })));
  select.addEventListener('change', () => {
    state.answers[q.id] = select.value || undefined;
    state.skipped.delete(q.id);
    $('#question-error').textContent = '';
  });
  return el('div', { class: 'field' }, el('label', { for: id, text: q.label || q.text }), select);
}

function sliderText(q, value) {
  const word = q.valueLabels ? q.valueLabels[value - q.min] : '';
  return word ? `${value} - ${word}` : String(value);
}

function renderSlider(q, saved) {
  const id = `${q.id}-range`;
  const value = saved ?? q.default ?? Math.round((q.min + q.max) / 2);
  const output = el('output', { class: 'slider-value', for: id, id: `${id}-out`, text: sliderText(q, value) });
  const input = el('input', {
    type: 'range', id, min: q.min, max: q.max, step: 1, value: String(value),
    'aria-valuetext': sliderText(q, value), 'aria-describedby': `${id}-ends`,
  });
  input.addEventListener('input', () => {
    const v = Number(input.value);
    state.answers[q.id] = v;
    state.skipped.delete(q.id);
    output.textContent = sliderText(q, v);
    input.setAttribute('aria-valuetext', sliderText(q, v));
  });
  return el('div', { class: 'slider-field' },
    el('label', { for: id, text: q.label || q.text }),
    output,
    input,
    el('div', { class: 'slider-ends', id: `${id}-ends` },
      el('span', { text: `1 = ${q.minLabel}` }),
      el('span', { text: `${q.max} = ${q.maxLabel}` })));
}

function recordQuestionTime(q) {
  const t = state.timing;
  if (!t || t.enteredAt === null) return;
  t.perQuestion[q.id] = (t.perQuestion[q.id] || 0) + (performance.now() - t.enteredAt);
  t.enteredAt = null;
}

function goNext(event) {
  if (event) event.preventDefault();
  const q = currentQuestion();

  // The slider always shows a value, so pressing Next accepts it even if untouched.
  if (q.type === 'slider' && !isAnswered(state.answers[q.id])) {
    state.answers[q.id] = Number($('#question-body input[type="range"]').value);
  }

  if (!isAnswered(state.answers[q.id])) {
    if (q.required) {
      $('#question-error').textContent = 'Please pick at least one answer to continue.';
      return;
    }
    // Pressing Next on an empty optional question counts as a skip.
    delete state.answers[q.id];
    state.skipped.add(q.id);
  } else {
    state.skipped.delete(q.id);
  }
  advance(q);
}

function skipQuestion() {
  const q = currentQuestion();
  delete state.answers[q.id];
  state.skipped.add(q.id);
  advance(q);
}

function advance(q) {
  recordQuestionTime(q);
  if (state.index < state.questions.length - 1) {
    state.index += 1;
    renderQuestion();
  } else {
    finishQuiz();
  }
}

function goBack() {
  recordQuestionTime(currentQuestion());
  if (state.index === 0) {
    showScreen('landing');
    return;
  }
  state.index -= 1;
  renderQuestion();
}

function finishQuiz() {
  state.timing.quizEnd = performance.now();
  showScreen('loading');
  window.setTimeout(() => {
    state.results = rankClubs(state.clubs, state.answers);
    syncFilterControls();
    renderResults();
    // Filters start open on wide screens, collapsed on phones.
    $('#results-filters').open = window.matchMedia('(min-width: 640px)').matches;
    showScreen('results');
    $('#browse-to-results').hidden = false;
    $('#copy-status').textContent = '';
    if (TEST_MODE) logSession();
  }, SORTING_DELAY_MS);
}

/* ==========================================================================
   5. MATCHING ALGORITHM
   ========================================================================== */

/**
 * scoreClub(club, answers) -> { score, rawScore, penalty, criteria, reasons }
 *
 * How it works:
 * - Each criterion in SCORING_WEIGHTS gets a "fraction" from 0 to 1 for how well
 *   the club fits, or null when the criterion doesn't apply (the student skipped the
 *   question, said "Doesn't matter", or picked "No preference").
 * - Score = (sum of weight x fraction for applicable criteria) / (sum of applicable
 *   weights) x 100. Dividing by only the applicable weights is what redistributes the
 *   points of skipped criteria proportionally, so skipping never hurts a club.
 * - Then BEGINNER_PENALTY is subtracted if the student has no experience and the club
 *   isn't beginner friendly. The final score is clamped to 0-100 and rounded.
 * - Every criterion carries a human-readable reason. The ones that earned the most
 *   points become the "Why you matched" bullets.
 */
function scoreClub(club, answers) {
  const criteria = [];
  const add = (key, fraction, reason) => criteria.push({ key, weight: SCORING_WEIGHTS[key], fraction, reason });

  // Interest overlap: share of the student's interest picks that the club covers.
  const interests = answers.interests || [];
  if (interests.length) {
    const hits = interests.filter(tag => club.interestTags.includes(tag));
    add('interest', hits.length / interests.length,
      hits.length ? `Matches your interest in ${joinList(hits)}` : null);
  }

  // Motivation overlap: share of the student's reasons for joining that the club supports.
  const motives = answers.motivation || [];
  if (motives.length) {
    const hits = motives.filter(tag => club.motivationTags.includes(tag));
    add('motivation', hits.length / motives.length,
      hits.length ? `A good place to ${joinList(hits.map(h => MOTIVATION_PHRASES[h] || h.toLowerCase()))}` : null);
  }

  // Time commitment: full points for the same bucket, half for one bucket away.
  if (answers.hours) {
    const gap = Math.abs(HOURS_BUCKETS.indexOf(answers.hours) - HOURS_BUCKETS.indexOf(club.weeklyHours));
    const fraction = gap === 0 ? 1 : gap === 1 ? 0.5 : 0;
    const reason = gap === 0
      ? `Fits your ${shortHours(answers.hours)}/week schedule`
      : gap === 1 ? `Close to your ${shortHours(answers.hours)}/week budget (about ${shortHours(club.weeklyHours)})` : null;
    add('time', fraction, reason);
  }

  // Schedule: any overlap between the student's free evenings and the club's meeting days.
  const freeDays = answers.freeDays || [];
  if (freeDays.length) {
    const overlap = club.meetingDays.filter(day => freeDays.includes(day));
    add('schedule', overlap.length ? 1 : 0,
      overlap.length ? `Meets on ${joinList(overlap)}, when you're free` : null);
  }

  // Major relevance: only when the student answered Yes or No and named a college.
  const college = answers.college;
  if ((answers.majorRelated === 'Yes' || answers.majorRelated === 'No') && college && college !== 'Undecided') {
    const related = club.relatedColleges.includes(college);
    const openToAll = club.relatedColleges.includes('Any');
    if (answers.majorRelated === 'Yes') {
      add('major', related ? 1 : openToAll ? MAJOR_OPEN_TO_ALL_SHARE : 0,
        related ? `Connected to your college (${college})` : null);
    } else {
      add('major', related ? 0 : 1, related ? null : 'A break from your major, like you wanted');
    }
  }

  // Vibe: 10 points minus 2.5 per step of difference on the 1-5 scale (floor 0).
  if (typeof answers.vibe === 'number') {
    const diff = Math.abs(answers.vibe - club.vibe);
    const vibeWord = club.vibe <= 2 ? 'relaxed' : club.vibe === 3 ? 'balanced' : 'competitive';
    add('vibe', Math.max(0, 1 - 0.25 * diff), diff <= 1 ? `Has the ${vibeWord} vibe you're after` : null);
  }

  // Size preference: "Small (under 30)" -> "Small". "No preference" doesn't apply.
  if (answers.size && answers.size !== 'No preference') {
    const wanted = answers.size.split(' ')[0];
    add('size', wanted === club.size ? 1 : 0,
      wanted === club.size ? `A ${club.size.toLowerCase()} group, like you prefer` : null);
  }

  // Combine. Only applicable criteria count toward the maximum (redistribution).
  const applicable = criteria.filter(c => c.fraction !== null);
  const maxPoints = applicable.reduce((sum, c) => sum + c.weight, 0);
  const earned = applicable.reduce((sum, c) => sum + c.weight * c.fraction, 0);
  criteria.forEach(c => { c.points = maxPoints ? (c.weight * c.fraction / maxPoints) * 100 : 0; });

  const noExperience = typeof answers.experience === 'string' && answers.experience.startsWith('None');
  const penalty = noExperience && !club.beginnerFriendly ? BEGINNER_PENALTY : 0;
  const rawScore = Math.min(100, Math.max(0, (maxPoints ? (earned / maxPoints) * 100 : 0) - penalty));

  // "Why you matched": the criteria that earned the most points first.
  // (A reason is only written when the club actually fits that criterion.)
  const reasons = criteria
    .filter(c => c.reason && c.fraction > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map(c => c.reason);
  // Make sure every card has at least two bullets.
  const fallbacks = [];
  if (club.beginnerFriendly) fallbacks.push(noExperience ? 'Beginner friendly, so no experience needed' : 'Welcomes new members of any skill level');
  if (club.relatedColleges.includes('Any')) fallbacks.push('Open to students in every major');
  fallbacks.push(`Meets ${shortDays(club.meetingDays)}${club.meetingTime ? ` at ${club.meetingTime}` : ''}`);
  while (reasons.length < 2 && fallbacks.length) reasons.push(fallbacks.shift());

  return { score: Math.round(rawScore), rawScore, penalty, criteria, reasons };
}

// Score every club and sort: highest score first, ties broken alphabetically by name.
function rankClubs(clubs, answers) {
  return clubs
    .map(club => ({ club, ...scoreClub(club, answers) }))
    .sort((a, b) => b.score - a.score || a.club.name.localeCompare(b.club.name));
}

/* ==========================================================================
   6. RESULTS
   ========================================================================== */

function matchesFilters(club, filters) {
  return (!filters.category || club.category === filters.category)
    && (!filters.day || club.meetingDays.includes(filters.day))
    && (!filters.hours || club.weeklyHours === filters.hours);
}

function fillSelect(select, anyLabel, values) {
  select.replaceChildren(
    el('option', { value: '', text: anyLabel }),
    ...values.map(v => el('option', { value: v, text: v })));
}

function setupFilterOptions() {
  const categories = [...new Set(state.clubs.map(c => c.category))].sort((a, b) => a.localeCompare(b));
  for (const prefix of ['f', 'b']) {
    fillSelect($(`#${prefix}-category`), 'All categories', categories);
    fillSelect($(`#${prefix}-day`), 'Any day', DAYS);
    fillSelect($(`#${prefix}-hours`), 'Any amount', HOURS_BUCKETS);
  }
}

function syncFilterControls() {
  $('#f-category').value = state.filters.category;
  $('#f-day').value = state.filters.day;
  $('#f-hours').value = state.filters.hours;
}

function renderResults() {
  const filtersOn = Object.values(state.filters).some(Boolean);
  const filtered = state.results.filter(r => matchesFilters(r.club, state.filters));
  const top = filtered.slice(0, TOP_COUNT);
  const also = filtered.slice(TOP_COUNT, TOP_COUNT + ALSO_COUNT);

  $('#top-results').replaceChildren(...top.map((r, i) => el('li', {}, clubCard(r.club, r, { rank: i + 1 }))));
  $('#also-results').replaceChildren(...also.map(r => el('li', {}, compactCard(r.club, r))));
  $('#also-section').hidden = also.length === 0;
  $('#results-empty').hidden = filtered.length > 0;
  $('#clear-filters').hidden = !filtersOn;
  $('#results-count').textContent = filtersOn
    ? `${filtered.length} club${filtered.length === 1 ? '' : 's'} match your filters. Showing the best ${Math.min(filtered.length, TOP_COUNT + ALSO_COUNT)}.`
    : '';
}

function linkButton(label, url, highlighted, clubName, note) {
  return el('a', {
    class: `btn btn-small ${highlighted ? 'btn-primary' : 'btn-secondary'}`,
    href: url, target: '_blank', rel: 'noopener',
  },
  label,
  highlighted && note ? el('span', { class: 'pref-star', text: ` (${note})` }) : null,
  el('span', { class: 'visually-hidden', text: ` for ${clubName}, opens in a new tab` }));
}

function fact(label, value) {
  return el('div', {}, el('dt', { text: label }), el('dd', { text: value }));
}

function meetsText(club) {
  return `${shortDays(club.meetingDays)}${club.meetingTime ? ` · ${club.meetingTime}` : ''}`;
}

function formatEventDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Full card. `result` is null on the Browse screen when the quiz hasn't been taken.
function clubCard(club, result, { rank = null, showWhy = true, headingLevel = 3 } = {}) {
  const contact = state.answers.contact || [];
  const wantsInPerson = contact.some(c => c.startsWith('In-person'));
  const event = upcomingEvent(club);

  const card = el('article', { class: 'club-card' });
  card.append(el('div', { class: 'card-top' },
    el('div', { class: 'card-title' },
      rank ? el('span', { class: 'rank', text: `Match #${rank}` }) : null,
      el(`h${headingLevel}`, { class: 'club-name', text: club.name }),
      el('span', { class: 'tag', text: club.category })),
    result ? el('p', { class: 'match' }, el('strong', { text: `${result.score}%` }), el('span', { text: 'match' })) : null));

  card.append(el('p', { class: 'description', text: club.description }));

  if (result && showWhy && result.reasons.length) {
    card.append(el('div', { class: 'why' },
      el(`h${headingLevel + 1}`, { text: 'Why you matched' }),
      el('ul', {}, result.reasons.map(reason => el('li', { text: reason })))));
  }

  card.append(el('dl', { class: 'facts' },
    fact('Time', `${shortHours(club.weeklyHours)}/wk`),
    fact('Meets', meetsText(club)),
    fact('Size', SIZE_LABELS[club.size] || club.size)));

  card.append(event
    ? el('div', { class: `event${wantsInPerson ? ' highlight' : ''}` },
        el('p', { class: 'event-label', text: wantsInPerson ? 'Meet them in person' : 'Next recruiting event' }),
        el('p', { class: 'event-title', text: event.title }),
        el('p', { text: `${formatEventDate(event.dateObj)} · ${event.time}` }),
        el('p', { text: event.location }))
    : el('p', { class: 'event none', text: 'No upcoming event listed yet. Check their Discover page.' }));

  if (club.groupMeAvailable) {
    const wantsGroupMe = contact.includes('GroupMe');
    card.append(el('p', { class: `pill-note${wantsGroupMe ? ' highlight' : ''}`, text: 'GroupMe chat available: ask for the link at their next event' }));
  }

  const actions = el('div', { class: 'card-actions' });
  if (club.discoverUrl) actions.append(linkButton('Discover page', club.discoverUrl, contact.includes('Email'), club.name, 'your pick'));
  if (club.instagramUrl) actions.append(linkButton('Instagram', club.instagramUrl, contact.includes('Instagram'), club.name, 'your pick'));
  card.append(actions);
  return card;
}

// Smaller card for "Also worth a look".
function compactCard(club, result) {
  return el('article', { class: 'club-card compact' },
    el('div', { class: 'card-top' },
      el('div', { class: 'card-title' },
        el('h4', { class: 'club-name', text: club.name }),
        el('span', { class: 'tag', text: club.category })),
      el('p', { class: 'match' }, el('strong', { text: `${result.score}%` }), el('span', { text: 'match' }))),
    el('p', { class: 'compact-reason', text: result.reasons[0] }),
    el('p', { class: 'compact-meta', text: `${shortHours(club.weeklyHours)}/wk · ${meetsText(club)} · ${club.size}` }),
    club.discoverUrl ? el('div', { class: 'card-actions' }, linkButton('Discover page', club.discoverUrl, false, club.name)) : null);
}

/* ==========================================================================
   7. BROWSE ALL
   ========================================================================== */

function searchableText(club) {
  return [club.name, club.category, club.description, ...club.interestTags, ...club.motivationTags]
    .join(' ').toLowerCase();
}

function renderBrowse() {
  const query = $('#b-search').value.trim().toLowerCase();
  const filters = { category: $('#b-category').value, day: $('#b-day').value, hours: $('#b-hours').value };
  const resultsById = new Map(state.results.map(r => [r.club.id, r]));
  const clubs = state.clubs
    .filter(club => matchesFilters(club, filters) && (!query || searchableText(club).includes(query)))
    .sort((a, b) => a.name.localeCompare(b.name));

  $('#browse-list').replaceChildren(...clubs.map(club =>
    el('li', {}, clubCard(club, resultsById.get(club.id) || null, { showWhy: false }))));
  $('#browse-count').textContent = `Showing ${clubs.length} of ${state.clubs.length} clubs`;
}

function openBrowse() {
  renderBrowse();
  showScreen('browse');
}

/* ==========================================================================
   8. TEST MODE (?test=1) — for user interviews
   ========================================================================== */

function formatAnswer(value) {
  if (!isAnswered(value)) return '(no answer)';
  return Array.isArray(value) ? value.join('; ') : String(value);
}

function buildSessionSummary() {
  const t = state.timing;
  const lines = [
    'Club Sorting Hat - session summary',
    `Date: ${new Date().toLocaleString()}`,
    `Total quiz time: ${formatMs(t.quizEnd - t.quizStart)}`,
    '',
    'Time per question:',
  ];
  state.questions.forEach((q, i) => {
    lines.push(`  Q${i + 1} (${q.id}): ${formatMs(t.perQuestion[q.id] || 0)}${state.skipped.has(q.id) ? ' [skipped]' : ''}`);
  });
  const skipped = state.questions.map((q, i) => (state.skipped.has(q.id) ? `Q${i + 1} (${q.id})` : null)).filter(Boolean);
  lines.push('', `Skipped: ${skipped.length ? skipped.join(', ') : 'none'}`, '', 'Answers:');
  state.questions.forEach((q, i) => lines.push(`  Q${i + 1} ${q.text} -> ${formatAnswer(state.answers[q.id])}`));
  lines.push('', 'Ranked results (all clubs):');
  state.results.forEach((r, i) => {
    lines.push(`  ${i + 1}. ${r.club.name} - ${r.score}%${r.penalty ? ` (incl. -${r.penalty} beginner penalty)` : ''}`);
  });
  return lines.join('\n');
}

function logSession() {
  const t = state.timing;
  console.group('[Club Sorting Hat] Test session');
  console.log('Total quiz time:', formatMs(t.quizEnd - t.quizStart));
  console.table(state.questions.map((q, i) => ({
    question: `Q${i + 1} ${q.id}`,
    seconds: Number(((t.perQuestion[q.id] || 0) / 1000).toFixed(1)),
    skipped: state.skipped.has(q.id),
    answer: formatAnswer(state.answers[q.id]),
  })));
  console.log('Skipped questions:', [...state.skipped].join(', ') || 'none');
  console.table(state.results.map((r, i) => ({ rank: i + 1, club: r.club.name, score: r.score, penalty: r.penalty })));
  console.groupEnd();
}

async function copySummary() {
  const text = buildSessionSummary();
  const status = $('#copy-status');
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = 'Copied! Paste it into your interview notes.';
  } catch {
    // Fallback for browsers that block the Clipboard API.
    const area = el('textarea', { class: 'visually-hidden', readonly: true });
    area.value = text;
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    status.textContent = ok ? 'Copied! Paste it into your interview notes.' : 'Copy failed. The summary is in the console.';
    if (!ok) console.log(text);
  }
}

/* ==========================================================================
   9. STARTUP
   ========================================================================== */

function bindEvents() {
  $('#start-btn').addEventListener('click', startQuiz);
  $('#browse-start').addEventListener('click', startQuiz);
  $('#retake-btn').addEventListener('click', startQuiz);
  $('#home-btn').addEventListener('click', () => showScreen('landing'));
  $('#nav-browse').addEventListener('click', openBrowse);
  $('#landing-browse').addEventListener('click', openBrowse);
  $('#results-browse').addEventListener('click', openBrowse);
  $('#browse-to-results').addEventListener('click', () => showScreen('results'));

  $('#quiz-form').addEventListener('submit', goNext);
  $('#back-btn').addEventListener('click', goBack);
  $('#skip-btn').addEventListener('click', skipQuestion);

  document.querySelectorAll('[data-filter]').forEach(select => {
    select.addEventListener('change', () => {
      state.filters[select.dataset.filter] = select.value;
      renderResults();
    });
  });
  $('#clear-filters').addEventListener('click', () => {
    state.filters = { category: '', day: '', hours: '' };
    syncFilterControls();
    renderResults();
    $('#f-category').focus();
  });

  $('#b-search').addEventListener('input', renderBrowse);
  document.querySelectorAll('[data-browse-filter]').forEach(select => select.addEventListener('change', renderBrowse));

  $('#copy-summary').addEventListener('click', copySummary);
}

async function init() {
  $('#feedback-link').href = FEEDBACK_FORM_URL;
  if (TEST_MODE) {
    $('#test-banner').hidden = false;
    $('#test-tools').hidden = false;
  }
  bindEvents();
  try {
    await loadData();
    setupFilterOptions();
    $('#start-btn').disabled = false;
  } catch (error) {
    showLoadError(error);
    $('#landing-browse').hidden = true;
    $('#nav-browse').disabled = true;
  }
}

// Exposed for debugging in the console (e.g. ClubSortingHat.scoreClub(club, answers)).
window.ClubSortingHat = { state, scoreClub, rankClubs, SCORING_WEIGHTS };

init();
