// KNS College API server

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

(function loadEnvFiles() {
    const root = __dirname;
    const localEnv = path.join(root, '.env.local');
    const defaultEnv = path.join(root, '.env');
    const productionEnv = path.join(root, '.env.production');

    if (fs.existsSync(localEnv)) {
        require('dotenv').config({ path: localEnv });
        console.log('Loaded environment from .env.local');
        return;
    }
    if (fs.existsSync(defaultEnv)) {
        require('dotenv').config({ path: defaultEnv });
        console.log('Loaded environment from .env');
        return;
    }
    if (fs.existsSync(productionEnv)) {
        require('dotenv').config({ path: productionEnv });
        console.log('Loaded environment from .env.production');
        return;
    }
    const knsEnv = path.join(root, 'kns.env');
    if (fs.existsSync(knsEnv)) {
        require('dotenv').config({ path: knsEnv });
        console.log('Loaded environment from kns.env');
        return;
    }

    require('dotenv').config();
    console.warn(
        'No env file found. Create .env.local with DATABASE_URL (PostgreSQL connection string).'
    );
})();

const express = require('express');
const { isDbConfigured, initDatabase, isMissingRelation } = require('./database/pg');
const db = require('./database/queries');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const brevo = require('@getbrevo/brevo');
const { TransactionalEmailsApi } = brevo;
const multer = require('multer');
const {
    APPLICATION_FEE_SLE,
    escapeHtml,
    escapeHtmlWithBreaks,
    createPaymentStatusToken,
    verifyPaymentStatusToken,
    createRequireAdminApiKey,
    isAllowedScholarshipFileUrl,
    resolveScholarshipFilePath
} = require('./security-helpers');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_IISNODE = Boolean(process.env.IISNODE_VERSION);

app.set('etag', false);

if (IS_IISNODE) {
    app.set('trust proxy', 1);
}

const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const KNS_ADMIN_API_KEY = (process.env.KNS_ADMIN_API_KEY || '').trim();
const requireAdminApiKey = createRequireAdminApiKey(KNS_ADMIN_API_KEY);

const MONIME_ACCESS_TOKEN = (process.env.MONIME_ACCESS_TOKEN || '').trim();
const MONIME_SPACE_ID = (process.env.MONIME_SPACE_ID || '').trim();
const MONIME_API_BASE = (process.env.MONIME_API_BASE_URL || 'https://api.monime.io').replace(/\/+$/, '');
const MONIME_VERSION = (process.env.MONIME_VERSION || 'caph.2025-08-23').trim();
const MONIME_REQUIRE_LIVE_TOKEN = process.env.MONIME_REQUIRE_LIVE_TOKEN === 'true';

function getMonimeTokenMode() {
    if (!MONIME_ACCESS_TOKEN) return 'unset';
    if (MONIME_ACCESS_TOKEN.startsWith('mon_test_')) return 'test';
    if (MONIME_ACCESS_TOKEN.startsWith('mon_')) return 'live';
    return 'unknown';
}

const MONIME_TOKEN_MODE = getMonimeTokenMode();

const KNS_SITE_ORIGINS = ['https://kns.edu.sl', 'https://www.kns.edu.sl'];

function buildMonimeCheckoutAllowedOrigins() {
    const productionDefaults = KNS_SITE_ORIGINS.slice();
    const devExtras = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://kns-college-website.onrender.com'
    ];
    const isProduction = process.env.NODE_ENV === 'production';
    const defaults = isProduction ? productionDefaults : productionDefaults.concat(devExtras);
    const raw = process.env.MONIME_ALLOWED_CHECKOUT_ORIGINS;
    let list = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : defaults;
    if (!isProduction && raw) {
        list = list.concat(devExtras);
    }
    const set = new Set();
    list.forEach((item) => {
        try {
            set.add(new URL(item).origin);
        } catch (e) {
            // bad entry in the origins list
        }
    });
    return set;
}

const monimeCheckoutAllowedOrigins = buildMonimeCheckoutAllowedOrigins();

if (MONIME_ACCESS_TOKEN) {
    if (MONIME_TOKEN_MODE === 'test' && process.env.NODE_ENV === 'production') {
        console.warn(
            'Monime: test token in production — use a live mon_* token for real payments'
        );
    }
    if (MONIME_TOKEN_MODE === 'test' && MONIME_REQUIRE_LIVE_TOKEN) {
        console.error(
            'Monime: MONIME_REQUIRE_LIVE_TOKEN is on but token is mon_test_'
        );
    }
    if (MONIME_TOKEN_MODE === 'live') {
        console.log(' Monime: live token');
    } else if (MONIME_TOKEN_MODE === 'test') {
        console.log(' Monime: test token (sandbox)');
    } else if (MONIME_TOKEN_MODE === 'unknown') {
        console.warn('  Monime: token format looks wrong — expected mon_* or mon_test_*');
    }
}

console.log('Environment check:');
console.log(`  DATABASE_URL: ${DATABASE_URL ? 'set' : 'missing'}`);
console.log(`  KNS_ADMIN_API_KEY: ${KNS_ADMIN_API_KEY ? 'set' : 'missing'}`);
console.log(`  MONIME_ACCESS_TOKEN: ${MONIME_ACCESS_TOKEN ? 'set' : 'missing'}`);
console.log(`  MONIME_SPACE_ID: ${MONIME_SPACE_ID ? 'set' : 'missing'}`);
if (MONIME_ACCESS_TOKEN) {
    console.log(`  Monime token mode: ${MONIME_TOKEN_MODE}${MONIME_REQUIRE_LIVE_TOKEN ? ' (live token required)' : ''}`);
}
console.log(`  PORT: ${PORT}`);
console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

if (!isDbConfigured()) {
    console.error('Error: DATABASE_URL must be set (PostgreSQL connection string from Render or your host)');
    console.error('For production: set DATABASE_URL in Render env vars or .env.production on the server');
    console.error('For local dev: add DATABASE_URL to .env.local, then run npm run db:migrate');
    if (!IS_IISNODE) {
        process.exit(1);
    }
}

const brevoApiKey = process.env.BREVO_API_KEY
    ? process.env.BREVO_API_KEY.replace(/\r\n/g, '').replace(/\n/g, '').replace(/\r/g, '').trim()
    : null;
const envFromEmail = process.env.BREVO_FROM_EMAIL;
const verifiedSenderEmail = 'salim@kns.sl';
const brevoFromEmail = (envFromEmail === verifiedSenderEmail) ? envFromEmail : verifiedSenderEmail;
const brevoToEmail =
    process.env.BREVO_TO_EMAIL || brevoFromEmail;

const apiInstance = new TransactionalEmailsApi();
if (!brevoApiKey) {
    console.warn(
        'Warning: BREVO_API_KEY is not set. Contact form emails will not be sent.'
    );
} else {
    try {
        apiInstance.authentications.apiKey.apiKey = brevoApiKey;
        console.log('Brevo:');
        console.log(`  from: ${brevoFromEmail}`);
        if (envFromEmail && envFromEmail !== verifiedSenderEmail) {
            console.warn(`  BREVO_FROM_EMAIL was ${envFromEmail}; using ${verifiedSenderEmail}`);
        }
        console.log(`  default to: ${brevoToEmail}`);
        console.log(`  scholarships: ${process.env.BREVO_SCHOLARSHIP_EMAIL || 'knscollegesle@gmail.com'}`);
        console.log(`  contact: ${process.env.BREVO_CONTACT_EMAIL || 'admissions@kns.edu.sl'}`);
        console.log(`  enquiry: ${process.env.BREVO_ENQUIRY_EMAIL || 'enquiry@kns.edu.sl'}`);
        console.log(`  training: ${process.env.BREVO_TRAINING_EMAIL || 'admissions@kns.edu.sl'}\n`);
    } catch (error) {
        console.error('Brevo: could not set API key —', error.message);
    }
}

const DEBUG_CORS = process.env.DEBUG_CORS === 'true';

function buildAllowedCorsOrigins() {
    const origins = new Set(KNS_SITE_ORIGINS);
    origins.add('https://kns-college-website.onrender.com');
    if (!IS_PRODUCTION) {
        [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:5500',
            'http://127.0.0.1:5500',
            'http://localhost:5173',
            'http://127.0.0.1:5173'
        ].forEach((o) => origins.add(o));
    }
    const extra = (process.env.CORS_ORIGIN || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
    extra.forEach((o) => {
        try {
            origins.add(new URL(o).origin);
        } catch {
            origins.add(o);
        }
    });
    return origins;
}

const allowedCorsOrigins = buildAllowedCorsOrigins();

function isOriginAllowed(origin) {
    if (!origin || origin === 'null') return true;
    if (allowedCorsOrigins.has(origin)) return true;
    try {
        const host = new URL(origin).hostname.toLowerCase();
        if (host === 'kns.edu.sl' || host.endsWith('.kns.edu.sl')) return true;
        if (!IS_PRODUCTION && (host === 'localhost' || host === '127.0.0.1' || host === '[::1]')) {
            return true;
        }
    } catch {
        // origin string didn't parse
    }
    return false;
}

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) {
            if (DEBUG_CORS) console.log('CORS: no origin (allowed)');
            return callback(null, true);
        }
        if (isOriginAllowed(origin)) {
            if (DEBUG_CORS) console.log(`CORS: allowed ${origin}`);
            return callback(null, true);
        }
        if (DEBUG_CORS) console.log(`CORS: blocked ${origin}`);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'X-Admin-Api-Key']
};

app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
    })
);
app.use(cors(corsOptions));
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

app.use((req, res, next) => {
    if (isDbConfigured() || !req.path.startsWith('/api/') || req.path === '/api/health') {
        return next();
    }
    return res.status(503).json({
        success: false,
        error: 'Database not configured. Set DATABASE_URL to your PostgreSQL connection string.'
    });
});

const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: IS_PRODUCTION ? 200 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests. Please try again later.' }
});

const formRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: IS_PRODUCTION ? 15 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many form submissions. Please try again later.' }
});

const paymentRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: IS_PRODUCTION ? 5 : 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return getClientIp(req) + ':' + (req.body?.customerEmail || 'unknown');
    },
    message: { success: false, error: 'Too many payment attempts. Please wait before trying again.' }
});

// In-memory suspicious activity tracking
const suspiciousActivity = new Map();

