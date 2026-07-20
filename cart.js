/**
 * Online courses shopping cart (localStorage) + drawer UI.
 * Udemy-style: add from catalog, review in drawer, checkout with line items.
 */
(function (global) {
    'use strict';

    var STORAGE_KEY = 'kns_online_cart_v1';
    var MAX_ITEMS = 20;

    function safeParse(raw) {
        try {
            var data = JSON.parse(raw);
            return Array.isArray(data) ? data : [];
        } catch (e) {
            return [];
        }
    }

    function readCart() {
        try {
            return safeParse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch (e) {
            return [];
        }
    }

    function writeCart(items) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
        } catch (e) {
            /* quota / private mode */
        }
        dispatchChange();
    }

    function normalizeItem(item) {
        if (!item || typeof item !== 'object') return null;
        var courseKey = String(item.courseKey || '').trim();
        var enrollCourseName = String(item.enrollCourseName || item.courseName || courseKey).trim();
        var displayTitle = String(item.displayTitle || enrollCourseName).trim();
        if (!courseKey && !enrollCourseName) return null;
        var amount = parseInt(item.amountSleMinor, 10);
        if (!Number.isInteger(amount) || amount < 1) amount = 100;
        return {
            courseKey: courseKey || enrollCourseName,
            enrollCourseName: enrollCourseName,
            displayTitle: displayTitle,
            priceLabel: String(item.priceLabel || 'NLe1').trim() || 'NLe1',
            amountSleMinor: amount,
            imageSrc: String(item.imageSrc || 'images/kns-certificate.jpg').trim()
        };
    }

    function dispatchChange() {
        var items = readCart();
        try {
            document.dispatchEvent(
                new CustomEvent('kns-cart-changed', {
                    detail: { items: items, count: items.length, totalMinor: totalMinor(items) }
                })
            );
        } catch (e) {
            /* older browsers */
        }
        updateBadges(items.length);
        renderDrawer(items);
    }

    function totalMinor(items) {
        return (items || readCart()).reduce(function (sum, it) {
            return sum + (Number(it.amountSleMinor) || 0);
        }, 0);
    }

    function formatPriceLabel(items) {
        var list = items || readCart();
        if (!list.length) return '';
        var labels = {};
        list.forEach(function (it) {
            labels[it.priceLabel] = true;
        });
        var keys = Object.keys(labels);
        if (keys.length === 1) {
            return list.length === 1 ? keys[0] : list.length + ' × ' + keys[0];
        }
        var minor = totalMinor(list);
        var major = (minor / 100).toFixed(minor % 100 === 0 ? 0 : 2);
        return 'NLe' + major;
    }

    function getItems() {
        return readCart();
    }

    function getCount() {
        return readCart().length;
    }

    function findIndex(courseKey) {
        var key = String(courseKey || '').trim();
        if (!key) return -1;
        var items = readCart();
        for (var i = 0; i < items.length; i++) {
            if (items[i].courseKey === key || items[i].enrollCourseName === key) return i;
        }
        return -1;
    }

    function has(courseKey) {
        return findIndex(courseKey) >= 0;
    }

    function add(rawItem) {
        var item = normalizeItem(rawItem);
        if (!item) return { ok: false, reason: 'invalid' };
        var items = readCart();
        if (findIndex(item.courseKey) >= 0 || findIndex(item.enrollCourseName) >= 0) {
            return { ok: false, reason: 'duplicate', item: item };
        }
        if (items.length >= MAX_ITEMS) {
            return { ok: false, reason: 'full' };
        }
        items.push(item);
        writeCart(items);
        return { ok: true, item: item, count: items.length };
    }

    function remove(courseKey) {
        var items = readCart().filter(function (it) {
            return it.courseKey !== courseKey && it.enrollCourseName !== courseKey;
        });
        writeCart(items);
        return items;
    }

    function clear() {
        writeCart([]);
    }

    /** Buy now: replace cart with one course, then go to checkout. */
    function buyNow(rawItem) {
        var item = normalizeItem(rawItem);
        if (!item) return false;
        writeCart([item]);
        window.location.href = 'checkout.html';
        return true;
    }

    function goToCheckout() {
        if (!readCart().length) return false;
        window.location.href = 'checkout.html';
        return true;
    }

    /* ---------- UI: badge + drawer ---------- */

    function updateBadges(count) {
        var n = typeof count === 'number' ? count : getCount();
        document.querySelectorAll('[data-cart-badge]').forEach(function (el) {
            el.textContent = String(n);
            el.hidden = n < 1;
            el.setAttribute('aria-label', n + (n === 1 ? ' course' : ' courses') + ' in cart');
        });
        document.querySelectorAll('[data-cart-count-text]').forEach(function (el) {
            el.textContent = n === 0 ? 'Cart is empty' : n === 1 ? '1 course in cart' : n + ' courses in cart';
        });
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function ensureDrawer() {
        if (document.getElementById('knsCartDrawer')) return;
        var root = document.createElement('div');
        root.id = 'knsCartDrawer';
        root.className = 'kns-cart-drawer';
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML =
            '<div class="kns-cart-drawer__backdrop" data-cart-close tabindex="-1" aria-hidden="true"></div>' +
            '<aside class="kns-cart-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="knsCartDrawerTitle">' +
            '  <header class="kns-cart-drawer__header">' +
            '    <h2 id="knsCartDrawerTitle" class="kns-cart-drawer__title">Shopping cart</h2>' +
            '    <button type="button" class="kns-cart-drawer__close" data-cart-close aria-label="Close cart">&times;</button>' +
            '  </header>' +
            '  <div class="kns-cart-drawer__body" id="knsCartDrawerBody"></div>' +
            '  <footer class="kns-cart-drawer__footer" id="knsCartDrawerFooter"></footer>' +
            '</aside>';
        document.body.appendChild(root);

        root.addEventListener('click', function (e) {
            var t = e.target;
            if (t && t.closest && t.closest('[data-cart-close]')) {
                closeDrawer();
                return;
            }
            var removeBtn = t && t.closest && t.closest('[data-cart-remove]');
            if (removeBtn) {
                remove(removeBtn.getAttribute('data-cart-remove'));
                return;
            }
            if (t && t.closest && t.closest('[data-cart-checkout]')) {
                goToCheckout();
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && root.classList.contains('is-open')) closeDrawer();
        });
    }

    function renderDrawer(items) {
        ensureDrawer();
        var body = document.getElementById('knsCartDrawerBody');
        var footer = document.getElementById('knsCartDrawerFooter');
        if (!body || !footer) return;
        var list = items || readCart();

        if (!list.length) {
            body.innerHTML =
                '<div class="kns-cart-drawer__empty">' +
                '<p>Your cart is empty.</p>' +
                '<a href="online-courses.html" class="btn btn-secondary" data-cart-close>Browse courses</a>' +
                '</div>';
            footer.innerHTML = '';
            return;
        }

        body.innerHTML =
            '<ul class="kns-cart-drawer__list">' +
            list
                .map(function (it) {
                    return (
                        '<li class="kns-cart-line">' +
                        '<img class="kns-cart-line__thumb" src="' +
                        escapeHtml(it.imageSrc) +
                        '" alt="" loading="lazy" width="72" height="40">' +
                        '<div class="kns-cart-line__meta">' +
                        '<p class="kns-cart-line__title">' +
                        escapeHtml(it.displayTitle) +
                        '</p>' +
                        '<p class="kns-cart-line__price">' +
                        escapeHtml(it.priceLabel) +
                        '</p>' +
                        '</div>' +
                        '<button type="button" class="kns-cart-line__remove" data-cart-remove="' +
                        escapeHtml(it.courseKey) +
                        '" aria-label="Remove ' +
                        escapeHtml(it.displayTitle) +
                        '">&times;</button>' +
                        '</li>'
                    );
                })
                .join('') +
            '</ul>';

        footer.innerHTML =
            '<div class="kns-cart-drawer__total">' +
            '<span>Total</span>' +
            '<strong>' +
            escapeHtml(formatPriceLabel(list)) +
            '</strong>' +
            '</div>' +
            '<button type="button" class="btn btn-primary kns-cart-drawer__checkout" data-cart-checkout>Go to checkout</button>';
    }

    function openDrawer() {
        ensureDrawer();
        renderDrawer(readCart());
        var root = document.getElementById('knsCartDrawer');
        if (!root) return;
        if (!root.classList.contains('is-open')) {
            root.classList.add('is-open');
            root.setAttribute('aria-hidden', 'false');
            if (typeof KNS !== 'undefined' && KNS.lockScroll) {
                KNS.lockScroll('cart');
            } else {
                document.body.classList.add('kns-cart-open', 'kns-scroll-locked');
            }
        }
    }

    function closeDrawer() {
        var root = document.getElementById('knsCartDrawer');
        if (!root || !root.classList.contains('is-open')) return;
        root.classList.remove('is-open');
        root.setAttribute('aria-hidden', 'true');
        if (typeof KNS !== 'undefined' && KNS.unlockScroll) {
            KNS.unlockScroll('cart');
        } else {
            document.body.classList.remove('kns-cart-open', 'kns-scroll-locked');
        }
    }

    function toggleDrawer() {
        var root = document.getElementById('knsCartDrawer');
        if (root && root.classList.contains('is-open')) closeDrawer();
        else openDrawer();
    }

    function showToast(message) {
        var existing = document.getElementById('knsCartToast');
        if (existing) existing.remove();
        var el = document.createElement('div');
        el.id = 'knsCartToast';
        el.className = 'kns-cart-toast';
        el.setAttribute('role', 'status');
        el.textContent = message;
        document.body.appendChild(el);
        requestAnimationFrame(function () {
            el.classList.add('is-visible');
        });
        setTimeout(function () {
            el.classList.remove('is-visible');
            setTimeout(function () {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 280);
        }, 2200);
    }

    function bindTriggers() {
        document.addEventListener('click', function (e) {
            var t = e.target;
            if (!t || !t.closest) return;

            var openBtn = t.closest('[data-cart-open]');
            if (openBtn) {
                e.preventDefault();
                openDrawer();
                return;
            }

            var addBtn = t.closest('[data-cart-add]');
            if (addBtn) {
                e.preventDefault();
                var payload = {
                    courseKey: addBtn.getAttribute('data-course-key') || '',
                    enrollCourseName: addBtn.getAttribute('data-course-name') || '',
                    displayTitle: addBtn.getAttribute('data-display-title') || '',
                    priceLabel: addBtn.getAttribute('data-price-label') || 'NLe1',
                    amountSleMinor: addBtn.getAttribute('data-amount-sle-minor') || '100',
                    imageSrc: addBtn.getAttribute('data-image-src') || 'images/kns-certificate.jpg'
                };
                var result = add(payload);
                if (result.ok) {
                    addBtn.classList.add('is-in-cart');
                    addBtn.textContent = 'In cart';
                    showToast('Added to cart');
                    openDrawer();
                } else if (result.reason === 'duplicate') {
                    addBtn.classList.add('is-in-cart');
                    addBtn.textContent = 'In cart';
                    showToast('Already in cart');
                    openDrawer();
                } else if (result.reason === 'full') {
                    showToast('Cart is full (max ' + MAX_ITEMS + ' courses)');
                }
                return;
            }

            var buyBtn = t.closest('[data-cart-buy-now]');
            if (buyBtn) {
                e.preventDefault();
                buyNow({
                    courseKey: buyBtn.getAttribute('data-course-key') || '',
                    enrollCourseName: buyBtn.getAttribute('data-course-name') || '',
                    displayTitle: buyBtn.getAttribute('data-display-title') || '',
                    priceLabel: buyBtn.getAttribute('data-price-label') || 'NLe1',
                    amountSleMinor: buyBtn.getAttribute('data-amount-sle-minor') || '100',
                    imageSrc: buyBtn.getAttribute('data-image-src') || 'images/kns-certificate.jpg'
                });
            }
        });
    }

    function syncAddButtons() {
        document.querySelectorAll('[data-cart-add]').forEach(function (btn) {
            var key = btn.getAttribute('data-course-key') || btn.getAttribute('data-course-name');
            if (has(key)) {
                btn.classList.add('is-in-cart');
                btn.textContent = 'In cart';
            } else {
                btn.classList.remove('is-in-cart');
                if (btn.getAttribute('data-default-label')) {
                    btn.textContent = btn.getAttribute('data-default-label');
                } else {
                    btn.textContent = 'Add to cart';
                }
            }
        });
    }

    function init() {
        ensureDrawer();
        bindTriggers();
        updateBadges();
        renderDrawer(readCart());
        syncAddButtons();
        document.addEventListener('kns-online-courses-loaded', syncAddButtons);
        document.addEventListener('kns-cart-changed', syncAddButtons);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    global.KNSCart = {
        getItems: getItems,
        getCount: getCount,
        has: has,
        add: add,
        remove: remove,
        clear: clear,
        buyNow: buyNow,
        goToCheckout: goToCheckout,
        openDrawer: openDrawer,
        closeDrawer: closeDrawer,
        toggleDrawer: toggleDrawer,
        formatPriceLabel: formatPriceLabel,
        totalMinor: totalMinor,
        showToast: showToast
    };
})(typeof window !== 'undefined' ? window : this);
