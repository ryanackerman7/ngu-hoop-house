/* ═══════════════════════════════════════════════════════
   NGU Hoop House | app.js
   ═══════════════════════════════════════════════════════ */

// ─── CONFIG ───────────────────────────────────────────
const CONFIG = {
  tiers: [
    { key: 'nightly', label: 'Nightly Drop-In', price: 15,  per: 'per night', desc: 'Show up whenever you want. Pay per run.',                              popular: false },
    { key: 'weekly',  label: 'Weekly Pass',     price: 30,  per: 'per week',  desc: 'All three nights for one week. Best value if you run regularly.',      popular: true  },
    { key: 'monthly', label: 'Monthly Pass',    price: 99,  per: 'per month', desc: 'Unlimited runs for a full month. Commit to the game.',                 popular: false },
  ],

  /*
    ═══ GOOGLE SHEETS INSERTION POINT ══════════════════════════════════════
    After setting up your Apps Script web app (see SHEETS SETUP comment
    block below), paste the deployed URL here:
      SHEETS_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
    Leave blank ('') to disable Sheet posting entirely.
    ════════════════════════════════════════════════════════════════════════
  */
  SHEETS_URL: '',

  /*
    ─── ADMIN PASSPHRASE ────────────────────────────────────────────────────
    IMPORTANT — READ THIS:
    This is LIGHT DETERRENCE only. It stops casual nosiness. It is NOT real
    security: the passphrase lives in this public JS file and anyone who views
    source can read it. Do NOT use this to protect anything sensitive.

    Real security for PII lives entirely behind your Google account on the
    Sheet — that requires Google credentials to access, which this site
    never touches.

    The admin panel after these changes only manages run dates (venue, times).
    There is NO signup PII stored or displayed here. The worst a passphrase-
    guesser can do is mess with your run schedule.

    Change this to any word or phrase you'll remember.
    ─────────────────────────────────────────────────────────────────────────
  */
  ADMIN_PASSPHRASE: 'hoophouse',
};

// ─── STORAGE KEYS ─────────────────────────────────────
/*
  localStorage contains ONLY non-PII data:

  "ngu_hoophouse_runs"     → admin-managed run schedule (no PII).
                             Shape: { 'YYYY-MM-DD': { venue, address,
                             doors, tipoff, end, note, isTest } }

  "ngu_hoophouse_schedule" → per-date INITIALS only (no PII).
                             Shape: { 'YYYY-MM-DD': ['J.G', 'R.A'] }

  Full PII (name, DOB, email, phone) is NEVER written to localStorage.
  It is collected in memory, posted to Google Sheets via Apps Script,
  and immediately discarded from the JS runtime. The browser retains
  nothing sensitive after the form submission completes.

  TO RESET (e.g. clear run schedule from DevTools):
    Application → Local Storage → delete keys starting with "ngu_hoophouse_"
*/
const KEYS = {
  runs:    'ngu_hoophouse_runs',
  public:  'ngu_hoophouse_schedule',
  version: 'ngu_hoophouse_version',
  // NOTE: there is intentionally NO "private" key — PII never touches localStorage
};

// ─── DATA VERSION RESET ───────────────────────────────
/*
  Bump DATA_VERSION any time you need to wipe ALL stored data on every
  visitor's next load (e.g. schema changes, going live fresh).
  '3' = date-keyed schedule, admin-managed runs, seed data cleared.

  NOTE: bumping this also wipes private signups. Only do it before
  real signups exist, or archive them first.
*/
const DATA_VERSION = '3';
(function resetIfStale() {
  if (localStorage.getItem(KEYS.version) !== DATA_VERSION) {
    localStorage.removeItem(KEYS.runs);
    localStorage.removeItem(KEYS.public);
    // No private key to clear — PII is never stored in localStorage
    localStorage.setItem(KEYS.version, DATA_VERSION);
  }
})();


// ─── RUN STORAGE (admin-managed) ──────────────────────
/*
  BACKEND PLACEHOLDER — runs stored in localStorage.
  Replace with authenticated API calls when you have a backend.
  Run shape: { venue, address, doors, tipoff, end, note, isTest }
  Keyed by 'YYYY-MM-DD'.
*/
function getRuns() {
  try { return JSON.parse(localStorage.getItem(KEYS.runs)) || {}; }
  catch { return {}; }
}

