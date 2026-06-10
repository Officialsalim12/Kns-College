(function () {    'use strict';

    function safeDecode(v) {
        if (v == null || v === '') return '';
        try {
            return decodeURIComponent(String(v).replace(/\+/g, ' '));
        } catch {
            return String(v);
        }
    }

    const params = new URLSearchParams(window.location.search);
    const isSuccess = !document.body.classList.contains('page-payment-result--cancelled');

    let state = {
        course: safeDecode(params.get('course')),
        price: safeDecode(params.get('price')),
        cost: safeDecode(params.get('cost')),
        source: params.get('source') || 'checkout',
        reference: safeDecode(params.get('reference') || params.get('ref')),
        amountMinor: params.get('amount_minor') || ''
    };

    function feeLabel() {
        if (state.price) return state.price;
        if (state.cost && state.cost !== '0') return 'NLe ' + state.cost;
        return '';
    }

    function applyUi() {
        const fee = feeLabel();
        const isApplication = state.source === 'application';

        const line = document.getElementById('payment-result-course-line');
        if (line) {
            if (state.course) {
                const bits = [state.course];
                if (fee) bits.push(fee);
                line.textContent = bits.join(' · ');
                line.hidden = false;
            } else {
                line.textContent = isSuccess
                    ? 'Your payment was received.'
                    : 'Payment was not completed.';
                line.hidden = false;
            }
        }

        const refLine = document.getElementById('payment-result-reference-line');
        if (refLine) {
            if (state.reference) {
                refLine.textContent = 'Reference: ' + state.reference;
                refLine.hidden = false;
            } else {
                refLine.hidden = true;
            }
        }

        const appNote = document.getElementById('payment-result-application-note');
        if (appNote) appNote.hidden = !isApplication || !isSuccess;

        const checkoutNote = document.getElementById('payment-result-checkout-note');
        if (checkoutNote) checkoutNote.hidden = isApplication || !isSuccess;

        const heroLead = document.querySelector('.payment-result-hero__lead');
        if (heroLead && !isApplication) {
            if (isSuccess) {
                heroLead.textContent = 'Thank you — your USSD payment was received.';
            } else {
                heroLead.textContent = 'Your USSD payment was cancelled and no charges were made.';
            }
        }

        const retry = document.getElementById('payment-cancelled-retry');
        if (retry) {
            if (state.course) {
                let href;
                if (isApplication) {
                    href = 'payment.html?course=' + encodeURIComponent(state.course);
                    if (state.cost) href += '&cost=' + encodeURIComponent(state.cost);
                } else {
                    href = 'checkout.html?course=' + encodeURIComponent(state.course);
                    if (fee) href += '&price=' + encodeURIComponent(fee);
                    if (state.amountMinor && /^\d+$/.test(String(state.amountMinor))) {
                        href += '&amount_minor=' + encodeURIComponent(String(state.amountMinor));
                    }
                }
                retry.setAttribute('href', href);
                if (!isApplication) retry.textContent = 'Try USSD payment again';
            } else {
                retry.setAttribute('href', isApplication ? 'payment.html' : 'online-courses.html');
                if (!isApplication) retry.textContent = 'Return to online courses';
            }
        }

        if (state.course) {
            document.title =
                (isSuccess ? 'Payment Successful' : 'Payment Cancelled') +
                ' — ' +
                state.course +
                ' | KNS College';
        }

        const loading = document.getElementById('payment-result-loading');
        if (loading) loading.hidden = true;

        const modal = document.querySelector('.payment-result-modal');
        if (modal) modal.removeAttribute('aria-busy');
    }

    function syncPaymentStatus() {
        if (state.source !== 'application' || !state.reference) return;
        if (typeof CONFIG === 'undefined' || !CONFIG.API_BASE_URL) return;

        const apiUrl = String(CONFIG.API_BASE_URL).replace(/\/+$/, '');
        const newStatus = isSuccess ? 'success' : 'failed';

        fetch(apiUrl + '/api/payments?reference=' + encodeURIComponent(state.reference))
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (!data || !data.payments || !data.payments.length) return;
                return fetch(apiUrl + '/api/payments/' + data.payments[0].id, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        paymentStatus: newStatus,
                        paymentReference: state.reference
                    })
                });
            })
            .catch(() => {});
    }

    function loadContextThenRender() {
        const returnId = params.get('id') || params.get('ref');
        const canFetch =
            returnId &&
            typeof CONFIG !== 'undefined' &&
            CONFIG.API_BASE_URL &&
            CONFIG.ENDPOINTS &&
            CONFIG.ENDPOINTS.CHECKOUT_RETURN_CONTEXT;

        if (!canFetch) {
            applyUi();
            syncPaymentStatus();
            return;
        }

        const path =
            CONFIG.ENDPOINTS.CHECKOUT_RETURN_CONTEXT +
            '?id=' +
            encodeURIComponent(returnId);
        const url =
            typeof CONFIG.buildApiUrl === 'function'
                ? CONFIG.buildApiUrl(path)
                : String(CONFIG.API_BASE_URL).replace(/\/+$/, '') + path;

        fetch(url, { method: 'GET', credentials: 'omit', mode: 'cors' })
            .then((res) => res.json().catch(() => ({})))
            .then((data) => {
                if (data && data.success) {
                    state.course = data.course || state.course;
                    state.price = data.price || state.price;
                    state.cost = data.cost || state.cost;
                    state.source = data.source || state.source;
                    state.reference = data.reference || state.reference || returnId;
                    if (data.amountMinor != null) state.amountMinor = String(data.amountMinor);
                }
            })
            .catch(() => {})
            .finally(function () {
                applyUi();
                syncPaymentStatus();
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadContextThenRender);
    } else {
        loadContextThenRender();
    }
})();