function trackSuspiciousActivity(ip, type, details = {}) {
    const key = `${ip}:${type}`;
    const now = Date.now();
    const entry = suspiciousActivity.get(key) || { count: 0, firstSeen: now, details: [] };
    
    entry.count++;
    entry.lastSeen = now;
    entry.details.push({ timestamp: now, ...details });
    
    // Keep only last 10 details
    if (entry.details.length > 10) {
        entry.details = entry.details.slice(-10);
    }
    
    suspiciousActivity.set(key, entry);
    
    // Log suspicious activity
    if (entry.count >= 3) {
        console.warn(`[Security] Suspicious activity detected: ${type} from IP ${ip}, count: ${entry.count}`);
    }
    
    // Clean up old entries (older than 1 hour)
    if (now - entry.firstSeen > 3600000) {
        suspiciousActivity.delete(key);
    }
    
    return entry.count;
}

function isIpBlocked(ip) {
    const blockedTypes = ['invalid_email', 'invalid_phone', 'invalid_amount', 'duplicate_idempotency'];
    for (const type of blockedTypes) {
        const key = `${ip}:${type}`;
        const entry = suspiciousActivity.get(key);
        if (entry && entry.count >= 5 && (Date.now() - entry.lastSeen) < 1800000) {
            console.warn(`[Security] IP ${ip} blocked due to excessive ${type} attempts`);
            return true;
        }
    }
    return false;
}

app.use('/api/', apiRateLimiter);

app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    // Additional security headers
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('X-XSS-Protection', '1; mode=block');
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
});

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, JPG, PNG, DOC, and DOCX files are allowed.'), false);
        }
    }
});

app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        const clientIp = getClientIp(req);
        const userAgent = getUserAgent(req);
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        console.log(`  IP: ${clientIp}`);
        console.log(`  Origin: ${req.headers.origin || 'none'}`);
        console.log(`  Referer: ${req.headers.referer || 'none'}`);
        console.log(`  User-Agent: ${userAgent}`);
        
        // Log payment-related requests with additional details
        if (req.path.includes('monime') || req.path.includes('payment')) {
            console.log(`  [Payment Security] Request from ${clientIp} for ${req.path}`);
        }
    }
    next();
});

function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           'unknown';
}

function getUserAgent(req) {
    return req.headers['user-agent'] || 'unknown';
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/health', (req, res) => {
    res.json({
        status: isDbConfigured() ? 'ok' : 'degraded',
        message: isDbConfigured()
            ? 'KNS College API is running'
            : 'KNS College API is running but DATABASE_URL is not configured',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        iisnode: IS_IISNODE,
        node_version: process.version,
        database_configured: isDbConfigured(),
        brevo_configured: !!brevoApiKey,
        monime_checkout_configured: !!(MONIME_ACCESS_TOKEN && MONIME_SPACE_ID),
        monime_token_mode: MONIME_TOKEN_MODE,
        monime_require_live_token: MONIME_REQUIRE_LIVE_TOKEN,
        features: {
            online_course_catalog: true,
            online_course_ratings: true,
            monime_checkout_session: true
        }
    });
});

app.post('/api/test-email', requireAdminApiKey, async (req, res) => {
    const { to } = req.body;
    const testRecipient = to || process.env.BREVO_SCHOLARSHIP_EMAIL || 'knscollegesle@gmail.com';
    
    if (!brevoApiKey || !brevoFromEmail) {
        return res.status(500).json({ 
            error: 'Brevo not configured',
            message: 'BREVO_API_KEY and BREVO_FROM_EMAIL must be set'
        });
    }
    
    try {
        const testSubject = `Test Email from KNS College API - ${new Date().toISOString()}`;
        const testBody = `
This is a test email from the KNS College API server.

If you receive this, Brevo is working.
From: ${brevoFromEmail}

Server Details:
- Timestamp: ${new Date().toISOString()}
- Environment: ${process.env.NODE_ENV || 'development'}
- Server: ${req.protocol}://${req.get('host')}

You can safely delete this test email.
        `.trim();
        
        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.to = [{ email: testRecipient }];
        sendSmtpEmail.sender = { email: brevoFromEmail, name: 'KNS College' };
        sendSmtpEmail.subject = testSubject;
        sendSmtpEmail.textContent = testBody;
        sendSmtpEmail.htmlContent = `<p>${testBody.replace(/\n/g, '<br>')}</p>`;
        
        console.log('Sending test email…');
        console.log(`  From: ${brevoFromEmail}`);
        console.log(`  To: ${testRecipient}`);
        
        const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
        
        console.log('Test email sent successfully');
        console.log(`  Brevo Status: ${response?.messageId || 'Success'}`);
        
        res.json({ 
            success: true,
            message: 'Test email sent successfully',
            from: brevoFromEmail,
            to: testRecipient,
            brevo_status: response?.messageId || 'Success',
            note: 'Check your inbox (and spam folder) for the email'
        });
    } catch (error) {
        console.error('Error sending test email:', error);
        console.error(`  Status Code: ${error.code || error.response?.statusCode || 'Unknown'}`);
        
        if (error.response?.body?.errors) {
            error.response.body.errors.forEach((err, index) => {
                console.error(`  Error ${index + 1}:`, err.message || err);
            });
        }
        
        res.status(500).json({ 
            success: false,
            error: 'Failed to send test email',
            details: error.message || 'Unknown error',
            status_code: error.code || error.response?.statusCode,
            brevo_errors: error.response?.body?.errors || null
        });
    }
});

app.get('/api/test', requireAdminApiKey, (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'API test endpoint is working',
        timestamp: new Date().toISOString(),
        origin: req.headers.origin || 'none',
        referer: req.headers.referer || 'none',
        host: req.headers.host || 'none',
        database_configured: isDbConfigured()
    });
});

const OC_RATING_WINDOW_MS = 60 * 60 * 1000;
const OC_RATING_MAX_PER_WINDOW = 40;
const ocRatingIpBuckets = new Map();

function ocRatingThrottleAllowed(ip) {
    const now = Date.now();
    const b = ocRatingIpBuckets.get(ip);
    if (!b || now - b.startedAt > OC_RATING_WINDOW_MS) return true;
    return b.count < OC_RATING_MAX_PER_WINDOW;
}

function ocRatingThrottleRecordSuccess(ip) {
    const now = Date.now();
    let b = ocRatingIpBuckets.get(ip);
    if (!b || now - b.startedAt > OC_RATING_WINDOW_MS) {
        b = { count: 0, startedAt: now };
    }
    b.count += 1;
    ocRatingIpBuckets.set(ip, b);
}

function aggregateOnlineCourseRatings(rows) {
    const sums = {};
    if (!rows || !rows.length) return [];
    rows.forEach((r) => {
        const k = r.course_key;
        if (!k) return;
        if (!sums[k]) sums[k] = { sum: 0, count: 0 };
        sums[k].sum += Number(r.stars);
        sums[k].count += 1;
    });
    return Object.keys(sums).map((course_key) => {
        const { sum, count } = sums[course_key];
        return {
            course_key,
            average: Math.round((sum / count) * 100) / 100,
            count
        };
    });
}

async function fetchRatingAggregateForCourse(courseKey) {
    const data = await db.getRatingStarsForCourse(courseKey);
    if (!data || !data.length) {
        return { course_key: courseKey, average: null, count: 0 };
    }
    const sum = data.reduce((s, row) => s + Number(row.stars), 0);
    const count = data.length;
    return {
        course_key: courseKey,
        average: Math.round((sum / count) * 100) / 100,
        count
    };
}

app.get('/api/online-courses', async (req, res) => {
    try {
        let catRows;
        try {
            catRows = await db.listOnlineCourseCategories();
        } catch (catErr) {
            if (isMissingRelation(catErr)) {
                return res.json({
                    success: true,
                    categories: [],
                    courses: [],
                    message: 'Catalog tables not found; run npm run db:migrate on the server.'
                });
            }
            console.error('online-courses GET categories:', catErr);
            return res.status(500).json({ success: false, error: 'Failed to load course categories' });
        }

        let courseRows;
        try {
            courseRows = await db.listActiveOnlineCourses();
        } catch (courseErr) {
            if (isMissingRelation(courseErr)) {
                return res.json({
                    success: true,
                    categories: [],
                    courses: [],
                    message: 'Catalog tables not found; run npm run db:migrate on the server.'
                });
            }
            console.error('online-courses GET courses:', courseErr);
            return res.status(500).json({ success: false, error: 'Failed to load courses' });
        }

        const categories = (catRows || []).map((r) => ({
            slug: r.slug,
            sectionTitle: r.section_title,
            sectionLead: r.section_lead,
            sortOrder: r.sort_order
        }));
        const courses = (courseRows || []).map((r) => ({
            categorySlug: r.category_slug,
            courseKey: r.course_key,
            displayTitle: r.display_title,
            enrollCourseName: r.enroll_course_name,
            priceLabel: r.price_label,
            structuredText: r.structured_text,
            paceText: r.pace_text,
            amountSleMinor:
                r.amount_sle_minor != null && Number.isFinite(Number(r.amount_sle_minor))
                    ? Number(r.amount_sle_minor)
                    : 100000,
            sortOrder: r.sort_order
        }));

        res.json({ success: true, categories, courses });
    } catch (err) {
        console.error('online-courses GET:', err);
        res.status(500).json({ success: false, error: 'Failed to load online courses' });
    }
});

app.get('/api/online-course-ratings', async (req, res) => {
    try {
        let data;
        try {
            data = await db.listOnlineCourseRatingRows();
        } catch (error) {
            if (isMissingRelation(error)) {
                return res.json({ success: true, ratings: [], message: 'Ratings table not found; run npm run db:migrate.' });
            }
            console.error('online-course-ratings GET:', error);
            return res.status(500).json({ success: false, error: 'Failed to load ratings' });
        }
        const ratings = aggregateOnlineCourseRatings(data || []);
        res.json({ success: true, ratings });
    } catch (err) {
        console.error('online-course-ratings GET:', err);
        res.status(500).json({ success: false, error: 'Failed to load ratings' });
    }
});

