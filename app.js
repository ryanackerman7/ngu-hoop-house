/* ═══════════════════════════════════════════════════════
   NGU Hoop House | app.js
   All prices + schedule config in CONFIG below.
   Change any value here without touching HTML/CSS.
   ═══════════════════════════════════════════════════════ */

// ─── CONFIG ───────────────────────────────────────────
// Edit prices, nights, and times here only.
const CONFIG = {
  nights: [
    { key: 'tuesday',   label: 'Tuesday',   time: '6:30 – 9:00 PM' },
    { key: 'wednesday', label: 'Wednesday', time: '6:30 – 9:00 PM' },
    { key: 'thursday',  label: 'Thursday',  time: '6:30 – 9:00 PM' },
  ],
  tiers: [
    {
      key:     'nightly',
      label:   'Nightly Drop-In',
      price:   15,
      per:     'per night',
      desc:    'Show up whenever you want. Pay per run.',
      popular: false,
    },
    {
      key:     'weekly',
      label:   'Weekly Pass',
      price:   30,
      per:     'per week',
      desc:    'All three nights for one week. Best value if you run regularly.',
      popular: true,
    },
    {
      key:     'monthly',
      label:   'Monthly Pass',
      price:   99,
      per:     'per month',
      desc:    'Unlimited runs for a full month. Commit to the game.',
      popular: false,
    },
  ],
};

// ─── STORAGE KEYS ─────────────────────────────────────
/*
  PRIVACY SPLIT — two separate localStorage keys intentionally:

  "ngu_hoophouse_signups"  → PRIVATE. Full records: firstName, lastName, DOB,
                             email, phone, nights[], passTier, signedUpAt.
                             NEVER read from this key for any public display.
                             Replace savePrivateSignup() / getPrivateSignups()
                             with real authenticated API calls when you have a backend.

  "ngu_hoophouse_schedule" → PUBLIC display only. Per-night arrays of initials
                             (e.g. "J.G"). No personal data. Safe to render.

  This separation ensures no future bug can accidentally expose private fields
  through the schedule / attendee display.
*/
const KEYS = {
  private: 'ngu_hoophouse_signups',   // NEVER render into the DOM
  public:  'ngu_hoophouse_schedule',  // initials only — safe to display
};

// ─── SEED DATA ────────────────────────────────────────
/*
  SEED — fake placeholder initials so the schedule isn't empty on demo day.
  DELETE this block and the seedSchedule() call in init() before going live.
  Also clear the ngu_hoophouse_schedule key in localStorage at launch.
*/
const SEED = {
  tuesday:   ['D.R', 'M.T', 'K.J', 'A.W'],
  wednesday: ['L.H', 'C.B', 'T.N'],
  thursday:  ['R.P', 'J.M', 'S.K', 'E.G'],
};

function seedSchedule() {
  const existing = getPublicSchedule();
  let changed = false;
  for (const night of CONFIG.nights) {
    if (!existing[night.key] || existing[night.key].length === 0) {
      existing[night.key] = [...SEED[night.key]];
      changed = true;
    }
  }
  if (changed) savePublicSchedule(existing);
}

// ─── STORAGE HELPERS ──────────────────────────────────
function getPublicSchedule() {
  try { return JSON.parse(localStorage.getItem(KEYS.public)) || {}; }
  catch { return {}; }
}

function savePublicSchedule(data) {
  // initials ONLY — no personal data ever written here
  localStorage.setItem(KEYS.public, JSON.stringify(data));
}

function getPrivateSignups() {
  /*
    BACKEND PLACEHOLDER — reads from localStorage.
    Replace with:
      const res = await fetch('/api/signups', {
        headers: { Authorization: 'Bearer ' + token }
      });
      return res.json();
    Only called by the local admin view, never by public display code.
  */
  try { return JSON.parse(localStorage.getItem(KEYS.private)) || []; }
  catch { return []; }
}

function savePrivateSignup(record) {
  /*
    BACKEND PLACEHOLDER — writes to localStorage.
    Replace with:
      await fetch('/api/signups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
    Record shape: { firstName, lastName, dob, email, phone,
                    nights[], passTier, signedUpAt }
  */
  const all = getPrivateSignups();
  all.push(record);
  localStorage.setItem(KEYS.private, JSON.stringify(all));
}

