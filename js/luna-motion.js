/* Luna — motion layer (intentionally static).
   All motion was removed for a clean, fast feel on phones. The only transition left is a
   160ms opacity fade defined in luna-polish.css. This stub keeps the API that
   luna-features.js calls, so nothing else needs to change. */
(function () {
    'use strict';
    const noop = () => Promise.resolve();
    window.LunaMotion = {
        play: noop,
        pop() {},
        countUp(el, to) { if (el) el.textContent = String(to); },
        reduced: () => true,           // luna-features.js skips its FLIP / drop animations
        isRTL: () => (document.documentElement.dir || getComputedStyle(document.body).direction) === 'rtl',
        EASE_OUT: [0.23, 1, 0.32, 1],
        EASE_DRAWER: [0.32, 0.72, 0, 1]
    };
})();
