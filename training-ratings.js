(function () {
    'use strict';

    if (typeof CONFIG === 'undefined' || !CONFIG.API_BASE_URL || !CONFIG.ENDPOINTS || !CONFIG.ENDPOINTS.ONLINE_COURSE_RATINGS) {
        return;
    }

    const apiUrl =
        typeof CONFIG.buildApiUrl === 'function'
            ? CONFIG.buildApiUrl(CONFIG.ENDPOINTS.ONLINE_COURSE_RATINGS)
            : String(CONFIG.API_BASE_URL || '').replace(/\/+$/, '') + CONFIG.ENDPOINTS.ONLINE_COURSE_RATINGS;

    const STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

    const modalRoot = document.getElementById('trainingRatingModalRoot');
    const modalCourseName = document.getElementById('trainingRatingModalCourseName');
    const starRow = document.getElementById('trainingRatingStarRow');
    const commentEl = document.getElementById('trainingRatingComment');
    const emailEl = document.getElementById('trainingRatingEmail');
    const errorEl = document.getElementById('trainingRatingModalError');
    const submitBtn = document.getElementById('trainingRatingSubmit');
    const formPanel = document.getElementById('trainingRatingFormPanel');
    const successPanel = document.getElementById('trainingRatingSuccessPanel');
    const successDoneBtn = document.getElementById('trainingRatingSuccessDone');

    let activeWorkshopKey = '';
    let activeDisplayTitle = '';
    let selectedStars = 0;
    let lastFocus = null;

    function parseJsonResponse(res) {
        return res.text().then(function (text) {
            let data = {};
            if (text) {
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    data = {};
                }
            }
            return { ok: res.ok, status: res.status, data: data };
        });
    }

    function networkErrorMessage(err) {
        const msg = (err && err.message) || '';
        if (msg === 'Failed to fetch' || err instanceof TypeError) {
            return 'We could not reach the server. Check your connection and try again.';
        }
        return msg || 'We could not save your rating. Please try again later.';
    }

    function formatAverage(avg) {
        if (avg == null || Number.isNaN(Number(avg))) return '—';
        return (Math.round(Number(avg) * 10) / 10).toFixed(1);
    }

    function starsText(average) {
        if (average == null || Number.isNaN(Number(average)) || Number(average) <= 0) {
            return '☆☆☆☆☆';
        }
        const filled = Math.max(0, Math.min(5, Math.round(Number(average))));
        return '★'.repeat(filled) + '☆'.repeat(5 - filled);
    }

    function applyStatsToCard(card, stats) {
        const ratingEl = card.querySelector('[data-workshop-rating]');
        if (!ratingEl) return;

        const avgEl = ratingEl.querySelector('[data-rating-average]');
        const starsEl = ratingEl.querySelector('[data-rating-stars]');
        const countEl = ratingEl.querySelector('[data-rating-count]');

        if (!stats || !stats.count) {
            if (avgEl) avgEl.textContent = '—';
            if (starsEl) starsEl.textContent = '☆☆☆☆☆';
            if (countEl) {
                countEl.textContent = '(0)';
                countEl.hidden = true;
            }
            ratingEl.setAttribute('aria-label', 'Training rating: not yet rated');
            return;
        }

        const avg = formatAverage(stats.average);
        if (avgEl) avgEl.textContent = avg;
        if (starsEl) starsEl.textContent = starsText(stats.average);
        if (countEl) {
            countEl.textContent = '(' + String(stats.count) + ')';
            countEl.hidden = false;
        }
        ratingEl.setAttribute(
            'aria-label',
            'Training rating: ' + avg + ' out of 5, ' + stats.count + ' ratings'
        );
    }

    function fetchRatings() {
        return fetch(apiUrl, { method: 'GET', credentials: 'omit', mode: 'cors' })
            .then(parseJsonResponse)
            .then(function (result) {
                const byKey = {};
                if (result.ok && result.data && result.data.success && Array.isArray(result.data.ratings)) {
                    result.data.ratings.forEach(function (r) {
                        if (r.course_key) {
                            byKey[r.course_key] = { average: r.average, count: r.count };
                        }
                    });
                }
                document.querySelectorAll('.workshop-card[data-workshop-key]').forEach(function (card) {
                    const key = card.getAttribute('data-workshop-key');
                    applyStatsToCard(card, key ? byKey[key] : null);
                });
            })
            .catch(function () {
                document.querySelectorAll('.workshop-card[data-workshop-key]').forEach(function (card) {
                    applyStatsToCard(card, null);
                });
            })
            .finally(function () {
                document.dispatchEvent(new CustomEvent('kns-training-ratings-loaded'));
            });
    }

    function setModalError(msg) {
        if (!errorEl) return;
        errorEl.textContent = msg || '';
        errorEl.hidden = !msg;
    }

    function resetRatingView() {
        if (formPanel) formPanel.hidden = false;
        if (successPanel) successPanel.hidden = true;
    }

    function showRatingSuccess() {
        if (formPanel) formPanel.hidden = true;
        if (successPanel) successPanel.hidden = false;
        if (successDoneBtn && successDoneBtn.focus) successDoneBtn.focus();
    }

    function syncStarHighlight() {
        if (!starRow) return;
        starRow.querySelectorAll('.oc-rating-star').forEach(function (b) {
            const v = parseInt(b.getAttribute('data-star-value'), 10);
            b.classList.toggle('is-selected', v <= selectedStars);
        });
    }

    function buildStarButtons() {
        if (!starRow) return;
        starRow.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const value = i;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'oc-rating-star';
            btn.setAttribute('aria-label', value + ' out of 5 stars');
            btn.dataset.starValue = String(value);
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '36');
            svg.setAttribute('height', '36');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('aria-hidden', 'true');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', STAR_PATH);
            path.setAttribute('fill', 'currentColor');
            svg.appendChild(path);
            btn.appendChild(svg);
            btn.addEventListener('click', function () {
                selectedStars = value;
                syncStarHighlight();
                if (submitBtn) submitBtn.disabled = false;
            });
            starRow.appendChild(btn);
        }
    }

    function openModal(workshopKey, displayTitle) {
        if (!modalRoot || !workshopKey) return;
        lastFocus = document.activeElement;
        activeWorkshopKey = workshopKey;
        activeDisplayTitle = displayTitle || workshopKey;
        selectedStars = 0;
        if (modalCourseName) modalCourseName.textContent = activeDisplayTitle;
        if (commentEl) commentEl.value = '';
        if (emailEl) emailEl.value = '';
        setModalError('');
        resetRatingView();
        if (submitBtn) submitBtn.disabled = true;
        buildStarButtons();
        modalRoot.hidden = false;
        modalRoot.setAttribute('aria-hidden', 'false');
        if (typeof KNS !== 'undefined' && KNS.lockScroll) {
            KNS.lockScroll('modal');
        } else {
            document.body.style.overflow = 'hidden';
        }
        const closeBtn = modalRoot.querySelector('.oc-rating-modal__close');
        if (closeBtn && closeBtn.focus) closeBtn.focus();
    }

    function closeModal() {
        if (!modalRoot) return;
        modalRoot.hidden = true;
        modalRoot.setAttribute('aria-hidden', 'true');
        if (typeof KNS !== 'undefined' && KNS.unlockScroll) {
            KNS.unlockScroll('modal');
        } else {
            document.body.style.overflow = '';
        }
        activeWorkshopKey = '';
        resetRatingView();
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submit rating';
        }
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function submitRating() {
        if (!activeWorkshopKey || selectedStars < 1 || selectedStars > 5) return;
        setModalError('');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting…';
        }

        const body = {
            courseKey: activeWorkshopKey,
            stars: selectedStars,
            comment: commentEl && commentEl.value.trim() ? commentEl.value.trim() : undefined,
            email: emailEl && emailEl.value.trim() ? emailEl.value.trim() : undefined
        };

        fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            credentials: 'omit',
            mode: 'cors',
            body: JSON.stringify(body)
        })
            .then(parseJsonResponse)
            .then(function (result) {
                if (submitBtn) submitBtn.textContent = 'Submit rating';
                if (!result.ok) {
                    const serverMsg =
                        (result.data && result.data.error) ||
                        (result.status >= 500 ? 'Server error (' + result.status + '). Try again later.' : null);
                    throw new Error(serverMsg || 'Could not save rating');
                }
                if (result.data && result.data.rating) {
                    const card = Array.from(document.querySelectorAll('.workshop-card[data-workshop-key]')).find(
                        function (c) {
                            return c.getAttribute('data-workshop-key') === activeWorkshopKey;
                        }
                    );
                    if (card) applyStatsToCard(card, result.data.rating);
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit rating';
                }
                showRatingSuccess();
            })
            .catch(function (err) {
                setModalError(networkErrorMessage(err));
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit rating';
                }
            });
    }

    document.addEventListener('click', function (e) {
        const btn = e.target.closest && e.target.closest('.workshop-card__rate-btn');
        if (!btn) return;
        const card = btn.closest('.workshop-card');
        if (!card) return;
        e.preventDefault();
        const key = card.getAttribute('data-workshop-key');
        const title = (card.querySelector('.workshop-card__title') || {}).textContent || key;
        openModal(key, String(title).trim());
    });

    if (modalRoot) {
        modalRoot.addEventListener('click', function (e) {
            if (e.target.hasAttribute && e.target.hasAttribute('data-training-rating-close')) {
                closeModal();
            }
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modalRoot && !modalRoot.hidden) {
            closeModal();
        }
    });

    if (submitBtn) submitBtn.addEventListener('click', submitRating);
    if (successDoneBtn) successDoneBtn.addEventListener('click', closeModal);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fetchRatings);
    } else {
        fetchRatings();
    }
})();