// ─── UTILITIES ────────────────────────────────────────
function toInitials(first, last) {
  // "Jordan" + "Grant" → "J.G"
  return `${first.trim().charAt(0).toUpperCase()}.${last.trim().charAt(0).toUpperCase()}`;
}

function calcAge(dobString) {
  const dob   = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function formatInitials(arr) {
  return arr.join(' · ') || '—';
}

function escHtml(str) {
  // Prevents XSS in the admin table display
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── RENDER: JUNE 2026 CALENDAR ───────────────────────
function renderCalendar() {
  const wrap = document.getElementById('calendarWrap');
  if (!wrap) return;

  const YEAR = 2026, MONTH = 5; // June = index 5
  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const RUN_DAYS   = { 2: 'tuesday', 3: 'wednesday', 4: 'thursday' }; // getDay() values
  const RUN_DOW    = new Set([2, 3, 4]);

  const firstDow  = new Date(YEAR, MONTH, 1).getDay(); // 1 = Monday for June 2026
  const totalDays = new Date(YEAR, MONTH + 1, 0).getDate(); // 30
  const schedule  = getPublicSchedule();

  // Day-of-week header row
  let html = `
    <div class="cal-header">
      <span class="cal-title">June 2026</span>
      <span class="cal-legend"><span class="cal-legend-dot"></span> Run night</span>
    </div>
    <div class="cal-grid">`;

  for (const label of DOW_LABELS) {
    const isRun = ['Tue','Wed','Thu'].includes(label);
    html += `<div class="cal-dow${isRun ? ' cal-dow-run' : ''}">${label}</div>`;
  }

  // Blank lead cells
  for (let i = 0; i < firstDow; i++) {
    html += `<div class="cal-cell cal-empty"></div>`;
  }

  // Day cells
  for (let d = 1; d <= totalDays; d++) {
    const dow      = new Date(YEAR, MONTH, d).getDay();
    const nightKey = RUN_DAYS[dow];

    if (nightKey) {
      const count = (schedule[nightKey] || []).length;
      html += `
        <div class="cal-cell cal-run" data-night="${nightKey}">
          <span class="cal-date">${d}</span>
          <ul class="cal-info">
            <li><span class="cal-info-label">📍</span>Winter Garden, FL</li>
            <li><span class="cal-info-label">🚪</span>Doors 6:15 PM</li>
            <li><span class="cal-info-label">🏀</span>Tip-off 6:30 PM</li>
            <li><span class="cal-info-label">🔚</span>Ends 9:00 PM</li>
          </ul>
          <span class="cal-going">${count} going</span>
        </div>`;
    } else {
      html += `<div class="cal-cell"><span class="cal-date">${d}</span></div>`;
    }
  }

  html += `</div>`;
  wrap.innerHTML = html;
}

// ─── RENDER: SCHEDULE ─────────────────────────────────
function renderSchedule() {
  const grid     = document.getElementById('scheduleGrid');
  const schedule = getPublicSchedule();
  grid.innerHTML  = '';

  for (const night of CONFIG.nights) {
    const attendees = schedule[night.key] || [];
    const card = document.createElement('div');
    card.className     = 'schedule-card';
    card.dataset.night = night.key;
    card.innerHTML = `
      <div class="schedule-day">${night.label}</div>
      <div class="schedule-time">${night.time}</div>
      <div class="going-count" id="count-${night.key}">${attendees.length}</div>
      <div class="going-label">Going</div>
      <div class="initials-row" id="initials-${night.key}">${formatInitials(attendees)}</div>
    `;
    grid.appendChild(card);
  }
}

// ─── RENDER: PRICING ──────────────────────────────────
function renderPricing() {
  const grid = document.getElementById('pricingGrid');
  grid.innerHTML = '';

  for (const tier of CONFIG.tiers) {
    const card = document.createElement('div');
    card.className = `pricing-card${tier.popular ? ' popular' : ''}`;
    card.innerHTML = `
      ${tier.popular ? '<span class="popular-badge">Most Popular</span>' : ''}
      <div class="pricing-tier">${tier.label}</div>
      <div class="pricing-price">$${tier.price}</div>
      <div class="pricing-per">${tier.per}</div>
      <div class="pricing-desc">${tier.desc}</div>
    `;
    grid.appendChild(card);
  }
}

// ─── LIVE SCHEDULE UPDATE ─────────────────────────────
function addToNight(nightKey, initials) {
  const schedule = getPublicSchedule();
  if (!schedule[nightKey]) schedule[nightKey] = [];
  // Skip if same initials already listed (prevents duplicate on re-submit)
  if (!schedule[nightKey].includes(initials)) {
    schedule[nightKey].push(initials);
  }
  savePublicSchedule(schedule);

  // Update DOM without full re-render
  const countEl    = document.getElementById(`count-${nightKey}`);
  const initialsEl = document.getElementById(`initials-${nightKey}`);
  if (countEl)    countEl.textContent    = schedule[nightKey].length;
  if (initialsEl) initialsEl.textContent = formatInitials(schedule[nightKey]);
}

// ─── FORM ─────────────────────────────────────────────
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
function getCheckedNights() {
  return Array.from(document.querySelectorAll('input[name="nights"]:checked'))
    .map(el => el.value);
}

document.getElementById('signupForm').addEventListener('submit', function (e) {
  e.preventDefault();
  clearError();

  const firstName = document.getElementById('firstName').value.trim();
  const lastName  = document.getElementById('lastName').value.trim();
  const dob       = document.getElementById('dob').value;
  const email     = document.getElementById('email').value.trim();
  const phone     = document.getElementById('phone').value.trim();
  const passTier  = document.getElementById('passTier').value;
  const waiver    = document.getElementById('waiverCheck').checked;
  const nights    = getCheckedNights();

  // Validation
  if (!firstName || !lastName)        return showError('Please enter your full name.');
  if (!dob)                           return showError('Please enter your date of birth.');
  if (calcAge(dob) < 18)             return showError('You must be 18 or older to participate.');
  if (!email || !email.includes('@')) return showError('Please enter a valid email address.');
  if (!phone)                         return showError('Please enter a phone number.');
  if (nights.length === 0)           return showError('Please select at least one night.');
  if (!passTier)                      return showError('Please select a pass type.');
  if (!waiver)                        return showError('Please agree to the liability waiver to continue.');

  const initials = toInitials(firstName, lastName);

  // PRIVATE record — full data, never shown in the DOM
  const privateRecord = {
    firstName, lastName, dob, email, phone,
    nights, passTier,
    signedUpAt: new Date().toISOString(),
  };

  /*
    BACKEND PLACEHOLDER — replace savePrivateSignup with a real API POST:
      await fetch('/api/signups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(privateRecord),
      });
  */
  savePrivateSignup(privateRecord);

  // PUBLIC — add initials only to chosen nights
  for (const night of nights) addToNight(night, initials);

  // Show confirmation, hide form
  document.getElementById('signupForm').classList.add('hidden');
  const conf = document.getElementById('confirmationMsg');
  conf.classList.remove('hidden');

  // ── Payment gate logic ──────────────────────────────────────────────
  // Nightly: pay per session — hit paywall immediately after each signup.
  // Weekly / Monthly: pass covers all selected nights — book freely.
  const tierConfig = CONFIG.tiers.find(t => t.key === passTier);
  const nightLabels = nights.map(n => {
    const nc = CONFIG.nights.find(c => c.key === n);
    return nc ? nc.label : n;
  }).join(', ');

  if (passTier === 'nightly') {
    document.getElementById('confirmHeadline').textContent = "ALMOST THERE.";
    document.getElementById('confirmSub').textContent =
      `You're signed up for ${nightLabels}. Complete payment below to lock in your spot — $15 per night.`;
    document.getElementById('confirmPayBlock').innerHTML = `
      <div class="pay-wall">
        <p class="pay-wall-label">Pay to secure your spot</p>
        <p class="pay-wall-amount">$15 <span>/ night</span></p>
        <!--
          ═══ STRIPE INSERTION POINT (NIGHTLY) ══════════════════════════════
          Replace button onclick with:
            window.location.href = 'https://buy.stripe.com/YOUR_NIGHTLY_LINK';
          ════════════════════════════════════════════════════════════════════
        -->
        <button class="btn btn-gold" id="paymentBtn"
                onclick="alert('Stripe Checkout goes here — nightly $15.')">
          Pay Now &rarr;
        </button>
      </div>`;
  } else {
    // Weekly or Monthly — pass covers all bookings
    const passLabel = tierConfig ? tierConfig.label : passTier;
    const passPrice = tierConfig ? `$${tierConfig.price}` : '';
    document.getElementById('confirmHeadline').textContent = "YOU'RE IN.";
    document.getElementById('confirmSub').textContent =
      `Your ${passLabel} covers all your nights (${nightLabels}). Complete payment once and you're good to book every run in your window.`;
    document.getElementById('confirmPayBlock').innerHTML = `
      <div class="pay-wall pay-wall--pass">
        <p class="pay-wall-label">${passLabel}</p>
        <p class="pay-wall-amount">${passPrice} <span>one payment — all your runs</span></p>
        <!--
          ═══ STRIPE INSERTION POINT (PASS) ═════════════════════════════════
          Replace button onclick with:
            const LINKS = { weekly: 'https://buy.stripe.com/...', monthly: 'https://buy.stripe.com/...' };
            window.location.href = LINKS[passTier];
          ════════════════════════════════════════════════════════════════════
        -->
        <button class="btn btn-gold" id="paymentBtn"
                onclick="alert('Stripe Checkout goes here — ${passLabel}.')">
          Activate Pass &rarr;
        </button>
      </div>`;
  }

  conf.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ─── LOGO BACKGROUND REMOVAL ──────────────────────────
/*
  The logo file has a near-black (non-transparent) background.
  This canvas pass replaces any pixel darker than `threshold` with
  transparency so the logo floats clean on the dark page.
  Safe to remove if a future logo file already has a transparent background.
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
      if (px[i] < threshold && px[i+1] < threshold && px[i+2] < threshold) {
        px[i+3] = 0;
      }
    }
    ctx.putImageData(data, 0, 0);
    imgEl.src = canvas.toDataURL('image/png');
  } catch (err) {
    // Canvas tainted (cross-origin) — skip bg removal silently
  }
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

  // Close mobile nav when a link is tapped
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
})();

// ─── ADMIN VIEW ───────────────────────────────────────
/*
  LOCAL-ONLY ADMIN — shows full signup records from localStorage in a modal.
  NOT SECURE. Anyone with DevTools can read localStorage directly.

  TO DO: Delete this panel entirely before launch. Build a real authenticated
  admin route at NGUHoopHouse.com/admin (Supabase Auth, NextAuth, Clerk, etc.)

  Shortcut: Ctrl+Shift+A (Win/Linux) · Cmd+Shift+A (Mac)
  Close:    Escape · or click the backdrop
*/
function openAdmin() {
  const signups  = getPrivateSignups();
  const tableDiv = document.getElementById('adminTable');

  if (signups.length === 0) {
    tableDiv.innerHTML = '<p class="admin-empty">No signups yet.</p>';
  } else {
    const rows = signups.map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escHtml(s.firstName)} ${escHtml(s.lastName)}</td>
        <td>${escHtml(s.dob)}</td>
        <td>${escHtml(s.email)}</td>
        <td>${escHtml(s.phone)}</td>
        <td>${(s.nights || []).join(', ')}</td>
        <td>${escHtml(s.passTier)}</td>
        <td style="white-space:nowrap">${new Date(s.signedUpAt).toLocaleString()}</td>
      </tr>
    `).join('');

    tableDiv.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>#</th><th>Name</th><th>DOB</th><th>Email</th>
            <th>Phone</th><th>Nights</th><th>Pass</th><th>Signed Up</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  document.getElementById('adminOverlay').classList.remove('hidden');
}

function closeAdmin() {
  document.getElementById('adminOverlay').classList.add('hidden');
}

document.getElementById('adminClose').addEventListener('click', closeAdmin);

document.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
    e.preventDefault();
    document.getElementById('adminOverlay').classList.contains('hidden')
      ? openAdmin() : closeAdmin();
  }
  if (e.key === 'Escape') closeAdmin();
});

document.getElementById('adminOverlay').addEventListener('click', function (e) {
  if (e.target === this) closeAdmin();
});

// ─── INIT ─────────────────────────────────────────────
(function init() {
  seedSchedule();   // ← REMOVE before launch (delete this + the SEED constant above)
  renderCalendar();
  renderSchedule();
  renderPricing();

  // Strip dark background from every logo instance on the page
  document.querySelectorAll('.nav-logo-img, .footer-logo-img').forEach(img => {
    const run = () => removeLogoBg(img, 70);
    if (img.complete && img.naturalWidth) run();
    else img.addEventListener('load', run);
  });
})();
