/* ==========================================================================
   Luna — motion layer
   Uses Motion (Framer Motion's vanilla engine, global `Motion`) when it has
   loaded, otherwise falls back to the Web Animations API. main.js is untouched:
   we observe the DOM it already produces and animate it.
   Rules: transform/opacity only, ease-out for entrances, <= 450ms, interruptible,
   spatially consistent (cards expand from where they were tapped).
   ========================================================================== */
(function () {
    'use strict';

    const EASE_OUT = [0.23, 1, 0.32, 1];
    const EASE_DRAWER = [0.32, 0.72, 0, 1];
    const css = (b) => `cubic-bezier(${b.join(',')})`;
    const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isRTL = () => (document.documentElement.dir || getComputedStyle(document.body).direction) === 'rtl';
    const running = new WeakMap();

    /**
     * play(el, keyframes, {duration(s), delay(s), ease(bezier[]), clear:[props]})
     * Returns a promise that resolves when finished (or cancelled).
     */
    function play(el, kf, opts) {
        if (!el) return Promise.resolve();
        const o = Object.assign({ duration: 0.3, delay: 0, ease: EASE_OUT, clear: ['opacity', 'transform'] }, opts);
        try { running.get(el)?.cancel?.(); } catch (e) { /* noop */ }

        let frames = kf;
        if (reduced()) {                       // keep meaning (fade), drop movement
            frames = {}; if (kf.opacity) frames.opacity = kf.opacity;
            o.duration = Math.min(o.duration, 0.16); o.delay = 0;
            if (!frames.opacity) return Promise.resolve();
        }
        // hold first frame during delay so staggered items don't flash
        if (o.delay > 0 && frames.opacity) el.style.opacity = String(frames.opacity[0]);

        let anim;
        try {
            if (window.Motion && typeof window.Motion.animate === 'function') {
                anim = window.Motion.animate(el, frames, { duration: o.duration, delay: o.delay, ease: o.ease });
            } else {
                anim = el.animate(frames, { duration: o.duration * 1000, delay: o.delay * 1000, easing: css(o.ease), fill: 'both' });
            }
        } catch (err) {
            try { anim = el.animate(frames, { duration: o.duration * 1000, delay: o.delay * 1000, easing: css(o.ease), fill: 'both' }); }
            catch (e2) { return Promise.resolve(); }
        }
        running.set(el, anim);

        const cleanup = () => {
            if (running.get(el) === anim) running.delete(el);
            try { anim.cancel?.(); } catch (e) { /* noop */ }
            o.clear.forEach((p) => el.style.removeProperty(p === 'clipPath' ? 'clip-path' : p));
        };
        const done = anim.finished
            || (typeof anim.then === 'function' ? anim : new Promise((r) => { anim.onfinish = r; }));
        return Promise.resolve(done).then(cleanup, cleanup);
    }

    /** Spring pop (Motion only; graceful CSS fallback). Used for mood selection. */
    function pop(el) {
        if (!el || reduced()) return;
        try {
            if (window.Motion?.animate) {
                window.Motion.animate(el, { scale: [0.82, 1] }, { type: 'spring', duration: 0.45, bounce: 0.35 });
            } else {
                el.animate({ transform: ['scale(.85)', 'scale(1)'] }, { duration: 220, easing: css(EASE_OUT) });
            }
        } catch (e) { /* noop */ }
    }

    /** Number count-up (Motion value animation). */
    function countUp(el, to, duration) {
        if (!el) return;
        if (reduced() || !window.Motion?.animate || to === 0) { el.textContent = String(to); return; }
        try {
            window.Motion.animate(0, to, {
                duration: duration || 0.7, ease: EASE_OUT,
                onUpdate: (v) => { el.textContent = String(Math.round(v)); },
                onComplete: () => { el.textContent = String(to); }
            });
        } catch (e) { el.textContent = String(to); }
    }

    window.LunaMotion = { play, pop, countUp, EASE_OUT, EASE_DRAWER, reduced, isRTL };

    /* ---------------------------------------------------------------
       1. Screen transitions
       --------------------------------------------------------------- */
    const DEPTH = {
        'auth-view': 0, 'pin-view': 0, 'pin-setup-view': 0, 'password-view': 0,
        'journals-list-view': 0, 'empty-state-container': 0,
        'timeline-view': 1,
        'insights-view': 2, 'graph-view': 2
    };
    // views whose own inline style is watched by main.js (PIN) -> animate children instead
    const ANIMATE_CHILDREN = new Set(['pin-view', 'pin-setup-view', 'password-view', 'auth-view']);
    const STAGGER_SEL = '.journal-list-item-wrapper, .journal-card, .month-header, .emotion-day-card, .luna-card, .stat-card, .insights-calendar, .pin-key';

    const wasVisible = new WeakMap();
    let lastDepth = 0;

    function enterView(el) {
        const id = el.id;
        const depth = id in DEPTH ? DEPTH[id] : lastDepth;
        const dx = (depth > lastDepth ? 1 : depth < lastDepth ? -1 : 0) * (isRTL() ? -1 : 1);
        lastDepth = depth;

        if (ANIMATE_CHILDREN.has(id)) {
            Array.from(el.children).forEach((c, i) =>
                play(c, { opacity: [0, 1], transform: ['translateY(10px)', 'translateY(0px)'] }, { duration: 0.4, delay: i * 0.05 }));
            return;
        }

        const from = dx === 0 ? 'translateY(8px)' : `translateX(${dx * 26}px)`;
        play(el, { opacity: [0, 1], transform: [from, 'translate(0px, 0px)'] }, { duration: 0.34 });

        // stagger the first screenful of content
        const vh = window.innerHeight;
        const items = Array.from(el.querySelectorAll(STAGGER_SEL)).filter((n) => {
            const r = n.getBoundingClientRect();
            return r.top < vh && r.bottom > 0;
        }).slice(0, 10);
        items.forEach((n, i) =>
            play(n, { opacity: [0, 1], transform: ['translateY(10px)', 'translateY(0px)'] }, { duration: 0.38, delay: 0.04 + i * 0.035 }));
    }

    function enterModal(overlay) {
        play(overlay, { opacity: [0, 1] }, { duration: 0.2 });
        const box = overlay.querySelector('.modal-content');
        if (box) play(box, { opacity: [0, 1], transform: ['scale(0.95) translateY(8px)', 'scale(1) translateY(0px)'] }, { duration: 0.3 });
    }

    function watch(el) {
        const isModal = el.classList.contains('modal-overlay');
        wasVisible.set(el, false);
        new MutationObserver(() => {
            const vis = el.style.display !== 'none' && el.style.display !== '';
            const prev = wasVisible.get(el);
            wasVisible.set(el, vis);
            if (vis && !prev) (isModal ? enterModal : enterView)(el);
        }).observe(el, { attributes: true, attributeFilter: ['style'] });
    }

    /* ---------------------------------------------------------------
       2. Composer: cards expand from where they were tapped
       --------------------------------------------------------------- */
    let tapped = null;   // { key, rect, t }

    function cardKey(card) { return `${card.dataset.journalId || ''}::${card.dataset.id || ''}`; }
    function findCard(key) {
        return Array.from(document.querySelectorAll('.journal-card')).find((c) => c.offsetParent !== null && cardKey(c) === key);
    }
    const insetFor = (r, rad) => `inset(${Math.max(0, r.top)}px ${Math.max(0, innerWidth - r.right)}px ${Math.max(0, innerHeight - r.bottom)}px ${Math.max(0, r.left)}px round ${rad}px)`;

    function watchComposer(composer) {
        let from = null;
        new MutationObserver(() => {
            const open = composer.classList.contains('visible');
            if (open && !composer.dataset.lunaOpen) {
                composer.dataset.lunaOpen = '1';
                const fresh = tapped && performance.now() - tapped.t < 600 ? tapped : null;
                tapped = null;
                if (fresh && !reduced()) {
                    from = fresh;
                    composer.classList.add('luna-from-card');
                    play(composer, { clipPath: [insetFor(fresh.rect, 22), 'inset(0px 0px 0px 0px round 0px)'] },
                        { duration: 0.44, ease: EASE_DRAWER, clear: ['clipPath', 'transform'] });
                } else {
                    from = null;
                    composer.classList.remove('luna-from-card');
                }
            } else if (!open && composer.dataset.lunaOpen) {
                delete composer.dataset.lunaOpen;
                if (from && !reduced()) {
                    const card = findCard(from.key);
                    const key = from; from = null;
                    if (card) {
                        const r = card.getBoundingClientRect();
                        if (r.bottom > 0 && r.top < innerHeight) {
                            // keep the clip until the layer is hidden, so the full-screen composer never flashes back
                            play(composer, { clipPath: ['inset(0px 0px 0px 0px round 0px)', insetFor(r, 22)] },
                                { duration: 0.3, ease: EASE_OUT, clear: [] })
                                .then(() => {
                                    composer.style.visibility = 'hidden';
                                    composer.classList.remove('luna-from-card');
                                    composer.style.removeProperty('clip-path');
                                    requestAnimationFrame(() => composer.style.removeProperty('visibility'));
                                });
                            return;
                        }
                    }
                    void key;
                }
                composer.classList.remove('luna-from-card');
            }
        }).observe(composer, { attributes: true, attributeFilter: ['class'] });
    }

    document.addEventListener('pointerdown', (e) => {
        const card = e.target.closest?.('.journal-card');
        if (card && card.dataset.id) tapped = { key: cardKey(card), rect: card.getBoundingClientRect(), t: performance.now() };
    }, true);
    document.addEventListener('click', (e) => {   // keyboard / programmatic activations
        const card = e.target.closest?.('.journal-card');
        if (card && card.dataset.id && (!tapped || performance.now() - tapped.t > 600)) {
            tapped = { key: cardKey(card), rect: card.getBoundingClientRect(), t: performance.now() };
        }
    }, true);

    /* ---------------------------------------------------------------
       3. Boot
       --------------------------------------------------------------- */
    function boot() {
        document.querySelectorAll('.view-screen, #empty-state-container').forEach(watch);
        document.querySelectorAll('.modal-overlay').forEach(watch);
        const composer = document.getElementById('composer-view');
        if (composer) watchComposer(composer);

        // modals created later (e.g. dynamic overlays)
        new MutationObserver((muts) => {
            muts.forEach((m) => m.addedNodes.forEach((n) => {
                if (n.nodeType === 1 && n.classList?.contains('modal-overlay')) watch(n);
            }));
        }).observe(document.body, { childList: true });
    }

    // main.js registers its DOMContentLoaded first; ours runs after it.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