app.post('/api/online-course-ratings', async (req, res) => {
    try {
        const ipAddress = getClientIp(req);
        if (!ocRatingThrottleAllowed(ipAddress)) {
            return res.status(429).json({
                success: false,
                error: 'Too many ratings from this network. Please try again later.'
            });
        }

        const rawKey = req.body.courseKey ?? req.body.course_key ?? '';
        const course_key = typeof rawKey === 'string' ? rawKey.trim().slice(0, 400) : '';
        const stars = parseInt(req.body.stars, 10);
        let comment = req.body.comment;
        if (typeof comment === 'string') {
            comment = comment.trim().slice(0, 2000) || null;
        } else {
            comment = null;
        }
        let rater_email = req.body.email ?? req.body.rater_email;
        if (typeof rater_email === 'string') {
            rater_email = rater_email.trim().slice(0, 200) || null;
        } else {
            rater_email = null;
        }

        if (!course_key) {
            return res.status(400).json({ success: false, error: 'courseKey is required' });
        }
        if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
            return res.status(400).json({ success: false, error: 'stars must be an integer from 1 to 5' });
        }

        const userAgent = getUserAgent(req);
        try {
            await db.insertOnlineCourseRating({
                course_key,
                stars,
                comment,
                rater_email,
                ip_address: ipAddress,
                user_agent: userAgent
            });
        } catch (insertError) {
            console.error('online-course-ratings POST insert:', insertError);
            if (isMissingRelation(insertError)) {
                return res.status(500).json({
                    success: false,
                    error: 'Ratings storage is not set up yet. Run npm run db:migrate on the server.'
                });
            }
            return res.status(500).json({ success: false, error: 'Failed to save rating' });
        }

        ocRatingThrottleRecordSuccess(ipAddress);
        const rating = await fetchRatingAggregateForCourse(course_key);
        res.json({ success: true, rating });
    } catch (err) {
        console.error('online-course-ratings POST:', err);
        res.status(500).json({ success: false, error: 'Failed to save rating' });
    }
});

function isAllowedMonimeReturnUrl(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') return false;
    try {
        const u = new URL(urlStr);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
        return monimeCheckoutAllowedOrigins.has(u.origin);
    } catch (e) {
        return false;
    }
}

const checkoutReturnStore = new Map();
const CHECKOUT_RETURN_TTL_MS = 48 * 60 * 60 * 1000;

function pruneCheckoutReturnStore() {
    const now = Date.now();
    for (const [key, row] of checkoutReturnStore) {
        if (now - row.createdAt > CHECKOUT_RETURN_TTL_MS) checkoutReturnStore.delete(key);
    }
}

function saveCheckoutReturn(id, data) {
    if (!id) return;
    pruneCheckoutReturnStore();
    checkoutReturnStore.set(String(id), { ...data, createdAt: Date.now() });
}

function getCheckoutReturn(id) {
    const row = checkoutReturnStore.get(String(id));
    if (!row) return null;
    if (Date.now() - row.createdAt > CHECKOUT_RETURN_TTL_MS) {
        checkoutReturnStore.delete(String(id));
        return null;
    }
    return row;
}

function resolveReturnOrigin(req) {
    const body = req.body || {};
    const candidates = [
        body.returnOrigin,
        body.successUrl,
        body.cancelUrl,
        req.get('origin'),
        req.get('referer')
    ];
    for (const raw of candidates) {
        if (!raw || typeof raw !== 'string') continue;
        try {
            const origin = /^https?:\/\//i.test(raw.trim()) ? new URL(raw.trim()).origin : null;
            if (origin && isAllowedMonimeReturnUrl(origin + '/')) return origin;
        } catch (ignore) {
            // try next field
        }
    }
    return null;
}

function buildShortPaymentReturnUrls(origin, returnId) {
    const base = String(origin).replace(/\/+$/, '');
    const q = 'id=' + encodeURIComponent(String(returnId));
    return {
        successUrl: `${base}/payment-success.html?${q}`,
        cancelUrl: `${base}/payment-cancelled.html?${q}`
    };
}

async function lookupOnlineCourseAmountSleMinor(courseNameTrimmed) {
    const cn = String(courseNameTrimmed || '').trim();
    if (!cn) return null;
    try {
        const byEnroll = await db.getCourseAmountByEnrollName(cn);
        if (byEnroll && byEnroll.amount_sle_minor != null) {
            const n = parseInt(byEnroll.amount_sle_minor, 10);
            if (Number.isInteger(n) && n >= 1 && n <= 100000000) return n;
        }
        const byKey = await db.getCourseAmountByKey(cn);
        if (byKey && byKey.amount_sle_minor != null) {
            const n = parseInt(byKey.amount_sle_minor, 10);
            if (Number.isInteger(n) && n >= 1 && n <= 100000000) return n;
        }
    } catch (ignore) {
        // online_courses table probably not created yet
    }
    return null;
}