function saveRun(dateStr, runData) {
  const runs = getRuns();
  runs[dateStr] = runData;
  localStorage.setItem(KEYS.runs, JSON.stringify(runs));
}

function deleteRun(dateStr) {
  const runs = getRuns();
  delete runs[dateStr];
  localStorage.setItem(KEYS.runs, JSON.stringify(runs));
  // Also wipe public initials for that date
  const sched = getPublicSchedule();
  delete sched[dateStr];
  savePublicSchedule(sched);
}


// ─── SCHEDULE STORAGE (public, initials only) ─────────
function getPublicSchedule() {
  try { return JSON.parse(localStorage.getItem(KEYS.public)) || {}; }
  catch { return {}; }
}

function savePublicSchedule(data) {
  // initials ONLY — no personal data ever written here
  localStorage.setItem(KEYS.public, JSON.stringify(data));
}

function addToDate(dateStr, initials) {
  const sched = getPublicSchedule();
  if (!sched[dateStr]) sched[dateStr] = [];
  if (!sched[dateStr].includes(initials)) sched[dateStr].push(initials);
  savePublicSchedule(sched);
}


// ─── PII POLICY ───────────────────────────────────────
/*
  Full signup data (name, DOB, email, phone) is NEVER written to
  localStorage. On form submit it exists only in memory long enough to:
    1. Derive initials (first + last initial) → written to public schedule
    2. POST to Google Sheets via Apps Script (see postToSheets below)
  After that the JS object goes out of scope and is garbage-collected.

  There is no getPrivateSignups() or savePrivateSignup() function.
  All historical signup data lives exclusively in your Google Sheet,
  behind your Google account credentials.
*/


// ─── UTILITIES ────────────────────────────────────────
function toInitials(first, last) {
  return `${first.trim().charAt(0).toUpperCase()}.${last.trim().charAt(0).toUpperCase()}`;
}

function calcAge(dobString) {
  const dob = new Date(dobString);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

function formatInitials(arr) {
  return arr.join(' · ') || '—';
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 'YYYY-MM-DD' → 'June 9, 2026'
function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

// 'YYYY-MM-DD' → 'Tue, Jun 9'
function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}


// ─── CALENDAR ─────────────────────────────────────────
const _today = new Date();
let calState = { year: _today.getFullYear(), month: _today.getMonth() };

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DOW_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function renderCalendar() {
  const wrap = document.getElementById('calendarWrap');
  if (!wrap) return;

  const { year, month } = calState;
  const runs     = getRuns();
  const schedule = getPublicSchedule();
  const firstDow = new Date(year, month, 1).getDay();
  const total    = new Date(year, month + 1, 0).getDate();

  let html = `
    <div class="cal-header">
      <button class="cal-nav" id="calPrev" aria-label="Previous month">&#8249;</button>
      <span class="cal-title">${MONTH_NAMES[month]} ${year}</span>
      <button class="cal-nav" id="calNext" aria-label="Next month">&#8250;</button>
      <span class="cal-legend"><span class="cal-legend-dot"></span> Run scheduled</span>
    </div>
    <div class="cal-grid">`;

  for (const label of DOW_LABELS) {
    html += `<div class="cal-dow">${label}</div>`;
  }

  for (let i = 0; i < firstDow; i++) {
    html += `<div class="cal-cell cal-empty"></div>`;
  }

  for (let d = 1; d <= total; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const run     = runs[dateStr];

    if (run) {
      const count   = (schedule[dateStr] || []).length;
      const testTag = run.isTest ? '<span class="cal-test-tag">TEST</span>' : '';
      html += `
        <div class="cal-cell cal-run${run.isTest ? ' cal-run-test' : ''}"
             data-date="${dateStr}" tabindex="0" role="button"
             aria-label="Run on ${escHtml(formatDateShort(dateStr))} — click for details">
          <span class="cal-date">${d}</span>
          ${testTag}
          <span class="cal-venue-name">${escHtml(run.venue)}</span>
          <ul class="cal-info">
            <li>🚪 Doors ${escHtml(run.doors)}</li>
            <li>🏀 Tip-off ${escHtml(run.tipoff)}</li>
            <li>🔚 Ends ${escHtml(run.end)}</li>
          </ul>
          <span class="cal-going">${count} going</span>
        </div>`;
    } else {
      html += `<div class="cal-cell"><span class="cal-date">${d}</span></div>`;
    }
  }

  html += `</div>`;
  wrap.innerHTML = html;

  document.getElementById('calPrev').addEventListener('click', () => {
    if (calState.month === 0) { calState.year--; calState.month = 11; }
    else calState.month--;
    renderCalendar();
  });
  document.getElementById('calNext').addEventListener('click', () => {
    if (calState.month === 11) { calState.year++; calState.month = 0; }
    else calState.month++;
    renderCalendar();
  });

  // Clicking a run cell opens the detail modal
  wrap.querySelectorAll('.cal-run').forEach(cell => {
    cell.addEventListener('click', () => openRunModal(cell.dataset.date));
    cell.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') openRunModal(cell.dataset.date);
    });
  });
}


