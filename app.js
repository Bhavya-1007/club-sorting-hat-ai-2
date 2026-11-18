/* Club Sorting Hat — app.js
   Plain JavaScript, no build step. Sections:
   1. Config               2. State + helpers   3. Data loading
   4. Quiz                  5. Server recommendations
   6. Results               7. Browse all        8. Test mode   9. Startup */
'use strict';

/* ==========================================================================
   1. CONFIG — the knobs your team is most likely to change
   ========================================================================== */

const SORTING_DELAY_MS = 800;
const TOP_COUNT = 5;
const ALSO_COUNT = 3;
const HOURS_BUCKETS = ['Under 2 hours', '2-5 hours', '5-10 hours', '10+ hours'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SIZE_LABELS = { Small: 'Small (under 30)', Medium: 'Medium (30-100)', Large: 'Large (100+)' };
let requestController = null;
let requestVersion = 0;
let browseController = null;
let browseOffset = 0;
let browseNextOffset = null;
let browseTimer = null;
let catalogMeta = {};

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
    fetchJson('questions.json'),
    fetchJson('/api/clubs?limit=1'),
  ]);
  state.questions = questionData.questions;
  state.clubs = clubData.clubs;
  catalogMeta = clubData;
  document.querySelectorAll('[data-catalog-count]').forEach(node=>node.textContent=clubData.catalogTotal+' sourced listings · '+clubData.recommendationEligibleTotal+' available for recommendations');
}

function showLoadError(error) {
  const box = $('#load-error');
  box.hidden = false;
  const onFile = window.location.protocol === 'file:';
  box.replaceChildren(
    el('strong', { text: "Couldn't load the club data. " }),
    onFile
      ? el('span', {}, 'Open this application through its backend server: ',
          el('code', { text: 'node scripts/dev.mjs' }), ', then open ', el('code', { text: 'http://127.0.0.1:3000' }), '. See README.md.')
      : el('span', { text: `Check that clubs.json and questions.json exist and are valid JSON. (${error.message})` }),
  );
  console.error('[Club Sorting Hat] Data failed to load:', error);
}

/* ==========================================================================
   4. QUIZ
   ========================================================================== */

