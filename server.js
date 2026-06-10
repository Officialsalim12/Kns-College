// main API server — express, supabase, sendgrid, monime checkout

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

if (fs.existsSync(path.join(__dirname, '.env.local'))) {
    require('dotenv').config({ path: '.env.local' });
} else if (fs.existsSync(path.join(__dirname, '.env'))) {
    require('dotenv').config({ path: '.env' });
} else {
    require('dotenv').config();
}

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_IISNODE = Boolean(process.env.IISNODE_VERSION);

if (IS_IISNODE) {
    app.set('trust proxy', 1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

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
    const list = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : defaults;
    const set = new Set();
    list.forEach((item) => {
        try {
            set.add(new URL(item).origin);
        } catch (e) {
            /* skip bad origins */
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
console.log(`  SUPABASE_URL: ${supabaseUrl ? 'set' : 'missing'}`);
console.log(`  SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'set' : 'missing'}`);
console.log(`  MONIME_ACCESS_TOKEN: ${MONIME_ACCESS_TOKEN ? 'set' : 'missing'}`);
console.log(`  MONIME_SPACE_ID: ${MONIME_SPACE_ID ? 'set' : 'missing'}`);
if (MONIME_ACCESS_TOKEN) {
    console.log(`  Monime token mode: ${MONIME_TOKEN_MODE}${MONIME_REQUIRE_LIVE_TOKEN ? ' (live token required)' : ''}`);
}
console.log(`  PORT: ${PORT}`);
console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables');
    console.error('For production deployment, set these in your hosting platform environment variables');
    console.error('For local development, create a .env.local file with your Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const sendgridApiKey = process.env.SENDGRID_API_KEY 
    ? process.env.SENDGRID_API_KEY.replace(/\r\n/g, '').replace(/\n/g, '').replace(/\r/g, '').trim() 
    : null;
const envFromEmail = process.env.SENDGRID_FROM_EMAIL;
const verifiedSenderEmail = 'scholarships@kns.edu.sl';
const sendgridFromEmail = (envFromEmail === verifiedSenderEmail) ? envFromEmail : verifiedSenderEmail;
const sendgridToEmail =
    process.env.SENDGRID_TO_EMAIL || sendgridFromEmail;

if (!sendgridApiKey) {
    console.warn(
        'Warning: SENDGRID_API_KEY is not set. Contact form emails will not be sent.'
    );
} else {
    if (!sendgridApiKey.startsWith('SG.')) {
        console.warn('SendGrid: API key should start with SG.');
    }

    const invalidChars = /[\r\n\t]/;
    if (invalidChars.test(sendgridApiKey)) {
        console.error('SendGrid: API key has stray newlines or tabs — fix it in Render env vars');
    } else {
        try {
            sgMail.setApiKey(sendgridApiKey);
            console.log('SendGrid:');
            console.log(`  from: ${sendgridFromEmail}`);
            if (envFromEmail && envFromEmail !== verifiedSenderEmail) {
                console.warn(`  SENDGRID_FROM_EMAIL was ${envFromEmail}; using ${verifiedSenderEmail}`);
            }
            console.log(`  default to: ${sendgridToEmail}`);
            console.log(`  scholarships: ${process.env.SENDGRID_SCHOLARSHIP_EMAIL || 'knscollegesle@gmail.com'}`);
            console.log(`  contact: ${process.env.SENDGRID_CONTACT_EMAIL || 'admissions@kns.edu.sl'}`);
            console.log(`  enquiry: ${process.env.SENDGRID_ENQUIRY_EMAIL || 'enquiry@kns.edu.sl'}\n`);
        } catch (error) {
            console.error('SendGrid: could not set API key —', error.message);
        }
    }
}

const DEBUG_CORS = process.env.DEBUG_CORS === 'true';

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) {
            if (DEBUG_CORS) console.log('CORS: no origin');
            return callback(null, true);
        }

        if (KNS_SITE_ORIGINS.includes(origin) || origin.includes('kns.edu.sl')) {
            if (DEBUG_CORS) console.log(`CORS: ${origin}`);
            return callback(null, true);
        }

        const allowedOrigins = process.env.CORS_ORIGIN
            ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
            : ['*'];

        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            if (DEBUG_CORS) console.log(`CORS: ${origin}`);
            callback(null, true);
        } else {
            console.log(`CORS: allowing ${origin}`);
            callback(null, true);
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
};
app.use(cors(corsOptions));

app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin && (KNS_SITE_ORIGINS.includes(origin) || origin.includes('kns.edu.sl'))) {
        res.header('Access-Control-Allow-Origin', origin);
        if (DEBUG_CORS) console.log(`CORS header: ${origin}`);
    } else if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
    } else {
        res.header('Access-Control-Allow-Origin', '*');
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        if (DEBUG_CORS) console.log(`CORS preflight: ${origin || 'none'}`);
        return res.sendStatus(200);
    }
    next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        console.log(`  Origin: ${req.headers.origin || 'none'}`);
        console.log(`  Referer: ${req.headers.referer || 'none'}`);
    }
    next();
});

async function initDatabase() {
    try {
        console.log('Testing Supabase connection...');
        // startup — ping supabase
        const { data, error } = await supabase.from('messages').select('id').limit(1);
        
        if (error) {
            // missing table is fine on first deploy
            if (error.code === 'PGRST116') {
                console.log('Supabase connection successful (messages table does not exist yet)');
            } else {
                console.error('Supabase connection error:', error);
                console.error('Error code:', error.code);
                console.error('Error message:', error.message);
                console.error('Error details:', error.details);
                throw error;
            }
        } else {
            console.log('Connected to Supabase database successfully');
            console.log(`  Supabase URL: ${supabaseUrl}`);
        }
        return Promise.resolve();
    } catch (err) {
        console.error('Database connection failed:', err.message);
        console.error('Full error:', err);
        return Promise.reject(err);
    }
}

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
        status: 'ok', 
        message: 'KNS College API is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        supabase_configured: !!(supabaseUrl && supabaseAnonKey),
        sendgrid_configured: !!sendgridApiKey,
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

