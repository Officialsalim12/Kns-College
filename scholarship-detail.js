document.addEventListener('DOMContentLoaded', async function() {
    // wait for CONFIG
    let retries = 0;
    const maxRetries = 10;
    while (typeof CONFIG === 'undefined' && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
    }
    
    if (typeof CONFIG === 'undefined') {
        console.warn('CONFIG not available after waiting, using fallback');
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const scholarshipId = urlParams.get('id') || urlParams.get('scholarship_id');
    
    // no id — general application page
    if (!scholarshipId) {
        const eligibilitySection = document.getElementById('eligibilitySection');
        const guideSection = document.getElementById('guideSection');
        const deadlineSection = document.getElementById('deadlineSection');
        
        if (eligibilitySection) eligibilitySection.style.display = 'none';
        if (guideSection) guideSection.style.display = 'none';
        if (deadlineSection) deadlineSection.style.display = 'none';
        
        const scholarshipTitle = document.getElementById('scholarshipTitle');
        if (scholarshipTitle) {
            scholarshipTitle.textContent = 'Scholarship Application';
        }
        const scholarshipAward = document.getElementById('scholarshipAward');
        if (scholarshipAward) {
            scholarshipAward.textContent = 'Apply for the KNS College Scholarship Programme 2026';
        }
        
        console.log('No scholarship ID provided - form will work without it');
        return;
    }
    
    try {
        const apiBaseUrl = getApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}/api/scholarships/${scholarshipId}`);
        
        if (!response.ok) {
            console.error('API response not OK:', response.status, response.statusText);
            console.warn('Could not load scholarship details, but form will still work');
            return;
        }
        
        const result = await response.json();
        
        if (!result.success || !result.scholarship) {
            console.warn('Scholarship not found, but form will still work');
            return;
        }
        
        populateScholarshipDetails(result.scholarship);
    } catch (error) {
        console.error('Error loading scholarship:', error);
        console.warn('Could not load scholarship details, but form will still work');
    }
});

function populateScholarshipDetails(scholarship) {
    document.getElementById('scholarshipTitle').textContent = scholarship.title;
    const cleanedAwardSummary = removePercentagesFromText(scholarship.award_summary);
    document.getElementById('scholarshipAward').textContent = cleanedAwardSummary;
    document.title = `${scholarship.title} - Scholarships - KNS College`;
    
    const eligibilityContent = document.getElementById('eligibilityContent');
    if (scholarship.eligibility && scholarship.eligibility.length > 0) {
        const ul = document.createElement('ul');
        ul.className = 'content-list eligibility-list';
        scholarship.eligibility.forEach(req => {
            const li = document.createElement('li');
            li.textContent = req;
            ul.appendChild(li);
        });
        eligibilityContent.innerHTML = '';
        eligibilityContent.appendChild(ul);
    } else {
        eligibilityContent.innerHTML = '<p class="content-text">Eligibility requirements are being updated. Please contact the scholarships office for more information.</p>';
    }
    
    // fixed deadline — override API
    const deadlineDate = new Date('2026-01-22T23:59:59');
    
    const formattedDeadline = deadlineDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    });
    
    document.getElementById('deadlineDate').innerHTML = `<span class="deadline-highlight">${formattedDeadline}</span>`;
    
    // deadline countdown
    const countdownElement = document.getElementById('deadlineCountdown');
    if (countdownElement) {
        function formatTimePart(value, label) {
            return `${value} ${label}${value === 1 ? '' : 's'}`;
        }
        
        function updateCountdown() {
            const now = new Date();
            const diffMs = deadlineDate.getTime() - now.getTime();
            
            if (isNaN(deadlineDate.getTime())) {
                countdownElement.textContent = 'Deadline date is being updated. Please check back later.';
                return;
            }
            
            if (diffMs <= 0) {
                countdownElement.textContent = 'The application deadline has passed.';
                countdownElement.classList.add('deadline-passed');
                return;
            }
            
            const totalSeconds = Math.floor(diffMs / 1000);
            const days = Math.floor(totalSeconds / (24 * 60 * 60));
            const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
            const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
            const seconds = totalSeconds % 60;
            
            const parts = [];
            if (days > 0) parts.push(formatTimePart(days, 'day'));
            if (hours > 0 || days > 0) parts.push(formatTimePart(hours, 'hour'));
            if (minutes > 0 || hours > 0 || days > 0) parts.push(formatTimePart(minutes, 'minute'));
            parts.push(formatTimePart(seconds, 'second'));
            
            countdownElement.textContent = `Time remaining: ${parts.join(', ')}`;
        }
        
        updateCountdown();
        setInterval(updateCountdown, 1000);
    }
    
    // apply button → scroll to form
    const applyNowButton = document.getElementById('applyNowButton');
    if (applyNowButton) {
        applyNowButton.href = '#applicationFormSection';
        applyNowButton.addEventListener('click', function(e) {
            e.preventDefault();
            const formSection = document.getElementById('applicationFormSection');
            if (formSection) {
                formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }
    
    const scholarshipIdInput = document.getElementById('scholarship_id');
    if (scholarshipIdInput) {
        scholarshipIdInput.value = scholarship.id;
    }
    
    const formDeadlineText = document.getElementById('formDeadlineText');
    if (formDeadlineText) {
        formDeadlineText.textContent = formattedDeadline;
    }
}
    
function getFileNameFromUrl(url, fileType) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const fileName = pathname.split('/').pop();
        if (fileName && fileName.includes('.')) {
            return fileName;
        }
    } catch (e) {
        const parts = url.split('/');
        const lastPart = parts[parts.length - 1];
        if (lastPart && lastPart.includes('.')) {
            return lastPart;
        }
    }
    return `${fileType.toLowerCase()}-${Date.now()}.pdf`;
}

function showError(message) {
    const mainContent = document.querySelector('.content-main');
    if (mainContent) {
        mainContent.innerHTML = `
            <div class="error-message">
                <h2 class="content-heading">Error</h2>
                <p class="content-text">${message}</p>
            </div>
        `;
    }
}

function removePercentagesFromText(text) {
    if (!text) return text;
    
    let cleaned = text;
    
    // strip % wording from award text
    cleaned = cleaned
        .replace(/Fully funded and \d+% discount on tuition fees/gi, 'Fully funded and partial funding on tuition fees')
        .replace(/fully funded and \d+% discount on tuition fees/gi, 'Fully funded and partial funding on tuition fees')
        .replace(/\d+% discount on tuition fees/gi, 'partial funding on tuition fees')
        .replace(/100%\s*(of tuition fees|tuition fee coverage|coverage)/gi, 'fully funded')
        .replace(/(Minimum\s+)?\d+% tuition fee discount/gi, 'partial funding')
        .replace(/Covers \d+% of tuition fees/gi, 'Fully funded')
        .replace(/\d+%\s*discount/gi, 'partial funding')
        .replace(/\d+%\s*coverage/gi, 'fully funded')
        .replace(/\b\d+%\b/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s+and\s+/gi, ' and ')
        .trim();
    
    return cleaned;
}

function getApiBaseUrl() {
    if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.API_BASE_URL) {
        return CONFIG.API_BASE_URL;
    }
    
    // localhost dev
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname === '';
    
    if (isLocalhost) {
        return 'http://localhost:3000';
    }
    
    return window.location.origin;
}
