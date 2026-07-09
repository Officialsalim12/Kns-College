document.addEventListener('DOMContentLoaded', function() {
    const registrationForm = document.getElementById('registrationForm');
    
    if (registrationForm) {
        registrationForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(registrationForm);
            const fullname = formData.get('fullname');
            const gender = formData.get('gender');
            const age = formData.get('age');
            const address = formData.get('address');
            const whatsapp = formData.get('whatsapp');
            const email = formData.get('email');
            
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
            document.body.classList.add('modal-open');
        }
    }

    // Close modal functionality
    const closeModalBtn = document.getElementById('closeModal');
    const paymentModal = document.getElementById('paymentModal');
    
    function hidePaymentModal() {
        if (paymentModal) {
            paymentModal.style.display = 'none';
            document.body.classList.remove('modal-open');
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
            payNowBtn.textContent = 'Processing...';
            
            try {
                let apiBaseUrl = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) 
                    ? CONFIG.API_BASE_URL 
                    : 'http://localhost:3000';
                
                const endpoint = '/api/monime/checkout-session';
                
                const isProduction = window.location.hostname !== 'localhost' && 
                                    window.location.hostname !== '127.0.0.1' && 
                                    window.location.hostname !== '';
                const isSameOrigin = apiBaseUrl === window.location.origin;
                
                if (isProduction && isSameOrigin) {
                    if (typeof CONFIG !== 'undefined' && CONFIG.PRODUCTION_API_URL) {
                        apiBaseUrl = CONFIG.PRODUCTION_API_URL;
                    } else {
                        throw new Error('Backend API not configured.');
                    }
                }
                
                const fullUrl = `${apiBaseUrl}${endpoint}`;
                console.log('API Base URL:', apiBaseUrl);
                console.log('Full API URL:', fullUrl);
                console.log('Window location:', window.location.origin);
                
                // Get form data for required Monime fields
                const formData = new FormData(registrationForm);
                const fullname = formData.get('fullname') || 'Training Registrant';
                const whatsapp = formData.get('whatsapp') || '+232000000000';
                const email = formData.get('email') || 'no-email@example.com';
                
                // Generate idempotency key
                const idempotencyKey = (typeof crypto !== 'undefined' && crypto.randomUUID)
                    ? crypto.randomUUID()
                    : 'kns-training-' + Date.now() + '-' + Math.random().toString(36).slice(2, 12);
                
                // Build success and cancel URLs with just id parameter (Monime will use server context)
                const returnQuery = 'id=' + encodeURIComponent(idempotencyKey);
                const successUrl = `${apiBaseUrl}/payment-success.html?${returnQuery}`;
                const cancelUrl = `${apiBaseUrl}/payment-cancelled.html?${returnQuery}`;
                
                const response = await fetch(fullUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    credentials: 'omit',
                    mode: 'cors',
                    body: JSON.stringify({
                        customerEmail: email,
                        fullName: fullname,
                        phone: whatsapp,
                        courseName: 'Digital Skills Training',
                        priceLabel: 'NLe1',
                        amountMinor: 100, // NLe1 in minor units (100 * 0.01 = 1)
                        currency: 'SLE',
                        returnOrigin: window.location.origin,
                        successUrl: successUrl,
                        cancelUrl: cancelUrl,
                        idempotencyKey: idempotencyKey,
                        source: 'training'
                    })
                });
                
                console.log('Payment API response status:', response.status);
                const result = await response.json().catch(() => ({}));
                console.log('Payment API response:', result);
                
                if (!response.ok) {
                    throw new Error(result.error || result.message || `Failed to create payment session (HTTP ${response.status})`);
                }
                
                // Extract redirect URL from response (handle nested structure)
                const redirectUrl = result.redirectUrl || 
                                    result.checkoutUrl || 
                                    (result.data && result.data.redirectUrl) ||
                                    (result.result && result.result.redirectUrl) ||
                                    (result.result && result.result.checkoutUrl);
                console.log('Extracted redirect URL:', redirectUrl);
                
                if (redirectUrl) {
                    window.location.href = redirectUrl;
                } else {
                    throw new Error('No payment URL returned from server');
                }
            } catch (error) {
                console.error('Payment error:', error);
                alert('Failed to initiate payment. Please try again or contact us directly.');
                payNowBtn.disabled = false;
                payNowBtn.textContent = 'Pay Now';
            }
        });
    }
});