app.post('/api/test-email', async (req, res) => {
    const { to } = req.body;
    const testRecipient = to || process.env.SENDGRID_SCHOLARSHIP_EMAIL || 'knscollegesle@gmail.com';
    
    if (!sendgridApiKey || !sendgridFromEmail) {
        return res.status(500).json({ 
            error: 'SendGrid not configured',
            message: 'SENDGRID_API_KEY and SENDGRID_FROM_EMAIL must be set'
        });
    }
    
    try {
        const testSubject = `Test Email from KNS College API - ${new Date().toISOString()}`;
        const testBody = `
This is a test email from the KNS College API server.

If you receive this, SendGrid is working.
From: ${sendgridFromEmail}

Server Details:
- Timestamp: ${new Date().toISOString()}
- Environment: ${process.env.NODE_ENV || 'development'}
- Server: ${req.protocol}://${req.get('host')}

You can safely delete this test email.
        `.trim();
        
        const msg = {
            to: testRecipient,
            from: sendgridFromEmail,
            subject: testSubject,
            text: testBody,
            html: `<p>${testBody.replace(/\n/g, '<br>')}</p>`
        };
        
        console.log('Sending test email…');
        console.log(`  From: ${sendgridFromEmail}`);
        console.log(`  To: ${testRecipient}`);
        
        const response = await sgMail.send(msg);
        
        console.log('Test email sent successfully');
        console.log(`  SendGrid Status: ${response[0]?.statusCode || 'Success'}`);
        
        res.json({ 
            success: true,
            message: 'Test email sent successfully',
            from: sendgridFromEmail,
            to: testRecipient,
            sendgrid_status: response[0]?.statusCode || 'Success',
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
            sendgrid_errors: error.response?.body?.errors || null
        });
    }
});