function startQuiz() {
  requestVersion++;
  requestController?.abort();
  state.results = [];
  $('#browse-to-results').hidden = true;
  $('#top-results').replaceChildren();
  $('#also-results').replaceChildren();
  $('#recommendation-status').textContent = '';
  $('#loading-error').hidden = true;
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
  const field=el('div', { class: 'field' }, el('label', { for: id, text: q.label || q.text }), select);
  if(q.id==='college'){
    const major=el('input',{id:'major-detail',type:'text',maxlength:'80',placeholder:'For example, Aerospace Engineering',value:state.answers.major||''});
    major.addEventListener('input',()=>{if(major.value.trim())state.answers.major=major.value.trim();else delete state.answers.major;});
    field.append(el('label',{for:'major-detail',text:'Major (optional)'}),major);
  }
  return field;
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

async function finishQuiz() {
  if(requestController&&!requestController.signal.aborted)return;
  state.timing.quizEnd = performance.now();
  requestController?.abort();
  const controller = new AbortController();
  requestController = controller;
  const version = ++requestVersion;
  $('#loading-error').hidden = true;
  $('#loading-progress').hidden = false;
  showScreen('loading');
  const timeout = setTimeout(() => controller.abort(), 32000);
  try {
    const [response] = await Promise.all([
      fetch('/api/recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: state.answers }), signal: controller.signal }),
      new Promise(resolve => setTimeout(resolve, SORTING_DELAY_MS)),
    ]);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Recommendations could not be generated.');
    if (version !== requestVersion) return;
    if (!['ai','fallback','empty'].includes(payload.mode) || !Array.isArray(payload.recommendations)) throw new Error('Unexpected recommendation response.');
    state.results = payload.recommendations.map(result => {
      const club = result.club;
      if(club?.id !== result.clubId) throw new Error('Invalid catalog result.');
      if (!club) throw new Error('The catalog has changed. Reload and try again.');
      return { ...result, club };
    });
    $('#recommendation-status').textContent = payload.message;
    $('#score-note').textContent = payload.scoreNote;
    syncFilterControls();
    renderResults();
    $('#results-filters').open = window.matchMedia('(min-width: 640px)').matches;
    showScreen('results');
    $('#browse-to-results').hidden = false;
    $('#copy-status').textContent = '';
    if (TEST_MODE) logSession();
  } catch (error) {
    if (version !== requestVersion) return;
    $('#loading-progress').hidden = true;
    $('#loading-error').hidden = false;
    $('#recommendation-error').textContent = error.name === 'AbortError' ? 'The request timed out. Try again or browse the verified clubs.' : error.message;
    $('#retry-recommendations').focus();
  } finally { clearTimeout(timeout); if(version===requestVersion)requestController=null; }
}

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
  const categories = catalogMeta.categories || [];
  for (const prefix of ['f', 'b']) {
    fillSelect($(`#${prefix}-category`), 'All categories', categories);
    fillSelect($(`#${prefix}-day`), 'Any day', DAYS.filter(d => (catalogMeta.days || []).includes(d)));
    $(`#${prefix}-day`).disabled = !catalogMeta.days?.length;
    fillSelect($(`#${prefix}-hours`), 'Any amount', catalogMeta.hours || []);
    $(`#${prefix}-hours`).disabled = !catalogMeta.hours?.length;
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
  $('#also-results').replaceChildren(...also.map(r => el('li', {}, clubCard(r.club, r))));
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
  const card = el('article', { class: 'club-card' });
  card.append(el('div', { class: 'card-top' },
    el('div', { class: 'card-title' },
      rank ? el('span', { class: 'rank', text: 'Match #' + rank }) : null,
      el('h' + headingLevel, { class: 'club-name', text: club.name }),
      el('span', { class: 'tag', text: club.category })),
    result ? el('p', { class: 'match', 'aria-label': result.score + '% estimated compatibility' }, el('strong', { text: result.score + '%' }), el('span', { text: result.assessment ? 'estimated AI fit' : 'estimated non-AI fit' })) : null));
  card.append(el('p', { class: 'description', text: club.description }));
  if (result && showWhy) {
    card.append(el('div', { class: 'why' },
      el('h' + (headingLevel + 1), { text: 'Why this club fits you' }),
      el('p', { text: result.explanation }),
      el('div', { class:'answer-chips', 'aria-label':'Answers that influenced this match' }, (result.influencedBy || []).map(answer => el('span',{class:'tag',text:answer})))));
  }
  const activityLabels={recent_activity_evidence:'Recent activity evidence',dated_past_activity:'Past activity documented',historical_only:'Historical listing — current activity unconfirmed',undated_listing:'Current activity not confirmed'};
  card.append(el('p',{class:'meta',text:(activityLabels[club.activityStatus]||'Current activity not confirmed')+(club.activityEvidence?.asOf?' · '+club.activityEvidence.asOf:'')}));
  if(club.recommendationEligible===false)card.append(el('p',{class:'meta',text:'Not used for recommendations: pending source review.'}));
  const labels={weeklyHours:'Weekly commitment',costs:'Membership costs',experience:'Experience',joining:'Joining',thon:'THON',meetings:'Meetings',size:'Group size',atmosphere:'Atmosphere'};
  const details=club.verifiedDetails||{};
  const known=Object.entries(labels).filter(([key])=>details[key]);
  if(known.length)card.append(el('dl',{class:'club-facts'},known.map(([key,label])=>fact(label,details[key].text))));
  for(const warning of result?.warnings||[])card.append(el('p',{class:'match-warning',text:warning}));
  const missing=Object.entries(labels).filter(([key])=>!details[key]).map(([,label])=>label);
  card.append(el('details',{class:'match-details'},el('summary',{text:'Club details'}),
    el('p',{text:'Not confirmed: '+(missing.join(', ')||'None of these fields')+'. Category and interest tags are editorial.'}),
    ...known.map(([key,label])=>el('p',{},label+': ',el('a',{href:details[key].source,target:'_blank',rel:'noopener',text:'Source reviewed '+details[key].verifiedAt})))));
  card.append(el('p', { class: 'club-interests', text: 'Relevant interests: ' + club.interestTags.join(' · ') }));
  card.append(el('p', { class: 'meta', text: club.campus + ' · Source reviewed ' + club.verifiedAt }));
  if(club.activityEvidence)card.querySelector('details').append(el('p',{},el('a',{href:club.activityEvidence.source,target:'_blank',rel:'noopener',text:'Activity evidence: '+club.activityEvidence.asOf})));
  for(const note of club.auditNotes||[])card.querySelector('details').append(el('p',{text:note}));
  if(result?.assessment) card.querySelector('details').append(el('p',{text:'AI evidence ratings (0–4): '+Object.entries(result.assessment).map(([key,value])=>key+': '+(value===null?'unknown':value)).join(' · ')}));
  card.append(el('div', { class: 'card-actions' },
    linkButton(club.officialUrl.includes('discover.psu.edu/organization/')?'Official Discover profile':club.officialUrl===club.source?'Penn State source':'Official club page', club.officialUrl, true, club.name),
    details.website && details.website.value!==club.officialUrl ? linkButton('Verified website / social',details.website.value,false,club.name):null,
    details.discover && details.discover.value!==club.officialUrl ? linkButton('Discover profile',details.discover.value,false,club.name):null,
    club.source !== club.officialUrl ? linkButton('Verification source', club.source, false, club.name) : null));
  return card;
}

async function renderBrowse() {
  browseController?.abort();
  const controller = new AbortController(); browseController = controller;
  $('#browse-count').textContent = 'Searching verified organizations…';
  $('#browse-error').hidden = true;
  const params=new URLSearchParams({q:$('#b-search').value.trim(),category:$('#b-category').value,day:$('#b-day').value,hours:$('#b-hours').value,offset:String(browseOffset),limit:'24'});
  try{
    const response=await fetch('/api/clubs?'+params,{signal:controller.signal});
    if(!response.ok)throw new Error('Catalog search is unavailable. Please try again.');
    const data=await response.json();if(controller!==browseController)return;
    const resultsById=new Map(state.results.map(r=>[r.clubId,r]));
    $('#browse-list').replaceChildren(...data.clubs.map(club=>el('li',{},clubCard(club,resultsById.get(club.id)||null,{showWhy:false}))));
    $('#browse-count').textContent=data.total ? 'Showing '+(data.offset+1)+'–'+(data.offset+data.clubs.length)+' of '+data.total+' matches ('+data.catalogTotal+' organizations in catalog)' : 'No clubs match your search. Try another keyword or clear filters.';
    browseNextOffset=data.nextOffset;
    $('#browse-prev').disabled=data.offset===0;$('#browse-next').disabled=data.nextOffset===null;
  }catch(error){if(error.name==='AbortError')return;$('#browse-count').textContent='';$('#browse-error').textContent=error.message;$('#browse-error').hidden=false;}
}
function resetBrowse(){browseOffset=0;clearTimeout(browseTimer);browseTimer=setTimeout(renderBrowse,180);}

function openBrowse() {
  requestVersion++;
  requestController?.abort();
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
  $('#retry-recommendations').addEventListener('click', finishQuiz);
  $('#loading-browse').addEventListener('click', openBrowse);
  $('#start-btn').addEventListener('click', startQuiz);
  $('#browse-start').addEventListener('click', startQuiz);
  $('#retake-btn').addEventListener('click', startQuiz);
  $('#home-btn').addEventListener('click', () => { requestVersion++; requestController?.abort(); showScreen('landing'); });
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

  $('#b-search').addEventListener('input', resetBrowse);
  $('#browse-prev').addEventListener('click',()=>{browseOffset=Math.max(0,browseOffset-24);renderBrowse();$('#browse-title').focus();});
  $('#browse-next').addEventListener('click',()=>{if(browseNextOffset!==null){browseOffset=browseNextOffset;renderBrowse();$('#browse-title').focus();}});
  document.querySelectorAll('[data-browse-filter]').forEach(select => select.addEventListener('change', resetBrowse));

  $('#copy-summary').addEventListener('click', copySummary);
}

async function init() {

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

// In-memory quiz state exposed for local interview testing.
window.ClubSortingHat = { state };

init();