app.post('/api/monime/checkout-session', paymentRateLimiter, async (req, res) => {
    try {
        const clientIp = getClientIp(req);
        
        // Check if IP is blocked due to suspicious activity
        if (isIpBlocked(clientIp)) {
            return res.status(429).json({
                success: false,
                error: 'Too many suspicious attempts. Please try again later or contact support.'
            });
        }
        if (!MONIME_ACCESS_TOKEN || !MONIME_SPACE_ID) {
            return res.status(503).json({
                success: false,
                error:
                    'Monime is not configured. Set MONIME_ACCESS_TOKEN and MONIME_SPACE_ID on the server (Render env or .env.local).',
                docs: 'https://docs.monime.io/developer-resources/api-basics'
            });
        }

        if (MONIME_REQUIRE_LIVE_TOKEN && MONIME_TOKEN_MODE === 'test') {
            return res.status(403).json({
                success: false,
                error:
                    'This server is configured for live payments only. Replace MONIME_ACCESS_TOKEN with a Monime live token (starts with mon_, not mon_test_), or set MONIME_REQUIRE_LIVE_TOKEN=false for sandbox.',
                docs: 'https://docs.monime.io/developer-resources/api-basics'
            });
        }

        const {
            customerEmail,
            fullName,
            phone,
            courseName,
            priceLabel,
            successUrl,
            cancelUrl,
            returnOrigin: returnOriginBody,
            idempotencyKey,
            amountMinor,
            currency,
            items: itemsBody
        } = req.body || {};

        // Enhanced input validation
        if (!customerEmail || !fullName || !phone) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: customerEmail, fullName, and phone are required.'
            });
        }

        // Build course list: multi-item cart and/or legacy single courseName
        const rawItems = Array.isArray(itemsBody) ? itemsBody : [];
        let courseNames = [];
        if (rawItems.length) {
            rawItems.forEach((it) => {
                if (!it || typeof it !== 'object') return;
                const primary = String(it.courseName || it.enrollCourseName || '').trim();
                const key = String(it.courseKey || '').trim();
                // Prefer enroll/display name; keep key as fallback lookup token
                if (primary) courseNames.push(primary);
                else if (key) courseNames.push(key);
                else return;
                // Also stash key for secondary lookup if needed (handled below)
                if (primary && key && primary !== key) {
                    it._lookupKey = key;
                }
            });
        }

        if (!courseNames.length && courseName) {
            courseNames = [String(courseName).trim()];
        }

        // Deduplicate while preserving order
        const seenCourses = new Set();
        courseNames = courseNames.filter((n) => {
            const k = n.toLowerCase();
            if (seenCourses.has(k)) return false;
            seenCourses.add(k);
            return true;
        });

        if (!courseNames.length) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: courseName or items[] with course names are required.'
            });
        }

        if (courseNames.length > 20) {
            return res.status(400).json({
                success: false,
                error: 'Too many courses in one checkout (maximum 20).'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerEmail)) {
            trackSuspiciousActivity(clientIp, 'invalid_email', { email: customerEmail });
            return res.status(400).json({
                success: false,
                error: 'Invalid email address format.'
            });
        }

        // Phone validation - basic format check for Sierra Leone numbers
        const phoneCleaned = String(phone).replace(/[\s\-\(\)]/g, '');
        if (!/^\+?232\d{8}$/.test(phoneCleaned) && !/^\d{8,15}$/.test(phoneCleaned)) {
            trackSuspiciousActivity(clientIp, 'invalid_phone', { phone: phone });
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number format. Please provide a valid phone number.'
            });
        }

        // Name validation - prevent injection and limit length
        const nameCleaned = String(fullName).trim();
        if (nameCleaned.length < 2 || nameCleaned.length > 100) {
            return res.status(400).json({
                success: false,
                error: 'Full name must be between 2 and 100 characters.'
            });
        }

        // Course name validation
        for (const cn of courseNames) {
            if (cn.length < 3 || cn.length > 200) {
                return res.status(400).json({
                    success: false,
                    error: 'Each course name must be between 3 and 200 characters.'
                });
            }
        }

        // Idempotency key validation
        if (idempotencyKey) {
            const idemCleaned = String(idempotencyKey).trim();
            if (idemCleaned.length < 8 || idemCleaned.length > 128) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid idempotency key format.'
                });
            }
        }

        const ccy = (currency || 'SLE').toString().slice(0, 3).toUpperCase();
        if (ccy !== 'SLE') {
            return res.status(400).json({ success: false, error: 'Only SLE currency is supported for this checkout.' });
        }

        const clientAmount = parseInt(amountMinor, 10);
        if (!Number.isInteger(clientAmount) || clientAmount < 1 || clientAmount > 100000000) {
            return res.status(400).json({
                success: false,
                error: 'Invalid amountMinor: must be a positive integer (SLE minor units, e.g. 100000 = SLE 1000.00).'
            });
        }

        const resolvedLineItems = [];
        let amount = 0;
        for (let i = 0; i < courseNames.length; i++) {
            const courseNm = courseNames[i];
            let catalogAmount = await lookupOnlineCourseAmountSleMinor(courseNm);
            // Fallback: try matching course_key from the same cart item
            if (catalogAmount == null && rawItems[i]) {
                const keyFallback = String(
                    rawItems[i].courseKey || rawItems[i]._lookupKey || ''
                ).trim();
                if (keyFallback && keyFallback !== courseNm) {
                    catalogAmount = await lookupOnlineCourseAmountSleMinor(keyFallback);
                }
            }
            // Training registration fallback when catalog row is missing
            if (
                catalogAmount == null &&
                String(req.body.source || '') === 'training' &&
                /digital\s*skills/i.test(courseNm)
            ) {
                catalogAmount =
                    typeof clientAmount === 'number' && clientAmount >= 1 ? clientAmount : 100;
                console.warn(
                    `Training checkout: using client/fallback amount for "${courseNm}" (catalog miss)`
                );
            }
            if (catalogAmount == null) {
                return res.status(400).json({
                    success: false,
                    error: `Unknown course "${courseNm}". Enroll from the online courses catalog so pricing is validated server-side.`
                });
            }
            if (!Number.isInteger(catalogAmount) || catalogAmount < 1 || catalogAmount > 100000000) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid charge amount for "${courseNm}". Check amount_sle_minor in the catalog.`
                });
            }
            amount += catalogAmount;
            resolvedLineItems.push({
                type: 'custom',
                name: courseNm.slice(0, 100),
                quantity: 1,
                price: { currency: 'SLE', value: catalogAmount }
            });
        }

        if (!Number.isInteger(amount) || amount < 1 || amount > 100000000) {
            return res.status(400).json({
                success: false,
                error: 'Invalid total charge amount for this cart.'
            });
        }
        if (amount !== clientAmount) {
            console.warn(
                `Checkout amount adjusted for cart [${courseNames.join(', ')}]: client ${clientAmount} → catalog ${amount}`
            );
        }

        const idem =
            idempotencyKey && String(idempotencyKey).trim().length > 0
                ? String(idempotencyKey).trim().slice(0, 64)
                : crypto.randomUUID();

        // Check for existing checkout session with same idempotency key
        try {
            const existingContext = await getCheckoutReturn(idem);
            if (existingContext && existingContext.timestamp) {
                const sessionAge = Date.now() - new Date(existingContext.timestamp).getTime();
                // If session is less than 1 hour old, return existing session
                if (sessionAge < 3600000) {
                    console.warn(`[Security] Duplicate checkout attempt detected for idempotency key: ${idem}`);
                    trackSuspiciousActivity(clientIp, 'duplicate_idempotency', { idempotencyKey: idem });
                    return res.status(409).json({
                        success: false,
                        error: 'A payment session with this idempotency key already exists. Please wait or use a new session.',
                        existingSession: true
                    });
                }
            }
        } catch (err) {
            // If lookup fails, continue with new session
            console.warn('[Security] Failed to check existing checkout context:', err.message);
        }

        const primaryName = courseNames[0].slice(0, 100);
        const sessionTitle =
            courseNames.length === 1
                ? `KNS Online — ${primaryName}`.slice(0, 150)
                : `KNS Online — ${courseNames.length} courses`.slice(0, 150);
        const coursesLabel = courseNames.join(', ').slice(0, 200);

        let returnOrigin = null;
        if (returnOriginBody) {
            try {
                const o = new URL(String(returnOriginBody).trim());
                if (isAllowedMonimeReturnUrl(o.origin + '/')) returnOrigin = o.origin;
            } catch (ignore) {
                // returnOrigin was junk
            }
        }
        if (!returnOrigin) returnOrigin = resolveReturnOrigin(req);
        let finalSuccessUrl = successUrl;
        let finalCancelUrl = cancelUrl;

        if (returnOrigin) {
            const short = buildShortPaymentReturnUrls(returnOrigin, idem);
            finalSuccessUrl = short.successUrl;
            finalCancelUrl = short.cancelUrl;
            saveCheckoutReturn(idem, {
                course: coursesLabel,
                price: String(priceLabel || 'NLe1'),
                amountMinor: amount,
                courses: courseNames,
                source: req.body.source || 'checkout'
            });
        }

        if (!finalSuccessUrl || !finalCancelUrl) {
            return res.status(400).json({
                success: false,
                error:
                    'Missing return URLs. Send returnOrigin (window.location.origin) plus successUrl and cancelUrl from checkout.'
            });
        }
        if (finalSuccessUrl.length > 255 || finalCancelUrl.length > 255) {
            return res.status(400).json({
                success: false,
                error: 'Return URLs exceed Monime 255 character limit. Use returnOrigin so the server can build short links.'
            });
        }
        if (!isAllowedMonimeReturnUrl(finalSuccessUrl) || !isAllowedMonimeReturnUrl(finalCancelUrl)) {
            return res.status(400).json({
                success: false,
                error:
                    'Return URL origin is not allowed. Set MONIME_ALLOWED_CHECKOUT_ORIGINS to include your site (e.g. http://localhost:3000).'
            });
        }

        const monimeBody = {
            name: sessionTitle,
            description: `Online course enrollment. ${String(priceLabel || '').slice(0, 950)}`.slice(0, 1000),
            reference: `kns-enroll-${Date.now()}`.slice(0, 255),
            successUrl: finalSuccessUrl,
            cancelUrl: finalCancelUrl,
            lineItems: resolvedLineItems,
            paymentOptions: {
                momo: { enabledProviders: ['m17', 'm18'] }
            },
            brandingOptions: {
                primaryColor: '#1a4d7a'
            },
            metadata: {
                customer_email: String(customerEmail).trim().slice(0, 100),
                customer_phone: String(phone).trim().slice(0, 100),
                customer_name: String(fullName).trim().slice(0, 100),
                course: primaryName.slice(0, 100),
                courses: coursesLabel.slice(0, 200),
                item_count: String(courseNames.length)
            }
        };

        const monimeRes = await fetch(`${MONIME_API_BASE}/v1/checkout-sessions`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: `Bearer ${MONIME_ACCESS_TOKEN}`,
                'Monime-Space-Id': MONIME_SPACE_ID,
                'Monime-Version': MONIME_VERSION,
                'Idempotency-Key': idem
            },
            body: JSON.stringify(monimeBody)
        });

        const json = await monimeRes.json().catch(() => ({}));

        if (!monimeRes.ok) {
            const msg =
                (json && (json.message || json.error)) ||
                (Array.isArray(json.messages) && json.messages[0] && (json.messages[0].message || json.messages[0])) ||
                'Monime did not create a checkout session.';
            console.error('Monime API error:', monimeRes.status, msg, JSON.stringify(json).slice(0, 500));
            return res.status(monimeRes.status >= 400 && monimeRes.status < 600 ? monimeRes.status : 502).json({
                success: false,
                error: typeof msg === 'string' ? msg : 'Monime checkout failed.',
                details: process.env.NODE_ENV === 'development' ? json : undefined
            });
        }

        return res.status(200).json(json);
    } catch (err) {
        console.error('Monime checkout-session exception:', err);
        return res.status(500).json({ success: false, error: 'Failed to reach Monime. Try again later.' });
    }
});

app.get('/api/monime/checkout-return-context', (req, res) => {
    const id = String(req.query.id || req.query.ref || '').trim();
    if (!id) {
        return res.status(400).json({ success: false, error: 'id is required' });
    }
    const row = getCheckoutReturn(id);
    if (!row) {
        return res.json({ success: false, error: 'not_found' });
    }
    res.json({
        success: true,
        course: row.course || '',
        price: row.price || '',
        cost: row.cost || '',
        amountMinor: row.amountMinor,
        source: row.source || 'checkout',
        reference: row.reference || id
    });
});

app.get('/api/scholarships/diagnostics', requireAdminApiKey, async (req, res) => {
    try {
        const diagnostics = {
            timestamp: new Date().toISOString(),
            database_configured: isDbConfigured(),
            tests: {}
        };

        try {
            const count = await db.countScholarships();
            const testData = await db.sampleScholarships(1);
            diagnostics.tests.table_access = {
                success: true,
                record_count: count,
                sample_record: testData.length > 0 ? testData[0] : null
            };
        } catch (err) {
            diagnostics.tests.table_access = {
                success: false,
                error: { message: err.message, code: err.code }
            };
        }

        try {
            const activeData = await db.listScholarshipsSample(10, true);
            diagnostics.tests.active_scholarships = {
                success: true,
                count: activeData.length,
                records: activeData
            };
        } catch (err) {
            diagnostics.tests.active_scholarships = {
                success: false,
                error: { message: err.message }
            };
        }

        try {
            const allData = await db.listScholarshipsSample(10, false);
            diagnostics.tests.all_scholarships = {
                success: true,
                count: allData.length,
                records: allData
            };
        } catch (err) {
            diagnostics.tests.all_scholarships = {
                success: false,
                error: { message: err.message }
            };
        }

        res.json({ success: true, diagnostics });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stack: IS_PRODUCTION ? undefined : error.stack
        });
    }
});

app.get('/api/scholarships/test', requireAdminApiKey, async (req, res) => {
    try {
        console.log('Testing scholarships connection...');

        let testData = [];
        let count = 0;
        let testError = null;
        try {
            count = await db.countScholarships();
            testData = await db.sampleScholarships(1);
        } catch (err) {
            testError = err;
        }

        const result = {
            timestamp: new Date().toISOString(),
            database_connected: !testError,
            table_exists: !testError || !isMissingRelation(testError),
            total_records: count,
            test_query_error: testError
                ? { code: testError.code, message: testError.message }
                : null,
            sample_record: testData.length > 0 ? testData[0] : null
        };

        try {
            const activeData = await db.listScholarshipsSample(5, true);
            result.active_scholarships_count = activeData.length;
            result.active_scholarships = activeData;
            result.active_query_error = null;
        } catch (activeError) {
            result.active_scholarships_count = 0;
            result.active_scholarships = [];
            result.active_query_error = {
                code: activeError.code,
                message: activeError.message
            };
        }

        res.json({ success: true, test: result });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stack: IS_PRODUCTION ? undefined : error.stack
        });
    }
});

app.post('/api/messages', formRateLimiter, async (req, res) => {
    const { sessionId, sender, message } = req.body;
    
    if (!sessionId || !sender || !message) {
        return res.status(400).json({ 
            error: 'Missing required fields: sessionId, sender, and message are required' 
        });
    }
    
    if (sender !== 'user') {
        return res.status(400).json({ 
            error: 'Invalid sender. Must be "user"' 
        });
    }
    
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    
    let data;
    try {
        data = await db.insertMessage({
            session_id: sessionId,
            sender,
            message,
            ip_address: ipAddress,
            user_agent: userAgent
        });
    } catch (error) {
        console.error('Error saving message:', error);
        return res.status(500).json({ error: 'Failed to save message' });
    }

    res.json({
        success: true, 
        messageId: data.id,
        message: 'Message saved successfully' 
    });
});

app.get('/api/messages/:sessionId', requireAdminApiKey, async (req, res) => {
    const { sessionId } = req.params;

    try {
        const data = await db.getMessagesBySession(sessionId);
        res.json({ success: true, messages: data || [] });
    } catch (error) {
        console.error('Error fetching messages:', error);
        return res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

app.post('/api/contacts', formRateLimiter, async (req, res) => {
    const { name, email, phone, subject, message } = req.body;
    
    if (!name || !email || !subject || !message) {
        return res.status(400).json({ 
            error: 'Missing required fields: name, email, subject, and message are required' 
        });
    }
    
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    
    // save contact row first
    let data;
    try {
        data = await db.insertContact({
            name,
            email,
            phone: phone || null,
            subject,
            message,
            ip_address: ipAddress,
            user_agent: userAgent
        });
    } catch (error) {
        console.error('Error saving contact:', error);
        return res.status(500).json({
            error: 'Failed to save contact submission',
            details: error.message || 'Unknown database error',
            code: error.code
        });
    }

    // email admissions; don't block the JSON response
    if (!brevoApiKey || !brevoFromEmail || !brevoToEmail) {
        console.warn(
            'Contact saved, but Brevo is not fully configured. Skipping email send.'
        );
    } else {
        const subjectLine = `New contact form submission: ${subject || 'No subject'}`;

        const textBody = `
New contact form submission from KNS College website

Name: ${name}
Email: ${email}
Phone: ${phone || 'N/A'}
Subject: ${subject}

Message:
${message}

IP Address: ${ipAddress}
User Agent: ${userAgent}
Submitted At: ${new Date().toISOString()}
`.trim();

        const htmlBody = `
            <h2>New contact form submission from KNS College website</h2>
            <p><strong>Name:</strong> ${escapeHtml(name)}</p>
            <p><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(phone || 'N/A')}</p>
            <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
            <p><strong>Message:</strong><br>${escapeHtmlWithBreaks(message)}</p>
            <hr>
            <p><strong>IP Address:</strong> ${escapeHtml(ipAddress)}</p>
            <p><strong>User Agent:</strong> ${escapeHtml(userAgent)}</p>
            <p><strong>Submitted At:</strong> ${escapeHtml(new Date().toISOString())}</p>
        `;

        const contactRecipientEmail = process.env.BREVO_CONTACT_EMAIL || 'admissions@kns.edu.sl';
        
        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.to = [{ email: contactRecipientEmail }];
        sendSmtpEmail.sender = { email: brevoFromEmail, name: 'KNS College' };
        sendSmtpEmail.subject = subjectLine;
        sendSmtpEmail.textContent = textBody;
        sendSmtpEmail.htmlContent = htmlBody;

        console.log(`Attempting to send contact form email...`);
        console.log(`  From: ${brevoFromEmail}`);
        console.log(`  To: ${contactRecipientEmail}`);

        apiInstance.sendTransacEmail(sendSmtpEmail)
            .then((response) => {
                console.log('Contact notification email sent via Brevo');
                console.log(`  From: ${brevoFromEmail}`);
                console.log(`  To: ${contactRecipientEmail}`);
                console.log(`  Brevo Status: ${response?.messageId || 'Success'}`);
                console.log(`  Note: Brevo accepted the email, but delivery depends on recipient mail server.`);
            })
            .catch((emailError) => {
                console.error('Error sending contact email via Brevo');
                console.error(`  Status Code: ${emailError.code || emailError.response?.statusCode || 'Unknown'}`);
                console.error(`  From Email: ${brevoFromEmail}`);
                
                if (emailError.response?.body?.errors) {
                    emailError.response.body.errors.forEach((err, index) => {
                        console.error(`  Error ${index + 1}:`, err.message || err);
                    });
                }
                
                if (emailError.code === 403 || emailError.response?.statusCode === 403) {
                    console.error(' Sender email may not be verified in Brevo. Check your Brevo account settings.');
                } else {
                    console.error('\n  If Brevo accepts emails but they show issues in Activity:');
                    console.error('    Check recipient mail server connectivity (see scholarship application handler for details)');
                }
            });
    }
    
    res.json({ 
        success: true, 
        contactId: data.id,
        message: 'Contact submission saved successfully' 
    });
});

app.get('/api/contacts', requireAdminApiKey, async (req, res) => {
    try {
        const data = await db.listContacts();
        res.json({ success: true, contacts: data || [] });
    } catch (error) {
        console.error('Error fetching contacts:', error);
        return res.status(500).json({ error: 'Failed to fetch contacts' });
    }
});

app.post('/api/enquiries', formRateLimiter, async (req, res) => {
    const { name, email, phone, programme_interest, preferred_intake, message, newsletter } = req.body;
    
    if (!name || !email || !programme_interest) {
        return res.status(400).json({ 
            error: 'Missing required fields: name, email, and programme_interest are required' 
        });
    }
    
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    const newsletterValue = newsletter === true || newsletter === 'yes' || newsletter === 1 || newsletter === 'true';
    
    let data;
    try {
        data = await db.insertEnquiry({
            name,
            email,
            phone: phone || null,
            programme_interest,
            preferred_intake: preferred_intake || null,
            message: message || null,
            newsletter: newsletterValue,
            ip_address: ipAddress,
            user_agent: userAgent
        });
    } catch (error) {
        console.error('Error saving enquiry:', error);
        return res.status(500).json({ error: 'Failed to save enquiry submission' });
    }

    // email enquiry team in the background
    if (!brevoApiKey || !brevoFromEmail || !brevoToEmail) {
        console.warn(
            'Enquiry saved, but Brevo is not fully configured. Skipping email send.'
        );
    } else {
        const subjectLine = `New programme enquiry: ${programme_interest || 'No programme specified'}`;

        const textBody = `
