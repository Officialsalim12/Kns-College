document.addEventListener('DOMContentLoaded', function() {
    const registrationForm = document.getElementById('registrationForm');
    const ageSelect = document.getElementById('age');
    const ageOtherField = document.getElementById('ageOtherField');
    const ageOtherInput = document.getElementById('ageOther');

    function syncAgeOtherField() {
        if (!ageSelect || !ageOtherField || !ageOtherInput) return;
        const isOther = ageSelect.value === 'other';
        ageOtherField.hidden = !isOther;
        ageOtherInput.required = isOther;
        if (!isOther) {
            ageOtherInput.value = '';
        } else {
            ageOtherInput.focus();
        }
    }

    if (ageSelect) {
        ageSelect.addEventListener('change', syncAgeOtherField);
        syncAgeOtherField();
    }
    
    if (registrationForm) {
        registrationForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(registrationForm);
            const fullname = formData.get('fullname');
            const gender = formData.get('gender');
            const ageRange = formData.get('age');
            const ageOther = (formData.get('ageOther') || '').toString().trim();
            const address = formData.get('address');
            const whatsapp = formData.get('whatsapp');
            const email = formData.get('email');

            let age = ageRange;
            if (ageRange === 'other') {
                const n = parseInt(ageOther, 10);
                if (!ageOther || !Number.isInteger(n) || n < 1 || n > 120) {
                    showFormMessage('error', 'Please enter a valid age.');
                    if (ageOtherInput) ageOtherInput.focus();
                    return;
                }
                age = String(n);
            }
            
            if (!fullname || !gender || !age || !address || !whatsapp) {
                showFormMessage('error', 'Please fill in all required fields.');
                return;
            }
            
            const submitBtn = registrationForm.querySelector('.btn-submit');
            const originalBtnText = submitBtn.textContent;
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
            
            try {
                let apiBaseUrl = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) 
                    ? CONFIG.API_BASE_URL 
                    : 'http://localhost:3000';
                
                const endpoint = '/api/training-registrations';
                
                const isProduction = window.location.hostname !== 'localhost' && 
                                    window.location.hostname !== '127.0.0.1' && 
                                    window.location.hostname !== '';
                const isSameOrigin = apiBaseUrl === window.location.origin;
                
                if (isProduction && isSameOrigin) {
                    if (typeof CONFIG !== 'undefined' && CONFIG.PRODUCTION_API_URL) {
                        apiBaseUrl = CONFIG.PRODUCTION_API_URL;
                    } else {
                        throw new Error('Backend API not configured. Please set PRODUCTION_API_URL in config.js to your deployed backend server URL.');
                    }
                }
                
                const fullUrl = `${apiBaseUrl}${endpoint}`;
                
                const response = await fetch(fullUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fullname: fullname,
                        gender: gender,
                        age: age,
                        address: address,
                        whatsapp: whatsapp,
                        email: email || null
                    })
                });
                
                if (!response.ok) {
                    console.error('API response not OK:', response.status, response.statusText);
                    let errorText = 'Failed to submit registration';
                    try {
                        const errorData = await response.json();
                        console.error('Error response data:', errorData);
                        errorText = errorData.error || errorText;
                    } catch (e) {
                        const responseText = await response.text();
                        console.error('Response text:', responseText);
                        errorText = `Server error: ${response.status} ${response.statusText}`;
                    }
                    throw new Error(errorText);
                }
                
                const result = await response.json();
                
                if (result.success) {
                    // Store form data for payment
                    window.trainingFormData = {
                        fullname: fullname,
                        whatsapp: whatsapp,
                        email: email || 'no-email@example.com'
                    };
                    showPaymentModal();
                    registrationForm.reset();
                    syncAgeOtherField();
                } else {
                    throw new Error(result.error || 'Failed to submit registration');
                }
            } catch (error) {
                console.error('Error submitting workshop registration:', error);
                console.error('Error details:', {
                    message: error.message,
                    name: error.name,
                    stack: error.stack
                });
                
                const errorMessage = error.message || error.toString() || '';
                const errorName = error.name || '';
                
                if (errorName === 'TypeError' || 
                    errorMessage.includes('Failed to fetch') || 
                    errorMessage.includes('NetworkError') ||
                    errorMessage.includes('network') ||
                    errorMessage.includes('ECONNREFUSED') ||
                    errorMessage.includes('ERR_CONNECTION_REFUSED') ||
                    errorMessage.includes('404')) {
                    if (errorMessage.includes('Backend API not configured')) {
                        showFormMessage('error', errorMessage + ' For now, please contact us directly at admissions@kns.edu.sl or +232 79 422 442.');
                    } else if (errorMessage.includes('404')) {
                        showFormMessage('error', 'Backend API endpoint not found (404). Please configure PRODUCTION_API_URL in config.js. For now, please contact us directly at admissions@kns.edu.sl or +232 79 422 442.');
                    } else {
                        showFormMessage('error', 'Cannot connect to server. Please make sure the backend server is running and PRODUCTION_API_URL is set correctly in config.js. For now, please contact us directly at admissions@kns.edu.sl or +232 79 422 442.');
                    }
                } else if (errorMessage.includes('Server error')) {
                    showFormMessage('error', errorMessage);
                } else {
                    showFormMessage('error', 'Sorry, there was an error submitting your registration. Please try again later or contact us directly at +232 79 422 442.');
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        });
    }
    
    function showFormMessage(type, message) {
        const existingMessage = document.querySelector('.form-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const slot = document.getElementById('formMessage');
        if (slot) {
            slot.hidden = false;
            slot.textContent = message;
            slot.className =
                'checkout-v2-error training-register-message' +
                (type === 'success' ? ' training-register-message--success' : '');
            slot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            if (type === 'success') {
                setTimeout(function () {
                    slot.hidden = true;
                    slot.textContent = '';
                }, 5000);
            }
            return;
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `form-message form-message-${type}`;
        messageDiv.style.cssText = `
            padding: 1rem;
            margin: 1rem 0;
            border-radius: 4px;
            ${type === 'success' ? 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;' : 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;'}
        `;
        messageDiv.textContent = message;
        
        const submitBtn = registrationForm.querySelector('.btn-submit');
        registrationForm.insertBefore(messageDiv, submitBtn);
        
        messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        if (type === 'success') {
            setTimeout(() => {
                messageDiv.style.opacity = '0';
                messageDiv.style.transition = 'opacity 0.3s';
                setTimeout(() => messageDiv.remove(), 300);
            }, 5000);
        }
    }

    function showPaymentModal() {
        const modal = document.getElementById('paymentModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');
            if (typeof KNS !== 'undefined' && KNS.lockScroll) {
                KNS.lockScroll('modal');
            } else {
                document.body.classList.add('kns-scroll-locked', 'kns-modal-open');
            }
        }
    }

    // Close modal functionality
    const closeModalBtn = document.getElementById('closeModal');
    const paymentModal = document.getElementById('paymentModal');
    
    function hidePaymentModal() {
        if (paymentModal) {
            paymentModal.style.display = 'none';
            paymentModal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('modal-open');
            if (typeof KNS !== 'undefined' && KNS.unlockScroll) {
                KNS.unlockScroll('modal');
            } else {
                document.body.classList.remove('kns-scroll-locked', 'kns-modal-open');
            }
        }
    }
    
    if (closeModalBtn && paymentModal) {
        closeModalBtn.addEventListener('click', hidePaymentModal);
        
        paymentModal.addEventListener('click', function(e) {
            if (e.target === paymentModal) {
                hidePaymentModal();
            }
        });
    }

    // Pay Now button - integrate with Monime
    const payNowBtn = document.getElementById('payNowBtn');
    if (payNowBtn) {
        payNowBtn.addEventListener('click', async function() {
            payNowBtn.disabled = true;
            payNowBtn.textContent = 'Processing…';

            const saved = window.trainingFormData || {};
            const fullname = String(saved.fullname || '').trim();
            const whatsapp = String(saved.whatsapp || '').trim();
            let email = String(saved.email || '').trim();

            if (!fullname || !whatsapp) {
                alert('Registration details were lost. Please submit the form again, then tap Pay now.');
                payNowBtn.disabled = false;
                payNowBtn.textContent = 'Pay now';
                hidePaymentModal();
                return;
            }

            // Monime requires an email; form email is optional
            if (!email || email === 'no-email@example.com' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                email = 'training+' + whatsapp.replace(/\D/g, '').slice(-9) + '@kns.edu.sl';
            }
            
            try {
                if (typeof CONFIG === 'undefined' || !CONFIG.API_BASE_URL) {
                    throw new Error('Payment setup is incomplete. Please try again later or contact admissions.');
                }

                const path =
                    CONFIG.ENDPOINTS && CONFIG.ENDPOINTS.MONIME_CHECKOUT_SESSION
                        ? CONFIG.ENDPOINTS.MONIME_CHECKOUT_SESSION
                        : '/api/monime/checkout-session';
                const fullUrl =
                    typeof CONFIG.buildApiUrl === 'function'
                        ? CONFIG.buildApiUrl(path)
                        : String(CONFIG.API_BASE_URL).replace(/\/+$/, '') + path;

                const amountMinor =
                    typeof CONFIG.CHECKOUT_AMOUNT_SLE_MINOR === 'number'
                        ? CONFIG.CHECKOUT_AMOUNT_SLE_MINOR
                        : 100;
                const priceLabel = CONFIG.CHECKOUT_DISPLAY_PRICE || 'NLe1';
                const courseName = 'Digital Skills Training';
                const courseKey = 'digital-skills-training';

                const idempotencyKey =
                    typeof crypto !== 'undefined' && crypto.randomUUID
                        ? crypto.randomUUID()
                        : 'kns-training-' + Date.now() + '-' + Math.random().toString(36).slice(2, 12);

                const returnQuery = 'id=' + encodeURIComponent(idempotencyKey);
                const apiBase = String(CONFIG.API_BASE_URL).replace(/\/+$/, '');
                const successUrl = apiBase + '/payment-success.html?' + returnQuery;
                const cancelUrl = apiBase + '/payment-cancelled.html?' + returnQuery;

                const response = await fetch(fullUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json'
                    },
                    credentials: 'omit',
                    mode: 'cors',
                    body: JSON.stringify({
                        customerEmail: email,
                        fullName: fullname,
                        phone: whatsapp,
                        courseName: courseName,
                        priceLabel: priceLabel,
                        amountMinor: amountMinor,
                        currency: CONFIG.CHECKOUT_CURRENCY || 'SLE',
                        items: [
                            {
                                courseName: courseName,
                                courseKey: courseKey,
                                priceLabel: priceLabel,
                                amountMinor: amountMinor
                            }
                        ],
                        returnOrigin: window.location.origin,
                        successUrl: successUrl,
                        cancelUrl: cancelUrl,
                        idempotencyKey: idempotencyKey,
                        source: 'training'
                    })
                });

                const result = await response.json().catch(function () {
                    return {};
                });

                if (!response.ok) {
                    throw new Error(
                        result.error ||
                            result.message ||
                            'Failed to create payment session (HTTP ' + response.status + ')'
                    );
                }

                const redirectUrl =
                    result.redirectUrl ||
                    result.checkoutUrl ||
                    (result.data && result.data.redirectUrl) ||
                    (result.result && result.result.redirectUrl) ||
                    (result.result && result.result.checkoutUrl);

                if (!redirectUrl) {
                    throw new Error('No payment URL returned from server');
                }

                window.location.href = redirectUrl;
            } catch (error) {
                console.error('Payment error:', error);
                alert(
                    (error && error.message
                        ? error.message
                        : 'Failed to initiate payment.') +
                        ' Please try again or contact us at +232 79 422 442.'
                );
                payNowBtn.disabled = false;
                payNowBtn.textContent = 'Pay now';
            }
        });
    }
});
