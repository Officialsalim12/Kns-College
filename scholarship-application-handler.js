document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('scholarshipApplicationForm');
    const personalStatement = document.getElementById('personal_statement');
    const wordCountElement = document.getElementById('word_count');
    const previousApplication = document.getElementById('previous_application');
    const previousApplicationDetailsGroup = document.getElementById('previous_application_details_group');
    const previousApplicationDetails = document.getElementById('previous_application_details');

    if (!form) {
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const scholarshipId = urlParams.get('scholarship_id') || urlParams.get('id');
    if (scholarshipId) {
        const scholarshipIdField = document.getElementById('scholarship_id');
        if (scholarshipIdField) {
            scholarshipIdField.value = scholarshipId;
        }
    }

    if (personalStatement && wordCountElement) {
        function updateWordCount() {
            const text = personalStatement.value.trim();
            const words = text ? text.split(/\s+/).filter((word) => word.length > 0) : [];
            const wordCount = words.length;
            wordCountElement.textContent = wordCount;

            if (wordCount < 300) {
                wordCountElement.style.color = 'var(--error-color)';
                personalStatement.setCustomValidity(
                    `Personal statement must be at least 300 words. Currently: ${wordCount} words.`
                );
            } else {
                wordCountElement.style.color = 'var(--success-color)';
                personalStatement.setCustomValidity('');
            }
        }

        personalStatement.addEventListener('input', updateWordCount);
        personalStatement.addEventListener('paste', function () {
            setTimeout(updateWordCount, 10);
        });
        updateWordCount();
    }

    if (previousApplication && previousApplicationDetailsGroup) {
        previousApplication.addEventListener('change', function () {
            if (this.value === 'Yes') {
                previousApplicationDetailsGroup.style.display = 'block';
                previousApplicationDetails.required = true;
            } else {
                previousApplicationDetailsGroup.style.display = 'none';
                previousApplicationDetails.required = false;
                previousApplicationDetails.value = '';
            }
        });
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        if (!personalStatement) {
            showFormMessage('error', 'Personal statement field not found. Please refresh the page and try again.');
            return;
        }

        const words = personalStatement.value.trim()
            ? personalStatement.value.trim().split(/\s+/).filter((word) => word.length > 0)
            : [];

        if (words.length < 300) {
            showFormMessage('error', `Personal statement must be at least 300 words. Currently: ${words.length} words.`);
            personalStatement.focus();
            return;
        }

        const declaration = document.getElementById('declaration');
        if (!declaration || !declaration.checked) {
            showFormMessage('error', 'You must accept the declaration to submit your application.');
            if (declaration) declaration.focus();
            return;
        }

        const submitBtn = form.querySelector('.submit-btn');
        if (!submitBtn) {
            showFormMessage('error', 'Submit button not found. Please refresh the page and try again.');
            return;
        }

        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            let apiBaseUrl =
                typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL
                    ? CONFIG.API_BASE_URL
                    : 'http://localhost:3000';

            const endpoint =
                typeof CONFIG !== 'undefined' && CONFIG.ENDPOINTS && CONFIG.ENDPOINTS.SCHOLARSHIP_APPLICATIONS
                    ? CONFIG.ENDPOINTS.SCHOLARSHIP_APPLICATIONS
                    : '/api/scholarship-applications';

            const isProduction =
                window.location.hostname !== 'localhost' &&
                window.location.hostname !== '127.0.0.1' &&
                window.location.hostname !== '';
            const isSameOrigin = apiBaseUrl === window.location.origin;

            if (isProduction && isSameOrigin) {
                if (typeof CONFIG !== 'undefined' && CONFIG.PRODUCTION_API_URL) {
                    apiBaseUrl = CONFIG.PRODUCTION_API_URL;
                } else {
                    throw new Error(
                        'Backend API not configured. Set PRODUCTION_API_URL in config.js to your deployed backend server URL.'
                    );
                }
            }

            const nationalIdValue = document.getElementById('national_id').value.trim();
            if (!nationalIdValue) {
                showFormMessage('error', 'National ID Number is required.');
                return;
            }

            const formData = {
                scholarship_id: document.getElementById('scholarship_id').value || null,
                surname: document.getElementById('surname').value,
                first_name: document.getElementById('first_name').value,
                other_names: document.getElementById('other_names').value || null,
                gender: document.getElementById('gender').value,
                date_of_birth: document.getElementById('date_of_birth').value,
                nationality: document.getElementById('nationality').value,
                national_id: nationalIdValue,
                address: document.getElementById('address').value,
                city: document.getElementById('city').value,
                phone: document.getElementById('phone').value,
                email: document.getElementById('email').value,
                highest_qualification: document.getElementById('highest_qualification').value,
                school_institution: document.getElementById('school_institution').value,
                year_of_completion: document.getElementById('year_of_completion').value,
                credits: document.getElementById('credits').value || null,
                programme: document.getElementById('programme').value,
                scholarship_type: document.getElementById('scholarship_type').value,
                previous_application: document.getElementById('previous_application').value,
                previous_application_details: document.getElementById('previous_application_details').value || null,
                personal_statement: document.getElementById('personal_statement').value,
                declaration: document.getElementById('declaration').checked ? 'on' : ''
            };

            const response = await fetch(`${apiBaseUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                let errorText = 'Failed to submit application';
                try {
                    const errorData = await response.json();
                    errorText = errorData.error || errorData.message || errorText;
                    if (errorData.details) {
                        errorText += `. ${errorData.details}`;
                    }
                } catch (ignore) {
                    errorText = `Server error: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorText);
            }

            const result = await response.json();

            if (result.success) {
                showFormMessage(
                    'success',
                    'Thank you for your scholarship application! Your application has been submitted successfully. We will review your application and contact you soon.'
                );
                form.reset();
                if (wordCountElement) wordCountElement.textContent = '0';
                if (previousApplicationDetailsGroup) previousApplicationDetailsGroup.style.display = 'none';
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                throw new Error(result.error || result.message || 'Failed to submit application');
            }
        } catch (error) {
            const errorMessage = error.message || String(error);
            const isNetwork =
                error.name === 'TypeError' ||
                /Failed to fetch|NetworkError|ECONNREFUSED|ERR_CONNECTION_REFUSED/i.test(errorMessage);

            if (errorMessage.includes('Backend API not configured')) {
                showFormMessage(
                    'error',
                    errorMessage + ' For now, contact admissions@kns.edu.sl or +232 79 422 442.'
                );
            } else if (isNetwork) {
                showFormMessage(
                    'error',
                    'Cannot reach the server right now. Try again later or call +232 79 422 442.'
                );
            } else if (errorMessage.includes('404')) {
                showFormMessage('error', 'Application endpoint not found (404). Contact +232 79 422 442.');
            } else if (errorMessage.trim()) {
                showFormMessage('error', errorMessage);
            } else {
                showFormMessage(
                    'error',
                    'Something went wrong submitting your application. Call +232 79 422 442 if it keeps happening.'
                );
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });

    function showFormMessage(type, message) {
        const existingMessage = document.querySelector('.scholarship-form-message');
        if (existingMessage) existingMessage.remove();

        const messageDiv = document.createElement('div');
        messageDiv.className = `scholarship-form-message scholarship-form-message-${type}`;
        messageDiv.textContent = message;
        messageDiv.style.padding = '15px';
        messageDiv.style.marginBottom = '20px';
        messageDiv.style.borderRadius = '4px';
        messageDiv.style.fontWeight = '500';

        if (type === 'error') {
            messageDiv.style.backgroundColor = '#fee';
            messageDiv.style.color = '#c33';
            messageDiv.style.border = '1px solid #fcc';
        } else if (type === 'success') {
            messageDiv.style.backgroundColor = '#efe';
            messageDiv.style.color = '#3c3';
            messageDiv.style.border = '1px solid #cfc';
        }

        const targetForm = document.getElementById('scholarshipApplicationForm');
        if (targetForm && targetForm.parentElement) {
            targetForm.parentElement.insertBefore(messageDiv, targetForm);
        } else {
            const container = document.querySelector('.content-section .container');
            if (container) {
                container.insertBefore(messageDiv, container.firstChild);
            } else {
                document.body.insertBefore(messageDiv, document.body.firstChild);
            }
        }

        setTimeout(() => {
            messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);

        if (type === 'success') {
            setTimeout(() => {
                messageDiv.style.opacity = '0';
                messageDiv.style.transition = 'opacity 0.3s';
                setTimeout(() => messageDiv.remove(), 300);
            }, 10000);
        }
    }
});