// ─── RUN DETAIL MODAL ─────────────────────────────────
function openRunModal(dateStr) {
  const run = getRuns()[dateStr];
  if (!run) return;

  const attendees = getPublicSchedule()[dateStr] || [];
  const testBadge = run.isTest
    ? '<span class="modal-test-tag">TEST RUN</span>'
    : '';

  document.getElementById('runModalDate').textContent = formatDateLabel(dateStr);
  document.getElementById('runModalContent').innerHTML = `
    ${testBadge}
    <div class="modal-venue">${escHtml(run.venue)}</div>
    <div class="modal-address">${escHtml(run.address)}</div>
    <ul class="modal-times">
      <li><span>Doors open</span>${escHtml(run.doors)}</li>
      <li><span>Tip-off</span>${escHtml(run.tipoff)}</li>
      <li><span>Ends</span>${escHtml(run.end)}</li>
    </ul>
    ${run.note ? `<p class="modal-note">${escHtml(run.note)}</p>` : ''}
    <div class="modal-going">
      <span class="modal-count">${attendees.length}</span>
      <span class="modal-count-label">Going</span>
    </div>
    <div class="modal-initials">${formatInitials(attendees)}</div>`;

  document.getElementById('runModalSignupBtn').onclick = () => {
    closeRunModal();
    prefillSignupForm(dateStr);
    document.getElementById('signup').scrollIntoView({ behavior: 'smooth' });
  };

  document.getElementById('runModalOverlay').classList.remove('hidden');
}

function closeRunModal() {
  document.getElementById('runModalOverlay').classList.add('hidden');
}


// ─── SIGNUP FORM — RUN DATE SELECTOR ──────────────────
function buildRunDateOptions() {
  const select = document.getElementById('runDate');
  if (!select) return;

  const runs  = getRuns();
  const floor = new Date();
  floor.setHours(0, 0, 0, 0);

  const upcoming = Object.keys(runs)
    .filter(d => new Date(d + 'T00:00:00') >= floor)
    .sort();

  if (upcoming.length === 0) {
    select.innerHTML = '<option value="" disabled selected>No runs scheduled yet — check back soon</option>';
    select.disabled  = true;
  } else {
    select.disabled  = false;
    select.innerHTML = '<option value="" disabled selected>Select a run date</option>';
    for (const d of upcoming) {
      const r   = runs[d];
      const tag = r.isTest ? ' [TEST]' : '';
      select.innerHTML += `<option value="${d}">${escHtml(formatDateShort(d))} — ${escHtml(r.venue)}${tag}</option>`;
    }
  }
}

function prefillSignupForm(dateStr) {
  const select = document.getElementById('runDate');
  if (!select) return;
  if (!select.querySelector(`option[value="${dateStr}"]`)) buildRunDateOptions();
  select.value = dateStr;
}


// ─── RENDER: PRICING ──────────────────────────────────
function renderPricing() {
  const grid = document.getElementById('pricingGrid');
  if (!grid) return;
  grid.innerHTML = '';

  for (const tier of CONFIG.tiers) {
    const card = document.createElement('div');
    card.className = `pricing-card${tier.popular ? ' popular' : ''}`;
    card.innerHTML = `
      ${tier.popular ? '<span class="popular-badge">Most Popular</span>' : ''}
      <div class="pricing-tier">${tier.label}</div>
      <div class="pricing-price">$${tier.price}</div>
      <div class="pricing-per">${tier.per}</div>
      <div class="pricing-desc">${tier.desc}</div>`;
    grid.appendChild(card);
  }
}


