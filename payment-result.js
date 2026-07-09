(function () {
    'use strict';

    function safeDecode(v) {
        if (v == null || v === '') return '';
        try {
            return decodeURIComponent(String(v).replace(/\+/g, ' '));
        } catch {
            return String(v);
        }
    }

    function getResultKind() {
        if (document.body.classList.contains('page-payment-result--failed')) return 'failed';
        if (document.body.classList.contains('page-payment-result--cancelled')) return 'cancelled';
        return 'success';
    }

    function isFailedReturn(params) {
        const status = (params.get('status') || params.get('payment_status') || '').toLowerCase();
        return (
            status === 'failed' ||
            status === 'error' ||
            status === 'declined' ||
            params.get('failed') === '1' ||
            params.get('failed') === 'true' ||
            params.get('error') === '1' ||
            params.get('error') === 'true'
        );
    }

    const params = new URLSearchParams(window.location.search);

    if (
        document.body.classList.contains('page-payment-result--cancelled') &&
        isFailedReturn(params)
    ) {
        window.location.replace('payment-failed.html?' + params.toString());
        return;
    }

    const resultKind = getResultKind();
    const isSuccess = resultKind === 'success';

    let state = {
        course: safeDecode(params.get('course')),
        price: safeDecode(params.get('price')),
        cost: safeDecode(params.get('cost')),
        source: params.get('source') || 'checkout',
        reference: safeDecode(params.get('reference') || params.get('ref')),
        amountMinor: params.get('amount_minor') || ''
    };

    // Detect training payments by checking if course is Digital Skills Training
    if (state.course === 'Digital Skills Training') {
        state.source = 'training';
    }

    // If source parameter is explicitly in URL, it takes precedence
    const urlSource = params.get('source');
    if (urlSource) {
        state.source = urlSource;
    }

    function feeLabel() {
        if (state.price) return state.price;
        if (state.cost && state.cost !== '0') return 'NLe ' + state.cost;
        return '';
    }

    function buildRetryHref() {
        const fee = feeLabel();
        if (state.course) {
            if (state.source === 'application') {
                let href = 'payment.html?course=' + encodeURIComponent(state.course);
                if (state.cost) href += '&cost=' + encodeURIComponent(state.cost);
                return href;
            }
            if (state.source === 'training') {
                return 'digital-skills-registration.html';
            }
            let href = 'checkout.html?course=' + encodeURIComponent(state.course);
            if (fee) href += '&price=' + encodeURIComponent(fee);
            if (state.amountMinor && /^\d+$/.test(String(state.amountMinor))) {
                href += '&amount_minor=' + encodeURIComponent(String(state.amountMinor));
            }
            return href;
        }
        if (state.source === 'training') return 'digital-skills-registration.html';
        return state.source === 'application' ? 'payment.html' : 'online-courses.html';
    }

    function applyUi() {
        const fee = feeLabel();
        const isApplication = state.source === 'application';
        const isTraining = state.source === 'training';

        const line = document.getElementById('payment-result-course-line');
        if (line) {
            if (state.course) {
                const bits = [state.course];
                if (fee) bits.push(fee);
                line.textContent = bits.join(' · ');
                line.hidden = false;
            } else if (isSuccess) {
                line.textContent = 'Your payment was received.';
                line.hidden = false;
            } else {
                line.hidden = true;
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

        const trainingNote = document.getElementById('payment-result-training-note');
        if (trainingNote) trainingNote.hidden = !isTraining;

        const genericHighlight = document.getElementById('payment-result-generic-highlight');
        if (genericHighlight) genericHighlight.hidden = isTraining;

        const retry =
            document.getElementById('payment-cancelled-retry') ||
            document.getElementById('payment-failed-retry');
        if (retry) {
            retry.setAttribute('href', buildRetryHref());
            if (!state.course) {
                retry.textContent =
                    state.source === 'application' ? 'Return to application' : 'Browse courses';
            }
        }

        const secondary = document.getElementById('payment-cancelled-secondary');
        if (secondary) {
            if (isTraining) {
                secondary.setAttribute('href', 'trainings.html');
                secondary.textContent = 'Training programs';
            }
        }

        const successPrimary = document.getElementById('payment-success-primary');
        if (successPrimary) {
            if (isTraining) {
                successPrimary.setAttribute('href', 'trainings.html');
                successPrimary.textContent = 'Return to Trainings';
            }
        }

        const successSecondary = document.getElementById('payment-success-secondary');
        if (successSecondary) {
            if (isTraining) {
                successSecondary.setAttribute('href', 'trainings.html');
                successSecondary.textContent = 'Training programs';
            }
        }

        if (state.course) {
            const titles = {
                success: 'Payment Successful',
                cancelled: 'Payment Cancelled',
                failed: 'Payment Failed'
            };
            document.title = titles[resultKind] + ' — ' + state.course + ' | KNS College';
        }

        const loading = document.getElementById('payment-result-loading');
        if (loading) loading.hidden = true;

        const modal = document.querySelector('.payment-result-modal');
        if (modal) modal.removeAttribute('aria-busy');
    }

    function syncPaymentStatus() {
        if (state.source !== 'application' || !state.reference) return;
        if (typeof CONFIG === 'undefined' || !CONFIG.API_BASE_URL) return;

        const tokenKey = 'kns_payment_token_' + state.reference;
        let statusUpdateToken = '';
        try {
            statusUpdateToken = sessionStorage.getItem(tokenKey) || '';
        } catch (e) {
            return;
        }
        if (!statusUpdateToken) return;

        const apiUrl = String(CONFIG.API_BASE_URL).replace(/\/+$/, '');
        const newStatus = isSuccess ? 'success' : 'failed';
        const path =
            CONFIG.ENDPOINTS && CONFIG.ENDPOINTS.PAYMENTS_RETURN_STATUS
                ? CONFIG.ENDPOINTS.PAYMENTS_RETURN_STATUS
                : '/api/payments/return-status';
        const endpoint =
            typeof CONFIG.buildApiUrl === 'function'
                ? CONFIG.buildApiUrl(path)
                : apiUrl + path;

        fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                paymentReference: state.reference,
                paymentStatus: newStatus,
                statusUpdateToken: statusUpdateToken
            })
        })
            .then(() => {
                try {
                    sessionStorage.removeItem(tokenKey);
                } catch (e) {
                    // sessionStorage not available
                }
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
                    state.reference = data.reference || state.reference || returnId;
                    if (data.amountMinor != null) state.amountMinor = String(data.amountMinor);
                    // Use server context source if available
                    if (data.source) {
                        state.source = data.source;
                    }
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
