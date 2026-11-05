/* ==========================================================================
   Luna — feature layer
   Adds: mood tracking, #hashtag tags + filter bar, writing streaks,
   daily reflection prompt, "on this day" memories, mood/tag insights,
   live word count, and a draggable bottom sheet.

   Data model is UNCHANGED. Entries keep {date, text, imageUrl}. Extra data
   lives inside `text`:
     - tags  = ordinary #hashtags typed in the text
     - mood  = an empty hidden marker <span class="luna-meta" data-mood="1..5">
   Old entries keep working; new entries are readable by older builds.
   ========================================================================== */
(function () {
    'use strict';

    const $ = (s, r) => (r || document).querySelector(s);
    const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const M = () => window.LunaMotion || { play: () => Promise.resolve(), pop() {}, countUp(el, n) { if (el) el.textContent = n; }, EASE_OUT: [0.23, 1, 0.32, 1], EASE_DRAWER: [0.32, 0.72, 0, 1], reduced: () => false };
    const icons = () => { try { window.lucide && window.lucide.createIcons(); } catch (e) { /* noop */ } };

    const MOODS = [
        { v: 1, e: '😞', l: 'קשה' },
        { v: 2, e: '😕', l: 'לא פשוט' },
        { v: 3, e: '😐', l: 'בסדר' },
        { v: 4, e: '🙂', l: 'טוב' },
        { v: 5, e: '😄', l: 'מצוין' }
    ];
    const moodOf = (v) => MOODS[v - 1];

    const PROMPTS = [
        'מה הדבר הקטן שעשה לך טוב היום?', 'על מה את/ה מודה היום?', 'איזה רגע מהיום היית רוצה לזכור?',
        'מה למדת על עצמך השבוע?', 'מה מעסיק אותך עכשיו, ולמה?', 'מה היית אומר/ת לעצמך מלפני שנה?',
        'איזו החלטה אתה/את דוחה, ומה מפחיד בה?', 'מי עזר לך לאחרונה, ואיך?', 'מה נתן לך אנרגיה היום, ומה לקח אותה?',
        'איך היית רוצה שמחר ייראה?', 'מה את/ה צריך/ה עכשיו שעוד לא ביקשת?', 'איזה פחד אפשר להקטין היום?',
        'מה גרם לך לחייך לאחרונה?', 'על מה סלחת לעצמך לאחרונה?', 'איזה הרגל אתה/את רוצה לשנות, ולמה דווקא עכשיו?',
        'איזה מקום גורם לך להרגיש בבית?', 'מה היה השיעור הכי קשה שלמדת?', 'מה היית עושה אילו לא פחדת?',
        'איזו שיחה היית רוצה לנהל עוד היום?', 'מה הדבר שאתה/את הכי גאה בו השנה?', 'איך הגוף שלך מרגיש עכשיו?',
        'מה עוד לא סיפרת לאף אחד?', 'מה היית רוצה לשחרר?', 'איזו שגרה קטנה מחזיקה אותך?',
        'מה היה הרגע השקט ביותר היום?', 'מה את/ה מחכה לו?', 'איזה אדם חסר לך, ומה היית אומר/ת לו?',
        'איך נראה יום מושלם בעיניך?', 'מה השתנה אצלך בשנה האחרונה?', 'על מה היית רוצה לדבר יותר?',
        'מה את/ה מרגיש/ה כלפי היום הזה בשלוש מילים?', 'איזו הצלחה קטנה שכחת לחגוג?', 'מה היית רוצה ללמוד?',
        'מה היית מספר/ת לחבר/ה על היום הזה?', 'איזה זיכרון חוזר אליך לאחרונה?', 'מה אפשר לוותר עליו מחר?',
        'מה עושה אותך אותנטי?', 'איזה גבול חשוב לך לשמור עליו?', 'מה היית רוצה שיגידו עליך בעוד עשר שנים?',
        'איזו מחשבה חוזרת אליך שוב ושוב?'
    ];

    /* ------------------------------------------------------------------
       Data helpers (read-only against window.appData)
       ------------------------------------------------------------------ */
    const journals = () => (window.appData && window.appData.journals) || [];
    const SKIP_TYPES = new Set(['folder', 'emotion', 'graph']);

    function writingEntries() {
        const out = [];
        journals().forEach((j) => {
            if (!j.entries || SKIP_TYPES.has(j.type)) return;
            Object.keys(j.entries).forEach((id) => {
                const e = j.entries[id];
                if (e && e.date) out.push({ id, journalId: j.id, journalName: j.name, date: e.date, text: e.text || '' });
            });
        });
        return out;
    }
    function scopeEntries() {
        const id = window.appData && window.appData.currentJournalId;
        if (!id) return writingEntries();
        return writingEntries().filter((e) => e.journalId === id);
    }
    function findEntry(journalId, id) {
        const j = journals().find((x) => x.id === journalId);
        return j && j.entries && j.entries[id] ? j.entries[id] : null;
    }

    const textOf = (html) => String(html || '')
        .replace(/<(br|\/div|\/p|\/li|\/h\d)\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;|&#39;/g, "'")
        .replace(/\s+/g, ' ').trim();

    const parseCache = new Map();
    function parse(html) {
        const key = html || '';
        if (parseCache.has(key)) return parseCache.get(key);
        const mm = /data-mood="([1-5])"/.exec(key);
        const tags = new Set();
        const re = /(^|\s)#(\p{L}[\p{L}\p{N}_]{0,29})/gu;
        const t = textOf(key); let m;
        while ((m = re.exec(t))) tags.add(m[2].toLowerCase());
        const res = { mood: mm ? +mm[1] : 0, tags: Array.from(tags), words: t ? t.split(' ').filter(Boolean).length : 0 };
        if (parseCache.size > 800) parseCache.clear();
        parseCache.set(key, res);
        return res;
    }

    const pad = (n) => String(n).padStart(2, '0');
    const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };

    function streakInfo() {
        const days = new Set(writingEntries().map((e) => dayKey(e.date)));
        const d = new Date(); d.setHours(12, 0, 0, 0);
        const today = new Date(d);
        if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);   // streak survives until midnight
        let cur = 0;
        while (days.has(dayKey(d))) { cur++; d.setDate(d.getDate() - 1); }
        let best = 0, run = 0, prev = null;
        Array.from(days).sort().forEach((k) => {
            const t = new Date(`${k}T12:00:00`);
            run = prev && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1;
            best = Math.max(best, run); prev = t;
        });
        const week = [];
        for (let i = 6; i >= 0; i--) {
            const x = new Date(today); x.setDate(today.getDate() - i);
            week.push({ on: days.has(dayKey(x)), today: i === 0, label: 'אבגדהוש'[x.getDay()] });
        }
        return { cur, best, week, weekCount: week.filter((w) => w.on).length, total: days.size };
    }

    /* ------------------------------------------------------------------
       Small UI helpers: toast + bottom sheet
       ------------------------------------------------------------------ */
    function toast(msg) {
        const c = $('#toast-container'); if (!c) return;
        const t = document.createElement('div'); t.className = 'toast-message'; t.textContent = msg; c.appendChild(t);
        setTimeout(() => t.classList.add('show'), 10);
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 320); }, 2600);
    }

    let sheet = null;
    function closeSheet(instant) {
        if (!sheet) return;
        const s = sheet; sheet = null;
        document.removeEventListener('keydown', s.onKey);
        if (instant) { s.root.remove(); return; }
        const m = M();
        m.play(s.panel, { transform: [s.panel.style.transform || 'translateY(0px)', 'translateY(105%)'] }, { duration: 0.24, ease: [0.4, 0, 1, 1], clear: [] });
        m.play(s.scrim, { opacity: [1, 0] }, { duration: 0.22, clear: [] }).then(() => s.root.remove());
    }
    function openSheet({ title, items }) {
        closeSheet(true);
        const root = document.createElement('div'); root.className = 'luna-sheet-root';
        root.innerHTML = `<div class="luna-sheet-scrim"></div>
            <div class="luna-sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
                <div class="luna-sheet-head"><div class="luna-sheet-grab"></div><h3>${esc(title)}</h3></div>
                <div class="luna-sheet-list">${items.map((it, i) => `<button class="luna-sheet-item" data-i="${i}"><i data-lucide="${esc(it.icon || 'book-open')}"></i><span>${esc(it.label)}</span></button>`).join('')}</div>
            </div>`;
        document.body.appendChild(root);
        icons();
        const panel = $('.luna-sheet', root), scrim = $('.luna-sheet-scrim', root), head = $('.luna-sheet-head', root);
        const onKey = (e) => { if (e.key === 'Escape') closeSheet(); };
        document.addEventListener('keydown', onKey);
        sheet = { root, panel, scrim, onKey };
        const m = M();
        m.play(scrim, { opacity: [0, 1] }, { duration: 0.22 });
        m.play(panel, { transform: ['translateY(100%)', 'translateY(0px)'] }, { duration: 0.42, ease: m.EASE_DRAWER });

        scrim.addEventListener('click', () => closeSheet());
        root.addEventListener('click', (e) => {
            const b = e.target.closest('.luna-sheet-item'); if (!b) return;
            const it = items[+b.dataset.i]; closeSheet(true); it && it.onSelect && it.onSelect();
        });

        // drag to dismiss: follows finger, rubber-bands upward, respects velocity
        let startY = 0, dy = 0, lastY = 0, lastT = 0, v = 0, dragging = false;
        head.addEventListener('pointerdown', (e) => { dragging = true; startY = lastY = e.clientY; lastT = e.timeStamp; dy = 0; v = 0; head.setPointerCapture(e.pointerId); });
        head.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const raw = e.clientY - startY;
            dy = raw >= 0 ? raw : -Math.pow(-raw, 0.7);
            const dt = Math.max(1, e.timeStamp - lastT); v = (e.clientY - lastY) / dt; lastY = e.clientY; lastT = e.timeStamp;
            panel.style.transform = `translateY(${dy}px)`;
            scrim.style.opacity = String(Math.max(0, 1 - dy / 400));
        });
        const end = () => {
            if (!dragging) return; dragging = false;
            if (dy > 90 || v > 0.55) { closeSheet(); return; }
            m.play(panel, { transform: [`translateY(${dy}px)`, 'translateY(0px)'] }, { duration: 0.38, ease: m.EASE_DRAWER, clear: ['transform'] });
            scrim.style.opacity = '';
        };
        head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
        const first = $('.luna-sheet-item', root); first && first.focus({ preventScroll: true });
    }

    /* ------------------------------------------------------------------
       Composer: mood picker, tag shortcuts, live word count
       ------------------------------------------------------------------ */
    let composerMood = 0;

    function ensureMarker(ta, mood) {
        let mk = ta.querySelector('.luna-meta');
        if (!mood) { if (mk) mk.remove(); return; }
        if (!mk) {
            mk = document.createElement('span'); mk.className = 'luna-meta';
            mk.setAttribute('contenteditable', 'false'); ta.appendChild(mk);
        }
        mk.dataset.mood = String(mood);
    }
    function placeCaretAtEnd(ta) {
        const sel = window.getSelection();
        if (sel.rangeCount && ta.contains(sel.anchorNode)) return;
        ta.focus();
        const r = document.createRange(); r.selectNodeContents(ta); r.collapse(false);
        sel.removeAllRanges(); sel.addRange(r);
    }

    function enhanceComposer() {
        const ta = $('#entry-textarea'); const meta = $('#composer-view .composer-metadata');
        if (!ta || !meta || ta.dataset.luna) return;
        ta.dataset.luna = '1';
        const jr = journals().find((j) => j.id === (window.appData && window.appData.currentJournalId));
        if (jr && jr.type === 'graph') return;                       // weight journal: no mood/tags

        const marker = ta.querySelector('.luna-meta');
        composerMood = marker ? +marker.dataset.mood || 0 : 0;

        if (!ta.isContentEditable) {                                 // view mode: read-only badge
            if (composerMood) meta.insertAdjacentHTML('afterend', `<div class="luna-view-mood">${pillHTML(composerMood)}</div>`);
            return;
        }

        const topTags = tagCounts(writingEntries()).slice(0, 8);
        const row = document.createElement('div'); row.className = 'luna-composer-row';
        row.innerHTML = `
            <div class="luna-mood-group" role="radiogroup" aria-label="מצב רוח">
                ${MOODS.map((m) => `<button type="button" class="luna-mood-btn" role="radio" data-v="${m.v}" style="--mood:var(--mood-${m.v})" aria-label="${m.l}" aria-checked="${composerMood === m.v}">${m.e}</button>`).join('')}
            </div>
            <div class="luna-sub"><span class="luna-mood-label"></span><span class="luna-wordcount"></span></div>
            ${topTags.length ? `<div class="luna-tag-row">${topTags.map((t) => `<button type="button" class="luna-tag" data-insert="#${esc(t.tag)}">#${esc(t.tag)}</button>`).join('')}</div>` : ''}`;
        meta.after(row);

        const label = $('.luna-mood-label', row), wc = $('.luna-wordcount', row);
        const paint = () => {
            $$('.luna-mood-btn', row).forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.v === composerMood)));
            label.textContent = composerMood ? moodOf(composerMood).l : 'איך עבר עליך?';
        };
        const count = () => {
            const n = parse(ta.innerHTML).words; wc.textContent = n ? `${n} מילים` : '';
            // show the placeholder when the only thing inside is the hidden mood marker
            ta.classList.toggle('luna-empty-body', n === 0 && !!ta.querySelector('.luna-meta') && !ta.querySelector('img, input, .question-item'));
        };
        paint(); count();
        ta.addEventListener('input', count);

        row.addEventListener('click', (e) => {
            const mb = e.target.closest('.luna-mood-btn');
            if (mb) {
                const v = +mb.dataset.v; composerMood = composerMood === v ? 0 : v;
                ensureMarker(ta, composerMood); paint(); count(); M().pop(mb);
                if (navigator.vibrate) navigator.vibrate(8);
                return;
            }
        });
        row.addEventListener('pointerdown', (e) => { if (e.target.closest('.luna-tag')) e.preventDefault(); });   // keep caret
        row.addEventListener('click', (e) => {
            const tb = e.target.closest('.luna-tag'); if (!tb) return;
            placeCaretAtEnd(ta);
            document.execCommand('insertText', false, `${tb.dataset.insert} `);
            count();
        });
    }

    // Before main.js reads innerHTML on save, make sure the marker matches the UI
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#save-btn')) return;
        const ta = $('#entry-textarea');
        if (ta && ta.dataset.luna && ta.isContentEditable) ensureMarker(ta, composerMood);
    }, true);

    /* ------------------------------------------------------------------
       Cards: mood pill + tag chips, filtering
       ------------------------------------------------------------------ */
    const pillHTML = (v) => `<span class="luna-mood-pill" style="--mood:var(--mood-${v})">${moodOf(v).e} ${moodOf(v).l}</span>`;

    function decorate(container) {
        $$('.journal-card:not([data-luna])', container).forEach((card) => {
            card.dataset.luna = '1';
            const entry = findEntry(card.dataset.journalId, card.dataset.id);
            if (!entry) return;
            const p = parse(entry.text);
            card.dataset.lunaMood = p.mood || '';
            card.dataset.lunaTags = p.tags.join(' ');
            if (p.mood) { const md = $('.metadata', card); md && md.insertAdjacentHTML('beforeend', pillHTML(p.mood)); }
            if (p.tags.length) {
                const body = $('.body-text', card);
                body && body.insertAdjacentHTML('afterend', `<div class="luna-tags">${p.tags.slice(0, 6).map((t) => `<button type="button" class="luna-tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>`);
            }
        });
    }

    const filter = { scope: null, tag: null, mood: 0, keep: false };

    function tagCounts(entries) {
        const map = new Map();
        entries.forEach((e) => parse(e.text).tags.forEach((t) => map.set(t, (map.get(t) || 0) + 1)));
        return Array.from(map, ([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag, 'he'));
    }

    let barHtml = '';
    function renderFilterBar() {
        const timeline = $('#timeline-view'); if (!timeline) return;
        let bar = $('#luna-filter-bar');
        if (!bar) { bar = document.createElement('div'); bar.id = 'luna-filter-bar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'סינון'); const sb = $('.search-bar-container', timeline); sb.after(bar); }
        const entries = scopeEntries();
        const moodN = [0, 0, 0, 0, 0, 0]; entries.forEach((e) => { moodN[parse(e.text).mood]++; });
        const tags = tagCounts(entries).slice(0, 14);
        if (filter.tag && !tags.some((t) => t.tag === filter.tag)) filter.tag = null;
        const moods = MOODS.filter((m) => moodN[m.v] > 0);
        const html = [
            ...moods.map((m) => `<button class="luna-chip" data-mood="${m.v}" aria-pressed="${filter.mood === m.v}" aria-label="${m.l}">${m.e} <span class="n">${moodN[m.v]}</span></button>`),
            moods.length && tags.length ? '<span class="luna-bar-sep"></span>' : '',
            ...tags.map((t) => `<button class="luna-chip" data-tag="${esc(t.tag)}" aria-pressed="${filter.tag === t.tag}">#${esc(t.tag)} <span class="n">${t.n}</span></button>`)
        ].join('');
        bar.hidden = !html;
        if (html !== barHtml) { bar.innerHTML = html; barHtml = html; }
    }

    function applyFilter() {
        const feed = $('#journal-feed'); if (!feed) return;
        const scope = (window.appData && window.appData.currentJournalId) || 'all';
        if (filter.scope !== scope) { filter.scope = scope; filter.tag = null; filter.mood = 0; }
        renderFilterBar();
        const active = !!(filter.tag || filter.mood);
        let header = null, any = false;
        Array.from(feed.children).forEach((ch) => {
            if (ch.classList.contains('month-header')) { header = ch; ch.hidden = active; return; }
            if (!ch.classList.contains('journal-card')) return;
            const tags = (ch.dataset.lunaTags || '').split(' ');
            const ok = (!filter.tag || tags.includes(filter.tag)) && (!filter.mood || +ch.dataset.lunaMood === filter.mood);
            ch.hidden = !ok;
            if (ok) { any = true; if (active && header) { header.hidden = false; header = null; } }
        });
        const old = $('.luna-empty', feed);
        if (active && !any) { if (!old) feed.insertAdjacentHTML('beforeend', '<p class="luna-empty">אין רשומות שמתאימות לסינון</p>'); }
        else if (old) old.remove();
    }

    document.addEventListener('click', (e) => {
        const chip = e.target.closest('#luna-filter-bar .luna-chip');
        if (chip) {
            if (chip.dataset.tag) filter.tag = filter.tag === chip.dataset.tag ? null : chip.dataset.tag;
            else filter.mood = filter.mood === +chip.dataset.mood ? 0 : +chip.dataset.mood;
            $$('#luna-filter-bar .luna-chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.tag ? c.dataset.tag === filter.tag : +c.dataset.mood === filter.mood)));
            applyFilter();
            return;
        }
        const tagBtn = e.target.closest('.journal-card .luna-tag');
        if (tagBtn) {                       // don't open the entry; filter by this tag
            e.stopPropagation();
            filter.tag = tagBtn.dataset.tag;
            applyFilter(); $('#journal-feed') && $('#timeline-view') && ($('#timeline-view').scrollTop = 0);
        }
    }, true);

    /* ------------------------------------------------------------------
       Home: streak, daily prompt, on-this-day
       ------------------------------------------------------------------ */
    let promptShift = 0, homeHtml = '', lastStreak = -1;

    const dayIndex = () => { const d = new Date(); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5); };
    const currentPrompt = () => PROMPTS[(dayIndex() + promptShift) % PROMPTS.length];
    const writable = () => journals().filter((j) => !j.type || j.type === 'default');

    function memories() {
        const now = new Date();
        return writingEntries().filter((e) => {
            const d = new Date(e.date);
            return d.getMonth() === now.getMonth() && d.getDate() === now.getDate() && d.getFullYear() < now.getFullYear() && textOf(e.text).length > 0;
        }).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 2);
    }

    function renderHome() {
        const anchor = $('#insights-widget-container'); if (!anchor) return;
        let root = $('#luna-home-extras');
        if (!root) { root = document.createElement('section'); root.id = 'luna-home-extras'; root.setAttribute('aria-label', 'היום'); anchor.after(root); }
        if (!journals().length) { root.hidden = true; return; }
        root.hidden = false;

        const s = streakInfo();
        const title = s.cur === 0 ? 'התחל/י רצף חדש היום' : s.cur === 1 ? 'יום אחד ברצף' : 'ימים ברצף כתיבה';
        const mem = memories();
        const html = `
            <div class="luna-card luna-streak" id="luna-streak">
                <div class="luna-streak-num" aria-hidden="true">${s.cur}</div>
                <div class="luna-streak-meta">
                    <p class="luna-streak-title" aria-label="${s.cur} ימים ברצף">${title}</p>
                    <div class="luna-week">${s.week.map((d) => `<div class="luna-day${d.on ? ' on' : ''}${d.today ? ' today' : ''}"><b></b>${d.label}</div>`).join('')}</div>
                </div>
            </div>
            <div class="luna-card" id="luna-prompt-card">
                <p class="luna-eyebrow">שאלה להיום</p>
                <p class="luna-prompt-text">${esc(currentPrompt())}</p>
                <div class="luna-card-actions">
                    <button class="luna-card-btn primary" data-act="write"><i data-lucide="pen-line"></i>כתוב/י על זה</button>
                    <button class="luna-card-btn" data-act="shuffle" aria-label="שאלה אחרת"><i data-lucide="shuffle"></i></button>
                </div>
            </div>
            ${mem.map((e) => {
                const yrs = new Date().getFullYear() - new Date(e.date).getFullYear();
                const snippet = textOf(e.text).slice(0, 200);
                return `<div class="journal-card luna-memory-card" data-id="${esc(e.id)}" data-journal-id="${esc(e.journalId)}" role="button" tabindex="0">
                    <p class="luna-eyebrow">ביום הזה · לפני ${yrs === 1 ? 'שנה' : yrs + ' שנים'} · ${esc(e.journalName || '')}</p>
                    <div class="body-text" dir="auto">${esc(snippet)}</div></div>`;
            }).join('')}`;

        if (html === homeHtml) return;
        homeHtml = html; root.innerHTML = html; icons();
        if (lastStreak !== s.cur) { M().countUp($('.luna-streak-num', root), s.cur, 0.8); lastStreak = s.cur; }
    }

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#luna-prompt-card [data-act]'); if (btn) {
            if (btn.dataset.act === 'write') startWriting(currentPrompt());
            else {
                const t = $('#luna-prompt-card .luna-prompt-text'), m = M();
                promptShift = (promptShift + 1 + Math.floor(Math.random() * 5)) % PROMPTS.length;
                if (t) m.play(t, { opacity: [1, 0], transform: ['translateY(0px)', 'translateY(-4px)'] }, { duration: 0.12, clear: [] }).then(() => {
                    t.textContent = currentPrompt();
                    m.play(t, { opacity: [0, 1], transform: ['translateY(6px)', 'translateY(0px)'] }, { duration: 0.28 });
                });
                homeHtml = '';
            }
            return;
        }
    }, true);
    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('luna-memory-card')) { e.preventDefault(); e.target.click(); }
    });

    function startWriting(promptText) {
        const list = writable();
        if (!list.length) { toast('צרו יומן רגיל כדי להתחיל לכתוב'); return; }
        if (list.length === 1) { openComposerWithPrompt(list[0].id, promptText); return; }
        openSheet({
            title: 'באיזה יומן לכתוב?',
            items: list.map((j) => ({ label: j.name, icon: /^[a-z0-9-]+$/.test(j.icon || '') ? j.icon : 'book-open', onSelect: () => openComposerWithPrompt(j.id, promptText) }))
        });
    }
    function openComposerWithPrompt(journalId, q) {
        if (typeof window.showTimelineView !== 'function') return;
        window.showTimelineView(journalId);
        const fab = $('#fab'); if (!fab) return;
        fab.click();                                   // main.js opens the composer synchronously
        const ta = $('#entry-textarea'); if (!ta || !q) return;
        ta.innerHTML = `<div class="question-item"><div class="question-text">${esc(q)}</div><div class="answer-text" contenteditable="true" placeholder="התשובה שלך..."></div></div><div><br></div>`;
        const ans = $('.answer-text', ta); ans && setTimeout(() => ans.focus(), 380);
    }

    /* ------------------------------------------------------------------
       Insights extras
       ------------------------------------------------------------------ */
    function renderInsights(animate) {
        const host = $('#insights-view .insights-main-stats'); if (!host) return;
        let root = $('#luna-insights-extras');
        if (!root) { root = document.createElement('section'); root.id = 'luna-insights-extras'; host.after(root); }
        const s = streakInfo(), all = writingEntries();

        // 30-day mood series
        const sums = new Map();
        all.forEach((e) => { const p = parse(e.text); if (!p.mood) return; const k = dayKey(e.date); const o = sums.get(k) || { t: 0, n: 0 }; o.t += p.mood; o.n++; sums.set(k, o); });
        const bars = []; let tot = 0, cnt = 0; const today = new Date(); today.setHours(12, 0, 0, 0);
        for (let i = 29; i >= 0; i--) {
            const d = new Date(today); d.setDate(today.getDate() - i);
            const o = sums.get(dayKey(d));
            if (o) { const a = o.t / o.n; tot += o.t; cnt += o.n; bars.push({ a }); } else bars.push({ a: 0 });
        }
        const avg = cnt ? tot / cnt : 0;
        const tags = tagCounts(all).slice(0, 12);

        root.innerHTML = `
            <div class="luna-stat-row">
                <div class="luna-stat"><div class="v">${s.cur}</div><div class="l">רצף נוכחי</div></div>
                <div class="luna-stat"><div class="v">${s.best}</div><div class="l">הרצף הארוך ביותר</div></div>
                <div class="luna-stat"><div class="v">${s.weekCount}/7</div><div class="l">ימים השבוע</div></div>
            </div>
            <div class="luna-card">
                <p class="luna-eyebrow">מצב רוח · 30 ימים אחרונים</p>
                ${cnt ? `<div class="luna-mood-chart" role="img" aria-label="גרף מצב רוח">${bars.map((b) => `<div class="luna-bar" style="height:${b.a ? 14 + (b.a / 5) * 58 : 5}px;${b.a ? `background:var(--mood-${Math.round(b.a)})` : ''}"></div>`).join('')}</div>
                       <div class="luna-mood-sub"><span>ממוצע ${avg.toFixed(1)} · ${moodOf(Math.round(avg)).l}</span><span>${cnt} רישומים</span></div>`
                    : '<p class="luna-empty" style="padding:18px 0 4px">בחר/י מצב רוח בכתיבה, וכאן תופיע המגמה שלך.</p>'}
            </div>
            ${tags.length ? `<div class="luna-card"><p class="luna-eyebrow">תגיות נפוצות</p><div class="luna-tag-cloud">${tags.map((t) => `<button class="luna-chip" data-cloud-tag="${esc(t.tag)}">#${esc(t.tag)} <span class="n">${t.n}</span></button>`).join('')}</div></div>` : ''}`;

        if (animate) $$('.luna-bar', root).forEach((b, i) => M().play(b, { transform: ['scaleY(0)', 'scaleY(1)'] }, { duration: 0.5, delay: 0.1 + i * 0.012 }));
    }

    document.addEventListener('click', (e) => {
        const c = e.target.closest('[data-cloud-tag]'); if (!c) return;
        filter.tag = c.dataset.cloudTag; filter.mood = 0; filter.scope = 'all'; filter.keep = true;
        const b = $('#show-all-entries-btn'); b && b.click();
    });

    /* ------------------------------------------------------------------
       Boot — runs after main.js's own DOMContentLoaded handler
       ------------------------------------------------------------------ */
    function watchVisible(el, onShow) {
        if (!el) return;
        let was = false;
        new MutationObserver(() => {
            const vis = el.style.display !== 'none' && el.style.display !== '';
            if (vis && !was) onShow(); was = vis;
        }).observe(el, { attributes: true, attributeFilter: ['style'] });
    }
    function watchChildren(el, fn) {
        if (!el) return;
        const obs = new MutationObserver(() => { obs.disconnect(); try { fn(); } finally { obs.observe(el, { childList: true }); } });
        obs.observe(el, { childList: true });
    }

    function boot() {
        // 1) leaving/entering the timeline resets the filter (created first -> runs first)
        watchVisible($('#timeline-view'), () => { if (!filter.keep) { filter.tag = null; filter.mood = 0; } filter.keep = false; });
        // 2) composer content is rebuilt by main.js on every open
        watchChildren($('#composer-view'), enhanceComposer);
        // 3) feeds
        watchChildren($('#journal-feed'), () => { decorate($('#journal-feed')); applyFilter(); });
        watchChildren($('#entries-for-date-view'), () => decorate($('#entries-for-date-view')));
        // 4) home + insights refresh with every Firebase value event (widget is re-rendered each time)
        watchChildren($('#insights-widget-container'), () => { renderHome(); if ($('#insights-view') && $('#insights-view').style.display === 'block') renderInsights(false); });
        watchVisible($('#journals-list-view'), renderHome);
        watchVisible($('#insights-view'), () => renderInsights(true));
        renderHome();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
