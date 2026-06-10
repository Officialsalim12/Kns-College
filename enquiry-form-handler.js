document.addEventListener('DOMContentLoaded', function () {
    const enquiryForm = document.getElementById('enquiryForm');
    const courseSelectFields = document.querySelectorAll('.course-select-field');
    const programmeInterestHidden = document.getElementById('programme_interest');

    function ensureDownwardDropdown() {
        if (window.innerWidth < 1025) return;

        courseSelectFields.forEach((select) => {
            const formGroup = select.closest('.form-group');
            if (formGroup) {
                formGroup.style.position = 'relative';
                formGroup.style.overflow = 'visible';
            }

            select.addEventListener('mousedown', function () {
                const rect = this.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                const spaceAbove = rect.top;

                if (spaceAbove > spaceBelow && spaceBelow < 400) {
                    setTimeout(() => {
                        const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
                        window.scrollTo({ top: currentScroll + 50, behavior: 'smooth' });
                    }, 10);
                }
            });
        });
    }

    ensureDownwardDropdown();
    window.addEventListener('resize', ensureDownwardDropdown);

    if (courseSelectFields.length > 0) {
        courseSelectFields.forEach((field) => {
            field.addEventListener('change', function () {
                const selectedValue = this.value;

                if (selectedValue) {
                    courseSelectFields.forEach((otherField) => {
                        if (otherField !== this) {
                            otherField.value = '';
                            otherField.disabled = true;
                        }
                    });
                    if (programmeInterestHidden) programmeInterestHidden.value = selectedValue;
                } else {
                    courseSelectFields.forEach((otherField) => {
                        otherField.disabled = false;
                    });
                    if (programmeInterestHidden) programmeInterestHidden.value = '';
                }
            });
        });
    }

    if (!enquiryForm) return;

    enquiryForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const formData = new FormData(enquiryForm);
        const name = formData.get('name');
        const email = formData.get('email');
        const phone = formData.get('phone');
        const preferredIntake = formData.get('preferred_intake');
        const message = formData.get('message');
        const newsletter = formData.get('newsletter') === 'yes';

        let programmeInterest = programmeInterestHidden ? programmeInterestHidden.value : '';
        if (!programmeInterest) {
            courseSelectFields.forEach((field) => {
                if (field.value) programmeInterest = field.value;
            });
        }

        if (!name || !email || !programmeInterest) {
            showEnquiryMessage(
                'error',
                'Please fill in all required fields and select a programme from one of the course fields.'
            );
            return;
        }

        const submitBtn = enquiryForm.querySelector('.submit-btn');
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            let apiBaseUrl =
                typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL
                    ? CONFIG.API_BASE_URL
                    : 'http://localhost:3000';

            const endpoint =
                typeof CONFIG !== 'undefined' && CONFIG.ENDPOINTS && CONFIG.ENDPOINTS.ENQUIRIES
                    ? CONFIG.ENDPOINTS.ENQUIRIES
                    : '/api/enquiries';

            const isProduction =
                window.location.hostname !== 'localhost' &&
                window.location.hostname !== '127.0.0.1' &&
                window.location.hostname !== '';
            const isSameOrigin = apiBaseUrl === window.location.origin;

            if (isProduction && isSameOrigin) {
                if (typeof CONFIG !== 'undefined' && CONFIG.PRODUCTION_API_URL) {
                    apiBaseUrl = CONFIG.PRODUCTION_API_URL;
                } else {
                    throw new Error('Backend API not configured. Set PRODUCTION_API_URL in config.js.');
                }
            }

            const response = await fetch(`${apiBaseUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    email,
                    phone: phone || null,
                    programme_interest: programmeInterest,
                    preferred_intake: preferredIntake || null,
                    message: message || null,
                    newsletter
                })
            });

            if (!response.ok) {
                let errorText = 'Failed to submit enquiry';
                try {
                    const errorData = await response.json();
                    errorText = errorData.error || errorText;
                } catch (ignore) {
                    errorText = `Server error: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorText);
            }

            const result = await response.json();

            if (result.success) {
                showEnquiryMessage(
                    'success',
                    'Thank you for your enquiry! Our admissions team will contact you soon with detailed information about the programme.'
                );
                enquiryForm.reset();
                courseSelectFields.forEach((field) => {
                    field.disabled = false;
                });
            } else {
                throw new Error(result.error || 'Failed to submit enquiry');
            }
        } catch (error) {
            const errorMessage = error.message || String(error);
            const isNetwork =
                error.name === 'TypeError' ||
                /Failed to fetch|NetworkError|ECONNREFUSED|ERR_CONNECTION_REFUSED/i.test(errorMessage);

            if (errorMessage.includes('Backend API not configured')) {
                showEnquiryMessage(
                    'error',
                    errorMessage + ' For now, contact admissions@kns.edu.sl or +232 79 422 442.'
                );
            } else if (errorMessage.includes('404')) {
                showEnquiryMessage(
                    'error',
                    'Backend endpoint not found. Contact admissions@kns.edu.sl or +232 79 422 442.'
                );
            } else if (isNetwork) {
                showEnquiryMessage(
                    'error',
                    'Cannot reach the server right now. Try again later or call +232 79 422 442.'
                );
            } else if (errorMessage.includes('Server error')) {
                showEnquiryMessage('error', errorMessage);
            } else {
                showEnquiryMessage(
                    'error',
                    'Sorry, there was an error submitting your enquiry. Try again or call +232 79 422 442.'
                );
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });

    function showEnquiryMessage(type, message) {
        const existingMessage = document.querySelector('.enquiry-form-message');
        if (existingMessage) existingMessage.remove();

        const messageDiv = document.createElement('div');
        messageDiv.className = `enquiry-form-message enquiry-form-message-${type}`;
        messageDiv.textContent = message;

        const submitBtn = enquiryForm.querySelector('.submit-btn');
        enquiryForm.insertBefore(messageDiv, submitBtn);
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