// ─── GOOGLE SHEETS ────────────────────────────────────
/*
  ════════════════════════════════════════════════════════════════════════════
  GOOGLE SHEETS SETUP — full step-by-step

  GOAL
  ────
  Every signup posts to a Google Sheet you own, server-side (no credentials
  in the public JS). The Sheet has:
    • "All Signups" master tab — every signup, full details
    • Per-date tabs (e.g. "2026-07-09") — check-in list with Arrived +
      ID Checked checkboxes for door use on your phone

  STEP 1 — Create the Sheet
  ──────────────────────────
  1. sheets.google.com → New blank spreadsheet
  2. Rename it: "NGU Hoop House Signups"
  3. Rename the default tab to: "All Signups"
  4. In row 1, add these headers:
     A: First Name  B: Last Name  C: DOB  D: Age  E: Email  F: Phone
     G: Run Date(s) H: Tier       I: Waiver Y/N    J: Signed Up At

  STEP 2 — Open Apps Script
  ──────────────────────────
  Extensions → Apps Script → replace everything in Code.gs with:

  ┌─────────────────────────── Code.gs ────────────────────────────────────
  │
  │  const SHEET_ID = 'YOUR_SPREADSHEET_ID'; // from the Sheet's URL
  │
  │  function doPost(e) {
  │    try {
  │      const data = JSON.parse(e.postData.contents);
  │      const ss   = SpreadsheetApp.openById(SHEET_ID);
  │      appendToMaster(ss, data);
  │      for (const dateStr of (data.dates || [])) {
  │        upsertDayTab(ss, dateStr, data);
  │      }
  │      return ContentService
  │        .createTextOutput(JSON.stringify({ status: 'ok' }))
  │        .setMimeType(ContentService.MimeType.JSON);
  │    } catch(err) {
  │      return ContentService
  │        .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
  │        .setMimeType(ContentService.MimeType.JSON);
  │    }
  │  }
  │
  │  function appendToMaster(ss, d) {
  │    const sheet = ss.getSheetByName('All Signups');
  │    sheet.appendRow([
  │      d.firstName, d.lastName, d.dob, d.age, d.email, d.phone,
  │      (d.dates || []).join(', '), d.passTier,
  │      d.waiver ? 'Y' : 'N', d.signedUpAt
  │    ]);
  │  }
  │
  │  function upsertDayTab(ss, dateStr, d) {
  │    let sheet = ss.getSheetByName(dateStr);
  │    if (!sheet) {
  │      // Create tab and add headers + checkbox columns
  │      sheet = ss.insertSheet(dateStr);
  │      sheet.appendRow([
  │        'Full Name','DOB','Age','Phone','Tier','Paid','Arrived','ID Checked'
  │      ]);
  │      // Pre-format 500 rows of checkbox columns for Arrived (col 7) and ID Checked (col 8)
  │      sheet.getRange(2, 7, 500, 2).insertCheckboxes();
  │      // Freeze header row
  │      sheet.setFrozenRows(1);
  │    }
  │    sheet.appendRow([
  │      d.firstName + ' ' + d.lastName,
  │      d.dob, d.age, d.phone, d.passTier, 'N'
  │      // Arrived + ID Checked checkboxes are already inserted above
  │    ]);
  │  }
  │
  │  // Allow CORS pre-flight
  │  function doGet(e) {
  │    return ContentService.createTextOutput('ok');
  │  }
  │
  └────────────────────────────────────────────────────────────────────────

  STEP 3 — Deploy as a web app
  ─────────────────────────────
  1. Apps Script → Deploy → New deployment
  2. Type: Web app
  3. Description: "NGU Signups v1"
  4. Execute as: Me (your Google account)
  5. Who has access: Anyone
  6. Click Deploy → Authorize → copy the Web App URL

  STEP 4 — Paste the URL
  ───────────────────────
  In app.js CONFIG at the top of this file, set:
    SHEETS_URL: 'https://script.google.com/macros/s/YOUR_ID/exec',

  STEP 5 — Test
  ───────────────
  Submit a test signup. Check DevTools Console — should log
  "Sheets: posted". Open your Sheet and verify the new row appears
  in "All Signups" and a per-date tab was created.

  SECURITY NOTE
  ─────────────
  The Apps Script URL is public but write-only (POST). No Google
  credentials are ever stored in the frontend JS. The Sheet itself
  is only accessible to your Google account.
  ════════════════════════════════════════════════════════════════════════════
*/
async function postToSheets(record) {
  if (!CONFIG.SHEETS_URL) return; // not configured — skip silently
  try {
    // mode: 'no-cors' is required for Apps Script from a browser.
    // The response will be opaque (unreadable) — that's expected.
    await fetch(CONFIG.SHEETS_URL, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(record),
    });
    console.log('Sheets: posted (no-cors, response opaque — check your Sheet)');
  } catch (err) {
    console.warn('Sheets post failed:', err.message);
  }
}


