(function () {
    'use strict';

    var overlay = document.getElementById('payment-result-overlay');
    var dialog = overlay && overlay.querySelector('[role="dialog"]');
    if (!dialog) return;

    var focusableSelector =
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    var lastFocused = document.activeElement;

    function getFocusable() {
        return Array.prototype.slice
            .call(dialog.querySelectorAll(focusableSelector))
            .filter(function (el) {
                return el.offsetParent !== null && !el.hidden;
            });
    }

    function trapFocus(e) {
        if (e.key !== 'Tab') return;
        var items = getFocusable();
        if (!items.length) return;
        var first = items[0];
        var last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    function dismissTarget() {
        var primary = dialog.querySelector('.payment-result-btn--primary, .payment-result-btn');
        var secondary = dialog.querySelector('.payment-result-btn-link');
        var target = primary || secondary;
        if (target && target.href) {
            window.location.assign(target.href);
        }
    }

    function onEscape(e) {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        dismissTarget();
    }

    function initFocus() {
        var items = getFocusable();
        if (items.length) {
            items[0].focus();
        } else {
            dialog.focus();
        }
    }

    function onBusyChange() {
        if (dialog.getAttribute('aria-busy') !== 'true') {
            initFocus();
        }
    }

    dialog.addEventListener('keydown', trapFocus);
    document.addEventListener('keydown', onEscape);

    var closeBtn = dialog.querySelector('[data-payment-result-close]');
    if (closeBtn) {
        closeBtn.addEventListener('click', dismissTarget);
    }

    if (dialog.getAttribute('aria-busy') === 'true') {
        var observer = new MutationObserver(onBusyChange);
        observer.observe(dialog, { attributes: true, attributeFilter: ['aria-busy'] });
    } else {
        initFocus();
    }

    window.addEventListener(
        'pagehide',
        function () {
            if (lastFocused && typeof lastFocused.focus === 'function') {
                try {
                    lastFocused.focus();
                } catch (_) {}
            }
        },
        { once: true }
    );
})();
