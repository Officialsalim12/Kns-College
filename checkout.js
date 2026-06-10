document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    const courseParam = params.get("course");
    const priceParam = params.get("price");
    const amountMinorParam = params.get("amount_minor");

    const courseDisplay = document.getElementById("checkout-course-display");
    const priceDisplay = document.getElementById("checkout-price-display");
    const summaryTitle = document.getElementById("checkout-summary-title");
    const summaryPrice = document.getElementById("checkout-price-line");
    const errBox = document.getElementById("checkout-error");
    const form = document.getElementById("checkoutForm");
    const payBtn = document.getElementById("checkout-pay-btn");

    let amountMinor =
        typeof CONFIG !== "undefined" && typeof CONFIG.CHECKOUT_AMOUNT_SLE_MINOR === "number"
            ? CONFIG.CHECKOUT_AMOUNT_SLE_MINOR
            : 100000;
    if (amountMinorParam != null && String(amountMinorParam).trim() !== "") {
        const parsed = parseInt(String(amountMinorParam).trim(), 10);
        if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 100000000) {
            amountMinor = parsed;
        }
    }

    const defaultPriceLabel =
        typeof CONFIG !== "undefined" && CONFIG.CHECKOUT_DISPLAY_PRICE ? CONFIG.CHECKOUT_DISPLAY_PRICE : "NLe 1000";

    const priceLabel = priceParam ? decodeURIComponent(priceParam) : defaultPriceLabel;

    let courseDecoded = "";
    if (courseParam) {
        courseDecoded = decodeURIComponent(courseParam);
        document.title = "Checkout — " + courseDecoded + " | KNS College";
    }

    if (courseDisplay) {
        courseDisplay.value = courseDecoded || "";
    }
    if (summaryTitle) {
        summaryTitle.textContent = courseDecoded || "Select a course";
    }
    if (priceDisplay) {
        priceDisplay.value = priceLabel;
    }
    if (summaryPrice) {
        summaryPrice.textContent = priceLabel;
    }
    if (payBtn) {
        payBtn.textContent = "Continue to USSD payment — " + priceLabel;
    }

    if (!courseDecoded && courseDisplay) {
        courseDisplay.placeholder = "Choose a course from Online courses, then tap Enroll.";
    }

    function showError(msg) {
        if (!errBox) return;
        errBox.textContent = msg;
        errBox.hidden = false;
    }

    function clearError() {
        if (!errBox) return;
        errBox.textContent = "";
        errBox.hidden = true;
    }

    function absoluteUrl(relativePath) {
        return new URL(relativePath, window.location.href).href;
    }

    function extractRedirectUrl(payload) {
        if (!payload || typeof payload !== "object") return null;
        if (payload.redirectUrl && typeof payload.redirectUrl === "string") return payload.redirectUrl;
        if (payload.result && payload.result.redirectUrl) return payload.result.redirectUrl;
        if (payload.data && payload.data.redirectUrl) return payload.data.redirectUrl;
        return null;
    }

    function formatCheckoutError(data) {
        if (!data || typeof data !== "object") return null;
        if (typeof data.error === "string") return data.error;
        if (typeof data.message === "string") return data.message;
        if (Array.isArray(data.messages) && data.messages.length) {
            var m = data.messages[0];
            if (typeof m === "string") return m;
            if (m && typeof m.message === "string") return m.message;
        }
        return null;
    }

    if (form) {
        form.addEventListener("submit", async function (e) {
            e.preventDefault();
            clearError();

            const fullnameEl = document.getElementById("checkout-fullname");
            const emailEl = document.getElementById("checkout-email");
            const phoneEl = document.getElementById("checkout-phone");

            if (!fullnameEl || !fullnameEl.value.trim()) {
                if (fullnameEl) fullnameEl.focus();
                showError("Please enter your full name.");
                return;
            }
            if (!emailEl || !emailEl.value.trim()) {
                if (emailEl) emailEl.focus();
                showError("Please enter your email address.");
                return;
            }
            if (!phoneEl || !phoneEl.value.trim()) {
                if (phoneEl) phoneEl.focus();
                showError("Please enter your phone number.");
                return;
            }
            if (!courseDecoded) {
                showError("No course selected. Go back to Online courses and choose Enroll on a course.");
                return;
            }

            if (typeof CONFIG === "undefined" || !CONFIG.API_BASE_URL) {
                showError("Payment setup is incomplete. Please try again later or contact admissions.");
                return;
            }

            const path =
                CONFIG.ENDPOINTS && CONFIG.ENDPOINTS.MONIME_CHECKOUT_SESSION
                    ? CONFIG.ENDPOINTS.MONIME_CHECKOUT_SESSION
                    : "/api/monime/checkout-session";
            const endpoint = CONFIG.API_BASE_URL.replace(/\/$/, "") + path;

            const idempotencyKey =
                typeof crypto !== "undefined" && crypto.randomUUID
                    ? crypto.randomUUID()
                    : "kns-" + Date.now() + "-" + Math.random().toString(36).slice(2, 12);

            const returnQuery = "id=" + encodeURIComponent(idempotencyKey);
            const successUrl = absoluteUrl("payment-success.html?" + returnQuery);
            const cancelUrl = absoluteUrl("payment-cancelled.html?" + returnQuery);

            const body = {
                customerEmail: emailEl.value.trim(),
                fullName: fullnameEl.value.trim(),
                phone: phoneEl.value.trim(),
                courseName: courseDecoded,
                priceLabel: priceLabel,
                returnOrigin: window.location.origin,
                successUrl: successUrl,
                cancelUrl: cancelUrl,
                idempotencyKey: idempotencyKey,
                amountMinor: amountMinor,
                currency: CONFIG.CHECKOUT_CURRENCY || "SLE"
            };

            if (payBtn) {
                payBtn.disabled = true;
                payBtn.textContent = "Starting USSD payment…";
            }

            try {
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    credentials: "omit",
                    mode: "cors",
                    body: JSON.stringify(body)
                });

                const data = await res.json().catch(function () {
                    return null;
                });

                if (!res.ok) {
                    showError(
                        formatCheckoutError(data) ||
                            "We could not start payment right now. Please try again or contact admissions."
                    );
                    return;
                }

                const redirectUrl = extractRedirectUrl(data);
                if (!redirectUrl) {
                    showError("We could not open the payment page. Please try again or contact admissions.");
                    return;
                }

                window.location.href = redirectUrl;
            } catch (err) {
                showError("Connection problem. Check your internet and try again, or contact admissions.");
            } finally {
                if (payBtn) {
                    payBtn.disabled = false;
                    payBtn.textContent = "Continue to USSD payment — " + priceLabel;
                }
            }
        });
    }
});
