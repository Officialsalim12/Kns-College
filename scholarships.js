// wait for CONFIG
function waitForConfig(callback, maxAttempts = 10) {
    let attempts = 0;
    const checkConfig = () => {
        attempts++;
        if (typeof CONFIG !== 'undefined' || attempts >= maxAttempts) {
            callback();
        } else {
            setTimeout(checkConfig, 100);
        }
    };
    checkConfig();
}

document.addEventListener('DOMContentLoaded', async function() {
    const scholarshipsGrid = document.getElementById('scholarshipsGrid');
    if (!scholarshipsGrid) {
        console.error('Scholarships grid element not found');
        return;
    }
    
    waitForConfig(async () => {
        await loadScholarships(scholarshipsGrid);
    });
});

async function loadScholarships(scholarshipsGrid) {
    let fullUrl = '';

    try {
        let apiBaseUrl;
        if (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) {
            apiBaseUrl = CONFIG.API_BASE_URL;
            if (!apiBaseUrl.startsWith('http://') && !apiBaseUrl.startsWith('https://')) {
                apiBaseUrl = 'https://' + apiBaseUrl.replace(/^\/+/, '');
            }
        } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '') {
            apiBaseUrl = 'http://localhost:3000';
        } else {
            apiBaseUrl = 'https://kns-college-website.onrender.com';
        }
        
        const endpoint = (typeof CONFIG !== 'undefined' && CONFIG.ENDPOINTS && CONFIG.ENDPOINTS.SCHOLARSHIPS)
            ? CONFIG.ENDPOINTS.SCHOLARSHIPS
            : '/api/scholarships';
        
        const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
        const normalizedBaseUrl = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
        fullUrl = `${normalizedBaseUrl}${normalizedEndpoint}`;

        if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
            throw new Error(`Invalid API URL: ${fullUrl}. URL must start with http:// or https://`);
        }
        
        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'omit'
        });
        
        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            let errorText = '';
            let errorJson = null;
            
            try {
                errorText = await response.text();
                if (contentType && contentType.includes('application/json')) {
                    errorJson = JSON.parse(errorText);
                }
            } catch (parseError) {
                console.warn('Could not parse error response as JSON:', parseError);
            }
            
            console.error('API response error:', {
                status: response.status,
                statusText: response.statusText,
                url: fullUrl,
                contentType: contentType,
                errorText: errorText,
                errorJson: errorJson
            });
            
            const errorMessage = errorJson 
                ? (errorJson.error || errorJson.details || `API request failed: ${response.status} ${response.statusText}`)
                : (errorText || `API request failed: ${response.status} ${response.statusText}`);
            
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            console.error('API returned success: false', result);
            const errorMsg = result.error || result.details || 'Failed to fetch scholarships';
            throw new Error(errorMsg);
        }
        
        if (!result.scholarships || result.scholarships.length === 0) {
            scholarshipsGrid.innerHTML = `
                <div class="no-scholarships-message">
                    <p>No scholarships are currently available. Please check back later.</p>
                </div>
            `;
            return;
        }
        
        scholarshipsGrid.innerHTML = '';
        result.scholarships.forEach(scholarship => {
            scholarshipsGrid.appendChild(createScholarshipCard(scholarship));
        });
    } catch (error) {
        console.error('Error loading scholarships:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        // user-facing error copy
        let errorMessage = 'Unable to load scholarships. Please try again later.';
        let errorDetails = error.message;
        
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('CORS')) {
            errorMessage = 'Unable to connect to the server. Please check your internet connection or try again later.';
            errorDetails = 'Network error: ' + error.message;
        } else if (error.message.includes('404')) {
            errorMessage = 'API endpoint not found (404). The server could not find the requested endpoint.';
            errorDetails = `The URL "${fullUrl}" returned a 404 error. Please verify the backend server is running and the endpoint exists.`;
        } else if (error.message.includes('500')) {
            errorMessage = 'Server error occurred. Please try again later.';
            errorDetails = 'Server error: ' + error.message;
        }
        
        scholarshipsGrid.innerHTML = `
            <div class="error-message">
                <p>${escapeHtml(errorMessage)}</p>
                <p style="font-size: 0.9em; color: #666; margin-top: 0.5em;">Error: ${escapeHtml(errorDetails)}</p>
                <p style="font-size: 0.8em; color: #999; margin-top: 0.5em;">If this problem persists, please contact us at admissions@kns.edu.sl</p>
                <p style="font-size: 0.8em; color: #999; margin-top: 0.5em;">Debug: Check browser console (F12) for more details.</p>
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

function createScholarshipCard(scholarship) {
    const card = document.createElement('div');
    card.className = 'scholarship-card';
    
    // fixed deadline — override API
    const deadlineDate = new Date('2026-01-22T23:59:59');
    const formattedDeadline = deadlineDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const cleanedAwardSummary = removePercentagesFromText(scholarship.award_summary);
    
    card.innerHTML = `
        <div class="scholarship-card-header">
            <h3 class="scholarship-card-title">${escapeHtml(scholarship.title)}</h3>
        </div>
        <div class="scholarship-card-body">
            <div class="scholarship-award-summary">
                <p class="award-amount">${escapeHtml(cleanedAwardSummary)}</p>
            </div>
            <div class="scholarship-deadline">
                <strong>Deadline:</strong> ${formattedDeadline}
            </div>
        </div>
        <div class="scholarship-card-footer">
            <a href="scholarship-detail.html?id=${scholarship.id}" class="btn btn-primary btn-view-details">
                View Details
            </a>
        </div>
    `;
    
    return card;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