New programme enquiry from KNS College website

Name: ${name}
Email: ${email}
Phone: ${phone || 'N/A'}
Programme of Interest: ${programme_interest}
Preferred Intake: ${preferred_intake || 'Not specified'}

Message:
${message || 'No additional message provided'}

Newsletter Opt-in: ${newsletterValue ? 'Yes' : 'No'}
IP Address: ${ipAddress}
User Agent: ${userAgent}
Submitted At: ${new Date().toISOString()}
`.trim();

        const htmlBody = `
            <h2>New programme enquiry from KNS College website</h2>
            <p><strong>Name:</strong> ${escapeHtml(name)}</p>
            <p><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(phone || 'N/A')}</p>
            <p><strong>Programme of Interest:</strong> ${escapeHtml(programme_interest)}</p>
            <p><strong>Preferred Intake:</strong> ${escapeHtml(preferred_intake || 'Not specified')}</p>
            <p><strong>Message:</strong><br>${escapeHtmlWithBreaks(message || 'No additional message provided')}</p>
            <p><strong>Newsletter Opt-in:</strong> ${newsletterValue ? 'Yes' : 'No'}</p>
            <hr>
            <p><strong>IP Address:</strong> ${escapeHtml(ipAddress)}</p>
            <p><strong>User Agent:</strong> ${escapeHtml(userAgent)}</p>
            <p><strong>Submitted At:</strong> ${escapeHtml(new Date().toISOString())}</p>
        `;

        const enquiryRecipientEmail = process.env.BREVO_ENQUIRY_EMAIL || 'enquiry@kns.edu.sl';
        
        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.to = [{ email: enquiryRecipientEmail }];
        sendSmtpEmail.sender = { email: brevoFromEmail, name: 'KNS College' };
        sendSmtpEmail.subject = subjectLine;
        sendSmtpEmail.textContent = textBody;
        sendSmtpEmail.htmlContent = htmlBody;

        console.log(`Attempting to send enquiry form email...`);
        console.log(`  From: ${brevoFromEmail}`);
        console.log(`  To: ${enquiryRecipientEmail}`);

        apiInstance.sendTransacEmail(sendSmtpEmail)
            .then((response) => {
                console.log('Enquiry notification email sent via Brevo');
                console.log(`  From: ${brevoFromEmail}`);
                console.log(`  To: ${enquiryRecipientEmail}`);
                console.log(`  Brevo Status: ${response?.messageId || 'Success'}`);
                console.log(`  Note: Brevo accepted the email, but delivery depends on recipient mail server.`);
            })
            .catch((emailError) => {
                console.error('Error sending enquiry email via Brevo');
                console.error(`  Status Code: ${emailError.code || emailError.response?.statusCode || 'Unknown'}`);
                console.error(`  From Email: ${brevoFromEmail}`);
                
                if (emailError.response?.body?.errors) {
                    emailError.response.body.errors.forEach((err, index) => {
                        console.error(`  Error ${index + 1}:`, err.message || err);
                    });
                }
                
                if (emailError.code === 403 || emailError.response?.statusCode === 403) {
                    console.error(' Sender email may not be verified in Brevo. Check your Brevo account settings.');
                } else {
                    console.error('\n  If Brevo accepts emails but they show issues in Activity:');
                    console.error('    Check recipient mail server connectivity (see scholarship application handler for details)');
                }
            });
    }
    
    res.json({ 
        success: true, 
        enquiryId: data.id,
        message: 'Enquiry submission saved successfully' 
    });
});

app.get('/api/enquiries', requireAdminApiKey, async (req, res) => {
    try {
        const data = await db.listEnquiries();
        res.json({ success: true, enquiries: data || [] });
    } catch (error) {
        console.error('Error fetching enquiries:', error);
        return res.status(500).json({ error: 'Failed to fetch enquiries' });
    }
});

app.post('/api/training-registrations', formRateLimiter, async (req, res) => {
    const { fullname, gender, age, address, whatsapp, email } = req.body;
    
    if (!fullname || !gender || !age || !address || !whatsapp) {
        return res.status(400).json({ 
            error: 'Missing required fields: fullname, gender, age, address, and whatsapp are required' 
        });
    }
    
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    
    try {
        const data = await db.createTrainingRegistration({
            fullname,
            gender,
            age,
            address,
            whatsapp,
            email: email || null,
            ip_address: ipAddress,
            user_agent: userAgent
        });
    } catch (error) {
        console.error('Error saving training registration:', error);
        return res.status(500).json({
            error: 'Failed to save training registration',
            details: error.message || 'Unknown database error',
            code: error.code
        });
    }

    // email notifications - don't block the JSON response
    if (brevoApiKey && brevoFromEmail) {
        const subjectLine = `New Training Registration: ${fullname} - Digital Skills Training`;
        
        const textBody = `
New training registration from KNS College website

Registration Details:
Name: ${fullname}
Gender: ${gender}
Age: ${age}
Address: ${address}
WhatsApp: ${whatsapp}
Email: ${email || 'Not provided'}

Training: One-Month Digital Skills Training
Programme: Digital Literacy, Microsoft Word, Excel, PowerPoint, AI

