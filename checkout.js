document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    const courseParam = params.get("course");
    const priceParam = params.get("price");
    const amountMinorParam = params.get("amount_minor");

    const errBox = document.getElementById("checkout-error");
    const form = document.getElementById("checkoutForm");
    const payBtn = document.getElementById("checkout-pay-btn");
    const emptyEl = document.getElementById("checkout-empty");
    const activeEl = document.getElementById("checkout-active");
    const itemsEl = document.getElementById("checkout-cart-items");
    const subtotalEl = document.getElementById("checkout-subtotal");
    const totalEl = document.getElementById("checkout-total");

    const defaultPriceLabel =
        typeof CONFIG !== "undefined" && CONFIG.CHECKOUT_DISPLAY_PRICE ? CONFIG.CHECKOUT_DISPLAY_PRICE : "NLe1";
    const defaultAmountMinor =
        typeof CONFIG !== "undefined" && typeof CONFIG.CHECKOUT_AMOUNT_SLE_MINOR === "number"
            ? CONFIG.CHECKOUT_AMOUNT_SLE_MINOR
            : 100;

    /** @type {{ courseKey: string, enrollCourseName: string, displayTitle: string, priceLabel: string, amountSleMinor: number, imageSrc: string }[]} */
    let cartItems = [];

    function resolveCartItems() {
        if (typeof KNSCart !== "undefined" && KNSCart.getItems) {
            var fromStore = KNSCart.getItems();
            if (fromStore && fromStore.length) return fromStore.slice();
        }

        // Legacy / deep-link: single course via URL (buy-now fallback if cart empty)
        if (courseParam) {
            var name = decodeURIComponent(courseParam);
            var priceLabel = priceParam ? decodeURIComponent(priceParam) : defaultPriceLabel;
            var amount = defaultAmountMinor;
            if (amountMinorParam && /^\d+$/.test(amountMinorParam)) {
                amount = parseInt(amountMinorParam, 10);
            }
            var item = {
                courseKey: name,
                enrollCourseName: name,
                displayTitle: name,
                priceLabel: priceLabel,
                amountSleMinor: amount,
                imageSrc: "images/kns-certificate.jpg"
            };
            if (typeof KNSCart !== "undefined" && KNSCart.add) {
                KNSCart.clear();
                KNSCart.add(item);
            }
            return [item];
        }

        return [];
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function formatTotalLabel(items) {
        if (typeof KNSCart !== "undefined" && KNSCart.formatPriceLabel) {
            return KNSCart.formatPriceLabel(items);
        }
        if (!items.length) return "—";
        if (items.length === 1) return items[0].priceLabel;
        var minor = items.reduce(function (s, it) {
            return s + (Number(it.amountSleMinor) || 0);
        }, 0);
        var major = (minor / 100).toFixed(minor % 100 === 0 ? 0 : 2);
        return "NLe" + major;
    }

    function renderSummary() {
        cartItems = resolveCartItems();
        var hasItems = cartItems.length > 0;

        if (emptyEl) emptyEl.hidden = hasItems;
        if (activeEl) activeEl.hidden = !hasItems;

        if (!hasItems) {
            document.title = "Checkout — Cart empty | KNS College";
            return;
        }

        var titleBits = cartItems.map(function (it) {
            return it.displayTitle;
        });
        document.title =
            "Checkout — " +
            (titleBits.length === 1 ? titleBits[0] : titleBits.length + " courses") +
            " | KNS College";

        var totalLabel = formatTotalLabel(cartItems);

        if (itemsEl) {
            itemsEl.innerHTML = cartItems
                .map(function (it) {
                    return (
                        '<li class="udemy-checkout-line">' +
                        '<img class="udemy-checkout-line__thumb" src="' +
                        escapeHtml(it.imageSrc) +
                        '" alt="" width="64" height="36" loading="lazy">' +
                        '<div class="udemy-checkout-line__meta">' +
                        '<p class="udemy-checkout-line__title">' +
                        escapeHtml(it.displayTitle) +
                        "</p>" +
                        '<p class="udemy-checkout-line__instructor">KNS College</p>' +
                        "</div>" +
                        '<p class="udemy-checkout-line__price">' +
                        escapeHtml(it.priceLabel) +
                        "</p>" +
                        '<button type="button" class="udemy-checkout-line__remove" data-checkout-remove="' +
                        escapeHtml(it.courseKey) +
                        '" aria-label="Remove ' +
                        escapeHtml(it.displayTitle) +
                        '">Remove</button>' +
                        "</li>"
                    );
                })
                .join("");
        }

        if (subtotalEl) subtotalEl.textContent = totalLabel;
        if (totalEl) totalEl.textContent = totalLabel;
        if (payBtn) {
            payBtn.textContent =
                cartItems.length === 1
                    ? "Complete checkout · " + totalLabel
                    : "Complete checkout · " + cartItems.length + " courses · " + totalLabel;
        }
    }

    if (itemsEl) {
        itemsEl.addEventListener("click", function (e) {
            var btn = e.target && e.target.closest && e.target.closest("[data-checkout-remove]");
            if (!btn) return;
            var key = btn.getAttribute("data-checkout-remove");
            if (typeof KNSCart !== "undefined" && KNSCart.remove) {
                KNSCart.remove(key);
            }
            renderSummary();
        });
    }

    document.addEventListener("kns-cart-changed", function () {
        renderSummary();
    });

    renderSummary();

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

            cartItems = resolveCartItems();
            if (!cartItems.length) {
                showError("Your cart is empty. Add a course from Online courses first.");
                renderSummary();
                return;
            }

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
            const successUrl = CONFIG.API_BASE_URL.replace(/\/$/, "") + "/payment-success.html?" + returnQuery;
            const cancelUrl = CONFIG.API_BASE_URL.replace(/\/$/, "") + "/payment-cancelled.html?" + returnQuery;

            const primary = cartItems[0];
            const clientTotal = cartItems.reduce(function (s, it) {
                return s + (Number(it.amountSleMinor) || 0);
            }, 0);

            const body = {
                customerEmail: emailEl.value.trim(),
                fullName: fullnameEl.value.trim(),
                phone: phoneEl.value.trim(),
                courseName: primary.enrollCourseName,
                priceLabel: formatTotalLabel(cartItems),
                items: cartItems.map(function (it) {
                    return {
                        courseName: it.enrollCourseName,
                        courseKey: it.courseKey,
                        priceLabel: it.priceLabel,
                        amountMinor: it.amountSleMinor
                    };
                }),
                returnOrigin: window.location.origin,
                successUrl: successUrl,
                cancelUrl: cancelUrl,
                idempotencyKey: idempotencyKey,
                amountMinor: clientTotal,
                currency: CONFIG.CHECKOUT_CURRENCY || "SLE",
                source: "checkout"
            };

            const submitLabel = payBtn ? payBtn.textContent : "Complete checkout";

            if (payBtn) {
                payBtn.disabled = true;
                payBtn.textContent = "Processing…";
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

                // Keep cart until payment succeeds (cleared on payment-success page)
                window.location.href = redirectUrl;
            } catch (err) {
                showError("Connection problem. Check your internet and try again, or contact admissions.");
            } finally {
                if (payBtn) {
                    payBtn.disabled = false;
                    payBtn.textContent = submitLabel;
                }
            }
        });
    }
});