// ─── FORM HELPERS ─────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('formError');
  el.textContent = msg;
  el.classList.add('visible');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function clearError() {
  const el = document.getElementById('formError');
  el.textContent = '';
  el.classList.remove('visible');
}

// ─── FORM SUBMIT ──────────────────────────────────────
document.getElementById('signupForm').addEventListener('submit', function (e) {
  e.preventDefault();
  clearError();

  const firstName = document.getElementById('firstName').value.trim();
  const lastName  = document.getElementById('lastName').value.trim();
  const dob       = document.getElementById('dob').value;
  const email     = document.getElementById('email').value.trim();
  const phone     = document.getElementById('phone').value.trim();
  const runDate   = document.getElementById('runDate').value;
  const passTier  = document.getElementById('passTier').value;
  const waiver    = document.getElementById('waiverCheck').checked;

  if (!firstName || !lastName)        return showError('Please enter your full name.');
  if (!dob)                           return showError('Please enter your date of birth.');
  if (calcAge(dob) < 18)              return showError('You must be 18 or older to participate.');
  if (!email || !email.includes('@')) return showError('Please enter a valid email address.');
  if (!phone)                         return showError('Please enter a phone number.');
  if (!runDate)                       return showError('Please select a run date.');
  if (!passTier)                      return showError('Please select a pass type.');
  if (!waiver)                        return showError('Please agree to the liability waiver to continue.');

  const initials = toInitials(firstName, lastName);
  const age      = calcAge(dob);
  const dates    = [runDate];

  // PRIVATE record — full PII, never shown in the DOM
  const privateRecord = {
    firstName, lastName, dob, age, email, phone,
    dates, passTier, waiver: true,
    signedUpAt: new Date().toISOString(),
  };

  // PII exists only in memory here. addToDate writes initials only.
  // postToSheets fires it to Google Sheets then it goes out of scope.
  // Nothing with PII is ever written to localStorage.
  addToDate(runDate, initials);
  postToSheets(privateRecord);

  // Refresh calendar so going count updates immediately
  renderCalendar();

  // Show confirmation
  document.getElementById('signupForm').classList.add('hidden');
  const conf = document.getElementById('confirmationMsg');
  conf.classList.remove('hidden');

  const tierConfig = CONFIG.tiers.find(t => t.key === passTier);
  const dateLabel  = formatDateShort(runDate);

  if (passTier === 'nightly') {
    document.getElementById('confirmHeadline').textContent = 'ALMOST THERE.';
    document.getElementById('confirmSub').textContent =
      `You're signed up for ${dateLabel}. Complete payment below to lock in your spot.`;
    document.getElementById('confirmPayBlock').innerHTML = `
      <div class="pay-wall">
        <p class="pay-wall-label">Pay to secure your spot</p>
        <p class="pay-wall-amount">$15 <span>/ night</span></p>
        <!--
          ═══ STRIPE INSERTION POINT (NIGHTLY) ═══════════════════════════
          Replace onclick with:
            window.location.href = 'https://buy.stripe.com/YOUR_NIGHTLY_LINK';
          ════════════════════════════════════════════════════════════════
        -->
        <button class="btn btn-gold" onclick="alert('Stripe Checkout — nightly $15')">
          Pay Now &rarr;
        </button>
      </div>`;
  } else {
    const passLabel = tierConfig ? tierConfig.label : passTier;
    const passPrice = tierConfig ? `$${tierConfig.price}` : '';
    document.getElementById('confirmHeadline').textContent = "YOU'RE IN.";
    document.getElementById('confirmSub').textContent =
      `Your ${passLabel} covers ${dateLabel}. Complete payment once — you're set for your run window.`;
    document.getElementById('confirmPayBlock').innerHTML = `
      <div class="pay-wall pay-wall--pass">
        <p class="pay-wall-label">${escHtml(passLabel)}</p>
        <p class="pay-wall-amount">${passPrice} <span>one payment — all your runs</span></p>
        <!--
          ═══ STRIPE INSERTION POINT (PASS) ═══════════════════════════════
          const LINKS = { weekly: 'https://buy.stripe.com/...', monthly: '...' };
          window.location.href = LINKS[passTier];
          ════════════════════════════════════════════════════════════════
        -->
        <button class="btn btn-gold" onclick="alert('Stripe Checkout — ${escHtml(passLabel)}')">
          Activate Pass &rarr;
        </button>
      </div>`;
  }

  conf.scrollIntoView({ behavior: 'smooth', block: 'start' });
});