IP Address: ${ipAddress}
User Agent: ${userAgent}
Submitted At: ${new Date().toISOString()}
`.trim();
        
        const htmlBody = `
            <h2>New training registration from KNS College website</h2>
            <h3>Registration Details</h3>
            <p><strong>Name:</strong> ${escapeHtml(fullname)}</p>
            <p><strong>Gender:</strong> ${escapeHtml(gender)}</p>
            <p><strong>Age:</strong> ${escapeHtml(age)}</p>
            <p><strong>Address:</strong> ${escapeHtml(address)}</p>
            <p><strong>WhatsApp:</strong> ${escapeHtml(whatsapp)}</p>
            <p><strong>Email:</strong> ${escapeHtml(email || 'Not provided')}</p>
            
            <h3>Training Information</h3>
            <p><strong>Training:</strong> One-Month Digital Skills Training</p>
            <p><strong>Programme:</strong> Digital Literacy, Microsoft Word, Excel, PowerPoint, AI</p>
            
            <hr>
            <p><strong>IP Address:</strong> ${escapeHtml(ipAddress)}</p>
            <p><strong>User Agent:</strong> ${escapeHtml(userAgent)}</p>
            <p><strong>Submitted At:</strong> ${escapeHtml(new Date().toISOString())}</p>
        `;
        
        const trainingRecipientEmail = process.env.BREVO_TRAINING_EMAIL || 'admissions@kns.edu.sl';
        
        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.to = [{ email: trainingRecipientEmail }];
        sendSmtpEmail.sender = { email: brevoFromEmail, name: 'KNS College' };
        sendSmtpEmail.subject = subjectLine;
        sendSmtpEmail.textContent = textBody;
        sendSmtpEmail.htmlContent = htmlBody;
        
        console.log(`Attempting to send training registration email...`);
        console.log(`  From: ${brevoFromEmail}`);
        console.log(`  To: ${trainingRecipientEmail}`);
        
        apiInstance.sendTransacEmail(sendSmtpEmail)
            .then((response) => {
                console.log('Training registration notification email sent via Brevo');
                console.log(`  From: ${brevoFromEmail}`);
                console.log(`  To: ${trainingRecipientEmail}`);
                console.log(`  Brevo Status: ${response?.messageId || 'Success'}`);
            })
            .catch((emailError) => {
                console.error('Error sending training registration email via Brevo');
                console.error(`  Status Code: ${emailError.code || emailError.response?.statusCode || 'Unknown'}`);
                console.error(`  From Email: ${brevoFromEmail}`);
                
                if (emailError.response?.body?.errors) {
                    emailError.response.body.errors.forEach((err, index) => {
                        console.error(`  Error ${index + 1}:`, err.message || err);
                    });
                }
            });
    }
    
    res.json({ 
        success: true, 
        message: 'Training registration submitted successfully' 
    });
});

app.post('/api/enrollments', formRateLimiter, async (req, res) => {
    const { 
        courseName, 
        firstName, 
        lastName, 
        email, 
        phone, 
        paymentMethod, 
        mobileNumber,
        enrollmentFee 
    } = req.body;
    
    if (!courseName || !firstName || !lastName || !email) {
        return res.status(400).json({ 
            error: 'Missing required fields: courseName, firstName, lastName, and email are required' 
        });
    }
    
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    
    let data;
    try {
        data = await db.insertEnrollment({
            course_name: courseName,
            first_name: firstName,
            last_name: lastName,
            email,
            phone: phone || null,
            payment_method: paymentMethod || null,
            mobile_number: mobileNumber || null,
            enrollment_fee: enrollmentFee || 'Le1,000',
            ip_address: ipAddress,
            user_agent: userAgent
        });
    } catch (error) {
        console.error('Error saving enrollment:', error);
        return res.status(500).json({ error: 'Failed to save enrollment submission' });
    }
    
    res.json({ 
        success: true, 
        enrollmentId: data.id,
        message: 'Enrollment submission saved successfully' 
    });
});

app.get('/api/enrollments', requireAdminApiKey, async (req, res) => {
    try {
        const data = await db.listEnrollments();
        res.json({ success: true, enrollments: data || [] });
    } catch (error) {
        console.error('Error fetching enrollments:', error);
        return res.status(500).json({ error: 'Failed to fetch enrollments' });
    }
});

app.post('/api/payments', formRateLimiter, async (req, res) => {
    const { 
        courseName, 
        fullName, 
        email, 
        phone, 
        address, 
        city, 
        country, 
        dateOfBirth, 
        gender, 
        emergencyContact, 
        emergencyPhone, 
        deliveryMode, 
        intakePeriod, 
        paymentReference
    } = req.body;
    
    if (!courseName || !fullName || !email || !phone || !address || !city || !deliveryMode || !intakePeriod) {
        return res.status(400).json({ 
            error: 'Missing required fields: courseName, fullName, email, phone, address, city, deliveryMode, and intakePeriod are required' 
        });
    }
    
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    
    let data;
    try {
        data = await db.insertPayment({
            course_name: courseName,
            full_name: fullName,
            email,
            phone,
            address,
            city,
            country: country || 'Sierra Leone',
            date_of_birth: dateOfBirth || null,
            gender: gender || null,
            emergency_contact: emergencyContact || null,
            emergency_phone: emergencyPhone || null,
            delivery_mode: deliveryMode,
            intake_period: intakePeriod,
            application_fee: APPLICATION_FEE_SLE,
            payment_status: 'pending',
            payment_reference: paymentReference || null,
            payment_provider: 'monime',
            ip_address: ipAddress,
            user_agent: userAgent
        });
    } catch (error) {
        console.error('Error saving payment:', error);
        return res.status(500).json({ error: 'Failed to save payment submission' });
    }

    if (paymentReference) {
        saveCheckoutReturn(paymentReference, {
            course: courseName,
            cost: String(APPLICATION_FEE_SLE),
            source: 'application',
            reference: paymentReference
        });
    }
    
    const statusUpdateToken = createPaymentStatusToken(data.id, data.payment_reference || paymentReference || '');

    res.json({ 
        success: true, 
        paymentId: data.id,
        paymentReference: data.payment_reference,
        statusUpdateToken,
        message: 'Payment submission saved successfully' 
    });
});

app.post('/api/payments/return-status', formRateLimiter, async (req, res) => {
    const { paymentReference, paymentStatus, statusUpdateToken } = req.body || {};

    if (!paymentReference || !paymentStatus || !statusUpdateToken) {
        return res.status(400).json({
            error: 'paymentReference, paymentStatus, and statusUpdateToken are required'
        });
    }

    const allowedStatuses = new Set(['success', 'failed', 'cancelled']);
    if (!allowedStatuses.has(String(paymentStatus))) {
        return res.status(400).json({ error: 'Invalid paymentStatus' });
    }

    let existing;
    try {
        existing = await db.getPaymentByReference(String(paymentReference).trim());
    } catch (lookupError) {
        console.error('Error looking up payment:', lookupError);
        return res.status(500).json({ error: 'Failed to look up payment' });
    }

    if (!existing) {
        return res.status(404).json({ error: 'Payment record not found' });
    }

    if (!verifyPaymentStatusToken(existing.id, existing.payment_reference, statusUpdateToken)) {
        return res.status(403).json({ error: 'Invalid status update token' });
    }

    let data;
    try {
        data = await db.updatePaymentStatusById(existing.id, paymentStatus);
    } catch (error) {
        console.error('Error updating payment:', error);
        return res.status(500).json({ error: 'Failed to update payment status' });
    }

    res.json({
        success: true,
        payment: data,
        message: 'Payment status updated successfully'
    });
});

app.patch('/api/payments/:paymentId', requireAdminApiKey, async (req, res) => {
    const { paymentId } = req.params;
    const { paymentStatus, paymentReference } = req.body;
    
    if (!paymentStatus) {
        return res.status(400).json({ 
            error: 'Missing required field: paymentStatus is required' 
        });
    }
    
    const updateData = { payment_status: paymentStatus };
    if (paymentReference) {
        updateData.payment_reference = paymentReference;
    }

    let data;
    try {
        data = await db.updatePaymentById(paymentId, updateData);
    } catch (error) {
        console.error('Error updating payment:', error);
        return res.status(500).json({ error: 'Failed to update payment status' });
    }

    if (!data) {
        return res.status(404).json({ error: 'Payment record not found' });
    }

    res.json({
        success: true, 
        payment: data,
        message: 'Payment status updated successfully' 
    });
});

app.get('/api/payments', requireAdminApiKey, async (req, res) => {
    const { status, course, reference } = req.query;

    try {
        const data = await db.listPayments({ status, course, reference });
        res.json({ success: true, payments: data || [] });
    } catch (error) {
        console.error('Error fetching payments:', error);
        return res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

app.get('/api/scholarships', async (req, res) => {
    try {
        let data;
        try {
            data = await db.listActiveScholarships();
        } catch (error) {
            console.error('Error fetching scholarships:', error.code, error.message);
            if (isMissingRelation(error)) {
                return res.status(500).json({
                    error: 'Scholarships table not found',
                    details: 'Run npm run db:migrate on the server to create database tables.'
                });
            }
            return res.status(500).json({
                error: 'Failed to fetch scholarships',
                details: error.message || 'Unknown database error',
                code: error.code
            });
        }

        if (!data || data.length === 0) {
            return res.json({
                success: true,
                scholarships: [],
                message: 'No active scholarships found. Add rows to the scholarships table with is_active = true.'
            });
        }

        res.json({ success: true, scholarships: data || [] });
    } catch (error) {
        console.error('Unexpected error fetching scholarships:', error.message);
        res.status(500).json({
            error: 'Failed to fetch scholarships',
            details: error.message || 'Unexpected server error'
        });
    }
});

app.get('/api/scholarships/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const data = await db.getActiveScholarshipById(id);

        if (!data) {
            return res.status(404).json({ error: 'Scholarship not found' });
        }

        res.json({ success: true, scholarship: data });
    } catch (error) {
        console.error('Error fetching scholarship:', error);
        res.status(500).json({ error: 'Failed to fetch scholarship' });
    }
});

app.get('/api/scholarships/:id/download/:type', async (req, res) => {
    const { id, type } = req.params;
    
    // only guide or form downloads
    if (type !== 'guide' && type !== 'form') {
        return res.status(400).json({ error: 'Invalid download type. Use "guide" or "form".' });
    }
    
    try {
        const data = await db.getActiveScholarshipById(id);

        if (!data) {
            console.error(`Download error: Scholarship ${id} not found`);
            return res.status(404).json({ error: 'Scholarship not found' });
        }

        const filePath = type === 'guide' ? data.guide_path : data.form_path;
        
        if (!filePath || filePath === '#' || filePath.trim() === '') {
            return res.status(404).json({ 
                error: `${type === 'guide' ? 'Guide' : 'Form'} file not available for this scholarship.`,
                message: 'The file path is not set in the database.'
            });
        }
        
        const trimmedPath = filePath.trim();
        
        // hosted file — pull it server-side so the browser skips CORS
        if (trimmedPath.startsWith('http://') || trimmedPath.startsWith('https://')) {
            if (!isAllowedScholarshipFileUrl(trimmedPath)) {
                return res.status(400).json({ error: 'External file URL is not allowed' });
            }
            try {
                const https = require('https');
                const http = require('http');
                
                const fileUrl = new URL(trimmedPath);
                const protocol = fileUrl.protocol === 'https:' ? https : http;
                
                protocol.get(trimmedPath, (fileResponse) => {
                    if (fileResponse.statusCode !== 200) {
                        return res.status(fileResponse.statusCode).json({ 
                            error: 'Failed to fetch file from external source',
                            statusCode: fileResponse.statusCode
                        });
                    }
                    
                    // content-type from upstream or .pdf extension
                    const contentType = fileResponse.headers['content-type'] || 
                                      (trimmedPath.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
                    
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Content-Disposition', `attachment; filename="${trimmedPath.split('/').pop()}"`);
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    
                    fileResponse.pipe(res);
                }).on('error', (err) => {
                    console.error('Error fetching external file:', err.message);
                    res.status(500).json({ error: 'Failed to fetch file from external source', details: err.message });
                });
            } catch (proxyError) {
                // proxy died — just redirect them
                return res.redirect(trimmedPath);
            }
            return;
        }
        
        // file under /scholarships on disk
        const path = require('path');
        const fs = require('fs');
        
        const fullPath = resolveScholarshipFilePath(__dirname, trimmedPath);
        if (!fullPath) {
            return res.status(400).json({ error: 'Invalid file path' });
        }
        
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ 
                error: 'File not found',
                message: 'The requested file does not exist on the server.'
            });
        }
        
        // work out MIME from extension
        const ext = path.extname(fullPath).toLowerCase();
        let contentType = 'application/octet-stream';
        if (ext === '.pdf') {
            contentType = 'application/pdf';
        } else if (ext === '.doc') {
            contentType = 'application/msword';
        } else if (ext === '.docx') {
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        }
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(fullPath)}"`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        res.sendFile(fullPath, (err) => {
            if (err) {
                console.error('Error sending file:', err.message);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to send file', details: err.message });
                }
            }
        });
        
    } catch (error) {
        console.error('Download error:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to serve file', details: error.message });
        }
    }
});