app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'API test endpoint is working',
        timestamp: new Date().toISOString(),
        origin: req.headers.origin || 'none',
        referer: req.headers.referer || 'none',
        host: req.headers.host || 'none',
        supabase_configured: !!(supabaseUrl && supabaseAnonKey)
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
    const { data, error } = await supabase
        .from('online_course_ratings')
        .select('stars')
        .eq('course_key', courseKey);
    if (error) throw error;
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
        const { data: catRows, error: catErr } = await supabase
            .from('online_course_categories')
            .select('slug, section_title, section_lead, sort_order')
            .order('sort_order', { ascending: true });
        if (catErr) {
            if (catErr.code === 'PGRST116' || catErr.code === '42P01') {
                return res.json({
                    success: true,
                    categories: [],
                    courses: [],
                    message: 'Catalog tables not found; create online_course_categories and online_courses in Supabase.'
                });
            }
            console.error('online-courses GET categories:', catErr);
            return res.status(500).json({ success: false, error: 'Failed to load course categories' });
        }

        const { data: courseRows, error: courseErr } = await supabase
            .from('online_courses')
            .select(
                'category_slug, course_key, display_title, enroll_course_name, price_label, structured_text, pace_text, amount_sle_minor, sort_order, is_active'
            )
            .eq('is_active', true)
            .order('sort_order', { ascending: true });
        if (courseErr) {
            if (courseErr.code === 'PGRST116' || courseErr.code === '42P01') {
                return res.json({
                    success: true,
                    categories: [],
                    courses: [],
                    message: 'Catalog tables not found; create online_course_categories and online_courses in Supabase.'
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
        const { data, error } = await supabase
            .from('online_course_ratings')
            .select('course_key, stars');
        if (error) {
            if (error.code === 'PGRST116' || error.code === '42P01') {
                return res.json({ success: true, ratings: [], message: 'Ratings table not found; create online_course_ratings in Supabase.' });
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
        const { error: insertError } = await supabase.from('online_course_ratings').insert([
            {
                course_key,
                stars,
                comment,
                rater_email,
                ip_address: ipAddress,
                user_agent: userAgent
            }
        ]);

        if (insertError) {
            console.error('online-course-ratings POST insert:', insertError);
            if (insertError.code === 'PGRST116' || insertError.code === '42P01') {
                return res.status(500).json({
                    success: false,
                    error: 'Ratings storage is not set up yet. Create the online_course_ratings table in Supabase.'
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
            /* next candidate */
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
        const { data: byEnroll, error: e1 } = await supabase
            .from('online_courses')
            .select('amount_sle_minor')
            .eq('is_active', true)
            .eq('enroll_course_name', cn)
            .maybeSingle();
        if (!e1 && byEnroll && byEnroll.amount_sle_minor != null) {
            const n = parseInt(byEnroll.amount_sle_minor, 10);
            if (Number.isInteger(n) && n >= 1 && n <= 100000000) return n;
        }
        const { data: byKey, error: e2 } = await supabase
            .from('online_courses')
            .select('amount_sle_minor')
            .eq('is_active', true)
            .eq('course_key', cn)
            .maybeSingle();
        if (!e2 && byKey && byKey.amount_sle_minor != null) {
            const n = parseInt(byKey.amount_sle_minor, 10);
            if (Number.isInteger(n) && n >= 1 && n <= 100000000) return n;
        }
    } catch (ignore) {
        /* online_courses not migrated yet */
    }
    return null;
}

app.post('/api/monime/checkout-session', async (req, res) => {
    try {
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
            currency
        } = req.body || {};

        if (!customerEmail || !fullName || !phone || !courseName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: customerEmail, fullName, phone, and courseName are required.'
            });
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

        const courseNm = String(courseName).trim();
        const catalogAmount = await lookupOnlineCourseAmountSleMinor(courseNm);
        const amount = catalogAmount != null ? catalogAmount : clientAmount;
        if (!Number.isInteger(amount) || amount < 1 || amount > 100000000) {
            return res.status(400).json({
                success: false,
                error: 'Invalid charge amount for this course. Check amount_sle_minor in Supabase (online_courses).'
            });
        }

        const idem =
            idempotencyKey && String(idempotencyKey).trim().length > 0
                ? String(idempotencyKey).trim().slice(0, 64)
                : crypto.randomUUID();

        const lineItemName = String(courseName).trim().slice(0, 100);
        const sessionTitle = `KNS Online — ${lineItemName}`.slice(0, 150);

        let returnOrigin = null;
        if (returnOriginBody) {
            try {
                const o = new URL(String(returnOriginBody).trim());
                if (isAllowedMonimeReturnUrl(o.origin + '/')) returnOrigin = o.origin;
            } catch (ignore) {
                /* bad returnOrigin */
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
                course: lineItemName,
                price: String(priceLabel || 'NLe 1000'),
                amountMinor: amount,
                source: 'checkout'
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
            lineItems: [
                {
                    type: 'custom',
                    name: lineItemName,
                    quantity: 1,
                    price: { currency: 'SLE', value: amount }
                }
            ],
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
                course: lineItemName.slice(0, 100)
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

app.get('/api/scholarships/diagnostics', async (req, res) => {
    try {
        const diagnostics = {
            timestamp: new Date().toISOString(),
            supabase_configured: !!(supabaseUrl && supabaseAnonKey),
            supabase_url_set: !!supabaseUrl,
            supabase_key_set: !!supabaseAnonKey,
            tests: {}
        };
        
        // diagnostics — table access
        try {
            const { data: testData, error: testError, count } = await supabase
                .from('scholarships')
                .select('*', { count: 'exact' })
                .limit(1);
            
            diagnostics.tests.table_access = {
                success: !testError,
                error: testError ? {
                    code: testError.code,
                    message: testError.message,
                    details: testError.details,
                    hint: testError.hint
                } : null,
                record_count: count || 0,
                sample_record: testData && testData.length > 0 ? testData[0] : null
            };
        } catch (err) {
            diagnostics.tests.table_access = {
                success: false,
                error: { message: err.message }
            };
        }
        
        // diagnostics — active scholarships
        try {
            const { data: activeData, error: activeError } = await supabase
                .from('scholarships')
                .select('id, title, is_active, deadline')
                .eq('is_active', true)
                .limit(10);
            
            diagnostics.tests.active_scholarships = {
                success: !activeError,
                error: activeError ? {
                    code: activeError.code,
                    message: activeError.message
                } : null,
                count: activeData ? activeData.length : 0,
                records: activeData || []
            };
        } catch (err) {
            diagnostics.tests.active_scholarships = {
                success: false,
                error: { message: err.message }
            };
        }
        
        // diagnostics — all scholarships
        try {
            const { data: allData, error: allError } = await supabase
                .from('scholarships')
                .select('id, title, is_active')
                .limit(10);
            
            diagnostics.tests.all_scholarships = {
                success: !allError,
                error: allError ? {
                    code: allError.code,
                    message: allError.message
                } : null,
                count: allData ? allData.length : 0,
                records: allData || []
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
            stack: error.stack
        });
    }
});

app.get('/api/scholarships/test', async (req, res) => {
    try {
        console.log('Testing scholarships connection...');
        
        // scholarships test — table query
        const { data: testData, error: testError, count } = await supabase
            .from('scholarships')
            .select('*', { count: 'exact' })
            .limit(1);
        
        const result = {
            timestamp: new Date().toISOString(),
            supabase_connected: !testError,
            table_exists: !testError || (testError && testError.code !== 'PGRST116' && testError.code !== '42P01'),
            total_records: count || 0,
            test_query_error: testError ? {
                code: testError.code,
                message: testError.message,
                details: testError.details,
                hint: testError.hint
            } : null,
            sample_record: testData && testData.length > 0 ? testData[0] : null
        };
        
        // scholarships test — active rows
        const { data: activeData, error: activeError } = await supabase
            .from('scholarships')
            .select('id, title, is_active')
            .eq('is_active', true)
            .limit(5);
        
        result.active_scholarships_count = activeData ? activeData.length : 0;
        result.active_scholarships = activeData || [];
        result.active_query_error = activeError ? {
            code: activeError.code,
            message: activeError.message
        } : null;
        
        res.json({ success: true, test: result });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message,
            stack: error.stack
        });
    }
});

app.post('/api/messages', async (req, res) => {
    const { sessionId, sender, message } = req.body;
    
    if (!sessionId || !sender || !message) {
        return res.status(400).json({ 
            error: 'Missing required fields: sessionId, sender, and message are required' 
        });
    }
    
    if (sender !== 'user' && sender !== 'bot') {
        return res.status(400).json({ 
            error: 'Invalid sender. Must be "user" or "bot"' 
        });
    }
    
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    
    const { data, error } = await supabase
        .from('messages')
        .insert([
            {
                session_id: sessionId,
                sender: sender,
                message: message,
                ip_address: ipAddress,
                user_agent: userAgent
            }
        ])
        .select()
        .single();
    
    if (error) {
        console.error('Error saving message:', error);
        return res.status(500).json({ error: 'Failed to save message' });
    }
    
    res.json({ 
        success: true, 
        messageId: data.id,
        message: 'Message saved successfully' 
    });
});

app.get('/api/messages/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });
    
    if (error) {
        console.error('Error fetching messages:', error);
        return res.status(500).json({ error: 'Failed to fetch messages' });
    }
    
    res.json({ success: true, messages: data || [] });
});

app.post('/api/contacts', async (req, res) => {
    const { name, email, phone, subject, message } = req.body;
    
    if (!name || !email || !subject || !message) {
        return res.status(400).json({ 
            error: 'Missing required fields: name, email, subject, and message are required' 
        });
    }
    
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    
    // contact form — save to DB
    const { data, error } = await supabase
        .from('contacts')
        .insert([
            {
                name: name,
                email: email,
                phone: phone || null,
                subject: subject,
                message: message,
                ip_address: ipAddress,
                user_agent: userAgent
            }
        ])
        .select()
        .single();
    
    if (error) {
        console.error('Error saving contact:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        return res.status(500).json({ 
            error: 'Failed to save contact submission',
            details: error.message || 'Unknown database error',
            code: error.code
        });
    }

    // contact form — sendgrid notification (fire and forget)
    if (!sendgridApiKey || !sendgridFromEmail || !sendgridToEmail) {
        console.warn(
            'Contact saved, but SendGrid is not fully configured. Skipping email send.'
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
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong><br>${message
                .split('\n')
                .map((line) => line.trim())
                .join('<br>')}</p>
            <hr>
            <p><strong>IP Address:</strong> ${ipAddress}</p>
            <p><strong>User Agent:</strong> ${userAgent}</p>
            <p><strong>Submitted At:</strong> ${new Date().toISOString()}</p>
        `;

        const contactRecipientEmail = process.env.SENDGRID_CONTACT_EMAIL || 'admissions@kns.edu.sl';
        
        const msg = {
            to: contactRecipientEmail,
            from: sendgridFromEmail,
            subject: subjectLine,
            text: textBody,
            html: htmlBody,
        };

        console.log(`Attempting to send contact form email...`);
        console.log(`  From: ${sendgridFromEmail}`);
        console.log(`  To: ${contactRecipientEmail}`);

        sgMail
            .send(msg)
            .then((response) => {
                console.log('Contact notification email sent via SendGrid');
                console.log(`  From: ${sendgridFromEmail}`);
                console.log(`  To: ${contactRecipientEmail}`);
                console.log(`  SendGrid Status: ${response[0]?.statusCode || 'Success'}`);
                console.log(`  Note: SendGrid accepted the email (202), but delivery depends on recipient mail server.`);
            })
            .catch((emailError) => {
                console.error('Error sending contact email via SendGrid');
                console.error(`  Status Code: ${emailError.code || emailError.response?.statusCode || 'Unknown'}`);
                console.error(`  From Email: ${sendgridFromEmail}`);
                
                if (emailError.response?.body?.errors) {
                    emailError.response.body.errors.forEach((err, index) => {
                        console.error(`  Error ${index + 1}:`, err.message || err);
                    });
                }
                
                if (emailError.code === 403 || emailError.response?.statusCode === 403) {
                    console.error(' Sender email may not be verified in SendGrid. Run: node setup-sender.js');
                } else {
                    console.error('\n  If SendGrid accepts emails (202) but they show "Deferred" in Activity:');
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

app.get('/api/contacts', async (req, res) => {
    const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('timestamp', { ascending: false });
    
    if (error) {
        console.error('Error fetching contacts:', error);
        return res.status(500).json({ error: 'Failed to fetch contacts' });
    }
    
    res.json({ success: true, contacts: data || [] });
});

app.post('/api/enquiries', async (req, res) => {
    const { name, email, phone, programme_interest, preferred_intake, message, newsletter } = req.body;
    
    if (!name || !email || !programme_interest) {
        return res.status(400).json({ 
            error: 'Missing required fields: name, email, and programme_interest are required' 
        });
    }
    
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    const newsletterValue = newsletter === true || newsletter === 'yes' || newsletter === 1 || newsletter === 'true';
    
    const { data, error } = await supabase
        .from('enquiries')
        .insert([
            {
                name: name,
                email: email,
                phone: phone || null,
                programme_interest: programme_interest,
                preferred_intake: preferred_intake || null,
                message: message || null,
                newsletter: newsletterValue,
                ip_address: ipAddress,
                user_agent: userAgent
            }
        ])
        .select()
        .single();
    
    if (error) {
        console.error('Error saving enquiry:', error);
        return res.status(500).json({ error: 'Failed to save enquiry submission' });
    }

    // enquiry form — sendgrid notification (fire and forget)
    if (!sendgridApiKey || !sendgridFromEmail || !sendgridToEmail) {
        console.warn(
            'Enquiry saved, but SendGrid is not fully configured. Skipping email send.'
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
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
            <p><strong>Programme of Interest:</strong> ${programme_interest}</p>
            <p><strong>Preferred Intake:</strong> ${preferred_intake || 'Not specified'}</p>
            <p><strong>Message:</strong><br>${(message || 'No additional message provided')
                .split('\n')
                .map((line) => line.trim())
                .join('<br>')}</p>
            <p><strong>Newsletter Opt-in:</strong> ${newsletterValue ? 'Yes' : 'No'}</p>
            <hr>
            <p><strong>IP Address:</strong> ${ipAddress}</p>
            <p><strong>User Agent:</strong> ${userAgent}</p>
            <p><strong>Submitted At:</strong> ${new Date().toISOString()}</p>
        `;

        const enquiryRecipientEmail = process.env.SENDGRID_ENQUIRY_EMAIL || 'enquiry@kns.edu.sl';
        
        const msg = {
            to: enquiryRecipientEmail,
            from: sendgridFromEmail,
            subject: subjectLine,
            text: textBody,
            html: htmlBody,
        };

        console.log(`Attempting to send enquiry form email...`);
        console.log(`  From: ${sendgridFromEmail}`);
        console.log(`  To: ${enquiryRecipientEmail}`);

        sgMail
            .send(msg)
            .then((response) => {
                console.log('Enquiry notification email sent via SendGrid');
                console.log(`  From: ${sendgridFromEmail}`);
                console.log(`  To: ${enquiryRecipientEmail}`);
                console.log(`  SendGrid Status: ${response[0]?.statusCode || 'Success'}`);
                console.log(`  Note: SendGrid accepted the email (202), but delivery depends on recipient mail server.`);
            })
            .catch((emailError) => {
                console.error('Error sending enquiry email via SendGrid');
                console.error(`  Status Code: ${emailError.code || emailError.response?.statusCode || 'Unknown'}`);
                console.error(`  From Email: ${sendgridFromEmail}`);
                
                if (emailError.response?.body?.errors) {
                    emailError.response.body.errors.forEach((err, index) => {
                        console.error(`  Error ${index + 1}:`, err.message || err);
                    });
                }
                
                if (emailError.code === 403 || emailError.response?.statusCode === 403) {
                    console.error(' Sender email may not be verified in SendGrid. Run: node setup-sender.js');
                } else {
                    console.error('\n  If SendGrid accepts emails (202) but they show "Deferred" in Activity:');
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

app.get('/api/enquiries', async (req, res) => {
    const { data, error } = await supabase
        .from('enquiries')
        .select('*')
        .order('timestamp', { ascending: false });
    
    if (error) {
        console.error('Error fetching enquiries:', error);
        return res.status(500).json({ error: 'Failed to fetch enquiries' });
    }
    
    res.json({ success: true, enquiries: data || [] });
});

app.post('/api/enrollments', async (req, res) => {
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
    
    const { data, error } = await supabase
        .from('enrollments')
        .insert([
            {
                course_name: courseName,
                first_name: firstName,
                last_name: lastName,
                email: email,
                phone: phone || null,
                payment_method: paymentMethod || null,
                mobile_number: mobileNumber || null,
                enrollment_fee: enrollmentFee || 'Le1,000',
                ip_address: ipAddress,
                user_agent: userAgent
            }
        ])
        .select()
        .single();
    
    if (error) {
        console.error('Error saving enrollment:', error);
        return res.status(500).json({ error: 'Failed to save enrollment submission' });
    }
    
    res.json({ 
        success: true, 
        enrollmentId: data.id,
        message: 'Enrollment submission saved successfully' 
    });
});

app.get('/api/enrollments', async (req, res) => {
    const { data, error } = await supabase
        .from('enrollments')
        .select('*')
        .order('timestamp', { ascending: false });
    
    if (error) {
        console.error('Error fetching enrollments:', error);
        return res.status(500).json({ error: 'Failed to fetch enrollments' });
    }
    
    res.json({ success: true, enrollments: data || [] });
});

app.post('/api/payments', async (req, res) => {
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
        applicationFee,
        paymentReference,
        paymentStatus
    } = req.body;
    
    if (!courseName || !fullName || !email || !phone || !address || !city || !deliveryMode || !intakePeriod) {
        return res.status(400).json({ 
            error: 'Missing required fields: courseName, fullName, email, phone, address, city, deliveryMode, and intakePeriod are required' 
        });
    }
    
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    
    const { data, error } = await supabase
        .from('payments')
        .insert([
            {
                course_name: courseName,
                full_name: fullName,
                email: email,
                phone: phone,
                address: address,
                city: city,
                country: country || 'Sierra Leone',
                date_of_birth: dateOfBirth || null,
                gender: gender || null,
                emergency_contact: emergencyContact || null,
                emergency_phone: emergencyPhone || null,
                delivery_mode: deliveryMode,
                intake_period: intakePeriod,
                application_fee: applicationFee || 250,
                payment_status: paymentStatus || 'pending',
                payment_reference: paymentReference || null,
                payment_provider: 'monime',
                ip_address: ipAddress,
                user_agent: userAgent
            }
        ])
        .select()
        .single();
    
    if (error) {
        console.error('Error saving payment:', error);
        return res.status(500).json({ error: 'Failed to save payment submission' });
    }

    if (paymentReference) {
        saveCheckoutReturn(paymentReference, {
            course: courseName,
            cost: applicationFee != null ? String(applicationFee) : '250',
            source: 'application',
            reference: paymentReference
        });
    }
    
    res.json({ 
        success: true, 
        paymentId: data.id,
        message: 'Payment submission saved successfully' 
    });
});

app.patch('/api/payments/:paymentId', async (req, res) => {
    const { paymentId } = req.params;
    const { paymentStatus, paymentReference } = req.body;
    
    if (!paymentStatus) {
        return res.status(400).json({ 
            error: 'Missing required field: paymentStatus is required' 
        });
    }
    
    const updateData = {
        payment_status: paymentStatus
    };
    
    if (paymentReference) {
        updateData.payment_reference = paymentReference;
    }
    
    const { data, error } = await supabase
        .from('payments')
        .update(updateData)
        .eq('id', paymentId)
        .select()
        .single();
    
    if (error) {
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

app.get('/api/payments', async (req, res) => {
    const { status, course, reference } = req.query;
    
    let query = supabase
        .from('payments')
        .select('*');
    
    if (status) {
        query = query.eq('payment_status', status);
    }
    
    if (course) {
        query = query.eq('course_name', course);
    }
    
    if (reference) {
        query = query.eq('payment_reference', reference);
    }
    
    query = query.order('timestamp', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error fetching payments:', error);
        return res.status(500).json({ error: 'Failed to fetch payments' });
    }
    
    res.json({ success: true, payments: data || [] });
});

app.get('/api/scholarships', async (req, res) => {
    try {
        // scholarships list — active only
        let query = supabase
            .from('scholarships')
            .select('*')
            .eq('is_active', true)
            .order('deadline', { ascending: true });
        
        const { data, error } = await query;
        
        if (error) {
            console.error('Error fetching scholarships:', error.code, error.message);
            
            // map common supabase errors
            if (error.code === 'PGRST116' || error.code === '42P01') {
                return res.status(500).json({ 
                    error: 'Scholarships table not found',
                    details: 'The scholarships table does not exist in the database. Please create it in Supabase.'
                });
            }
            
            if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
                return res.status(500).json({ 
                    error: 'Permission denied',
                    details: 'Row Level Security (RLS) policies are blocking access to scholarships. Please create a public SELECT policy in Supabase.'
                });
            }
            
            return res.status(500).json({ 
                error: 'Failed to fetch scholarships',
                details: error.message || 'Unknown database error',
                code: error.code
            });
        }
        
        // empty list — still 200 with a hint
        if (!data || data.length === 0) {
            return res.json({ 
                success: true, 
                scholarships: [],
                message: 'No active scholarships found. Check Supabase to ensure scholarships exist and have is_active = true.'
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
        const { data, error } = await supabase
            .from('scholarships')
            .select('*')
            .eq('id', id)
            .eq('is_active', true)
            .single();
        
        if (error) {
            console.error('Error fetching scholarship:', error);
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Scholarship not found' });
            }
            return res.status(500).json({ error: 'Failed to fetch scholarship' });
        }
        
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
    
    // guide or form only
    if (type !== 'guide' && type !== 'form') {
        return res.status(400).json({ error: 'Invalid download type. Use "guide" or "form".' });
    }
    
    try {
        const { data, error } = await supabase
            .from('scholarships')
            .select('*')
            .eq('id', id)
            .eq('is_active', true)
            .single();
        
        if (error || !data) {
            console.error(`Download error: Scholarship ${id} not found`);
            return res.status(404).json({ error: 'Scholarship not found', details: error?.message });
        }
        
        const filePath = type === 'guide' ? data.guide_path : data.form_path;
        
        if (!filePath || filePath === '#' || filePath.trim() === '') {
            return res.status(404).json({ 
                error: `${type === 'guide' ? 'Guide' : 'Form'} file not available for this scholarship.`,
                message: 'The file path is not set in the database.'
            });
        }
        
        const trimmedPath = filePath.trim();
        
        // external file URL — proxy so the browser doesn't hit CORS
        if (trimmedPath.startsWith('http://') || trimmedPath.startsWith('https://')) {
            try {
                const https = require('https');
                const http = require('http');
                const url = require('url');
                
                const fileUrl = new URL(trimmedPath);
                const protocol = fileUrl.protocol === 'https:' ? https : http;
                
                protocol.get(trimmedPath, (fileResponse) => {
                    if (fileResponse.statusCode !== 200) {
                        return res.status(fileResponse.statusCode).json({ 
                            error: 'Failed to fetch file from external source',
                            statusCode: fileResponse.statusCode
                        });
                    }
                    
                    // content-type from response or extension
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
                // proxy failed — redirect instead
                return res.redirect(trimmedPath);
            }
            return;
        }
        
        // local file — scholarships folder
        const path = require('path');
        const fs = require('fs');
        
        // normalize path under scholarships/
        let cleanPath = trimmedPath.replace(/^\/+/, '').replace(/^scholarships\//, '');
        const fullPath = path.join(__dirname, 'scholarships', cleanPath);
        
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ 
                error: 'File not found',
                path: fullPath,
                message: 'The requested file does not exist on the server.',
                suggestion: 'Please ensure the file exists in the scholarships directory or update the file path in the database.'
            });
        }
        
        // pick MIME from extension
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

app.get('/api/scholarships/:id/files/check', async (req, res) => {
    const { id } = req.params;
    
    try {
        const { data, error } = await supabase
            .from('scholarships')
            .select('*')
            .eq('id', id)
            .eq('is_active', true)
            .single();
        
        if (error || !data) {
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
        
        // guide file on disk
        if (data.guide_path && data.guide_path.trim() && !data.guide_path.startsWith('http')) {
            const cleanPath = data.guide_path.replace(/^\/+/, '').replace(/^scholarships\//, '');
            const fullPath = path.join(__dirname, 'scholarships', cleanPath);
            results.guide_full_path = fullPath;
            results.guide_exists = fs.existsSync(fullPath);
        } else if (data.guide_path && (data.guide_path.startsWith('http://') || data.guide_path.startsWith('https://'))) {
            results.guide_exists = 'external_url';
        }
        
        // form file on disk
        if (data.form_path && data.form_path.trim() && !data.form_path.startsWith('http')) {
            const cleanPath = data.form_path.replace(/^\/+/, '').replace(/^scholarships\//, '');
            const fullPath = path.join(__dirname, 'scholarships', cleanPath);
            results.form_full_path = fullPath;
            results.form_exists = fs.existsSync(fullPath);
        } else if (data.form_path && (data.form_path.startsWith('http://') || data.form_path.startsWith('https://'))) {
            results.form_exists = 'external_url';
        }
        
        res.json({ success: true, ...results });
    } catch (error) {
        console.error('Error checking files:', error);
        res.status(500).json({ error: 'Failed to check files', details: error.message });
    }
});

app.post('/api/scholarship-applications', async (req, res) => {
    try {
        // scholarship application — parse body
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
        
        // required fields + national_id
        if (!surname || !first_name || !gender || !date_of_birth || !nationality || 
            !national_id || national_id.trim() === '' ||
            !address || !city || !phone || !email || !highest_qualification || !school_institution ||
            !year_of_completion || !programme || !scholarship_type || !previous_application ||
            !personal_statement || declaration !== 'on') {
            return res.status(400).json({ 
                error: 'Missing required fields. Please ensure all required fields are completed, including National ID Number.' 
            });
        }
        
        // personal statement — min 300 words
        const statementWords = personal_statement.trim().split(/\s+/).filter(word => word.length > 0);
        if (statementWords.length < 300) {
            return res.status(400).json({ 
                error: `Personal statement must be at least 300 words. Currently: ${statementWords.length} words.` 
            });
        }
        
        const ipAddress = getClientIp(req);
        const userAgent = getUserAgent(req);
        
        // save application
        const { data, error } = await supabase
            .from('scholarship_applications')
            .insert([
                {
                    scholarship_id: scholarship_id || null,
                    surname: surname,
                    first_name: first_name,
                    other_names: other_names || null,
                    gender: gender,
                    date_of_birth: date_of_birth,
                    nationality: nationality,
                    national_id: national_id.trim(),
                    address: address,
                    city: city,
                    phone: phone,
                    email: email,
                    highest_qualification: highest_qualification,
                    school_institution: school_institution,
                    year_of_completion: parseInt(year_of_completion),
                    credits: credits || null,
                    programme: programme,
                    scholarship_type: scholarship_type,
                    previous_application: previous_application,
                    previous_application_details: previous_application === 'Yes' ? previous_application_details : null,
                    personal_statement: personal_statement,
                    documents_submitted_in_person: true,
                    ip_address: ipAddress,
                    user_agent: userAgent
                }
            ])
            .select()
            .single();
        
        if (error) {
            console.error('Error saving scholarship application:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('Error details:', error.details);
            console.error('Error hint:', error.hint);
            return res.status(500).json({ 
                error: 'Failed to save scholarship application',
                details: error.message || 'Unknown database error',
                code: error.code,
                hint: error.hint || null,
                fullError: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
        
        // sendgrid notification (fire and forget)
        if (sendgridApiKey && sendgridFromEmail && sendgridToEmail) {
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
                <p><strong>Name:</strong> ${surname}, ${first_name} ${other_names || ''}</p>
                <p><strong>Gender:</strong> ${gender}</p>
                <p><strong>Date of Birth:</strong> ${date_of_birth}</p>
                <p><strong>Nationality:</strong> ${nationality}</p>
                <p><strong>National ID:</strong> ${national_id}</p>
                
                <h3>Contact Information</h3>
                <p><strong>Address:</strong> ${address}</p>
                <p><strong>City:</strong> ${city}</p>
                <p><strong>Phone:</strong> ${phone}</p>
                <p><strong>Email:</strong> ${email}</p>
                
                <h3>Academic Background</h3>
                <p><strong>Highest Qualification:</strong> ${highest_qualification}</p>
                <p><strong>School/Institution:</strong> ${school_institution}</p>
                <p><strong>Year of Completion:</strong> ${year_of_completion}</p>
                <p><strong>Credits:</strong> ${credits || 'N/A'}</p>
                
                <h3>Programme & Scholarship</h3>
                <p><strong>Programme:</strong> ${programme}</p>
                <p><strong>Scholarship Type:</strong> ${scholarship_type}</p>
                <p><strong>Previous Application:</strong> ${previous_application}</p>
                ${previous_application === 'Yes' && previous_application_details ? `<p><strong>Previous Application Details:</strong> ${previous_application_details}</p>` : ''}
                
                <h3>Personal Statement</h3>
                <p>${personal_statement.split('\n').map(line => line.trim()).join('<br>')}</p>
                
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
                <p><strong>IP Address:</strong> ${ipAddress}</p>
                <p><strong>User Agent:</strong> ${userAgent}</p>
                <p><strong>Submitted At:</strong> ${new Date().toISOString()}</p>
            `;
            
            const scholarshipRecipientEmail = process.env.SENDGRID_SCHOLARSHIP_EMAIL || 'knscollegesle@gmail.com';
            
            const msg = {
                to: scholarshipRecipientEmail,
                from: sendgridFromEmail,
                subject: subjectLine,
                text: textBody,
                html: htmlBody,
            };
            
            console.log(`Attempting to send scholarship application email...`);
            console.log(`  From: ${sendgridFromEmail}`);
            console.log(`  To: ${scholarshipRecipientEmail}`);
            console.log(`  Subject: ${subjectLine}`);
            
            sgMail
                .send(msg)
                .then((response) => {
                    console.log('Scholarship application notification email sent via SendGrid');
                    console.log(`  From: ${sendgridFromEmail}`);
                    console.log(`  To: ${scholarshipRecipientEmail}`);
                    console.log(`  SendGrid Status: ${response[0]?.statusCode || 'Success'}`);
                    if (response[0]?.headers?.['x-message-id']) {
                        console.log(`  Message ID: ${response[0].headers['x-message-id']}`);
                    }
                    console.log(`  Note: SendGrid accepted the email (202), but delivery depends on recipient mail server.`);
                    console.log(`  If emails show "Deferred" in SendGrid Activity, check recipient mail server connectivity.`);
                })
                .catch((emailError) => {
                    console.error('Error sending scholarship application email via SendGrid');
                    console.error(`  Status Code: ${emailError.code || emailError.response?.statusCode || 'Unknown'}`);
                    console.error(`  From Email: ${sendgridFromEmail}`);
                    console.error(`  To Email: ${scholarshipRecipientEmail}`);
                    
                    if (emailError.response) {
                        console.error(`  Response Body:`, JSON.stringify(emailError.response.body, null, 2));
                        if (emailError.response.body?.errors) {
                            emailError.response.body.errors.forEach((err, index) => {
                                console.error(`  Error ${index + 1}:`, err.message || err);
                            });
                        }
                    }
                    
                    // sendgrid 403 — sender not verified
                    if (emailError.code === 403 || emailError.response?.statusCode === 403) {
                        console.error('\n  🔧 Troubleshooting 403 Forbidden Error:');
                        console.error('   1. Verify the sender email is verified in SendGrid:');
                        console.error(`       - Go to SendGrid Dashboard > Settings > Sender Authentication`);
                        console.error(`       - Verify that "${sendgridFromEmail}" is verified`);
                        console.error(`    2. Run the setup script to verify sender: node setup-sender.js`);
                        console.error('   3. Check API key permissions (needs "Mail Send" permission)');
                        console.error('   4. For domain-based sending, ensure domain is authenticated\n');
                    } else if (emailError.code === 401 || emailError.response?.statusCode === 401) {
                        console.error('\n  🔧 Troubleshooting 401 Unauthorized Error:');
                        console.error('   1. Check that SENDGRID_API_KEY is correct');
                        console.error('   2. Verify the API key is active in SendGrid Dashboard\n');
                    } else {
                        console.error(`  Full Error:`, emailError.message || emailError);
                    }
                    
                    // deferred delivery — recipient mail server issue
                    console.error('\n  IMPORTANT: If SendGrid accepts emails (202 status) but they show "Deferred" in Activity:');
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

app.get('/api/scholarship-applications', async (req, res) => {
    const { scholarship_id, status } = req.query;
    
    let query = supabase
        .from('scholarship_applications')
        .select('*');
    
    if (scholarship_id) {
        query = query.eq('scholarship_id', scholarship_id);
    }
    
    if (status) {
        query = query.eq('status', status);
    }
    
    query = query.order('timestamp', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error fetching scholarship applications:', error);
        return res.status(500).json({ error: 'Failed to fetch scholarship applications' });
    }
    
    res.json({ success: true, applications: data || [] });
});

app.get('/api/stats', async (req, res) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoISO = sevenDaysAgo.toISOString();
        
        // totals across tables
        const [totalMessagesResult, totalContactsResult, totalEnrollmentsResult, totalPaymentsResult] = await Promise.all([
            supabase.from('messages').select('id', { count: 'exact', head: true }),
            supabase.from('contacts').select('id', { count: 'exact', head: true }),
            supabase.from('enrollments').select('id', { count: 'exact', head: true }),
            supabase.from('payments').select('id', { count: 'exact', head: true })
        ]);
        
        // last 7 days
        const [recentMessagesResult, recentContactsResult, recentEnrollmentsResult, recentPaymentsResult] = await Promise.all([
            supabase.from('messages').select('id', { count: 'exact', head: true }).gte('timestamp', sevenDaysAgoISO),
            supabase.from('contacts').select('id', { count: 'exact', head: true }).gte('timestamp', sevenDaysAgoISO),
            supabase.from('enrollments').select('id', { count: 'exact', head: true }).gte('timestamp', sevenDaysAgoISO),
            supabase.from('payments').select('id', { count: 'exact', head: true }).gte('timestamp', sevenDaysAgoISO)
        ]);
        
        const stats = {
            totalMessages: totalMessagesResult.count || 0,
            totalContacts: totalContactsResult.count || 0,
            totalEnrollments: totalEnrollmentsResult.count || 0,
            totalPayments: totalPaymentsResult.count || 0,
            recentMessages: recentMessagesResult.count || 0,
            recentContacts: recentContactsResult.count || 0,
            recentEnrollments: recentEnrollmentsResult.count || 0,
            recentPayments: recentPaymentsResult.count || 0
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
        hint: 'Restart local Node (npm start) or redeploy Render so server.js matches this repo. Request path must match exactly (e.g. GET /api/online-course-ratings).',
        path: req.path,
        method: req.method,
        originalUrl: req.originalUrl,
        availableRoutes: [
            'GET /api/health',
            'GET /api/test',
            'GET /api/scholarships',
            'GET /api/scholarships/:id',
            'GET /api/scholarships/:id/download/:type',
            'GET /api/scholarships/test',
            'GET /api/scholarships/diagnostics',
            'POST /api/messages',
            'GET /api/messages/:sessionId',
            'POST /api/contacts',
            'GET /api/contacts',
            'POST /api/enquiries',
            'GET /api/enquiries',
            'POST /api/enrollments',
            'GET /api/enrollments',
            'POST /api/payments',
            'PATCH /api/payments/:paymentId',
            'GET /api/payments',
            'POST /api/scholarship-applications',
            'GET /api/scholarship-applications',
            'GET /api/stats',
            'GET /api/online-courses',
            'GET /api/online-course-ratings',
            'POST /api/online-course-ratings',
            'POST /api/monime/checkout-session',
            'GET /api/monime/checkout-return-context'
        ]
    });
});

app.post(
    ['/checkout-success.html', '/checkout-cancelled.html', '/payment-success.html', '/payment-cancelled.html'],
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

initDatabase()
    .then(() => {
        const onListen = () => {
            const hostLabel = IS_IISNODE ? 'IIS/iisnode' : `http://0.0.0.0:${PORT}`;
            console.log(`KNS API running (${hostLabel}, port ${PORT})`);
            if (!IS_IISNODE) {
                console.log('Render free tier: ping /api/health every 10-14 min if cold starts are a problem');
            }
        };

        server = IS_IISNODE ? app.listen(PORT, onListen) : app.listen(PORT, '0.0.0.0', onListen);

        server.on('error', (err) => {
            console.error('Server error:', err);
            process.exit(1);
        });
    })
    .catch((err) => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    });

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