// ─── LOGO BACKGROUND REMOVAL ──────────────────────────
/*
  Canvas pass: strips near-black background from the logo PNG so it
  floats cleanly on the dark page. Remove when you have a transparent logo.
*/
function removeLogoBg(imgEl, threshold) {
  threshold = threshold || 70;
  try {
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');
    canvas.width  = imgEl.naturalWidth;
    canvas.height = imgEl.naturalHeight;
    ctx.drawImage(imgEl, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px   = data.data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] < threshold && px[i+1] < threshold && px[i+2] < threshold) px[i+3] = 0;
    }
    ctx.putImageData(data, 0, 0);
    imgEl.src = canvas.toDataURL('image/png');
  } catch (err) { /* cross-origin — skip silently */ }
}


// ─── NAV MOBILE TOGGLE ────────────────────────────────
(function initNav() {
  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
})();


// ─── RUN DETAIL MODAL CLOSE HANDLERS ─────────────────
document.getElementById('runModalClose').addEventListener('click', closeRunModal);
document.getElementById('runModalOverlay').addEventListener('click', function (e) {
  if (e.target === this) closeRunModal();
});


// ─── ADMIN ────────────────────────────────────────────
/*
  ADMIN PANEL — manages run schedule only. No PII here.

  PASSPHRASE GATE (CONFIG.ADMIN_PASSPHRASE):
  ─────────────────────────────────────────
  This is LIGHT DETERRENCE, not real security. The passphrase is in
  this public JS file — anyone who views source can read it. Its only
  job is to stop casual stumbling or accidental keypresses from
  opening the panel.

  Real security for sensitive data (signups, PII) lives behind your
  Google account on the Sheet. That requires actual Google credentials
  to access. This panel cannot touch it.

  Passphrase is remembered for the browser session (sessionStorage) so
  you don't retype it every time you open/close the panel.

  Shortcut: Ctrl+Shift+A (Win/Linux) · Cmd+Shift+A (Mac)
*/

// Session flag — avoids re-prompting while the tab is open
const ADMIN_SESSION_KEY = 'ngu_admin_auth';

function openAdmin() {
  // Check session first, then passphrase
  if (!sessionStorage.getItem(ADMIN_SESSION_KEY)) {
    const input = prompt('Admin passphrase:');
    if (input === null) return; // cancelled
    if (input.trim() !== CONFIG.ADMIN_PASSPHRASE) {
      alert('Incorrect passphrase.');
      return;
    }
    // Remember for this browser session only (cleared on tab close)
    sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
  }

  renderAdminRuns();
  document.getElementById('adminOverlay').classList.remove('hidden');
}

function closeAdmin() {
  document.getElementById('adminOverlay').classList.add('hidden');
}