app.get('/api/scholarships/:id/files/check', requireAdminApiKey, async (req, res) => {
    const { id } = req.params;
    
    try {
        const data = await db.getActiveScholarshipById(id);

        if (!data) {
            return res.status(404).json({ error: 'Scholarship not found' });
        }

        const path = require('path');
        const fs = require('fs');
        
        const results = {
            scholarship_id: id,
            scholarship_title: data.title,
            guide_path: data.guide_path,
            form_path: data.form_path,
            guide_exists: false,
            form_exists: false,
            guide_full_path: null,
            form_full_path: null,
            scholarships_dir_exists: fs.existsSync(path.join(__dirname, 'scholarships'))
        };
        
        // guide on disk
        if (data.guide_path && data.guide_path.trim() && !data.guide_path.startsWith('http')) {
            const fullPath = resolveScholarshipFilePath(__dirname, data.guide_path);
            results.guide_full_path = IS_PRODUCTION ? undefined : fullPath;
            results.guide_exists = fullPath ? fs.existsSync(fullPath) : false;
        } else if (data.guide_path && (data.guide_path.startsWith('http://') || data.guide_path.startsWith('https://'))) {
            results.guide_exists = isAllowedScholarshipFileUrl(data.guide_path) ? 'external_url' : 'blocked_url';
        }
        
        // application form on disk
        if (data.form_path && data.form_path.trim() && !data.form_path.startsWith('http')) {
            const fullPath = resolveScholarshipFilePath(__dirname, data.form_path);
            results.form_full_path = IS_PRODUCTION ? undefined : fullPath;
            results.form_exists = fullPath ? fs.existsSync(fullPath) : false;
        } else if (data.form_path && (data.form_path.startsWith('http://') || data.form_path.startsWith('https://'))) {
            results.form_exists = isAllowedScholarshipFileUrl(data.form_path) ? 'external_url' : 'blocked_url';
        }
        
        res.json({ success: true, ...results });
    } catch (error) {
        console.error('Error checking files:', error);
        res.status(500).json({ error: 'Failed to check files', details: error.message });
    }
});

