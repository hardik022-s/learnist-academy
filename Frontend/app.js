/* ==========================================================
   Learnist Academy - app logic
   Plain JavaScript single-page app with hash routing (#/courses).
   Data comes from data.js. Saved data lives in localStorage.
   ========================================================== */

(function () {
  'use strict';

  /* ---------------------------------------------------------
     1. Storage (falls back to memory if localStorage is blocked)
     --------------------------------------------------------- */
  const store = (function () {
    const memory = {};
    let available = true;
    try {
      localStorage.setItem('__la_test', '1');
      localStorage.removeItem('__la_test');
    } catch (e) {
      available = false;
    }
    return {
      get(key, fallback) {
        try {
          const raw = available ? localStorage.getItem(key) : memory[key];
          return raw == null ? fallback : JSON.parse(raw);
        } catch (e) {
          return fallback;
        }
      },
      set(key, value) {
        const raw = JSON.stringify(value);
        if (available) {
          try { localStorage.setItem(key, raw); return; } catch (e) { /* use memory */ }
        }
        memory[key] = raw;
      },
      remove(key) {
        try { if (available) localStorage.removeItem(key); } catch (e) { /* ignore */ }
        delete memory[key];
      }
    };
  })();

  const DB_KEY = 'learnist_db_v1';
  const SESSION_KEY = 'learnist_session';

  function freshDb() {
    const today = new Date();
    const daysAgo = (n) => new Date(today.getTime() - n * 86400000).toISOString();
    return {
      users: DEMO_USERS.map((u, i) => ({ ...u, createdAt: daysAgo(40 - i * 15) })),
      profiles: JSON.parse(JSON.stringify(DEMO_PROFILES)),
      courses: JSON.parse(JSON.stringify(COURSES)),
      batches: JSON.parse(JSON.stringify(BATCHES)),
      bookings: [
        { id: 'bk-1', name: 'Rahul Sharma', phone: '+91 98989 89898', courseId: 'course-ssc-cgl-target', date: isoDate(addDays(today, 2)), slot: 'Evening (6 - 8 PM)', status: 'CONFIRMED', source: 'WEBSITE', createdAt: daysAgo(3) },
        { id: 'bk-2', name: 'Meera Pillai', phone: '+91 91234 50000', courseId: COURSES[1].id, date: isoDate(addDays(today, 4)), slot: 'Morning (8 - 10 AM)', status: 'PENDING', source: 'CHATBOT', createdAt: daysAgo(1) }
      ],
      enquiries: [
        { id: 'enq-1', name: 'Arjun Mehta', email: 'arjun.m@gmail.com', phone: '+91 99887 76655', categoryId: 'ca', message: 'Is the CA Foundation batch available in Hindi medium?', status: 'NEW', source: 'WEBSITE', createdAt: daysAgo(2) },
        { id: 'enq-2', name: 'Sneha Kapoor', email: 'sneha.k@yahoo.com', phone: '+91 90000 11111', categoryId: 'upsc', message: 'Do you offer an optional subject course for Geography?', status: 'CONTACTED', source: 'WEBSITE', createdAt: daysAgo(5) }
      ],
      tasks: {}
    };
  }

  let db = store.get(DB_KEY, null) || freshDb();
  const saveDb = () => store.set(DB_KEY, db);
  saveDb();

  /* ---------------------------------------------------------
     2. Helpers
     --------------------------------------------------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const uid = (prefix) => prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
  function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
  function isoDate(d) {
    const pad = (x) => String(x).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function niceDate(value) {
    const d = new Date(value);
    if (isNaN(d)) return value;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const TYPE_LABEL = {
    FOUNDATION: 'Foundation Program', FULL_COURSE: 'Comprehensive Batch', CRASH: 'Crash Course',
    TEST_SERIES: 'Test Series', SUBJECT_INTENSIVE: 'Subject Intensive'
  };
  const LEVEL_LABEL = { BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced' };
  const STATUS_CLASS = { CONFIRMED: 'ok', COMPLETED: 'ok', CLOSED: 'ok', PENDING: 'warn', NEW: 'info', CONTACTED: 'warn', CANCELLED: 'bad', UPCOMING: 'info', ONGOING: 'ok' };

  const SUBJECTS = {};
  CATEGORIES.forEach((c) => c.subjects.forEach((s) => { SUBJECTS[s.id] = s; }));

  const category = (id) => CATEGORIES.find((c) => c.id === id);
  const track = (id) => { for (const c of CATEGORIES) { const t = c.tracks.find((x) => x.id === id); if (t) return t; } return null; };
  const course = (idOrSlug) => db.courses.find((c) => c.id === idOrSlug || c.slug === idOrSlug);
  const teacher = (id) => FACULTY.find((f) => f.id === id);
  const batch = (id) => db.batches.find((b) => b.id === id);

  function subjectBadges(ids) {
    const seen = new Set();
    return (ids || []).map((id) => SUBJECTS[id]).filter((s) => {
      if (!s || seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    }).map((s) => `<span class="badge"><span class="dot" style="background:${s.color}"></span>${esc(s.name)}</span>`).join('');
  }

  function seatsLeft(b) { return Math.max(0, b.capacity - b.enrolledCount); }
  function isFull(b) { return seatsLeft(b) === 0; }

  /* ---------------------------------------------------------
     3. Icons (inline SVG)
     --------------------------------------------------------- */
  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
    video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 6 10 7 10-7"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/>',
    flame: '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-9-1 2-2 3-4 3 0-2-1-4-3-6 0 4-4 6-4 11 0 4 3 8 8 8z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
    star: '<path d="m12 2 3 6.5 7 .9-5.1 4.8 1.3 7L12 17.8 5.8 21.2l1.3-7L2 9.4l7-.9z"/>',
    home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/>',
    atom: '<circle cx="12" cy="12" r="1.5"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/>',
    dna: '<path d="M7 3c0 6 10 6 10 12 0 3-2 4.5-4 5.5M17 3c0 6-10 6-10 12 0 3 2 4.5 4 5.5M8 7h8M8 17h8M9.5 12h5"/>',
    backpack: '<path d="M5 10a7 7 0 0 1 14 0v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M9 3h6M8 22v-6h8v6M8 12h8"/>',
    ledger: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h8M8 14h2M14 14h2M8 18h2M14 18h2"/>',
    building: '<path d="M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M2 10h20L12 3z"/>',
    clipboard: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 2h6v4H9zM9 12h6M9 16h4"/>',
    bank: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18M7 15h4M3 7l9-4 9 4"/>',
    train: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l-2-4M15 21l2-4M9 14h.01M15 14h.01"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    flag: '<path d="M4 22V4M4 4h12l-2 4 2 4H4"/>',
    scales: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>'
  };
  function icon(name, size) {
    const style = size ? ` style="width:${size}px;height:${size}px"` : '';
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${style}>${ICONS[name] || ''}</svg>`;
  }
  const GOOGLE_ICON = '<svg class="icon" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8.1z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>';

  /* ---------------------------------------------------------
     4. Session
     --------------------------------------------------------- */
  function currentUser() {
    const id = store.get(SESSION_KEY, null);
    return id ? db.users.find((u) => u.id === id) || null : null;
  }
  const profileOf = (user) => (user ? db.profiles[user.id] || null : null);
  function signIn(user) { store.set(SESSION_KEY, user.id); }
  function signOut() { store.remove(SESSION_KEY); closeChat(); go('/'); toast('Logged out'); }

  function routeAfterLogin(user, next) {
    if (user.role === 'ADMIN') return go('/admin');
    if (!profileOf(user)) return go('/onboarding' + (next ? '?next=' + encodeURIComponent(next) : ''));
    go(next || '/home');
  }

  /* ---------------------------------------------------------
     5. Toast + modal
     --------------------------------------------------------- */
  function toast(message, type) {
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' error' : '');
    el.innerHTML = icon(type === 'error' ? 'x' : 'check', 16) + '<span>' + esc(message) + '</span>';
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function openModal(html) {
    $('#modal-root').innerHTML = `<div class="overlay" data-action="close-modal-bg"><div class="card modal" role="dialog">${html}</div></div>`;
  }
  function closeModal() { $('#modal-root').innerHTML = ''; }

  /* ---------------------------------------------------------
     6. Router
     --------------------------------------------------------- */
  const routes = [
    { path: '/', view: viewHome },
    { path: '/courses', view: viewCourses },
    { path: '/courses/:slug', view: viewCourseDetail },
    { path: '/faculty', view: viewFaculty },
    { path: '/faculty/:id', view: viewFacultyProfile },
    { path: '/results', view: viewResults },
    { path: '/batches', view: viewBatches },
    { path: '/contact', view: viewContact },
    { path: '/auth', view: viewAuth, layout: 'bare' },
    { path: '/onboarding', view: viewOnboarding, layout: 'minimal', guard: 'student' },
    { path: '/home', view: viewStudentHome, guard: 'student' },
    { path: '/admin/login', view: viewAdminLogin, layout: 'bare' },
    { path: '/admin', view: viewAdmin, layout: 'admin', guard: 'admin' },
    { path: '/admin/:tab', view: viewAdmin, layout: 'admin', guard: 'admin' }
  ];

  let lastPath = null;
  let mountQueue = [];
  const onMount = (fn) => mountQueue.push(fn);

  function parseHash() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, query] = raw.split('?');
    return { path: path || '/', query: new URLSearchParams(query || '') };
  }

  function matchRoute(path) {
    const parts = path.split('/').filter(Boolean);
    for (const r of routes) {
      const rParts = r.path.split('/').filter(Boolean);
      if (rParts.length !== parts.length) continue;
      const params = {};
      const ok = rParts.every((p, i) => {
        if (p.startsWith(':')) { params[p.slice(1)] = decodeURIComponent(parts[i]); return true; }
        return p === parts[i];
      });
      if (ok) return { route: r, params };
    }
    return null;
  }

  function go(path) {
    if (location.hash === '#' + path) render();
    else location.hash = path;
  }

  function render() {
    const { path, query } = parseHash();
    const match = matchRoute(path);
    const user = currentUser();
    mountQueue = [];

    if (match && match.route.guard === 'student') {
      if (!user) return go('/auth?next=' + encodeURIComponent(path));
      if (user.role === 'ADMIN') return go('/admin');
      if (path === '/home' && !profileOf(user)) return go('/onboarding');
    }
    if (match && match.route.guard === 'admin' && (!user || user.role !== 'ADMIN')) return go('/admin/login');

    const ctx = { params: match ? match.params : {}, query, user, profile: profileOf(user), path };
    const body = match ? match.route.view(ctx) : viewNotFound();
    const layout = match ? match.route.layout : null;

    let html;
    if (layout === 'bare' || layout === 'admin') html = body;
    else if (layout === 'minimal') html = minimalHeader() + body;
    else html = topBanner(user) + navbar(path, user) + '<main>' + body + '</main>' + footer();

    $('#app').innerHTML = html;
    document.body.classList.toggle('dock-page', path === '/home');

    if (path !== lastPath) window.scrollTo(0, 0);
    lastPath = path;

    renderChatLauncher(layout !== 'admin' && layout !== 'bare' && layout !== 'minimal');
    closeModal();
    mountQueue.forEach((fn) => fn());
    setupReveal();
    setupCounters();
    setupSwipeRows();
    onScroll();
  }

  /* ---------------------------------------------------------
     7. Shared layout pieces
     --------------------------------------------------------- */
  function logo(showText) {
    return `<a href="#/" class="logo" aria-label="Learnist Academy home">
      <span class="logo-tile">LA</span>
      ${showText === false ? '' : '<span class="logo-text"><strong>Learnist Academy</strong><small>ONLINE PREP</small></span>'}
    </a>`;
  }

  function topBanner(user) {
    return `<div class="top-banner">${esc(SITE.banner)}${user ? '' : '<a href="#/auth?mode=signup">Get Started</a>'}</div>`;
  }

  function navbar(path, user) {
    const links = [['/', 'Home'], ['/courses', 'Courses'], ['/faculty', 'Faculty'], ['/results', 'Results'], ['/batches', 'Batches']];
    const isActive = (p) => (p === '/' ? path === '/' : path.startsWith(p));
    const linkHtml = links.map(([p, label]) => `<a href="#${p}" class="${isActive(p) ? 'active' : ''}">${label}</a>`).join('');

    let actions;
    if (user) {
      const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
      const homeLink = user.role === 'ADMIN' ? '#/admin' : '#/home';
      actions = `
        <a href="${homeLink}" class="btn btn-cta btn-sm hide-sm">${user.role === 'ADMIN' ? 'Admin Panel' : 'My Home'}</a>
        <div class="dropdown" id="user-menu">
          <button class="avatar" data-action="toggle-menu" aria-label="Account menu">${esc(initials)}</button>
          <div class="dropdown-menu">
            <div style="padding:8px 12px 10px;border-bottom:1px solid var(--line);margin-bottom:4px">
              <strong style="font-size:14px">${esc(user.name)}</strong><br><small class="muted">${esc(user.email)}</small>
            </div>
            <a href="${homeLink}">${user.role === 'ADMIN' ? 'Admin Panel' : 'My Home'}</a>
            ${user.role === 'STUDENT' ? '<a href="#/onboarding">Edit study profile</a>' : ''}
            <button data-action="logout">Log out</button>
          </div>
        </div>`;
    } else {
      actions = `
        <button class="btn btn-outline btn-sm hide-sm" data-action="book-demo">Book Free Demo</button>
        <a href="#/auth" class="btn btn-ghost hide-sm">Log In</a>
        <a href="#/auth?mode=signup" class="btn btn-cta btn-sm">Get Started</a>`;
    }

    return `
      <header class="navbar" id="navbar">
        <div class="container nav-inner">
          ${logo()}
          <nav class="nav-links">${linkHtml}</nav>
          <div class="nav-actions">
            ${actions}
            <button class="menu-btn" data-action="toggle-mobile" aria-label="Menu">${icon('menu', 22)}</button>
          </div>
        </div>
        <div class="mobile-menu" id="mobile-menu">
          ${links.map(([p, label]) => `<a href="#${p}">${label}</a>`).join('')}
          <a href="#/contact">Contact</a>
          ${user ? '' : '<a href="#/auth">Log In</a><button class="btn btn-outline btn-block" data-action="book-demo">Book Free Demo</button>'}
        </div>
        <div class="progress-bar" id="progress-bar"></div>
      </header>`;
  }

  function minimalHeader() {
    return `<header class="navbar scrolled"><div class="container nav-inner">${logo()}<button class="btn btn-ghost btn-sm" data-action="logout">${icon('logout', 16)} Log out</button></div></header>`;
  }

  function footer() {
    const examLinks = CATEGORIES.slice(0, 6).map((c) => `<a href="#/courses?category=${c.id}">${esc(c.name)}</a>`).join('');
    const govLinks = CATEGORIES.slice(6).map((c) => `<a href="#/courses?category=${c.id}">${esc(c.name)}</a>`).join('');
    return `
      <footer class="footer">
        <div class="container">
          <div class="footer-grid">
            <div>
              ${logo()}
              <p style="margin:16px 0;font-size:14px;max-width:320px;color:#94A3B8">${esc(SITE.tagline)} Live online classes, recorded lectures, test series and doubt support for India's major exams.</p>
              <a href="mailto:${SITE.email}">${icon('mail', 14)} ${SITE.email}</a>
              <a href="tel:${SITE.phone.replace(/\s/g, '')}">${icon('phone', 14)} ${SITE.phone}</a>
            </div>
            <div><h4>Competitive Exams</h4>${examLinks}</div>
            <div><h4>Government Exams</h4>${govLinks}</div>
            <div><h4>Learnist</h4>
              <a href="#/courses">All Courses</a><a href="#/faculty">Our Faculty</a><a href="#/results">Results</a>
              <a href="#/batches">Upcoming Batches</a><a href="#/contact">Contact Us</a><a href="#/admin/login">Admin Login</a>
            </div>
          </div>
          <div class="footer-bottom">
            <span>&copy; ${new Date().getFullYear()} Learnist Academy. 100% online learning.</span>
            <span>Privacy Policy &middot; Terms of Use &middot; Refund Policy</span>
          </div>
        </div>
      </footer>`;
  }

  function pageHead(crumb, title, sub, extra) {
    return `
      <section class="page-head">
        <div class="container">
          <div class="crumbs"><a href="#/">Home</a> &nbsp;/&nbsp; ${crumb}</div>
          <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap">
            <div><h1>${title}</h1><p>${sub}</p></div>
            ${extra || ''}
          </div>
        </div>
      </section>`;
  }

  /* ---------------------------------------------------------
     8. Card templates
     --------------------------------------------------------- */
  function categoryCard(c, hidden) {
    return `
      <div class="card lift cat-card reveal ${hidden ? 'hidden extra-cat' : ''}" style="--accent:${c.accent}">
        <div class="cat-icon" style="background:${c.tint};color:${c.accent}">${icon(c.icon)}</div>
        <a href="#/courses?category=${c.id}"><h3>${esc(c.name)}</h3></a>
        <p>${esc(c.description)}</p>
        <div class="chips">${c.tracks.map((t) => `<a class="chip" href="#/courses?category=${c.id}&track=${t.id}">${esc(t.name)}</a>`).join('')}</div>
        <a class="link" href="#/courses?category=${c.id}" style="margin-top:4px">Explore ${icon('arrowRight', 16)}</a>
      </div>`;
  }

  function courseCard(c, reason) {
    return `
      <article class="card lift course-card">
        <div class="top"><span class="tag">${TYPE_LABEL[c.type] || c.type}</span><span>${esc(c.duration)}</span></div>
        <a href="#/courses/${c.slug}"><h3>${esc(c.title)}</h3></a>
        <p class="desc">${esc(c.description)}</p>
        <div class="chips">${subjectBadges(c.subjectIds)}</div>
        ${reason ? `<div class="reason"><b>Why this is recommended:</b> ${esc(reason)}</div>` : ''}
        <ul>${(c.highlights || []).slice(0, 2).map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
        <div class="foot">
          <div class="price"><small>Total fee</small><strong>${inr(c.price)}</strong>${c.originalPrice ? `<s>${inr(c.originalPrice)}</s>` : ''}</div>
          <div class="btn-row">
            <button class="btn btn-outline btn-sm" data-action="book-demo" data-course="${c.id}">Demo</button>
            <button class="btn btn-cta btn-sm" data-action="enroll" data-course="${c.id}">Enroll</button>
          </div>
        </div>
      </article>`;
  }

  function facultyCard(f) {
    return `
      <article class="card lift fac-card reveal">
        <img src="${f.photo}" alt="${esc(f.name)}" loading="lazy">
        <h3>${esc(f.name)}</h3>
        <div class="exp">${esc(f.experience)}</div>
        <div class="qual">${esc(f.qualifications)}</div>
        <p class="bio">${esc(f.bio)}</p>
        <div class="chips">${subjectBadges(f.subjectIds)}</div>
        <a href="#/faculty/${f.id}" class="btn btn-outline btn-sm">View Profile</a>
      </article>`;
  }

  function batchCard(b, reason) {
    const c = course(b.courseId);
    const f = teacher(b.facultyId);
    const left = seatsLeft(b);
    const pct = Math.round((b.enrolledCount / b.capacity) * 100);
    const full = isFull(b);
    return `
      <article class="card lift batch-card">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
          <span class="status ${full ? 'bad' : 'info'}">${full ? 'Batch full' : 'Starts ' + niceDate(b.startDate)}</span>
          <span class="muted" style="font-size:13px">${c ? esc(c.duration) : ''}</span>
        </div>
        <h3>${esc(b.name)}</h3>
        ${reason ? `<div class="reason">${esc(reason)}</div>` : ''}
        <div class="batch-meta">
          ${c ? `<div>${icon('book', 15)} <a href="#/courses/${c.slug}">${esc(c.title)}</a></div>` : ''}
          <div>${icon('calendar', 15)} ${esc(b.scheduleDays)}</div>
          <div>${icon('clock', 15)} ${esc(b.scheduleTime)}</div>
          ${f ? `<div>${icon('user', 15)} ${esc(f.name)}</div>` : ''}
        </div>
        <div class="seats"><span>${full ? 'No seats left' : left + ' seats left'}</span><span class="muted">${pct}% filled</span></div>
        <div class="meter ${left < 10 ? 'low' : ''}"><i style="width:${pct}%"></i></div>
        <div class="btn-row" style="margin-top:6px">
          <button class="btn btn-outline btn-sm" style="flex:1" data-action="book-demo" data-course="${b.courseId}" data-batch="${b.id}" ${full ? 'disabled' : ''}>Book Demo</button>
          <button class="btn btn-cta btn-sm" style="flex:1" data-action="join-batch" data-batch="${b.id}" ${full ? 'disabled' : ''}>Join</button>
        </div>
      </article>`;
  }

  function resultCard(r) {
    return `
      <article class="card lift result-card reveal">
        <img src="${r.photo}" alt="${esc(r.studentName)}" loading="lazy">
        <div>
          <h4>${esc(r.studentName)}</h4>
          <div class="rank">${esc(r.rankOrScore)}</div>
          <div class="exam">${esc(r.exam)}</div>
          <q>${esc(r.quote)}</q>
        </div>
      </article>`;
  }

  function swipeRow(id, itemsHtml) {
    return `<div class="row-wrap"><div class="swipe" id="${id}">${itemsHtml}</div></div>`;
  }
  function rowArrows(id) {
    return `<div class="row-arrows">
      <button class="arrow" data-action="scroll-row" data-row="${id}" data-dir="-1" aria-label="Previous">${icon('chevronLeft')}</button>
      <button class="arrow" data-action="scroll-row" data-row="${id}" data-dir="1" aria-label="Next">${icon('chevronRight')}</button>
    </div>`;
  }

  /* ---------------------------------------------------------
     9. Public pages
     --------------------------------------------------------- */
  function viewHome(ctx) {
    const featured = db.courses.filter((c) => c.isFeatured).slice(0, 4);
    const popular = ['JEE', 'NEET', 'UPSC', 'CA', 'SSC', 'Banking'];
    const features = [
      ['video', 'Live online classes', 'Interactive HD lectures with live Q&A, from the comfort of your home.'],
      ['layers', 'Recorded lectures', 'Every class is recorded, with notes, so you can revise any time.'],
      ['file', 'Online test series', 'Exam-pattern mock tests with All-India ranking and detailed analysis.'],
      ['help', 'Doubt support', 'Ask doubts by photo or chat and get answers from subject experts.']
    ];

    return `
      <section class="hero">
        <div class="container">
          <span class="pill reveal"><span class="live"></span> 100% online learning platform</span>
          <h1 class="reveal">Prepare for any exam, online, with India's best educators</h1>
          <p class="reveal">Live classes, structured test series and personal doubt support for 12 exam categories.</p>
          <form class="search-box reveal" data-form="hero-search">
            <span style="display:grid;place-items:center;padding-left:8px;color:var(--ink-faint)">${icon('search')}</span>
            <input name="q" placeholder="Search exams or courses (e.g. SSC CGL, CA Foundation)" aria-label="Search courses">
            <button class="btn btn-dark" type="submit">Search</button>
          </form>
          <div class="popular reveal"><strong>Popular:</strong>
            ${popular.map((p) => { const c = CATEGORIES.find((x) => x.name === p); return `<a class="chip" href="#/courses?category=${c ? c.id : ''}">${p}</a>`; }).join('')}
          </div>
          <div class="hero-actions reveal">
            ${ctx.user ? `<a href="${ctx.user.role === 'ADMIN' ? '#/admin' : '#/home'}" class="btn btn-cta">Go to My Home</a>` : '<a href="#/auth?mode=signup" class="btn btn-cta">Get Started</a>'}
            <button class="btn btn-outline" data-action="book-demo">Book Free Demo</button>
          </div>
        </div>
      </section>

      <section class="stats-band">
        <div class="container stats-grid">
          ${SITE.stats.map((s) => `<div class="stat"><strong data-count="${s.value}" data-suffix="${s.suffix}">0</strong><span>${esc(s.label)}</span></div>`).join('')}
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="sec-head reveal"><div><span class="eyebrow">Exam categories</span><h2>What are you preparing for?</h2></div></div>
          <div class="grid grid-2">${CATEGORIES.map((c, i) => categoryCard(c, i >= 6)).join('')}</div>
          <div style="text-align:center;margin-top:24px"><button class="btn btn-outline" data-action="show-all-cats" id="show-cats">View all categories (${CATEGORIES.length})</button></div>
        </div>
      </section>

      <section class="section alt">
        <div class="container">
          <div class="sec-head reveal"><div><span class="eyebrow">Live online cohorts</span><h2>Popular courses</h2></div><a href="#/courses" class="link">Browse all courses ${icon('arrowRight', 16)}</a></div>
          <div class="grid grid-2">${featured.map((c) => `<div class="reveal">${courseCard(c)}</div>`).join('')}</div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="sec-head reveal"><div><span class="eyebrow">Why Learnist</span><h2>Everything you need, in one place</h2></div></div>
          <div class="grid grid-4">${features.map(([ic, t, d]) => `<div class="card feature reveal"><div class="ic">${icon(ic, 22)}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>
        </div>
      </section>

      <section class="section alt">
        <div class="container">
          <div class="sec-head reveal"><div><span class="eyebrow">Results</span><h2>Our students, their ranks</h2></div><a href="#/results" class="link">See all results ${icon('arrowRight', 16)}</a></div>
          <div class="grid grid-2">${RESULTS.slice(0, 4).map(resultCard).join('')}</div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="cta-band reveal">
            <div><h2>Start your preparation today</h2><p>Join a live online batch or try a free demo class first.</p></div>
            <div class="btn-row">
              <button class="btn btn-outline" style="background:transparent;color:#fff;border-color:#fff" data-action="book-demo">Book Free Demo</button>
              <a href="${ctx.user ? '#/courses' : '#/auth?mode=signup'}" class="btn btn-cta">Get Started</a>
            </div>
          </div>
        </div>
      </section>`;
  }

  /* --- Courses --- */
  const PRICE_BUCKETS = { 'under-5k': [0, 5000], '5k-15k': [5000, 15000], 'above-15k': [15000, Infinity] };
  const PAGE_SIZE = 8;

  function viewCourses(ctx) {
    const q = ctx.query;
    const f = {
      q: q.get('q') || '', category: q.get('category') || '', track: q.get('track') || '',
      level: q.get('level') || '', type: q.get('type') || '', price: q.get('price') || '',
      sort: q.get('sort') || 'popular', page: parseInt(q.get('page') || '1', 10)
    };

    let list = db.courses.filter((c) => {
      if (f.category && c.categoryId !== f.category) return false;
      if (f.track && c.trackId !== f.track) return false;
      if (f.level && c.level !== f.level) return false;
      if (f.type && c.type !== f.type) return false;
      if (f.price && PRICE_BUCKETS[f.price]) {
        const [min, max] = PRICE_BUCKETS[f.price];
        if (c.price < min || c.price >= max) return false;
      }
      if (f.q) {
        const cat = category(c.categoryId);
        const hay = (c.title + ' ' + c.description + ' ' + (cat ? cat.name : '')).toLowerCase();
        if (!f.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    if (f.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
    else if (f.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
    else list.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));

    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    const page = Math.min(Math.max(1, f.page), pages);
    const shown = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const cat = category(f.category);
    const opt = (value, label, current) => `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`;
    const anyFilter = f.q || f.category || f.track || f.level || f.type || f.price;

    return `
      ${pageHead('Courses', 'Explore all online courses', 'Filter by exam, level and format. Every course includes live online classes, test series and doubt support.',
        `<form class="search-box" style="margin:0;max-width:380px;width:100%" data-form="course-search">
          <input name="q" value="${esc(f.q)}" placeholder="Search courses..." aria-label="Search courses">
          <button class="btn btn-dark btn-sm" type="submit">Search</button>
        </form>`)}
      <div class="container listing">
        <aside class="card filters">
          <h3>Filters ${anyFilter ? '<a href="#/courses" class="link" style="font-size:13px">Clear all</a>' : ''}</h3>
          <div class="field"><label>Exam category</label>
            <select class="input" data-filter="category">${opt('', 'All categories', f.category)}${CATEGORIES.map((c) => opt(c.id, c.name, f.category)).join('')}</select></div>
          ${cat ? `<div class="field"><label>Sub-track</label>
            <select class="input" data-filter="track">${opt('', 'All ' + esc(cat.name) + ' tracks', f.track)}${cat.tracks.map((t) => opt(t.id, t.name, f.track)).join('')}</select></div>` : ''}
          <div class="field"><label>Level</label>
            <select class="input" data-filter="level">${opt('', 'All levels', f.level)}${Object.keys(LEVEL_LABEL).map((k) => opt(k, LEVEL_LABEL[k], f.level)).join('')}</select></div>
          <div class="field"><label>Course format</label>
            <select class="input" data-filter="type">${opt('', 'All formats', f.type)}${Object.keys(TYPE_LABEL).map((k) => opt(k, TYPE_LABEL[k], f.type)).join('')}</select></div>
          <div class="field"><label>Price</label>
            <select class="input" data-filter="price">${opt('', 'Any price', f.price)}${opt('under-5k', 'Under ₹5,000', f.price)}${opt('5k-15k', '₹5,000 - ₹15,000', f.price)}${opt('above-15k', 'Above ₹15,000', f.price)}</select></div>
          <div class="field"><label>Sort by</label>
            <select class="input" data-filter="sort">${opt('popular', 'Most popular', f.sort)}${opt('price-asc', 'Price: low to high', f.sort)}${opt('price-desc', 'Price: high to low', f.sort)}</select></div>
        </aside>
        <div>
          <div class="card result-bar"><span>Showing ${list.length} course${list.length === 1 ? '' : 's'}${cat ? ' in ' + esc(cat.name) : ''}</span></div>
          ${shown.length ? `<div class="grid grid-2">${shown.map((c) => courseCard(c)).join('')}</div>` :
            `<div class="card empty"><h3>No courses match these filters</h3><p>Try removing a filter or searching for something else.</p><a href="#/courses" class="btn btn-dark btn-sm" style="margin-top:14px">Clear filters</a></div>`}
          ${pages > 1 ? `<div class="pager">${Array.from({ length: pages }, (_, i) => `<button class="${i + 1 === page ? 'active' : ''}" data-action="page" data-page="${i + 1}">${i + 1}</button>`).join('')}</div>` : ''}
        </div>
      </div>`;
  }

  function setQuery(changes) {
    const { path, query } = parseHash();
    Object.keys(changes).forEach((k) => {
      if (changes[k]) query.set(k, changes[k]); else query.delete(k);
    });
    const qs = query.toString();
    go(path + (qs ? '?' + qs : ''));
  }

  /* --- Course detail --- */
  function viewCourseDetail(ctx) {
    const c = course(ctx.params.slug);
    if (!c) return viewNotFound();
    const cat = category(c.categoryId);
    const tr = track(c.trackId);
    const teachers = (c.facultyIds || []).map(teacher).filter(Boolean);
    const upcoming = db.batches.filter((b) => b.courseId === c.id);
    const faqs = FAQS.filter((q) => ['fees', 'refunds', 'online_classes', 'devices'].includes(q.topic)).slice(0, 4);
    const subjects = [...new Set((c.subjectIds || []).map((id) => SUBJECTS[id]).filter(Boolean))];

    return `
      ${pageHead(`<a href="#/courses">Courses</a> &nbsp;/&nbsp; ${esc(cat ? cat.name : '')}`, esc(c.title),
        `${TYPE_LABEL[c.type]} &middot; ${LEVEL_LABEL[c.level]} &middot; ${esc(c.duration)}${tr ? ' &middot; ' + esc(tr.name) : ''}`)}
      <div class="container detail">
        <div class="detail-main">
          <section class="card reveal"><h2>Overview</h2><p class="muted">${esc(c.description)}</p>
            <div class="chips" style="margin-top:14px">${subjectBadges(c.subjectIds)}</div>
            <div class="kpis">
              <div class="kpi"><strong>${c.totalHours || '-'}</strong><span>Hours of live class</span></div>
              <div class="kpi"><strong>${c.totalTests || '-'}</strong><span>Online tests</span></div>
              <div class="kpi"><strong>${esc(c.duration)}</strong><span>Duration</span></div>
            </div>
          </section>
          <section class="card reveal"><h2>What you get</h2>
            <ul class="check-list">${(c.highlights || []).map((h) => `<li>${icon('check')} ${esc(h)}</li>`).join('')}</ul></section>
          <section class="card reveal"><h2>Syllabus</h2>
            <div class="accordion">${subjects.map((s, i) => `
              <details ${i === 0 ? 'open' : ''}><summary>${esc(s.name)}</summary>
                <ul><li>Concept lectures, live and recorded</li><li>Daily practice problems with solutions</li><li>Chapter-wise and full-length tests</li><li>Revision notes and previous year questions</li></ul>
              </details>`).join('')}</div></section>
          ${teachers.length ? `<section class="card reveal"><h2>Your educators</h2><div class="mini-list">${teachers.map((f) => `
            <a class="mini" href="#/faculty/${f.id}"><img src="${f.photo}" alt=""><div><strong>${esc(f.name)}</strong><span>${esc(f.experience)}</span></div>${icon('chevronRight')}</a>`).join('')}</div></section>` : ''}
          <section class="card reveal"><h2>Upcoming batches</h2>
            ${upcoming.length ? `<div class="grid grid-2">${upcoming.map((b) => batchCard(b)).join('')}</div>` : '<p class="muted">New batches for this course will be announced soon. Book a demo to get notified.</p>'}</section>
          <section class="card reveal"><h2>Frequently asked questions</h2>
            <div class="accordion">${faqs.map((q) => `<details><summary>${esc(q.question)}</summary><p>${esc(q.answer)}</p></details>`).join('')}</div></section>
        </div>
        <aside class="card side-card">
          <div class="price"><small>Total fee</small><strong>${inr(c.price)}</strong>${c.originalPrice ? `<s>${inr(c.originalPrice)}</s>` : ''}</div>
          ${c.originalPrice ? `<span class="status ok" style="justify-self:start">Save ${Math.round((1 - c.price / c.originalPrice) * 100)}%</span>` : ''}
          <button class="btn btn-cta btn-block" data-action="enroll" data-course="${c.id}">Enroll Now</button>
          <button class="btn btn-outline btn-block" data-action="book-demo" data-course="${c.id}">Book Free Demo</button>
          <ul class="check-list" style="font-size:14px;margin-top:6px">
            <li>${icon('check')} 7-day refund policy</li><li>${icon('check')} Access on phone, tablet and laptop</li><li>${icon('check')} Doubt support included</li>
          </ul>
        </aside>
      </div>`;
  }

  /* --- Faculty --- */
  function viewFaculty(ctx) {
    const catId = ctx.query.get('category') || '';
    const q = (ctx.query.get('q') || '').toLowerCase();
    const list = FACULTY.filter((f) => (!catId || f.categoryIds.includes(catId)) && (!q || f.name.toLowerCase().includes(q)));
    const usedCats = CATEGORIES.filter((c) => FACULTY.some((f) => f.categoryIds.includes(c.id)));
    return `
      ${pageHead('Faculty', 'Learn from top online educators', 'Experienced teachers who specialise in online teaching. Pick an educator and book a demo class with them.',
        `<form class="search-box" style="margin:0;max-width:340px;width:100%" data-form="faculty-search">
          <input name="q" value="${esc(ctx.query.get('q') || '')}" placeholder="Search by name..." aria-label="Search faculty">
          <button class="btn btn-dark btn-sm" type="submit">Search</button>
        </form>`)}
      <section class="section" style="padding-top:32px">
        <div class="container">
          <div class="chips" style="margin-bottom:24px">
            <a class="chip ${!catId ? 'active' : ''}" href="#/faculty">All</a>
            ${usedCats.map((c) => `<a class="chip ${catId === c.id ? 'active' : ''}" href="#/faculty?category=${c.id}">${esc(c.name)}</a>`).join('')}
          </div>
          ${list.length ? `<div class="grid grid-3">${list.map(facultyCard).join('')}</div>` : '<div class="card empty"><h3>No educators found</h3><p>Try a different name or category.</p></div>'}
        </div>
      </section>`;
  }

  function viewFacultyProfile(ctx) {
    const f = teacher(ctx.params.id);
    if (!f) return viewNotFound();
    const taught = db.courses.filter((c) => (c.facultyIds || []).includes(f.id));
    const theirBatches = db.batches.filter((b) => b.facultyId === f.id);
    return `
      <section class="page-head"><div class="container">
        <div class="crumbs"><a href="#/">Home</a> &nbsp;/&nbsp; <a href="#/faculty">Faculty</a> &nbsp;/&nbsp; ${esc(f.name)}</div>
        <div class="profile-head">
          <img src="${f.photo}" alt="${esc(f.name)}">
          <div>
            <h1 style="font-size:32px">${esc(f.name)}</h1>
            <p style="font-weight:600;margin:4px 0">${esc(f.experience)}</p>
            <p class="muted">${esc(f.qualifications)}</p>
            <div class="chips" style="margin:12px 0">${subjectBadges(f.subjectIds)}</div>
            <button class="btn btn-cta" data-action="book-demo" data-course="${taught[0] ? taught[0].id : ''}">Book a demo class with ${esc(f.name.split(' ').slice(0, 2).join(' '))}</button>
          </div>
        </div>
      </div></section>
      <section class="section" style="padding-top:40px"><div class="container" style="display:grid;gap:40px">
        <div class="card reveal" style="padding:26px"><h2 style="font-size:20px;margin-bottom:10px">About</h2><p class="muted">${esc(f.bio)}</p></div>
        <div><div class="sec-head"><h2>Courses taught</h2></div>
          ${taught.length ? `<div class="grid grid-2">${taught.slice(0, 6).map((c) => courseCard(c)).join('')}</div>` : '<p class="muted">No courses listed right now.</p>'}</div>
        ${theirBatches.length ? `<div><div class="sec-head"><h2>Upcoming batches</h2></div><div class="grid grid-3">${theirBatches.map((b) => batchCard(b)).join('')}</div></div>` : ''}
      </div></section>`;
  }

  /* --- Results --- */
  function viewResults(ctx) {
    const cat = ctx.query.get('category') || '';
    const year = ctx.query.get('year') || '';
    const cats = [...new Set(RESULTS.map((r) => r.category))];
    const years = [...new Set(RESULTS.map((r) => r.year))].sort((a, b) => b - a);
    const list = RESULTS.filter((r) => (!cat || r.category === cat) && (!year || String(r.year) === year));
    const link = (c, y) => '#/results' + ((c || y) ? '?' + new URLSearchParams(Object.entries({ category: c, year: y }).filter(([, v]) => v)).toString() : '');
    return `
      ${pageHead('Results', 'Hall of fame', 'Real ranks achieved by students who prepared completely online with Learnist.')}
      <section class="stats-band"><div class="container stats-grid">
        <div class="stat"><strong data-count="${RESULTS.length * 40}" data-suffix="+">0</strong><span>Selections this year</span></div>
        <div class="stat"><strong data-count="${cats.length}" data-suffix="">0</strong><span>Exams with toppers</span></div>
        <div class="stat"><strong data-count="18" data-suffix="">0</strong><span>Top-100 ranks</span></div>
        <div class="stat"><strong data-count="96" data-suffix="%">0</strong><span>Students recommend us</span></div>
      </div></section>
      <section class="section"><div class="container">
        <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:24px">
          <div class="chips"><a class="chip ${!cat ? 'active' : ''}" href="${link('', year)}">All exams</a>
            ${cats.map((c) => `<a class="chip ${cat === c ? 'active' : ''}" href="${link(c, year)}">${esc(c)}</a>`).join('')}</div>
          <div class="chips">${years.map((y) => `<a class="chip ${year === String(y) ? 'active' : ''}" href="${link(cat, year === String(y) ? '' : y)}">${y}</a>`).join('')}</div>
        </div>
        ${list.length ? `<div class="grid grid-2">${list.map(resultCard).join('')}</div>` : '<div class="card empty"><h3>No results for this filter</h3></div>'}
      </div></section>`;
  }

  /* --- Batches --- */
  function timeOfDay(b) {
    const m = b.scheduleTime.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)/i);
    if (!m) return '';
    let h = parseInt(m[1], 10) % 12;
    if (m[3].toUpperCase() === 'PM') h += 12;
    return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  }
  const isWeekend = (b) => /sat|sun/i.test(b.scheduleDays) && !/mon|tue|wed|thu|fri/i.test(b.scheduleDays);

  function viewBatches(ctx) {
    const catId = ctx.query.get('category') || '';
    const time = ctx.query.get('time') || '';
    const list = db.batches.filter((b) => {
      const c = course(b.courseId);
      if (catId && (!c || c.categoryId !== catId)) return false;
      if (time === 'weekend') return isWeekend(b);
      if (time && timeOfDay(b) !== time) return false;
      return true;
    }).sort((a, b) => a.startDate.localeCompare(b.startDate));
    const opt = (value, label, current) => `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`;
    return `
      ${pageHead('Batches', 'Upcoming live online batches', 'Pick a start date and a timing that fits your day. Seats are limited in every batch.')}
      <div class="container listing">
        <aside class="card filters">
          <h3>Filters ${catId || time ? '<a href="#/batches" class="link" style="font-size:13px">Clear all</a>' : ''}</h3>
          <div class="field"><label>Exam category</label>
            <select class="input" data-filter="category">${opt('', 'All categories', catId)}${CATEGORIES.map((c) => opt(c.id, c.name, catId)).join('')}</select></div>
          <div class="field"><label>Timing</label>
            <select class="input" data-filter="time">${opt('', 'Any time', time)}${opt('morning', 'Morning', time)}${opt('afternoon', 'Afternoon', time)}${opt('evening', 'Evening', time)}${opt('weekend', 'Weekend only', time)}</select></div>
        </aside>
        <div>
          <div class="card result-bar"><span>${list.length} batch${list.length === 1 ? '' : 'es'} found</span></div>
          ${list.length ? `<div class="grid grid-2">${list.map((b) => batchCard(b)).join('')}</div>` : '<div class="card empty"><h3>No batches match</h3><p>Try another timing or category.</p></div>'}
        </div>
      </div>`;
  }

  /* --- Contact --- */
  function viewContact(ctx) {
    const u = ctx.user;
    return `
      ${pageHead('Contact', 'Talk to an academic counsellor', 'Questions about courses, fees or batches? Send us a message and we will call you back within 24 hours.')}
      <div class="container detail">
        <form class="card form" style="padding:28px" data-form="enquiry" novalidate>
          <h2 style="font-size:20px">Send an enquiry</h2>
          <div class="grid grid-2" style="gap:14px">
            <div class="field"><label>Full name</label><input class="input" name="name" value="${esc(u ? u.name : '')}" required></div>
            <div class="field"><label>Phone</label><input class="input" name="phone" placeholder="+91" required></div>
          </div>
          <div class="field"><label>Email</label><input class="input" name="email" type="email" value="${esc(u ? u.email : '')}" required></div>
          <div class="field"><label>Exam</label><select class="input" name="categoryId"><option value="">Select exam</option>${CATEGORIES.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Message</label><textarea class="input" name="message" rows="4" required></textarea></div>
          <button class="btn btn-cta" type="submit">Send Enquiry</button>
        </form>
        <aside style="display:grid;gap:20px">
          <div class="card" style="padding:24px;display:grid;gap:12px">
            <h3 style="font-size:17px">Reach us directly</h3>
            <a href="tel:${SITE.phone.replace(/\s/g, '')}" style="display:flex;gap:10px;align-items:center">${icon('phone')} ${SITE.phone}</a>
            <a href="mailto:${SITE.email}" style="display:flex;gap:10px;align-items:center">${icon('mail')} ${SITE.email}</a>
            <span class="muted" style="display:flex;gap:10px;align-items:center">${icon('clock')} Mon - Sun, 8 AM - 10 PM</span>
          </div>
          <div class="card accordion" style="padding:8px 24px">${FAQS.slice(0, 5).map((q) => `<details><summary>${esc(q.question)}</summary><p>${esc(q.answer)}</p></details>`).join('')}</div>
        </aside>
      </div>`;
  }

  function viewNotFound() {
    return `<section class="section"><div class="container empty" style="padding:100px 20px">
      <span class="eyebrow">404</span><h1 style="font-size:40px;margin:10px 0">Page not found</h1>
      <p>The page you are looking for doesn't exist or was moved.</p>
      <a href="#/" class="btn btn-dark" style="margin-top:20px">Back to Home</a></div></section>`;
  }

  /* ---------------------------------------------------------
     10. Demo booking modal + enroll / join
     --------------------------------------------------------- */
  function openDemoModal(courseId, batchId) {
    const user = currentUser();
    const profile = profileOf(user);
    let selected = courseId || '';
    if (!selected && profile) {
      const c = db.courses.find((x) => x.categoryId === profile.categoryId);
      if (c) selected = c.id;
    }
    const tomorrow = isoDate(addDays(new Date(), 1));
    openModal(`
      <div class="modal-head"><div><h3>Book a free demo class</h3><p class="muted" style="font-size:14px">Attend one live online class before you enroll.</p></div>
        <button class="icon-btn" data-action="close-modal" aria-label="Close">${icon('x')}</button></div>
      <form class="form" data-form="demo" novalidate>
        <input type="hidden" name="batchId" value="${esc(batchId || '')}">
        <div class="field"><label>Full name</label><input class="input" name="name" value="${esc(user ? user.name : '')}" required></div>
        <div class="field"><label>Phone</label><input class="input" name="phone" placeholder="+91" required></div>
        <div class="field"><label>Course</label><select class="input" name="courseId" required>
          <option value="">Choose a course</option>
          ${CATEGORIES.map((cat) => `<optgroup label="${esc(cat.name)}">${db.courses.filter((c) => c.categoryId === cat.id).map((c) => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</optgroup>`).join('')}
        </select></div>
        <div class="grid grid-2" style="gap:12px">
          <div class="field"><label>Preferred date</label><input class="input" type="date" name="date" min="${tomorrow}" value="${tomorrow}" required></div>
          <div class="field"><label>Time slot</label><select class="input" name="slot"><option>Morning (8 - 10 AM)</option><option>Afternoon (2 - 4 PM)</option><option selected>Evening (6 - 8 PM)</option></select></div>
        </div>
        <button class="btn btn-cta" type="submit">Confirm Demo Booking</button>
      </form>`);
  }

  function enroll(courseId) {
    const user = currentUser();
    if (!user) { toast('Please log in to enroll'); return go('/auth?mode=signup&next=' + encodeURIComponent('/courses/' + (course(courseId) || {}).slug)); }
    if (user.role === 'ADMIN') return toast('Admins cannot enroll in courses', 'error');
    const p = profileOf(user);
    if (!p) return go('/onboarding');
    p.courseIds = p.courseIds || [];
    if (p.courseIds.includes(courseId)) return toast('You are already enrolled in this course');
    p.courseIds.push(courseId);
    saveDb();
    toast('Enrolled! Your course is now on your home page.');
  }

  function joinBatch(batchId) {
    const user = currentUser();
    const b = batch(batchId);
    if (!user) { toast('Please log in to join a batch'); return go('/auth?mode=signup&next=/batches'); }
    if (user.role === 'ADMIN') return toast('Admins cannot join batches', 'error');
    const p = profileOf(user);
    if (!p) return go('/onboarding');
    p.batchIds = p.batchIds || [];
    if (p.batchIds.includes(batchId)) return toast('You have already joined this batch');
    if (!b || isFull(b)) return toast('This batch is full', 'error');
    p.batchIds.push(batchId);
    b.enrolledCount += 1;
    saveDb();
    toast('Joined ' + b.name);
    render();
  }

  /* ---------------------------------------------------------
     11. Auth page (login / signup / Google / phone OTP)
     --------------------------------------------------------- */
  const authState = { mode: 'login', phoneStep: 0, phone: '', timer: 0, next: '' };
  let otpTimer = null;

  function viewAuth(ctx) {
    if (ctx.user) { setTimeout(() => routeAfterLogin(ctx.user, ctx.query.get('next')), 0); return ''; }
    authState.mode = ctx.query.get('mode') === 'signup' ? 'signup' : 'login';
    authState.next = ctx.query.get('next') || '';
    authState.phoneStep = 0;
    const floaties = [['atom', 12, 18, 0], ['book', 70, 12, 1.5], ['ledger', 20, 62, 3], ['building', 75, 55, 2], ['scales', 45, 82, 4]];
    onMount(renderAuthCard);
    return `
      <div class="auth">
        <aside class="auth-side">
          ${logo()}
          <div>
            <h2>Your exam. Your pace. Online.</h2>
            <p>Live classes, test series and a study plan built around your goals. Join thousands of students preparing with Learnist.</p>
          </div>
          <span class="muted" style="font-size:13px;color:#94A3B8">&copy; Learnist Academy</span>
          ${floaties.map(([ic, x, y, d]) => `<span class="floaty" style="left:${x}%;top:${y}%;animation-delay:${d}s">${icon(ic)}</span>`).join('')}
        </aside>
        <main class="auth-main"><div class="card auth-card" id="auth-card"></div></main>
      </div>`;
  }

  function renderAuthCard() {
    const card = $('#auth-card');
    if (!card) return;
    const signup = authState.mode === 'signup';
    let phoneBlock = '';
    if (authState.phoneStep === 1) {
      phoneBlock = `
        <form class="form" data-form="send-otp" novalidate style="margin-top:12px">
          <div class="phone-row"><span>+91</span><input class="input" name="phone" inputmode="numeric" maxlength="10" placeholder="10-digit mobile number" autofocus></div>
          <button class="btn btn-dark" type="submit">Send OTP</button>
        </form>`;
    } else if (authState.phoneStep === 2) {
      phoneBlock = `
        <form class="form" data-form="verify-otp" novalidate style="margin-top:12px">
          <p class="muted" style="font-size:14px">Enter the 6-digit code sent to +91 ${esc(authState.phone)}</p>
          <div class="otp">${[0, 1, 2, 3, 4, 5].map((i) => `<input class="input" maxlength="1" inputmode="numeric" data-otp="${i}" style="animation-delay:${i * 50}ms">`).join('')}</div>
          <button class="btn btn-dark" type="submit">Verify</button>
          <p class="note" id="otp-timer"></p>
        </form>`;
    }

    card.innerHTML = `
      <h2 style="font-size:24px">${signup ? 'Create your account' : 'Welcome back'}</h2>
      <p class="muted" style="margin:4px 0 20px;font-size:14.5px">${signup ? 'Start your preparation in under a minute.' : 'Log in to continue your preparation.'}</p>
      <div class="tabs"><button class="${!signup ? 'active' : ''}" data-action="auth-tab" data-mode="login">Log In</button>
        <button class="${signup ? 'active' : ''}" data-action="auth-tab" data-mode="signup">Sign Up</button>
        <span class="bar" style="transform:translateX(${signup ? '100%' : '0'})"></span></div>
      <div class="social">
        <button class="btn" data-action="google-login">${GOOGLE_ICON} Continue with Google</button>
        <button class="btn" data-action="phone-login">${icon('phone')} Continue with Phone</button>
      </div>
      ${phoneBlock}
      <div class="divider">or continue with email</div>
      <form class="form" data-form="${signup ? 'signup' : 'login'}" novalidate>
        ${signup ? '<div class="field"><label>Full name</label><input class="input" name="name" autocomplete="name"></div>' : ''}
        <div class="field"><label>Email</label><input class="input" name="email" type="email" autocomplete="email"></div>
        <div class="field"><label>Password</label>
          <div class="pw-wrap"><input class="input" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}">
            <button type="button" data-action="toggle-pw" aria-label="Show password">${icon('eye')}</button></div>
          ${signup ? '<div class="strength"><i id="pw-strength" style="width:0"></i></div>' : '<a href="#" data-action="forgot" class="link" style="justify-self:end;font-size:13px;font-weight:500">Forgot password?</a>'}
        </div>
        ${signup ? '<div class="field"><label>Confirm password</label><input class="input" name="confirm" type="password" autocomplete="new-password"></div>' : ''}
        <button class="btn btn-cta" type="submit" id="auth-submit">${signup ? 'Create Account' : 'Log In'}</button>
      </form>
      <p class="note" style="margin-top:18px">Demo: student@learnist.com / Student@123 &middot; OTP 123456</p>`;

    if (authState.phoneStep === 2) startOtpTimer();
  }

  function startOtpTimer() {
    clearInterval(otpTimer);
    authState.timer = 30;
    const tick = () => {
      const el = $('#otp-timer');
      if (!el) return clearInterval(otpTimer);
      el.innerHTML = authState.timer > 0 ? 'Resend code in ' + authState.timer + 's' : '<a href="#" data-action="resend-otp" class="link">Resend code</a>';
      authState.timer -= 1;
      if (authState.timer < -1) clearInterval(otpTimer);
    };
    tick();
    otpTimer = setInterval(tick, 1000);
  }

  function showFieldError(form, name, message) {
    const input = form.elements[name];
    if (!input) return;
    input.classList.add('error');
    const holder = input.closest('.field') || input.parentElement;
    if (!holder.querySelector('.err-msg')) holder.insertAdjacentHTML('beforeend', `<span class="err-msg">${esc(message)}</span>`);
  }
  function clearErrors(form) {
    $$('.err-msg', form).forEach((e) => e.remove());
    $$('.error', form).forEach((e) => e.classList.remove('error'));
  }
  function shake(el) {
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }
  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  function finishLogin(user, button) {
    if (button) { button.disabled = true; button.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;margin:0"></span>'; }
    setTimeout(() => {
      if (button) button.innerHTML = icon('check') + ' Done';
      setTimeout(() => {
        signIn(user);
        toast('Welcome, ' + user.name.split(' ')[0] + '!');
        routeAfterLogin(user, authState.next);
      }, 350);
    }, 600);
  }

  function findOrCreateUser(email, name, extra) {
    let user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      user = { id: uid('u'), name, email, role: 'STUDENT', createdAt: new Date().toISOString(), ...extra };
      db.users.push(user);
      saveDb();
    }
    return user;
  }

  /* ---------------------------------------------------------
     12. Onboarding (6 steps)
     --------------------------------------------------------- */
  const STAGES = ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12', 'Dropper', 'Graduate', 'Working Professional'];
  const EXAMS_FOR_STAGE = {
    'Class 8': ['foundation'], 'Class 9': ['foundation'], 'Class 10': ['foundation'],
    'Class 11': ['jee', 'neet'], 'Class 12': ['jee', 'neet', 'ca', 'law', 'defence'], 'Dropper': ['jee', 'neet', 'law', 'defence'],
    'Graduate': ['upsc', 'ssc', 'banking', 'railways', 'defence', 'teaching', 'state-psc', 'ca', 'law'],
    'Working Professional': ['upsc', 'ssc', 'banking', 'railways', 'teaching', 'state-psc', 'ca']
  };
  const LEVELS = [
    ['BEGINNER', 'Beginner', 'Just starting, need to build basics'],
    ['INTERMEDIATE', 'Intermediate', 'Know the basics, need practice'],
    ['ADVANCED', 'Advanced', 'Strong basics, want tests and speed']
  ];
  let ob = null;

  function viewOnboarding(ctx) {
    const existing = ctx.profile;
    ob = {
      step: 1,
      next: ctx.query.get('next') || '',
      data: existing ? JSON.parse(JSON.stringify(existing)) : { stage: '', categoryId: '', trackId: '', targetYear: 0, subjects: [], weakSubjects: [], level: '', hours: 3 }
    };
    onMount(renderOnboarding);
    return '<div class="onboard" id="onboard"></div>';
  }

  function renderOnboarding() {
    const el = $('#onboard');
    if (!el || !ob) return;
    const d = ob.data;
    const total = 6;
    let title = '', why = '', body = '', canNext = false;

    if (ob.step === 1) {
      title = 'Which class or stage are you in?';
      why = 'This helps us show only the exams that make sense for you.';
      body = `<div class="options">${STAGES.map((s) => `<button class="option ${d.stage === s ? 'selected' : ''}" data-action="ob-pick" data-key="stage" data-value="${s}">${s}</button>`).join('')}</div>`;
      canNext = !!d.stage;
    } else if (ob.step === 2) {
      const allowed = EXAMS_FOR_STAGE[d.stage] || CATEGORIES.map((c) => c.id);
      const cat = category(d.categoryId);
      title = 'Which exam are you preparing for?';
      why = 'We match your courses, batches and study plan to this exam.';
      body = `<div class="options">${allowed.map(category).filter(Boolean).map((c) => `
          <button class="option ${d.categoryId === c.id ? 'selected' : ''}" data-action="ob-pick" data-key="categoryId" data-value="${c.id}">
            <span style="color:${c.accent}">${icon(c.icon, 22)}</span>${esc(c.name)}<small>${esc(c.description)}</small></button>`).join('')}</div>
        ${cat ? `<p style="font-weight:600;margin:24px 0 10px">Choose your track</p>
          <div class="chips">${cat.tracks.map((t) => `<button class="chip ${d.trackId === t.id ? 'active' : ''}" data-action="ob-pick" data-key="trackId" data-value="${t.id}">${esc(t.name)}</button>`).join('')}</div>` : ''}`;
      canNext = !!(d.categoryId && d.trackId);
    } else if (ob.step === 3) {
      const y = new Date().getFullYear();
      title = 'When is your target exam?';
      why = 'Your timeline decides whether we suggest long-term courses or crash courses.';
      body = `<div class="options">${[y, y + 1, y + 2, y + 3, y + 4].map((yr) => `<button class="option ${d.targetYear === yr ? 'selected' : ''}" data-action="ob-pick" data-key="targetYear" data-value="${yr}">${yr}</button>`).join('')}</div>`;
      canNext = !!d.targetYear;
    } else if (ob.step === 4) {
      const cat = category(d.categoryId);
      title = 'Pick your subjects';
      why = 'Tap once to select. Tap again to mark it as a weak subject; we give weak subjects more time.';
      body = `<div class="options">${(cat ? cat.subjects : []).map((s) => {
          const weak = d.weakSubjects.includes(s.id);
          const sel = d.subjects.includes(s.id);
          return `<button class="option ${weak ? 'weak' : sel ? 'selected' : ''}" data-action="ob-subject" data-value="${s.id}">
            <span style="display:flex;align-items:center;gap:8px"><span class="dot" style="width:9px;height:9px;border-radius:50%;background:${s.color}"></span>${esc(s.name)}</span>
            <small>${weak ? 'Weak subject - extra time' : sel ? 'Selected' : 'Tap to select'}</small></button>`;
        }).join('')}</div>`;
      canNext = d.subjects.length > 0;
    } else if (ob.step === 5) {
      title = 'How would you rate your current level?';
      why = 'Beginners start with foundation courses; advanced students get more tests.';
      body = `<div class="options">${LEVELS.map(([k, label, desc]) => `<button class="option ${d.level === k ? 'selected' : ''}" data-action="ob-pick" data-key="level" data-value="${k}">${label}<small>${desc}</small></button>`).join('')}</div>`;
      canNext = !!d.level;
    } else if (ob.step === 6) {
      const pace = d.hours <= 2 ? 'Light pace' : d.hours <= 4 ? 'Steady pace' : d.hours <= 6 ? 'Strong pace' : 'Intensive pace';
      title = 'How many hours can you study each day?';
      why = 'We size your daily study plan to fit this time.';
      body = `<div class="range-label" id="hours-label">${d.hours} hr${d.hours > 1 ? 's' : ''}/day &mdash; ${pace}</div>
        <input type="range" class="range" min="1" max="10" value="${d.hours}" data-input="ob-hours">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--ink-faint);margin-top:6px"><span>1 hr</span><span>10 hrs</span></div>`;
      canNext = true;
    } else {
      el.innerHTML = `<div class="card building">
        <div class="spinner"></div><h2 style="margin-top:20px">Building your personalized plan...</h2>
        <ul><li id="b1">${icon('check')} Matching courses</li><li id="b2">${icon('check')} Finding your batches</li><li id="b3">${icon('check')} Creating your study plan</li></ul></div>`;
      ['b1', 'b2', 'b3'].forEach((id, i) => setTimeout(() => { const li = $('#' + id); if (li) li.classList.add('done'); }, 500 + i * 550));
      setTimeout(finishOnboarding, 2300);
      return;
    }

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:14px;color:var(--ink-soft)"><span>Step ${ob.step} of ${total}</span><span>${Math.round(((ob.step - 1) / total) * 100)}% done</span></div>
      <div class="steps-bar"><i style="width:${(ob.step / total) * 100}%"></i></div>
      <div class="card step-card">
        <span class="eyebrow">Set up your study profile</span>
        <h2>${title}</h2><p class="why">${why}</p>
        ${body}
        <div class="step-nav">
          ${ob.step > 1 ? `<button class="btn btn-outline" data-action="ob-back">${icon('arrowLeft', 16)} Back</button>` : '<span></span>'}
          <button class="btn ${ob.step === total ? 'btn-cta' : 'btn-dark'}" data-action="ob-next" ${canNext ? '' : 'disabled'}>${ob.step === total ? 'Generate My Study Plan' : 'Next'} ${icon('arrowRight', 16)}</button>
        </div>
      </div>`;
  }

  function finishOnboarding() {
    const user = currentUser();
    if (!user) return go('/auth');
    const old = db.profiles[user.id] || {};
    db.profiles[user.id] = { ...ob.data, streak: old.streak || 1, batchIds: old.batchIds || [], courseIds: old.courseIds || [] };
    delete db.tasks[user.id];
    saveDb();
    toast('Your study plan is ready');
    go(ob.next || '/home');
  }

  /* ---------------------------------------------------------
     13. Recommendations + study plan
     --------------------------------------------------------- */
  function recommendCourses(p) {
    const now = new Date().getFullYear();
    const yearsAway = p.targetYear - now;
    return db.courses
      .filter((c) => c.categoryId === p.categoryId)
      .map((c) => {
        let score = 0;
        const reasons = [];
        if (c.trackId === p.trackId) { score += 30; reasons.push('matches your ' + (track(p.trackId) || {}).name + ' track'); }
        if (p.level === 'BEGINNER') {
          if (c.type === 'FOUNDATION' || c.type === 'FULL_COURSE') { score += 20; reasons.push('builds strong basics first'); }
          if (c.level === 'ADVANCED') score -= 25;
          if (c.type === 'CRASH') score -= 20;
        }
        if (p.level === 'ADVANCED' && (c.type === 'TEST_SERIES' || c.type === 'SUBJECT_INTENSIVE')) { score += 20; reasons.push('adds tests and speed practice for your level'); }
        if (p.level === 'INTERMEDIATE' && c.level === 'INTERMEDIATE') { score += 10; reasons.push('pitched at your level'); }
        if (p.hours <= 2 && (c.type === 'TEST_SERIES' || c.type === 'SUBJECT_INTENSIVE')) { score += 10; reasons.push('fits short daily sessions'); }
        if (p.hours >= 5 && (c.type === 'FULL_COURSE' || c.type === 'CRASH')) { score += 10; reasons.push('uses your ' + p.hours + ' daily hours fully'); }
        if (yearsAway >= 2) {
          if (c.type === 'CRASH') score -= 40;
          if (c.type === 'FULL_COURSE' || c.type === 'FOUNDATION') { score += 15; reasons.push('long-term plan for ' + p.targetYear); }
        } else if (yearsAway <= 0 && (c.type === 'CRASH' || c.type === 'TEST_SERIES')) {
          score += 20; reasons.push('your exam is close, so focus on revision');
        }
        const weakHits = (c.subjectIds || []).filter((id) => p.weakSubjects.includes(id));
        if (weakHits.length) { score += 10 * weakHits.length; reasons.push('covers your weak subject ' + SUBJECTS[weakHits[0]].name); }
        return { course: c, score, reason: reasons.length ? reasons.slice(0, 2).join(', ').replace(/^./, (m) => m.toUpperCase()) + '.' : 'Popular choice for ' + category(p.categoryId).name + ' students.' };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }

  function recommendBatches(p, recs) {
    const ids = recs.map((r) => r.course.id);
    const mine = p.batchIds || [];
    return db.batches
      .filter((b) => !mine.includes(b.id) && !isFull(b) && (ids.includes(b.courseId) || (course(b.courseId) || {}).categoryId === p.categoryId))
      .sort((a, b) => (ids.includes(b.courseId) ? 1 : 0) - (ids.includes(a.courseId) ? 1 : 0))
      .slice(0, 3)
      .map((b) => {
        const t = timeOfDay(b);
        let reason = 'Upcoming batch for your exam';
        if (p.hours <= 3 && t === 'evening') reason = 'Evening slot that fits around your day';
        else if (t === 'morning') reason = 'Morning slot for a focused start';
        else if (seatsLeft(b) < 15) reason = 'Filling fast: only ' + seatsLeft(b) + ' seats left';
        return { batch: b, reason };
      });
  }

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const TASK_TYPES = ['Concept revision', 'Practice set', 'Previous year questions', 'Sectional test', 'Short notes + formula review'];

  function weekKey() {
    const d = new Date();
    const monday = addDays(d, -((d.getDay() + 6) % 7));
    return isoDate(monday);
  }

  function studyPlan(user, p) {
    const key = weekKey();
    const existing = db.tasks[user.id];
    if (existing && existing.week === key) return existing.items;

    const subjects = p.subjects.length ? p.subjects : (category(p.categoryId) || { subjects: [] }).subjects.map((s) => s.id);
    const pool = [];
    subjects.forEach((id) => { pool.push(id); if (p.weakSubjects.includes(id)) pool.push(id); });
    const perDay = Math.max(2, Math.min(4, Math.ceil(p.hours / 1.5)));
    const minutes = Math.round((p.hours * 60) / perDay / 5) * 5;
    const items = [];
    let k = 0;
    DAYS.forEach((day, di) => {
      if (di === 6) {
        items.push({ id: uid('t'), day: di, subjectId: subjects[0], title: 'Full-length mock test + analysis', minutes: Math.min(180, p.hours * 45), done: false });
        return;
      }
      for (let i = 0; i < perDay; i++) {
        const subjectId = pool[k % pool.length];
        const type = TASK_TYPES[(k + di) % TASK_TYPES.length];
        const weak = p.weakSubjects.includes(subjectId);
        items.push({ id: uid('t'), day: di, subjectId, title: (SUBJECTS[subjectId] || {}).name + ': ' + type, minutes: weak ? minutes + 15 : minutes, done: false });
        k++;
      }
    });
    db.tasks[user.id] = { week: key, items };
    saveDb();
    return items;
  }

  function upcomingEvents(p) {
    const events = [];
    const today = new Date();
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    (p.batchIds || []).map(batch).filter(Boolean).forEach((b) => {
      for (let i = 0; i < 7; i++) {
        const d = addDays(today, i);
        if (b.scheduleDays.toLowerCase().includes(dayNames[d.getDay()])) {
          events.push({ date: d, title: 'Live class: ' + b.name, time: b.scheduleTime, type: 'class' });
        }
      }
    });
    const sunday = addDays(today, (7 - today.getDay()) % 7);
    events.push({ date: sunday, title: 'Weekly mock test (' + category(p.categoryId).name + ')', time: '10:00 AM - 1:00 PM IST', type: 'test' });
    return events.sort((a, b) => a.date - b.date).slice(0, 6);
  }

  /* ---------------------------------------------------------
     14. Student home
     --------------------------------------------------------- */
  let activeDay = (new Date().getDay() + 6) % 7;

  function viewStudentHome(ctx) {
    const { user, profile: p } = ctx;
    const cat = category(p.categoryId);
    const tr = track(p.trackId);
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const recs = recommendCourses(p);
    const myBatches = (p.batchIds || []).map(batch).filter(Boolean);
    const recBatches = recommendBatches(p, recs);
    const myCourses = (p.courseIds || []).map(course).filter(Boolean);
    const fields = ['stage', 'categoryId', 'trackId', 'targetYear', 'level', 'hours'];
    const completion = Math.round(((fields.filter((k) => p[k]).length + (p.subjects.length ? 1 : 0) + (myBatches.length ? 1 : 0)) / (fields.length + 2)) * 100);

    onMount(renderPlan);
    onMount(() => renderChat($('#chat-dock')));

    return `
      <div class="container dash">
        <div class="dash-main">
          <div class="dash-head reveal">
            <div><h1>${greet}, ${esc(user.name.split(' ')[0])}</h1>
              <p class="muted">Preparing for <strong style="color:var(--ink)">${esc(cat.name)} ${esc(tr ? tr.name : '')} ${p.targetYear}</strong> &middot; <a href="#/onboarding" class="link" style="font-weight:500">Edit profile</a></p></div>
            <div class="head-stats">
              <div class="streak"><strong style="display:flex;align-items:center;gap:4px;justify-content:center">${icon('flame', 22)} ${p.streak || 1}</strong><span>Day streak</span></div>
              <div class="ring" style="--p:${completion}" title="Profile completion"><span>${completion}%</span></div>
            </div>
          </div>

          <section class="card reveal">
            <div class="sec-head" style="margin-bottom:16px"><div><h2>Recommended for you</h2><p class="muted" style="font-size:14px">Based on your exam, level, hours and weak subjects</p></div>${rowArrows('rec-row')}</div>
            ${recs.length ? swipeRow('rec-row', recs.map((r) => courseCard(r.course, r.reason)).join('')) : '<p class="muted">No courses for this exam yet. <a class="link" href="#/courses">Browse all</a></p>'}
          </section>

          ${myCourses.length ? `<section class="card reveal"><h2 style="margin-bottom:12px">My courses</h2><div class="mini-list">${myCourses.map((c) => `
            <a class="mini" href="#/courses/${c.slug}"><span class="cat-icon" style="width:40px;height:40px;background:${category(c.categoryId).tint}">${icon('book')}</span><div><strong>${esc(c.title)}</strong><span>${esc(c.duration)} &middot; ${TYPE_LABEL[c.type]}</span></div>${icon('chevronRight')}</a>`).join('')}</div></section>` : ''}

          <section class="card reveal">
            <div class="sec-head" style="margin-bottom:16px"><h2>Your batches</h2><a href="#/batches?category=${p.categoryId}" class="link" style="font-size:14px">All batches ${icon('arrowRight', 14)}</a></div>
            <div class="mini-list">
              ${myBatches.map((b) => `<div class="mini"><span class="status ok">Joined</span><div><strong>${esc(b.name)}</strong><span>${esc(b.scheduleDays)} &middot; ${esc(b.scheduleTime)}</span></div>
                <button class="btn btn-dark btn-sm" data-action="join-live">${icon('video', 15)} Enter class</button></div>`).join('')}
              ${recBatches.map(({ batch: b, reason }) => `<div class="mini"><div><strong>${esc(b.name)}</strong><span>${esc(reason)} &middot; ${esc(b.scheduleTime)} &middot; ${seatsLeft(b)} seats left</span></div>
                <button class="btn btn-cta btn-sm" data-action="join-batch" data-batch="${b.id}">Join</button></div>`).join('')}
              ${!myBatches.length && !recBatches.length ? '<p class="muted">No open batches right now.</p>' : ''}
            </div>
          </section>

          <section class="card reveal" id="plan-card"></section>

          <section class="card reveal">
            <h2 style="margin-bottom:14px">Upcoming classes &amp; tests</h2>
            <div class="timeline">${upcomingEvents(p).map((e) => `
              <div class="event">
                <div class="date"><strong>${e.date.getDate()}</strong><span>${e.date.toLocaleDateString('en-IN', { weekday: 'short' })}</span></div>
                <div><strong class="t">${esc(e.title)}</strong><small>${esc(e.time)}</small></div>
                <button class="btn ${e.type === 'class' ? 'btn-dark' : 'btn-outline'} btn-sm" data-action="${e.type === 'class' ? 'join-live' : 'remind'}">${e.type === 'class' ? 'Join' : 'Remind me'}</button>
              </div>`).join('')}</div>
          </section>
        </div>
        <aside class="chat-dock"><div class="chat" id="chat-dock"></div></aside>
      </div>`;
  }

  function renderPlan() {
    const el = $('#plan-card');
    const user = currentUser();
    const p = profileOf(user);
    if (!el || !p) return;
    const items = studyPlan(user, p);
    const done = items.filter((t) => t.done).length;
    const pct = items.length ? Math.round((done / items.length) * 100) : 0;
    const tests = items.filter((t) => t.done && /test/i.test(t.title)).length;
    const dayItems = items.filter((t) => t.day === activeDay);
    const subjectIds = [...new Set(items.map((t) => t.subjectId))];

    el.innerHTML = `
      <div class="sec-head" style="margin-bottom:0"><div><h2>This week's study plan</h2><p class="muted" style="font-size:14px">Built for ${p.hours} hr${p.hours > 1 ? 's' : ''}/day. Weak subjects get extra time.</p></div>
        <span class="status ${pct === 100 ? 'ok' : 'info'}">${done} / ${items.length} done</span></div>
      <div class="day-tabs">${DAYS.map((d, i) => `<button class="${i === activeDay ? 'active' : ''}" data-action="plan-day" data-day="${i}">${d}</button>`).join('')}</div>
      ${dayItems.map((t) => `<label class="task ${t.done ? 'done' : ''}"><input type="checkbox" data-input="task" data-id="${t.id}" ${t.done ? 'checked' : ''}><span>${esc(t.title)}</span><em>${t.minutes} min</em></label>`).join('')}
      <h2 style="margin:24px 0 4px">Progress</h2>
      <div class="kpis">
        <div class="kpi"><strong>${pct}%</strong><span>Plan completed</span></div>
        <div class="kpi"><strong>${done}</strong><span>Tasks done</span></div>
        <div class="kpi"><strong>${tests}</strong><span>Tests attempted</span></div>
      </div>
      ${subjectIds.map((id) => {
        const all = items.filter((t) => t.subjectId === id);
        const sp = Math.round((all.filter((t) => t.done).length / all.length) * 100);
        const s = SUBJECTS[id] || { name: id, color: '#64748B' };
        return `<div class="prog-row"><div><span>${esc(s.name)}${p.weakSubjects.includes(id) ? ' <small class="muted">(weak)</small>' : ''}</span><span class="muted">${sp}%</span></div>
          <div class="meter"><i style="width:${sp}%;background:${s.color}"></i></div></div>`;
      }).join('')}`;
  }

  /* ---------------------------------------------------------
     15. Chat assistant (rule-based, uses site data)
     --------------------------------------------------------- */
  const chat = { open: false, messages: [], typing: false, pending: null };

  function renderChatLauncher(show) {
    const root = $('#chat-root');
    if (!show) { root.innerHTML = ''; return; }
    root.innerHTML = `
      <button class="chat-launcher" data-action="toggle-chat" aria-label="Open assistant">${icon(chat.open ? 'x' : 'sparkle')}${chat.messages.length ? '' : '<span class="ping"></span>'}</button>
      ${chat.open ? '<div class="chat-box"><div class="chat" id="chat-pop"></div></div>' : ''}`;
    if (chat.open) renderChat($('#chat-pop'));
  }
  function closeChat() { chat.open = false; const root = $('#chat-root'); if (root && root.innerHTML) renderChatLauncher(true); }

  function chatChips() {
    const user = currentUser();
    if (user && profileOf(user)) return ['What should I study today?', 'Explain my study plan', 'Show better batches for me', 'Book a demo'];
    return ['Which course suits me?', 'Show CA batches', 'Compare two courses', 'Book a free demo'];
  }

  function ensureGreeting() {
    if (chat.messages.length) return;
    const user = currentUser();
    chat.messages.push({ from: 'bot', text: user
      ? `Hi ${user.name.split(' ')[0]}! I can help with your study plan, courses, batches, fees and demo bookings.`
      : 'Hi! I am the Learnist assistant. Ask me about courses, batches, fees or book a free demo class.' });
  }

  function renderChat(el) {
    if (!el) return;
    ensureGreeting();
    el.innerHTML = `
      <div class="chat-head"><span class="logo-tile">LA</span><div><strong>Learnist Assistant</strong><small>Online</small></div>
        ${el.id === 'chat-pop' ? `<button data-action="toggle-chat" aria-label="Close" style="color:#fff">${icon('x')}</button>` : ''}</div>
      <div class="chat-body">
        ${chat.messages.map(messageHtml).join('')}
        ${chat.typing ? '<div class="msg bot typing"><i></i><i></i><i></i></div>' : ''}
      </div>
      <div class="chat-chips">${chatChips().map((c) => `<button data-action="chat-chip" data-text="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <form class="chat-input" data-form="chat"><input name="text" maxlength="400" placeholder="Ask about courses, batches, fees..." autocomplete="off" aria-label="Message"><button type="submit" aria-label="Send">${icon('send', 16)}</button></form>`;
    const body = $('.chat-body', el);
    body.scrollTop = body.scrollHeight;
  }

  function messageHtml(m) {
    if (m.from === 'me') return `<div class="msg me">${esc(m.text)}</div>`;
    let extra = '';
    if (m.courses) extra += m.courses.map((c) => `<a class="msg-card" href="#/courses/${c.slug}" style="display:block"><strong>${esc(c.title)}</strong>${TYPE_LABEL[c.type]} &middot; ${esc(c.duration)} &middot; ${inr(c.price)}</a>`).join('');
    if (m.batches) extra += m.batches.map((b) => `<div class="msg-card"><strong>${esc(b.name)}</strong>Starts ${niceDate(b.startDate)} &middot; ${esc(b.scheduleTime)} &middot; ${seatsLeft(b)} seats left</div>`).join('');
    if (m.confirm) {
      extra += `<div class="msg-card"><strong>${esc(m.confirm.summary)}</strong>${esc(m.confirm.detail)}
        ${m.confirm.state === 'pending' ? `<div class="btn-row"><button class="btn btn-cta btn-sm" data-action="chat-confirm">Confirm</button><button class="btn btn-outline btn-sm" data-action="chat-cancel">Cancel</button></div>`
          : `<div style="margin-top:6px;font-weight:600">${m.confirm.state === 'done' ? 'Confirmed' : 'Cancelled'}</div>`}</div>`;
    }
    return `<div class="msg bot">${esc(m.text)}${extra}${m.src ? `<span class="src">${esc(m.src)}</span>` : ''}</div>`;
  }

  function refreshChats() {
    renderChat($('#chat-pop'));
    renderChat($('#chat-dock'));
  }

  function sendChat(text) {
    text = text.trim();
    if (!text) return;
    chat.messages.push({ from: 'me', text });
    chat.typing = true;
    refreshChats();
    setTimeout(() => {
      chat.typing = false;
      chat.messages.push(replyTo(text));
      refreshChats();
    }, 650);
  }

  const CATEGORY_WORDS = {
    jee: ['jee', 'iit'], neet: ['neet', 'medical', 'mbbs'], foundation: ['foundation', 'class 8', 'class 9', 'class 10', 'olympiad'],
    ca: [' ca ', 'chartered', 'ca foundation', 'ca inter', 'ca final'], upsc: ['upsc', 'ias', 'civil services'], ssc: ['ssc', 'cgl', 'chsl', 'mts'],
    banking: ['bank', 'ibps', 'sbi', 'rbi'], railways: ['railway', 'rrb', 'ntpc', 'group d'], defence: ['nda', 'cds', 'afcat', 'defence', 'army'],
    teaching: ['ctet', 'tet', 'teaching', 'teacher'], 'state-psc': ['psc', 'uppsc', 'bpsc', 'rpsc'], law: ['clat', 'law']
  };
  function detectCategory(text) {
    const t = ' ' + text.toLowerCase() + ' ';
    for (const [id, words] of Object.entries(CATEGORY_WORDS)) {
      if (words.some((w) => t.includes(w))) return id;
    }
    return null;
  }

  function replyTo(text) {
    const t = text.toLowerCase();
    const user = currentUser();
    const p = profileOf(user);
    const catId = detectCategory(text) || (p ? p.categoryId : null);
    const cat = category(catId);
    const has = (...words) => words.some((w) => t.includes(w));

    if (has('delete', 'change price', 'edit course', 'admin', 'give me discount code')) {
      return { from: 'bot', text: 'I can\'t make changes to courses, prices or accounts. Please contact our team on the Contact page for anything account-related.' };
    }
    if (has('demo', 'trial', 'free class')) {
      const c = (cat && db.courses.find((x) => x.categoryId === cat.id)) || db.courses[0];
      const date = isoDate(addDays(new Date(), 2));
      const name = user ? user.name : 'Guest';
      chat.pending = { type: 'demo', courseId: c.id, date, name };
      return { from: 'bot', text: 'Here are the demo booking details. Please confirm:', confirm: { summary: 'Free demo: ' + c.title, detail: niceDate(date) + ', Evening (6 - 8 PM) for ' + name, state: 'pending' } };
    }
    if (has('callback', 'call me', 'counsellor', 'counselor', 'enquiry', 'talk to someone')) {
      if (!user) return { from: 'bot', text: 'Sure! Please fill the short form on our Contact page and a counsellor will call you within 24 hours.' };
      chat.pending = { type: 'enquiry', message: text };
      return { from: 'bot', text: 'I can ask a counsellor to call you. Please confirm:', confirm: { summary: 'Callback request for ' + user.name, detail: 'Topic: "' + text.slice(0, 60) + '"', state: 'pending' } };
    }
    if (p && has('today', 'study now', 'what should i study')) {
      const day = (new Date().getDay() + 6) % 7;
      const items = studyPlan(user, p).filter((x) => x.day === day);
      return { from: 'bot', text: 'Here is your plan for today:\n' + items.map((x) => (x.done ? '✓ ' : '• ') + x.title + ' (' + x.minutes + ' min)').join('\n'), src: 'From your weekly study plan' };
    }
    if (p && has('study plan', 'my plan', 'explain')) {
      const weak = p.weakSubjects.map((id) => (SUBJECTS[id] || {}).name).filter(Boolean);
      return { from: 'bot', text: `Your plan is built for ${p.hours} hours a day for ${category(p.categoryId).name} ${p.targetYear}. Each weekday has short focused tasks, and Sunday has a full mock test.${weak.length ? ' ' + weak.join(', ') + ' get extra minutes because you marked them as weak.' : ''}`, src: 'From your study profile' };
    }
    if (has('batch', 'timing', 'schedule', 'start')) {
      const list = db.batches.filter((b) => { const c = course(b.courseId); return (!cat || (c && c.categoryId === cat.id)) && !isFull(b); }).slice(0, 3);
      if (!list.length) return { from: 'bot', text: 'I couldn\'t find open batches for that right now. Want me to raise an enquiry with our team?' };
      return { from: 'bot', text: 'Upcoming ' + (cat ? cat.name + ' ' : '') + 'batches:', batches: list, src: 'Based on current batch data' };
    }
    if (has('compare', ' vs ', 'difference')) {
      const list = db.courses.filter((c) => !cat || c.categoryId === cat.id).slice(0, 2);
      if (list.length < 2) return { from: 'bot', text: 'Tell me the exam (for example "compare JEE courses") and I\'ll compare two options.' };
      const [a, b] = list;
      return { from: 'bot', text: `${a.title}: ${TYPE_LABEL[a.type]}, ${a.duration}, ${inr(a.price)}.\n${b.title}: ${TYPE_LABEL[b.type]}, ${b.duration}, ${inr(b.price)}.\n\nPick the first for complete preparation, the second if you want ${b.type === 'CRASH' || b.type === 'TEST_SERIES' ? 'faster revision and tests' : 'a different pace'}.`, courses: list, src: 'Based on current course data' };
    }
    const faqHit = FAQS.find((f) => {
      const map = { fees: ['fee', 'price', 'cost', 'emi', 'pay'], refunds: ['refund', 'money back'], devices: ['device', 'laptop', 'mobile', 'phone app'], doubt_support: ['doubt'], online_classes: ['recorded', 'live class', 'miss a class', 'how do classes'], admissions: ['admission', 'enroll', 'join'] };
      return (map[f.topic] || []).some((w) => t.includes(w));
    });
    if (faqHit && !has('suit', 'recommend', 'which course')) return { from: 'bot', text: faqHit.answer, src: 'From our FAQs' };
    if (has('suit', 'recommend', 'which course', 'best course', 'course for me') || (cat && has('course'))) {
      if (p && (!detectCategory(text) || detectCategory(text) === p.categoryId)) {
        const recs = recommendCourses(p).slice(0, 2);
        return { from: 'bot', text: 'Based on your profile, I recommend:\n' + recs.map((r) => '• ' + r.course.title + ' - ' + r.reason).join('\n'), courses: recs.map((r) => r.course), src: 'Based on your saved study profile' };
      }
      if (cat) {
        const list = db.courses.filter((c) => c.categoryId === cat.id).slice(0, 3);
        return { from: 'bot', text: 'Popular ' + cat.name + ' courses:' + (user ? '' : ' Sign up and complete your profile for personal recommendations.'), courses: list, src: 'Based on current course data' };
      }
      return { from: 'bot', text: 'Which exam are you preparing for? For example JEE, NEET, CA, UPSC, SSC or Banking.' };
    }
    if (cat) {
      const list = db.courses.filter((c) => c.categoryId === cat.id).slice(0, 3);
      return { from: 'bot', text: 'Here are some ' + cat.name + ' courses:', courses: list, src: 'Based on current course data' };
    }
    if (has('hi', 'hello', 'hey', 'namaste')) return { from: 'bot', text: 'Hello! What exam are you preparing for?' };
    return { from: 'bot', text: 'I can help with courses, batches, fees, refunds and demo bookings for Learnist. I don\'t have an answer for that one. Would you like a counsellor to call you?' };
  }

  function chatConfirm(ok) {
    const msg = [...chat.messages].reverse().find((m) => m.confirm && m.confirm.state === 'pending');
    if (!msg || !chat.pending) return;
    msg.confirm.state = ok ? 'done' : 'cancelled';
    if (ok) {
      const user = currentUser();
      if (chat.pending.type === 'demo') {
        db.bookings.unshift({ id: uid('bk'), name: chat.pending.name, phone: user && user.phone ? user.phone : '-', courseId: chat.pending.courseId, date: chat.pending.date, slot: 'Evening (6 - 8 PM)', status: 'PENDING', source: 'CHATBOT', createdAt: new Date().toISOString(), userId: user ? user.id : null });
        chat.messages.push({ from: 'bot', text: 'Done! Your demo is booked. Our team will send the class link before the session.' });
      } else {
        db.enquiries.unshift({ id: uid('enq'), name: user.name, email: user.email, phone: user.phone || '-', categoryId: (profileOf(user) || {}).categoryId || '', message: chat.pending.message, status: 'NEW', source: 'CHATBOT', createdAt: new Date().toISOString() });
        chat.messages.push({ from: 'bot', text: 'Request sent. A counsellor will call you within 24 hours.' });
      }
      saveDb();
    } else {
      chat.messages.push({ from: 'bot', text: 'No problem, nothing was booked.' });
    }
    chat.pending = null;
    refreshChats();
  }

  /* ---------------------------------------------------------
     16. Admin
     --------------------------------------------------------- */
  function viewAdminLogin(ctx) {
    if (ctx.user && ctx.user.role === 'ADMIN') { setTimeout(() => go('/admin'), 0); return ''; }
    return `
      <div class="auth" style="grid-template-columns:1fr">
        <main class="auth-main" style="background:var(--bg-alt)">
          <div class="card auth-card" id="admin-card">
            <div style="margin-bottom:20px">${logo()}</div>
            <h2 style="font-size:24px">Admin login</h2>
            <p class="muted" style="margin:4px 0 20px;font-size:14.5px">Only institute staff can access the admin panel.</p>
            <form class="form" data-form="admin-login" novalidate>
              <div class="field"><label>Email</label><input class="input" name="email" type="email"></div>
              <div class="field"><label>Password</label><input class="input" name="password" type="password"></div>
              <button class="btn btn-dark" type="submit">Log In</button>
            </form>
            <p class="note" style="margin-top:18px">Demo: admin@learnist.com / Admin@123</p>
            <p class="note"><a href="#/" class="link">Back to website</a></p>
          </div>
        </main>
      </div>`;
  }

  const ADMIN_TABS = [
    ['', 'Overview', 'grid'], ['students', 'Students', 'users'], ['courses', 'Courses', 'book'],
    ['batches', 'Batches', 'calendar'], ['bookings', 'Demo Bookings', 'video'], ['enquiries', 'Enquiries', 'inbox']
  ];

  function viewAdmin(ctx) {
    const tab = ctx.params.tab || '';
    const nav = ADMIN_TABS.map(([id, label, ic]) => `<a href="#/admin${id ? '/' + id : ''}" class="${tab === id ? 'active' : ''}">${icon(ic)} ${label}</a>`).join('');
    const views = { '': adminOverview, students: adminStudents, courses: adminCourses, batches: adminBatches, bookings: adminBookings, enquiries: adminEnquiries };
    const content = (views[tab] || adminOverview)(ctx);
    return `
      <div class="admin">
        <aside class="admin-side">
          ${logo()}
          ${nav}
          <div class="bottom">
            <a href="#/">${icon('home')} View website</a>
            <a href="#" data-action="logout">${icon('logout')} Log out</a>
          </div>
        </aside>
        <main class="admin-main">${content}</main>
      </div>`;
  }

  function adminTop(title, sub, actions) {
    return `<div class="admin-top"><div><h1>${title}</h1><p class="muted">${sub}</p></div>${actions || ''}</div>`;
  }
  const students = () => db.users.filter((u) => u.role === 'STUDENT');
  const statusSelect = (kind, id, current, options) => `<select data-input="status" data-kind="${kind}" data-id="${id}">${options.map((o) => `<option ${o === current ? 'selected' : ''}>${o}</option>`).join('')}</select>`;

  function adminOverview() {
    const weekAgo = Date.now() - 7 * 86400000;
    const cards = [
      ['Total students', students().length],
      ['New enquiries', db.enquiries.filter((e) => e.status === 'NEW').length],
      ['Demo bookings', db.bookings.length],
      ['Upcoming batches', db.batches.filter((b) => b.status === 'UPCOMING').length],
      ['Active courses', db.courses.length],
      ['New students (7 days)', students().filter((u) => new Date(u.createdAt).getTime() > weekAgo).length]
    ];
    return `
      ${adminTop('Overview', 'A quick look at what is happening today.')}
      <div class="stat-cards">${cards.map(([l, v]) => `<div class="card stat-card"><span>${l}</span><strong>${v}</strong></div>`).join('')}</div>
      <div class="grid grid-2">
        <div class="card"><div style="padding:18px 18px 8px;display:flex;justify-content:space-between"><h3 style="font-size:16px">Latest demo bookings</h3><a href="#/admin/bookings" class="link" style="font-size:13px">View all</a></div>
          <div class="table-wrap"><table><tbody>${db.bookings.slice(0, 5).map((b) => `<tr><td><strong>${esc(b.name)}</strong><br><small class="muted">${esc((course(b.courseId) || {}).title || '')}</small></td><td><span class="status ${STATUS_CLASS[b.status]}">${b.status}</span></td></tr>`).join('') || '<tr><td class="muted">No bookings yet</td></tr>'}</tbody></table></div></div>
        <div class="card"><div style="padding:18px 18px 8px;display:flex;justify-content:space-between"><h3 style="font-size:16px">Latest enquiries</h3><a href="#/admin/enquiries" class="link" style="font-size:13px">View all</a></div>
          <div class="table-wrap"><table><tbody>${db.enquiries.slice(0, 5).map((e) => `<tr><td><strong>${esc(e.name)}</strong><br><small class="muted">${esc(e.message.slice(0, 60))}</small></td><td><span class="status ${STATUS_CLASS[e.status]}">${e.status}</span></td></tr>`).join('') || '<tr><td class="muted">No enquiries yet</td></tr>'}</tbody></table></div></div>
      </div>`;
  }

  function adminStudents() {
    return `
      ${adminTop('Students', students().length + ' registered students')}
      <div class="card table-wrap"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Exam</th><th>Level</th><th>Joined</th><th></th></tr></thead>
        <tbody>${students().map((u) => {
          const p = db.profiles[u.id];
          const cat = p ? category(p.categoryId) : null;
          return `<tr><td><strong>${esc(u.name)}</strong></td><td>${esc(u.email)}</td><td>${cat ? esc(cat.name + ' ' + ((track(p.trackId) || {}).name || '')) : '<span class="muted">Not set</span>'}</td>
            <td>${p ? LEVEL_LABEL[p.level] || '-' : '-'}</td><td>${niceDate(u.createdAt)}</td>
            <td><button class="btn btn-outline btn-sm" data-action="admin-student" data-id="${u.id}">View</button></td></tr>`;
        }).join('')}</tbody></table></div>`;
  }

  function adminCourses(ctx) {
    const q = (ctx.query.get('q') || '').toLowerCase();
    const list = db.courses.filter((c) => !q || c.title.toLowerCase().includes(q));
    return `
      ${adminTop('Courses', db.courses.length + ' courses', `<div class="btn-row"><form data-form="admin-search" class="search-box" style="margin:0;padding:4px"><input name="q" value="${esc(q)}" placeholder="Search courses"><button class="btn btn-dark btn-sm">Search</button></form>
        <button class="btn btn-dark" data-action="admin-add-course">${icon('plus', 16)} Add course</button></div>`)}
      <div class="card table-wrap"><table>
        <thead><tr><th>Course</th><th>Exam</th><th>Format</th><th>Price</th><th>Featured</th><th></th></tr></thead>
        <tbody>${list.map((c) => `<tr><td><a href="#/courses/${c.slug}" class="link" style="font-weight:600">${esc(c.title)}</a></td><td>${esc((category(c.categoryId) || {}).name || '')}</td>
          <td>${TYPE_LABEL[c.type]}</td><td>${inr(c.price)}</td>
          <td><input type="checkbox" data-input="featured" data-id="${c.id}" ${c.isFeatured ? 'checked' : ''}></td>
          <td><button class="icon-btn" data-action="admin-delete" data-kind="courses" data-id="${c.id}" aria-label="Delete">${icon('trash', 16)}</button></td></tr>`).join('')}</tbody></table></div>`;
  }

  function adminBatches() {
    return `
      ${adminTop('Batches', db.batches.length + ' batches', `<button class="btn btn-dark" data-action="admin-add-batch">${icon('plus', 16)} Add batch</button>`)}
      <div class="card table-wrap"><table>
        <thead><tr><th>Batch</th><th>Course</th><th>Starts</th><th>Timing</th><th>Seats</th><th>Status</th><th></th></tr></thead>
        <tbody>${db.batches.map((b) => `<tr><td><strong>${esc(b.name)}</strong></td><td>${esc((course(b.courseId) || {}).title || '-')}</td><td>${niceDate(b.startDate)}</td>
          <td>${esc(b.scheduleDays)}<br><small class="muted">${esc(b.scheduleTime)}</small></td><td>${b.enrolledCount} / ${b.capacity}</td>
          <td>${statusSelect('batches', b.id, b.status, ['UPCOMING', 'ONGOING', 'COMPLETED'])}</td>
          <td><button class="icon-btn" data-action="admin-delete" data-kind="batches" data-id="${b.id}" aria-label="Delete">${icon('trash', 16)}</button></td></tr>`).join('')}</tbody></table></div>`;
  }

  function adminBookings() {
    return `
      ${adminTop('Demo bookings', db.bookings.length + ' bookings')}
      <div class="card table-wrap"><table>
        <thead><tr><th>Name</th><th>Phone</th><th>Course</th><th>Date</th><th>Source</th><th>Status</th></tr></thead>
        <tbody>${db.bookings.map((b) => `<tr><td><strong>${esc(b.name)}</strong></td><td>${esc(b.phone)}</td><td>${esc((course(b.courseId) || {}).title || '-')}</td>
          <td>${niceDate(b.date)}<br><small class="muted">${esc(b.slot)}</small></td><td>${b.source === 'CHATBOT' ? 'Assistant' : 'Website'}</td>
          <td>${statusSelect('bookings', b.id, b.status, ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'])}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No bookings yet</td></tr>'}</tbody></table></div>`;
  }

  function adminEnquiries() {
    return `
      ${adminTop('Enquiries', db.enquiries.length + ' enquiries')}
      <div class="card table-wrap"><table>
        <thead><tr><th>Name</th><th>Contact</th><th>Exam</th><th>Message</th><th>Received</th><th>Status</th></tr></thead>
        <tbody>${db.enquiries.map((e) => `<tr><td><strong>${esc(e.name)}</strong></td><td>${esc(e.phone)}<br><small class="muted">${esc(e.email)}</small></td>
          <td>${esc((category(e.categoryId) || {}).name || '-')}</td><td style="max-width:280px">${esc(e.message)}</td><td>${niceDate(e.createdAt)}</td>
          <td>${statusSelect('enquiries', e.id, e.status, ['NEW', 'CONTACTED', 'CLOSED'])}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No enquiries yet</td></tr>'}</tbody></table></div>`;
  }

  function adminStudentModal(id) {
    const u = db.users.find((x) => x.id === id);
    const p = db.profiles[id];
    const row = (label, value) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)"><span class="muted">${label}</span><strong style="text-align:right">${value}</strong></div>`;
    openModal(`
      <div class="modal-head"><div><h3>${esc(u.name)}</h3><p class="muted" style="font-size:14px">${esc(u.email)}</p></div><button class="icon-btn" data-action="close-modal">${icon('x')}</button></div>
      ${p ? [
        row('Stage', esc(p.stage)), row('Exam', esc((category(p.categoryId) || {}).name + ' - ' + ((track(p.trackId) || {}).name || ''))),
        row('Target year', p.targetYear), row('Subjects', esc(p.subjects.map((s) => (SUBJECTS[s] || {}).name).join(', '))),
        row('Weak subjects', esc(p.weakSubjects.map((s) => (SUBJECTS[s] || {}).name).join(', ') || 'None')),
        row('Level', LEVEL_LABEL[p.level] || '-'), row('Study hours', p.hours + ' hrs/day'), row('Batches joined', (p.batchIds || []).length)
      ].join('') : '<p class="muted">This student has not completed onboarding yet.</p>'}`);
  }

  function adminCourseModal() {
    openModal(`
      <div class="modal-head"><h3>Add course</h3><button class="icon-btn" data-action="close-modal">${icon('x')}</button></div>
      <form class="form" data-form="admin-course" novalidate>
        <div class="field"><label>Title</label><input class="input" name="title" required></div>
        <div class="grid grid-2" style="gap:12px">
          <div class="field"><label>Exam</label><select class="input" name="categoryId">${CATEGORIES.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Format</label><select class="input" name="type">${Object.keys(TYPE_LABEL).map((k) => `<option value="${k}">${TYPE_LABEL[k]}</option>`).join('')}</select></div>
          <div class="field"><label>Level</label><select class="input" name="level">${Object.keys(LEVEL_LABEL).map((k) => `<option value="${k}">${LEVEL_LABEL[k]}</option>`).join('')}</select></div>
          <div class="field"><label>Price (₹)</label><input class="input" name="price" type="number" min="0" required></div>
        </div>
        <div class="field"><label>Duration</label><input class="input" name="duration" placeholder="e.g. 6 Months" required></div>
        <div class="field"><label>Description</label><textarea class="input" name="description" rows="3" required></textarea></div>
        <button class="btn btn-dark" type="submit">Save course</button>
      </form>`);
  }

  function adminBatchModal() {
    openModal(`
      <div class="modal-head"><h3>Add batch</h3><button class="icon-btn" data-action="close-modal">${icon('x')}</button></div>
      <form class="form" data-form="admin-batch" novalidate>
        <div class="field"><label>Batch name</label><input class="input" name="name" required></div>
        <div class="field"><label>Course</label><select class="input" name="courseId">${db.courses.map((c) => `<option value="${c.id}">${esc(c.title)}</option>`).join('')}</select></div>
        <div class="field"><label>Educator</label><select class="input" name="facultyId">${FACULTY.map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select></div>
        <div class="grid grid-2" style="gap:12px">
          <div class="field"><label>Start date</label><input class="input" type="date" name="startDate" required></div>
          <div class="field"><label>Capacity</label><input class="input" type="number" name="capacity" min="1" value="100" required></div>
          <div class="field"><label>Days</label><input class="input" name="scheduleDays" value="Mon, Wed, Fri" required></div>
          <div class="field"><label>Time</label><input class="input" name="scheduleTime" value="6:30 PM - 8:30 PM IST" required></div>
        </div>
        <button class="btn btn-dark" type="submit">Save batch</button>
      </form>`);
  }

  /* ---------------------------------------------------------
     17. Event handling (one listener per event type)
     --------------------------------------------------------- */
  const actions = {
    'toggle-menu': (el) => el.closest('.dropdown').classList.toggle('open'),
    'toggle-mobile': () => { const m = $('#mobile-menu'); if (m) m.classList.toggle('open'); },
    logout: (el, e) => { e.preventDefault(); signOut(); },
    'book-demo': (el) => openDemoModal(el.dataset.course, el.dataset.batch),
    enroll: (el) => enroll(el.dataset.course),
    'join-batch': (el) => joinBatch(el.dataset.batch),
    'join-live': () => toast('The live room opens 10 minutes before class starts'),
    remind: () => toast('Reminder set. We will notify you before the test.'),
    'close-modal': closeModal,
    'close-modal-bg': (el, e) => { if (e.target === el) closeModal(); },
    'show-all-cats': (el) => { $$('.extra-cat').forEach((c) => { c.classList.remove('hidden'); c.classList.add('in'); }); el.remove(); },
    'scroll-row': (el) => { const row = document.getElementById(el.dataset.row); if (row) row.scrollBy({ left: Number(el.dataset.dir) * (row.clientWidth * 0.8), behavior: 'smooth' }); },
    page: (el) => { setQuery({ page: el.dataset.page }); window.scrollTo({ top: 0, behavior: 'smooth' }); },

    'auth-tab': (el) => { authState.mode = el.dataset.mode; authState.phoneStep = 0; renderAuthCard(); },
    'google-login': (el) => {
      const user = findOrCreateUser('google.student@gmail.com', 'Google Student', { authProvider: 'GOOGLE' });
      toast('Signed in with Google');
      finishLogin(user, el);
    },
    'phone-login': () => { authState.phoneStep = authState.phoneStep ? 0 : 1; renderAuthCard(); },
    'resend-otp': (el, e) => { e.preventDefault(); toast('New code sent (demo code: 123456)'); startOtpTimer(); },
    'toggle-pw': (el) => {
      const input = el.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      el.innerHTML = icon(show ? 'eyeOff' : 'eye');
    },
    forgot: (el, e) => { e.preventDefault(); toast('If this email is registered, a reset link has been sent'); },

    'ob-pick': (el) => {
      const key = el.dataset.key;
      let value = el.dataset.value;
      if (key === 'targetYear') value = Number(value);
      if (key === 'stage' && ob.data.stage !== value) { ob.data.categoryId = ''; ob.data.trackId = ''; ob.data.subjects = []; ob.data.weakSubjects = []; }
      if (key === 'categoryId' && ob.data.categoryId !== value) { ob.data.trackId = ''; ob.data.subjects = []; ob.data.weakSubjects = []; }
      ob.data[key] = value;
      renderOnboarding();
    },
    'ob-subject': (el) => {
      const id = el.dataset.value;
      const d = ob.data;
      if (d.weakSubjects.includes(id)) { d.weakSubjects = d.weakSubjects.filter((x) => x !== id); d.subjects = d.subjects.filter((x) => x !== id); }
      else if (d.subjects.includes(id)) d.weakSubjects.push(id);
      else d.subjects.push(id);
      renderOnboarding();
    },
    'ob-next': () => { ob.step += 1; renderOnboarding(); window.scrollTo(0, 0); },
    'ob-back': () => { ob.step -= 1; renderOnboarding(); },

    'plan-day': (el) => { activeDay = Number(el.dataset.day); renderPlan(); },

    'toggle-chat': () => { chat.open = !chat.open; renderChatLauncher(true); if (chat.open) { const i = $('#chat-pop input'); if (i) i.focus(); } },
    'chat-chip': (el) => sendChat(el.dataset.text),
    'chat-confirm': () => chatConfirm(true),
    'chat-cancel': () => chatConfirm(false),

    'admin-student': (el) => adminStudentModal(el.dataset.id),
    'admin-add-course': adminCourseModal,
    'admin-add-batch': adminBatchModal,
    'admin-delete': (el) => {
      if (!confirm('Delete this item? This cannot be undone.')) return;
      db[el.dataset.kind] = db[el.dataset.kind].filter((x) => x.id !== el.dataset.id);
      saveDb();
      toast('Deleted');
      render();
    }
  };

  const forms = {
    'hero-search': (f) => go('/courses' + (f.q.value.trim() ? '?q=' + encodeURIComponent(f.q.value.trim()) : '')),
    'course-search': (f) => setQuery({ q: f.q.value.trim(), page: '' }),
    'faculty-search': (f) => setQuery({ q: f.q.value.trim() }),
    'admin-search': (f) => setQuery({ q: f.q.value.trim() }),
    chat: (f) => { const v = f.text.value; f.text.value = ''; sendChat(v); },

    login: (f) => {
      clearErrors(f);
      const email = f.email.value.trim();
      const pass = f.password.value;
      if (!validEmail(email)) return showFieldError(f, 'email', 'Enter a valid email address');
      if (!pass) return showFieldError(f, 'password', 'Enter your password');
      const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === pass);
      if (!user) { showFieldError(f, 'password', 'Wrong email or password'); return shake($('#auth-card')); }
      finishLogin(user, $('#auth-submit'));
    },
    signup: (f) => {
      clearErrors(f);
      const name = f.name.value.trim();
      const email = f.email.value.trim();
      let bad = false;
      if (name.length < 2) { showFieldError(f, 'name', 'Enter your full name'); bad = true; }
      if (!validEmail(email)) { showFieldError(f, 'email', 'Enter a valid email address'); bad = true; }
      else if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) { showFieldError(f, 'email', 'An account with this email already exists. Log in instead.'); bad = true; }
      if (f.password.value.length < 8) { showFieldError(f, 'password', 'Use at least 8 characters'); bad = true; }
      if (f.confirm.value !== f.password.value) { showFieldError(f, 'confirm', 'Passwords do not match'); bad = true; }
      if (bad) return shake($('#auth-card'));
      const user = { id: uid('u'), name, email, password: f.password.value, role: 'STUDENT', createdAt: new Date().toISOString() };
      db.users.push(user);
      saveDb();
      finishLogin(user, $('#auth-submit'));
    },
    'send-otp': (f) => {
      clearErrors(f);
      const phone = f.phone.value.replace(/\D/g, '');
      if (!/^[6-9]\d{9}$/.test(phone)) return showFieldError(f, 'phone', 'Enter a valid 10-digit mobile number');
      authState.phone = phone;
      authState.phoneStep = 2;
      renderAuthCard();
      toast('OTP sent (demo code: 123456)');
      const first = $('[data-otp="0"]');
      if (first) first.focus();
    },
    'verify-otp': (f) => {
      const code = $$('[data-otp]', f).map((i) => i.value).join('');
      if (code !== '123456') {
        $$('[data-otp]', f).forEach((i) => i.classList.add('error'));
        return shake($('#auth-card'));
      }
      const user = findOrCreateUser(authState.phone + '@phone.learnist', 'Student ' + authState.phone.slice(-4), { phone: '+91 ' + authState.phone, authProvider: 'PHONE' });
      finishLogin(user, f.querySelector('button'));
    },

    demo: (f) => {
      clearErrors(f);
      let bad = false;
      if (f.name.value.trim().length < 2) { showFieldError(f, 'name', 'Enter your name'); bad = true; }
      if (f.phone.value.replace(/\D/g, '').length < 10) { showFieldError(f, 'phone', 'Enter a valid phone number'); bad = true; }
      if (!f.courseId.value) { showFieldError(f, 'courseId', 'Choose a course'); bad = true; }
      if (bad) return;
      const user = currentUser();
      db.bookings.unshift({ id: uid('bk'), name: f.name.value.trim(), phone: f.phone.value.trim(), courseId: f.courseId.value, batchId: f.batchId.value || null, date: f.date.value, slot: f.slot.value, status: 'PENDING', source: 'WEBSITE', createdAt: new Date().toISOString(), userId: user ? user.id : null });
      saveDb();
      closeModal();
      toast('Demo booked! We will share the class link on your phone.');
    },
    enquiry: (f) => {
      clearErrors(f);
      let bad = false;
      if (f.name.value.trim().length < 2) { showFieldError(f, 'name', 'Enter your name'); bad = true; }
      if (f.phone.value.replace(/\D/g, '').length < 10) { showFieldError(f, 'phone', 'Enter a valid phone number'); bad = true; }
      if (!validEmail(f.email.value.trim())) { showFieldError(f, 'email', 'Enter a valid email'); bad = true; }
      if (f.message.value.trim().length < 5) { showFieldError(f, 'message', 'Tell us a little more'); bad = true; }
      if (bad) return;
      db.enquiries.unshift({ id: uid('enq'), name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), categoryId: f.categoryId.value, message: f.message.value.trim(), status: 'NEW', source: 'WEBSITE', createdAt: new Date().toISOString() });
      saveDb();
      f.reset();
      toast('Thanks! A counsellor will call you within 24 hours.');
    },

    'admin-login': (f) => {
      const user = db.users.find((u) => u.role === 'ADMIN' && u.email.toLowerCase() === f.email.value.trim().toLowerCase() && u.password === f.password.value);
      if (!user) { clearErrors(f); showFieldError(f, 'password', 'Invalid admin credentials'); return shake($('#admin-card')); }
      signIn(user);
      go('/admin');
    },
    'admin-course': (f) => {
      if (!f.title.value.trim() || !f.price.value || !f.duration.value.trim()) return toast('Please fill all fields', 'error');
      const title = f.title.value.trim();
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36).slice(-4);
      const cat = category(f.categoryId.value);
      db.courses.unshift({
        id: uid('course'), title, slug, categoryId: cat.id, trackId: cat.tracks[0].id, type: f.type.value, level: f.level.value,
        price: Number(f.price.value), duration: f.duration.value.trim(), description: f.description.value.trim(),
        subjectIds: cat.subjects.map((s) => s.id), facultyIds: [], highlights: ['Live interactive online classes', 'Doubt support included'], totalHours: 0, totalTests: 0
      });
      saveDb();
      closeModal();
      toast('Course added. It is now live on the website.');
      render();
    },
    'admin-batch': (f) => {
      if (!f.name.value.trim() || !f.startDate.value) return toast('Please fill all fields', 'error');
      db.batches.unshift({
        id: uid('batch'), name: f.name.value.trim(), courseId: f.courseId.value, facultyId: f.facultyId.value, startDate: f.startDate.value,
        scheduleDays: f.scheduleDays.value.trim(), scheduleTime: f.scheduleTime.value.trim(), capacity: Number(f.capacity.value) || 100, enrolledCount: 0, status: 'UPCOMING'
      });
      saveDb();
      closeModal();
      toast('Batch added');
      render();
    }
  };

  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!$('#user-menu') || !e.target.closest('#user-menu')) { const m = $('#user-menu'); if (m) m.classList.remove('open'); }
    if (!target) {
      if (e.target.closest('#mobile-menu a')) { const m = $('#mobile-menu'); if (m) m.classList.remove('open'); }
      return;
    }
    const handler = actions[target.dataset.action];
    if (handler) handler(target, e);
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const handler = forms[form.dataset.form];
    if (handler) handler(form);
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.filter) {
      const changes = { [el.dataset.filter]: el.value, page: '' };
      if (el.dataset.filter === 'category') changes.track = '';
      setQuery(changes);
    } else if (el.dataset.input === 'task') {
      const user = currentUser();
      const item = (db.tasks[user.id] || { items: [] }).items.find((t) => t.id === el.dataset.id);
      if (item) { item.done = el.checked; saveDb(); renderPlan(); }
    } else if (el.dataset.input === 'status') {
      const item = db[el.dataset.kind].find((x) => x.id === el.dataset.id);
      if (item) { item.status = el.value; saveDb(); toast('Status updated'); }
    } else if (el.dataset.input === 'featured') {
      const c = course(el.dataset.id);
      if (c) { c.isFeatured = el.checked; saveDb(); toast(el.checked ? 'Shown on home page' : 'Removed from home page'); }
    }
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.input === 'ob-hours') {
      ob.data.hours = Number(el.value);
      const h = ob.data.hours;
      const pace = h <= 2 ? 'Light pace' : h <= 4 ? 'Steady pace' : h <= 6 ? 'Strong pace' : 'Intensive pace';
      $('#hours-label').innerHTML = `${h} hr${h > 1 ? 's' : ''}/day &mdash; ${pace}`;
    } else if (el.dataset.otp !== undefined) {
      el.value = el.value.replace(/\D/g, '').slice(-1);
      el.classList.remove('error');
      if (el.value) { const next = $(`[data-otp="${Number(el.dataset.otp) + 1}"]`); if (next) next.focus(); }
    } else if (el.name === 'password' && $('#pw-strength')) {
      const v = el.value;
      const score = [v.length >= 8, /[A-Z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length;
      const bar = $('#pw-strength');
      bar.style.width = (v ? Math.max(15, score * 25) : 0) + '%';
      bar.style.background = ['#B91C1C', '#B91C1C', '#B45309', '#15803D', '#15803D'][score];
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      if (chat.open) { chat.open = false; renderChatLauncher(true); }
    }
    if (e.key === 'Backspace' && e.target.dataset && e.target.dataset.otp !== undefined && !e.target.value) {
      const prev = $(`[data-otp="${Number(e.target.dataset.otp) - 1}"]`);
      if (prev) prev.focus();
    }
  });

  document.addEventListener('paste', (e) => {
    if (e.target.dataset && e.target.dataset.otp !== undefined) {
      const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      if (digits.length > 1) {
        e.preventDefault();
        $$('[data-otp]').forEach((input, i) => { input.value = digits[i] || ''; });
      }
    }
  });

  /* ---------------------------------------------------------
     18. Scroll effects: navbar, progress bar, reveal, counters, swipe
     --------------------------------------------------------- */
  function onScroll() {
    const nav = $('#navbar');
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 80);
    const bar = $('#progress-bar');
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setupReveal() {
    const items = $$('.reveal');
    if (!('IntersectionObserver' in window) || reducedMotion) { items.forEach((el) => el.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('in'), i * 70);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach((el) => io.observe(el));
  }

  function setupCounters() {
    const items = $$('[data-count]');
    const finish = (el) => { el.textContent = Number(el.dataset.count).toLocaleString('en-IN') + el.dataset.suffix; };
    if (!('IntersectionObserver' in window) || reducedMotion) { items.forEach(finish); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        const el = entry.target;
        const target = Number(el.dataset.count);
        const delay = items.indexOf(el) % 4 * 120;
        const duration = 1600;
        setTimeout(() => {
          const start = performance.now();
          const step = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            el.textContent = Math.round(target * eased).toLocaleString('en-IN') + (t === 1 ? el.dataset.suffix : '');
            if (t < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }, delay);
      });
    }, { threshold: 0.4 });
    items.forEach((el) => io.observe(el));
  }

  function setupSwipeRows() {
    $$('.swipe').forEach((row) => {
      let down = false, startX = 0, startScroll = 0, moved = false;
      row.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse') return;
        down = true; moved = false; startX = e.clientX; startScroll = row.scrollLeft;
      });
      row.addEventListener('pointermove', (e) => {
        if (!down) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 5) { moved = true; row.classList.add('dragging'); }
        row.scrollLeft = startScroll - dx;
      });
      const end = () => {
        if (!down) return;
        down = false;
        row.classList.remove('dragging');
        if (moved) {
          const card = row.firstElementChild;
          const width = card ? card.getBoundingClientRect().width + 20 : 300;
          row.scrollTo({ left: Math.round(row.scrollLeft / width) * width, behavior: 'smooth' });
        }
      };
      row.addEventListener('pointerup', end);
      row.addEventListener('pointerleave', end);
    });
  }

  /* ---------------------------------------------------------
     19. Start
     --------------------------------------------------------- */
  window.addEventListener('hashchange', render);
  render();
})();