// Render existing runs list
function renderAdminRuns() {
  const runs  = getRuns();
  const dates = Object.keys(runs).sort();
  const list  = document.getElementById('adminRunList');

  if (dates.length === 0) {
    list.innerHTML = '<p class="admin-empty">No runs scheduled yet. Add one below.</p>';
  } else {
    list.innerHTML = dates.map(d => {
      const r = runs[d];
      return `
        <div class="admin-run-item${r.isTest ? ' is-test' : ''}">
          <div class="admin-run-meta">
            <strong>${escHtml(formatDateShort(d))}</strong>
            ${r.isTest ? '<span class="admin-test-tag">TEST</span>' : ''}
            <span class="admin-run-venue">${escHtml(r.venue)}</span>
            <span class="admin-run-addr">${escHtml(r.address)}</span>
            <span class="admin-run-times">${escHtml(r.doors)} · ${escHtml(r.tipoff)} · ${escHtml(r.end)}</span>
            ${r.note ? `<span class="admin-run-note">${escHtml(r.note)}</span>` : ''}
          </div>
          <div class="admin-run-actions">
            <button class="btn-admin-sm btn-admin-edit"   onclick="editRun('${d}')">Edit</button>
            <button class="btn-admin-sm btn-admin-delete" onclick="confirmDeleteRun('${d}')">Delete</button>
          </div>
        </div>`;
    }).join('');
  }
}

// Populate the add/edit form for an existing run
function editRun(dateStr) {
  const r = getRuns()[dateStr] || {};
  document.getElementById('adminRunDate').value    = dateStr;
  document.getElementById('adminRunVenue').value   = r.venue   || '';
  document.getElementById('adminRunAddr').value    = r.address || '';
  document.getElementById('adminRunDoors').value   = r.doors   || '6:15 PM';
  document.getElementById('adminRunTipoff').value  = r.tipoff  || '6:30 PM';
  document.getElementById('adminRunEnd').value     = r.end     || '9:00 PM';
  document.getElementById('adminRunNote').value    = r.note    || '';
  document.getElementById('adminRunIsTest').checked = !!r.isTest;
  document.getElementById('adminRunForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function confirmDeleteRun(dateStr) {
  if (confirm(`Delete run on ${formatDateShort(dateStr)}?\n\nThis also clears the public attendee list for that date.`)) {
    deleteRun(dateStr);
    renderAdminRuns();
    buildRunDateOptions();
    renderCalendar();
  }
}

// Add/edit form submit
document.getElementById('adminRunForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const dateStr = document.getElementById('adminRunDate').value;
  if (!dateStr) { alert('Please choose a date.'); return; }

  saveRun(dateStr, {
    venue:   document.getElementById('adminRunVenue').value.trim(),
    address: document.getElementById('adminRunAddr').value.trim(),
    doors:   document.getElementById('adminRunDoors').value.trim(),
    tipoff:  document.getElementById('adminRunTipoff').value.trim(),
    end:     document.getElementById('adminRunEnd').value.trim(),
    note:    document.getElementById('adminRunNote').value.trim(),
    isTest:  document.getElementById('adminRunIsTest').checked,
  });

  // Reset form to defaults
  this.reset();
  document.getElementById('adminRunDoors').value  = '6:15 PM';
  document.getElementById('adminRunTipoff').value = '6:30 PM';
  document.getElementById('adminRunEnd').value    = '9:00 PM';

  renderAdminRuns();
  buildRunDateOptions();
  renderCalendar();
});

document.getElementById('adminClose').addEventListener('click', closeAdmin);

document.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
    e.preventDefault();
    document.getElementById('adminOverlay').classList.contains('hidden')
      ? openAdmin() : closeAdmin();
  }
  if (e.key === 'Escape') { closeAdmin(); closeRunModal(); }
});

document.getElementById('adminOverlay').addEventListener('click', function (e) {
  if (e.target === this) closeAdmin();
});


// ─── INIT ─────────────────────────────────────────────
(function init() {
  renderCalendar();
  buildRunDateOptions();
  renderPricing();

  document.querySelectorAll('.nav-logo-img, .footer-logo-img').forEach(img => {
    const go = () => removeLogoBg(img, 70);
    if (img.complete && img.naturalWidth) go();
    else img.addEventListener('load', go);
  });
})();