app.post('/api/scholarship-applications', formRateLimiter, async (req, res) => {
    try {
        // pull fields off the request body
        const {
            scholarship_id,
            surname,
            first_name,
            other_names,
            gender,
            date_of_birth,
            nationality,
            national_id,
            address,
            city,
            phone,
            email,
            highest_qualification,
            school_institution,
            year_of_completion,
            credits,
            programme,
            scholarship_type,
            previous_application,
            previous_application_details,
            personal_statement,
            declaration
        } = req.body;
        
        // basics + national ID must be there
        if (!surname || !first_name || !gender || !date_of_birth || !nationality || 
            !national_id || national_id.trim() === '' ||
            !address || !city || !phone || !email || !highest_qualification || !school_institution ||
            !year_of_completion || !programme || !scholarship_type || !previous_application ||
            !personal_statement || declaration !== 'on') {
            return res.status(400).json({ 
                error: 'Missing required fields. Please ensure all required fields are completed, including National ID Number.' 
            });
        }
        
        // personal statement needs 300+ words
        const statementWords = personal_statement.trim().split(/\s+/).filter(word => word.length > 0);
        if (statementWords.length < 300) {
            return res.status(400).json({ 
                error: `Personal statement must be at least 300 words. Currently: ${statementWords.length} words.` 
            });
        }
        
        const ipAddress = getClientIp(req);
        const userAgent = getUserAgent(req);
        
        // persist the application
        let data;
        try {
            data = await db.insertScholarshipApplication({
                scholarship_id: scholarship_id || null,
                surname,
                first_name,
                other_names: other_names || null,
                gender,
                date_of_birth,
                nationality,
                national_id: national_id.trim(),
                address,
                city,
                phone,
                email,
                highest_qualification,
                school_institution,
                year_of_completion: parseInt(year_of_completion, 10),
                credits: credits || null,
                programme,
                scholarship_type,
                previous_application,
                previous_application_details:
                    previous_application === 'Yes' ? previous_application_details : null,
                personal_statement,
                documents_submitted_in_person: true,
                ip_address: ipAddress,
                user_agent: userAgent
            });
        } catch (error) {
            console.error('Error saving scholarship application:', error);
            return res.status(500).json({
                error: 'Failed to save scholarship application',
                details: error.message || 'Unknown database error',
                code: error.code,
                fullError: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }

        // notify scholarships inbox — don't hold the client
        if (brevoApiKey && brevoFromEmail && brevoToEmail) {
            const subjectLine = `New Scholarship Application: ${programme} - ${first_name} ${surname}`;
            
            const textBody = `
New scholarship application from KNS College website

Personal Information:
Name: ${surname}, ${first_name} ${other_names || ''}
Gender: ${gender}
Date of Birth: ${date_of_birth}
Nationality: ${nationality}
National ID: ${national_id}

Contact Information:
Address: ${address}
City: ${city}
Phone: ${phone}
Email: ${email}

Academic Background:
Highest Qualification: ${highest_qualification}
School/Institution: ${school_institution}
Year of Completion: ${year_of_completion}
Credits: ${credits || 'N/A'}

Programme & Scholarship:
Programme: ${programme}
Scholarship Type: ${scholarship_type}
Previous Application: ${previous_application}
${previous_application === 'Yes' && previous_application_details ? `Previous Application Details: ${previous_application_details}` : ''}

Personal Statement:
${personal_statement.substring(0, 500)}${personal_statement.length > 500 ? '...' : ''}

Note: Supporting documents must be submitted in person at the KNS College office.
Required documents:
- Academic Certificate(s) or Result Slip
- Valid National ID or Passport (clear copy)
- Passport-size Photograph
- Curriculum Vitae (CV)
- Recommendation Letter (Optional but Advantageous)

Office Location: 18 Dundas Street, Freetown, Sierra Leone
Contact: +232 79 422 442 | admissions@kns.edu.sl

IP Address: ${ipAddress}
User Agent: ${userAgent}
Submitted At: ${new Date().toISOString()}
`.trim();
            
            const htmlBody = `
                <h2>New scholarship application from KNS College website</h2>
                <h3>Personal Information</h3>
                <p><strong>Name:</strong> ${escapeHtml(surname)}, ${escapeHtml(first_name)} ${escapeHtml(other_names || '')}</p>
                <p><strong>Gender:</strong> ${escapeHtml(gender)}</p>
                <p><strong>Date of Birth:</strong> ${escapeHtml(date_of_birth)}</p>
                <p><strong>Nationality:</strong> ${escapeHtml(nationality)}</p>
                <p><strong>National ID:</strong> ${escapeHtml(national_id)}</p>
                
                <h3>Contact Information</h3>
                <p><strong>Address:</strong> ${escapeHtml(address)}</p>
                <p><strong>City:</strong> ${escapeHtml(city)}</p>
                <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
                <p><strong>Email:</strong> ${escapeHtml(email)}</p>
                
                <h3>Academic Background</h3>
                <p><strong>Highest Qualification:</strong> ${escapeHtml(highest_qualification)}</p>
                <p><strong>School/Institution:</strong> ${escapeHtml(school_institution)}</p>
                <p><strong>Year of Completion:</strong> ${escapeHtml(year_of_completion)}</p>
                <p><strong>Credits:</strong> ${escapeHtml(credits || 'N/A')}</p>
                
                <h3>Programme & Scholarship</h3>
                <p><strong>Programme:</strong> ${escapeHtml(programme)}</p>
                <p><strong>Scholarship Type:</strong> ${escapeHtml(scholarship_type)}</p>
                <p><strong>Previous Application:</strong> ${escapeHtml(previous_application)}</p>
                ${previous_application === 'Yes' && previous_application_details ? `<p><strong>Previous Application Details:</strong> ${escapeHtml(previous_application_details)}</p>` : ''}
                
                <h3>Personal Statement</h3>
                <p>${escapeHtmlWithBreaks(personal_statement)}</p>
                
                <h3>Supporting Documents</h3>
                <p><strong>Note:</strong> Supporting documents must be submitted in person at the KNS College office.</p>
                <p><strong>Required documents:</strong></p>
                <ul>
                    <li>Academic Certificate(s) or Result Slip</li>
                    <li>Valid National ID or Passport (clear copy)</li>
                    <li>Passport-size Photograph</li>
                    <li>Curriculum Vitae (CV)</li>
                    <li>Recommendation Letter (Optional but Advantageous)</li>
                </ul>
                <p><strong>Office Location:</strong> 18 Dundas Street, Freetown, Sierra Leone<br>
                <strong>Contact:</strong> +232 79 422 442 | admissions@kns.edu.sl</p>
                
                <hr>
                <p><strong>IP Address:</strong> ${escapeHtml(ipAddress)}</p>
                <p><strong>User Agent:</strong> ${escapeHtml(userAgent)}</p>
                <p><strong>Submitted At:</strong> ${escapeHtml(new Date().toISOString())}</p>
            `;
            
            const scholarshipRecipientEmail = process.env.BREVO_SCHOLARSHIP_EMAIL || 'knscollegesle@gmail.com';
            
            const sendSmtpEmail = new brevo.SendSmtpEmail();
            sendSmtpEmail.to = [{ email: scholarshipRecipientEmail }];
            sendSmtpEmail.sender = { email: brevoFromEmail, name: 'KNS College' };
            sendSmtpEmail.subject = subjectLine;
            sendSmtpEmail.textContent = textBody;
            sendSmtpEmail.htmlContent = htmlBody;
            
            console.log(`Attempting to send scholarship application email...`);
            console.log(`  From: ${brevoFromEmail}`);
            console.log(`  To: ${scholarshipRecipientEmail}`);
            console.log(`  Subject: ${subjectLine}`);
            
            apiInstance.sendTransacEmail(sendSmtpEmail)
                .then((response) => {
                    console.log('Scholarship application notification email sent via Brevo');
                    console.log(`  From: ${brevoFromEmail}`);
                    console.log(`  To: ${scholarshipRecipientEmail}`);
                    console.log(`  Brevo Status: ${response?.messageId || 'Success'}`);
                    console.log(`  Note: Brevo accepted the email, but delivery depends on recipient mail server.`);
                    console.log(`  If emails show issues in Brevo Activity, check recipient mail server connectivity.`);
                })
                .catch((emailError) => {
                    console.error('Error sending scholarship application email via Brevo');
                    console.error(`  Status Code: ${emailError.code || emailError.response?.statusCode || 'Unknown'}`);
                    console.error(`  From Email: ${brevoFromEmail}`);
                    console.error(`  To Email: ${scholarshipRecipientEmail}`);
                    
                    if (emailError.response) {
                        console.error(`  Response Body:`, JSON.stringify(emailError.response.body, null, 2));
                        if (emailError.response.body?.errors) {
                            emailError.response.body.errors.forEach((err, index) => {
                                console.error(`  Error ${index + 1}:`, err.message || err);
                            });
                        }
                    }
                    
                    // 403 = sender email not verified in Brevo
                    if (emailError.code === 403 || emailError.response?.statusCode === 403) {
                        console.error('\n  🔧 Troubleshooting 403 Forbidden Error:');
                        console.error('   1. Verify the sender email is verified in Brevo:');
                        console.error(`       - Go to Brevo Dashboard > SMTP & Email > Senders`);
                        console.error(`       - Verify that "${brevoFromEmail}" is verified`);
                        console.error('   2. Check API key permissions (needs "Transactional Email" permission)');
                        console.error('   3. For domain-based sending, ensure domain is authenticated\n');
                    } else if (emailError.code === 401 || emailError.response?.statusCode === 401) {
                        console.error('\n  🔧 Troubleshooting 401 Unauthorized Error:');
                        console.error('   1. Check that BREVO_API_KEY is correct');
                        console.error('   2. Verify the API key is active in Brevo Dashboard\n');
                    } else {
                        console.error(`  Full Error:`, emailError.message || emailError);
                    }
                    
                    // accepted but their mail server may still defer
                    console.error('\n  IMPORTANT: If Brevo accepts emails but they show issues in Activity:');
                    console.error('    This indicates the recipient mail server cannot be reached.');
                    console.error('    Common causes:');
                    console.error('    1. Mail server is down or unreachable');
                    console.error('    2. Port 25 is blocked by firewall');
                    console.error('    3. Mail server IP is blacklisted');
                    console.error('    4. DNS/MX records misconfigured');
                    console.error('    Solutions:');
                    console.error('    - Test with a working email (Gmail, Outlook) to verify SendGrid works');
                    console.error('    - Check MX records: nslookup -type=MX kns.edu.sl');
                    console.error('    - Verify mail server accepts connections on port 25');
                    console.error('    - Consider using email forwarding service\n');
                });
        }
        
        res.json({ 
            success: true, 
            applicationId: data.id,
            message: 'Scholarship application submitted successfully' 
        });
    } catch (error) {
        console.error('Error processing scholarship application:', error);
        res.status(500).json({ 
            error: 'Failed to process scholarship application',
            details: error.message || 'Unknown server error'
        });
    }
});

app.get('/api/scholarship-applications', requireAdminApiKey, async (req, res) => {
    const { scholarship_id, status } = req.query;

    try {
        const data = await db.listScholarshipApplications({ scholarship_id, status });
        res.json({ success: true, applications: data || [] });
    } catch (error) {
        console.error('Error fetching scholarship applications:', error);
        return res.status(500).json({ error: 'Failed to fetch scholarship applications' });
    }
});

app.get('/api/stats', requireAdminApiKey, async (req, res) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoISO = sevenDaysAgo.toISOString();

        const [
            totalMessages,
            totalContacts,
            totalEnrollments,
            totalPayments,
            recentMessages,
            recentContacts,
            recentEnrollments,
            recentPayments
        ] = await Promise.all([
            db.countRows('messages'),
            db.countRows('contacts'),
            db.countRows('enrollments'),
            db.countRows('payments'),
            db.countRows('messages', sevenDaysAgoISO),
            db.countRows('contacts', sevenDaysAgoISO),
            db.countRows('enrollments', sevenDaysAgoISO),
            db.countRows('payments', sevenDaysAgoISO)
        ]);

        const stats = {
            totalMessages,
            totalContacts,
            totalEnrollments,
            totalPayments,
            recentMessages,
            recentContacts,
            recentEnrollments,
            recentPayments
        };

        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

app.use('/api/*', (req, res) => {
    console.error(`[${new Date().toISOString()}] UNMATCHED API ROUTE: ${req.method} ${req.path}`);
    console.error(`  Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
    console.error(`  Origin: ${req.headers.origin || 'none'}`);
    res.status(404).json({ 
        error: 'API route not found',
        path: req.path,
        method: req.method
    });
});

app.use((err, req, res, next) => {
    if (err && err.message === 'Not allowed by CORS') {
        const origin = req.headers.origin || '';
        const payload = { error: 'Not allowed by CORS' };
        if (!IS_PRODUCTION && origin) {
            payload.origin = origin;
            payload.hint =
                'Open the site at http://localhost:3000 (npm run dev), or add this origin to CORS_ORIGIN in .env.local.';
        }
        return res.status(403).json(payload);
    }
    next(err);
});

app.post(
    ['/checkout-success.html', '/checkout-cancelled.html', '/payment-success.html', '/payment-cancelled.html', '/payment-failed.html'],
    (req, res) => {
        const loc = req.originalUrl && req.originalUrl.startsWith('/') ? req.originalUrl : req.url || '/';
        res.redirect(303, loc);
    }
);

app.use(express.static(__dirname));

app.use('/scholarships', express.static('scholarships', {
    setHeaders: (res, path) => {
        if (path.endsWith('.pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment');
        } else if (path.endsWith('.doc') || path.endsWith('.docx')) {
            res.setHeader('Content-Type', 'application/msword');
            res.setHeader('Content-Disposition', 'attachment');
        }
    }
}));

let server;

function startHttpServer() {
    const listenPort = process.env.PORT || PORT;
    const onListen = () => {
        const hostLabel = IS_IISNODE ? 'IIS/iisnode' : `http://0.0.0.0:${listenPort}`;
        console.log(`KNS API running (${hostLabel}, port ${listenPort})`);
        if (!IS_IISNODE) {
            console.log('Render free tier: ping /api/health every 10-14 min if cold starts are a problem');
        }
    };

    server = IS_IISNODE ? app.listen(listenPort, onListen) : app.listen(listenPort, '0.0.0.0', onListen);

    server.on('error', (err) => {
        console.error('Server error:', err);
        process.exit(1);
    });
}

initDatabase()
    .then(startHttpServer)
    .catch((err) => {
        console.error('Failed to initialize database:', err.message || err);
        if (IS_IISNODE) {
            console.warn('Starting HTTP server anyway so /api/health can report the failure.');
            startHttpServer();
        } else {
            process.exit(1);
        }
    });

module.exports = app;

const gracefulShutdown = (signal) => {
    console.log(`Shutting down (${signal})…`);
    
    if (server) {
        server.close(() => {
            console.log('HTTP server closed.');
            process.exit(0);
        });
        
        setTimeout(() => {
            console.error('Forced shutdown after timeout');
            process.exit(1);
        }, 10000);
    } else {
        process.exit(0);
    }
};

// POST handlers for payment return pages (Monime POSTs to these URLs)
app.post('/payment-success.html', express.urlencoded({ extended: false }), (req, res) => {
    const query = new URLSearchParams(req.body).toString();
    res.redirect(303, '/payment-success.html?' + query);
});

app.post('/payment-cancelled.html', express.urlencoded({ extended: false }), (req, res) => {
    const query = new URLSearchParams(req.body).toString();
    res.redirect(303, '/payment-cancelled.html?' + query);
});

app.post('/payment-failed.html', express.urlencoded({ extended: false }), (req, res) => {
    const query = new URLSearchParams(req.body).toString();
    res.redirect(303, '/payment-failed.html?' + query);
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});

