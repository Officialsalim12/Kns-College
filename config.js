function normalizeApiUrl(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }
    
    url = url.trim();

    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }

    url = url.replace(/^\/+/, '');
    return 'https://' + url;
}

const KNS_DEFAULT_RENDER_API = 'https://kns-college-website.onrender.com';

function isAllowedStoredApiBaseUrl(normalized) {
    if (!normalized) return false;
    if (normalized.includes('kns.edu.sl')) return true;
    if (normalized.includes('kns-college-website.onrender.com')) return true;
    if (/^https?:\/\/localhost(?::\d+)?(\/|$)/i.test(normalized)) return true;
    if (/^https?:\/\/127\.0\.0\.1(?::\d+)?(\/|$)/i.test(normalized)) return true;
    return false;
}

function wantsLocalNodeApi() {
    if (typeof window === 'undefined') return false;
    if (window.KNS_USE_LOCAL_API === true) return true;
    try {
        return localStorage.getItem('KNS_USE_LOCAL_API') === '1';
    } catch (e) {
        return false;
    }
}

function getApiBaseUrl() {
    const isLoopbackHost =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (typeof window !== 'undefined' && window.RENDER_API_URL) {
        const normalized = normalizeApiUrl(window.RENDER_API_URL);
        return normalized || KNS_DEFAULT_RENDER_API;
    }

    try {
        const storedApiUrl = localStorage.getItem('API_BASE_URL');
        if (storedApiUrl) {
            const normalized = normalizeApiUrl(storedApiUrl);
            if (normalized && isAllowedStoredApiBaseUrl(normalized)) {
                return normalized.replace(/\/+$/, '');
            }
            console.warn('Stored API_BASE_URL is not allowed (use Render URL or http://localhost:PORT). Clearing.');
            localStorage.removeItem('API_BASE_URL');
        }
    } catch (e) {
        // localStorage blocked — carry on with defaults
    }

    const currentOrigin = window.location.origin;
    if (isLoopbackHost) {
        if (wantsLocalNodeApi()) {
            return 'http://localhost:3000';
        }
        if (/^http:\/\/(localhost|127\.0\.0\.1):3000$/i.test(currentOrigin)) {
            return currentOrigin;
        }
        // Default to hosted API for local development
        return KNS_DEFAULT_RENDER_API;
    }

    if (currentOrigin.includes('onrender.com') || currentOrigin.includes('kns-college-website')) {
        return currentOrigin;
    }

    // kns.edu.sl is static hosting; API lives on Render
    if (currentOrigin.includes('kns.edu.sl')) {
        return KNS_DEFAULT_RENDER_API;
    }

    return KNS_DEFAULT_RENDER_API;
}

let calculatedApiBaseUrl = getApiBaseUrl();

if (!calculatedApiBaseUrl.startsWith('http://') && !calculatedApiBaseUrl.startsWith('https://')) {
    console.warn('Calculated API URL missing protocol, fixing...');
    calculatedApiBaseUrl = normalizeApiUrl(calculatedApiBaseUrl) || KNS_DEFAULT_RENDER_API;
}

if (typeof window !== 'undefined') {
    try {
        const h = window.location.hostname;
        if (h === 'localhost' || h === '127.0.0.1') {
            console.info('[KNS] API requests use: ' + calculatedApiBaseUrl);
            if (/localhost:3000|127\.0\.0\.1:3000/.test(calculatedApiBaseUrl)) {
                console.info(
                    '[KNS] For local API: run `npm start` in the project folder (needs .env.local with Supabase). ' +
                        'If you only want the hosted API, run resetApiUrl() then reload, or remove KNS_USE_LOCAL_API from localStorage.'
                );
            }
        }
    } catch (e) {
        // localStorage blocked — carry on with defaults
    }
}

if (typeof window !== 'undefined') {
    window.resetApiUrl = function() {
        try {
            localStorage.removeItem('API_BASE_URL');
            localStorage.removeItem('KNS_USE_LOCAL_API');
        } catch (e) {
            console.error('Could not clear localStorage:', e);
        }
    };
}

const CONFIG = {
    API_BASE_URL: calculatedApiBaseUrl,
    PRODUCTION_API_URL: 'https://kns.edu.sl',
    
    ENDPOINTS: {
        MESSAGES: '/api/messages',
        CONTACTS: '/api/contacts',
        ENQUIRIES: '/api/enquiries',
        ENROLLMENTS: '/api/enrollments',
        PAYMENTS: '/api/payments',
        PAYMENTS_RETURN_STATUS: '/api/payments/return-status',
        SCHOLARSHIPS: '/api/scholarships',
        SCHOLARSHIP_APPLICATIONS: '/api/scholarship-applications',
        STATS: '/api/stats',
        HEALTH: '/api/health',
        MONIME_CHECKOUT_SESSION: '/api/monime/checkout-session',
        CHECKOUT_RETURN_CONTEXT: '/api/monime/checkout-return-context',
        ONLINE_COURSES: '/api/online-courses',
        ONLINE_COURSE_RATINGS: '/api/online-course-ratings'
    },

    CHECKOUT_AMOUNT_SLE_MINOR: 100,
    CHECKOUT_CURRENCY: 'SLE',
    CHECKOUT_DISPLAY_PRICE: 'NLe1',

    buildApiUrl: function (path) {
        const base = (this.API_BASE_URL || '').replace(/\/+$/, '');
        const p = typeof path === 'string' && path.startsWith('/') ? path : '/' + (path || '');
        return base + p;
    }
};

function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function getSessionId() {
    let sessionId = sessionStorage.getItem('chatbot_session_id');
    if (!sessionId) {
        sessionId = generateSessionId();
        sessionStorage.setItem('chatbot_session_id', sessionId);
    }
    return sessionId;
}

