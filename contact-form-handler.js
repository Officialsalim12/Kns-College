document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.querySelector('.contact-form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(contactForm);
            const name = formData.get('name');
            const email = formData.get('email');
            const phone = formData.get('phone');
            const subject = formData.get('subject');
            const message = formData.get('message');
            
            if (!name || !email || !subject || !message) {
                showFormMessage('error', 'Please fill in all required fields.');
                return;
            }
            
            const submitBtn = contactForm.querySelector('.submit-btn');
            const originalBtnText = submitBtn.textContent;
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
            
            try {
                let apiBaseUrl = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) 
                    ? CONFIG.API_BASE_URL 
                    : 'http://localhost:3000';
                
                const endpoint = (typeof CONFIG !== 'undefined' && CONFIG.ENDPOINTS && CONFIG.ENDPOINTS.CONTACTS)
                    ? CONFIG.ENDPOINTS.CONTACTS
                    : '/api/contacts';
                
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
                        name: name,
                        email: email,
                        phone: phone || null,
                        subject: subject,
                        message: message
                    })
                });
                
                if (!response.ok) {
                    console.error('API response not OK:', response.status, response.statusText);
                    let errorText = 'Failed to send message';
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
                    showFormMessage('success', 'Thank you for contacting us! Your message has been sent successfully. We will get back to you soon.');
                    contactForm.reset();
                } else {
                    throw new Error(result.error || 'Failed to send message');
                }
            } catch (error) {
                console.error('Error submitting contact form:', error);
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
                    showFormMessage('error', 'Sorry, there was an error sending your message. Please try again later or contact us directly at +232 79 422 442.');
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
        messageDiv.textContent = message;
        
        const submitBtn = contactForm.querySelector('.submit-btn');
        contactForm.insertBefore(messageDiv, submitBtn);
        
        messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        if (type === 'success') {
            setTimeout(() => {
                messageDiv.style.opacity = '0';
                messageDiv.style.transition = 'opacity 0.3s';
                setTimeout(() => messageDiv.remove(), 300);
            }, 5000);
        }
    }
});

