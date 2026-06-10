// sendgrid sender verification — run: node setup-sender.js

const fs = require('fs');
const path = require('path');

if (fs.existsSync(path.join(__dirname, '.env.local'))) {
    require('dotenv').config({ path: '.env.local' });
} else if (fs.existsSync(path.join(__dirname, '.env'))) {
    require('dotenv').config({ path: '.env' });
} else {
    require('dotenv').config();
}

const https = require('https');

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

if (!SENDGRID_API_KEY) {
    console.error('SENDGRID_API_KEY not set — add it to .env.local');
    process.exit(1);
}

const senderEmail = process.env.SENDGRID_FROM_EMAIL || 'scholarships@kns.edu.sl';

const senderConfig = {
    nickname: 'KNS College',
    from_email: senderEmail,
    from_name: 'KNS College',
    reply_to: senderEmail,
    reply_to_name: 'KNS College',
    address: '18 Dundas Street',
    address2: '',
    city: 'Freetown',
    zip: '',
    country: 'Sierra Leone'
};

function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.sendgrid.com',
            port: 443,
            path: path,
            method: method,
            headers: {
                'Authorization': `Bearer ${SENDGRID_API_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            
            res.on('data', (chunk) => {
                body += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : {};
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ statusCode: res.statusCode, data: parsed });
                    } else {
                        reject({ statusCode: res.statusCode, error: parsed });
                    }
                } catch (e) {
                    reject({ statusCode: res.statusCode, error: { message: body } });
                }
            });
        });
        
        req.on('error', (error) => {
            reject({ error: error.message });
        });
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

async function createSender() {
    console.log('\nSendGrid sender setup\n');
    console.log('Configuration:');
    console.log(`  Email: ${senderConfig.from_email}`);
    console.log(`  Name: ${senderConfig.from_name}`);
    console.log(`  Address: ${senderConfig.address}, ${senderConfig.city}, ${senderConfig.country}\n`);
    
    try {
        console.log('Creating sender...');
        console.log('Payload:', JSON.stringify(senderConfig, null, 2));
        const response = await makeRequest('POST', '/v3/verified_senders', senderConfig);
        
        console.log('Sender created.\n');
        console.log('Next:');
        console.log('1. Check your email inbox: ' + senderConfig.from_email);
        console.log('2. Look for an email from SendGrid with subject "Verify your sender identity"');
        console.log('3. Click the verification link in the email');
        console.log('4. Once verified, you can use this email to send scholarship application notifications\n');
        
        return response.data;
    } catch (error) {
        if (error.statusCode === 400) {
            const errorMsg = error.error?.errors?.[0]?.message || error.error?.message || 'Unknown error';
            const fullError = error.error?.errors || error.error;
            
            console.error('Error creating sender:', errorMsg);
            if (fullError && Array.isArray(fullError)) {
                fullError.forEach((err, idx) => {
                    console.error(`   Error ${idx + 1}:`, err.message || err);
                    if (err.field) console.error(`   Field: ${err.field}`);
                });
            }
            
            if (errorMsg.includes('already exists') || errorMsg.includes('already verified')) {
                console.log('\nSender already exists. Checking status...\n');
                await checkSenderStatus();
            } else {
                console.log('\nCommon issues:');
                console.log('  - Email address format is invalid');
                console.log('  - Sender already exists (try checking status instead)');
                console.log('  - API key doesn\'t have required permissions');
                console.log('  - Required fields may be missing\n');
            }
        } else if (error.statusCode === 401) {
            console.error('Authentication failed!');
            console.log('   Please check that your SENDGRID_API_KEY is correct.\n');
        } else if (error.statusCode === 403) {
            console.error('Permission denied!');
            console.log('   Your API key doesn\'t have permission to create senders.');
            console.log('   Please use a Full Access API key or one with Sender Management permissions.\n');
        } else {
            console.error('Error:', error.error || error);
            console.error('  Status Code:', error.statusCode);
        }
        throw error;
    }
}

async function checkSenderStatus() {
    try {
        console.log('Fetching sender status...\n');
        const response = await makeRequest('GET', '/v3/verified_senders');
        
        const results = response.data?.results || response.data || [];
        
        if (results && results.length > 0) {
            console.log('Existing senders:\n');
            results.forEach((sender, index) => {
                const email = sender.from?.email || sender.email || 
                            (typeof sender.from === 'string' ? sender.from : null) || 
                            sender.verified_sender?.email || 'Unknown';
                const status = sender.verified ? 'verified' : 'pending';
                const name = sender.from?.name || sender.nickname || '';
                console.log(`${index + 1}. ${email}${name ? ` (${name})` : ''} - ${status}`);
                
                if (email === senderConfig.from_email || email.toLowerCase() === senderConfig.from_email.toLowerCase()) {
                    if (sender.verified) {
                        console.log('\nThis sender is verified.\n');
                        return;
                    } else {
                        console.log('\nThis sender is still pending verification.');
                        console.log('   Please check your email and click the verification link.\n');
                        return;
                    }
                }
            });
            
            const ourSender = results.find(s => {
                const email = s.from?.email || s.email || 
                            (typeof s.from === 'string' ? s.from : null) || 
                            s.verified_sender?.email || '';
                return email.toLowerCase() === senderConfig.from_email.toLowerCase();
            });
            
            if (!ourSender) {
                console.log(`\nConfigured sender "${senderConfig.from_email}" not found in SendGrid.`);
                console.log('   Creating new sender...\n');
                await createSender();
            }
        } else {
            console.log('No senders found. Creating new sender...\n');
            await createSender();
        }
    } catch (error) {
        console.error('Error checking sender status:', error.error || error);
        if (error.statusCode === 401) {
            console.error('\n Authentication failed. Please check your SENDGRID_API_KEY.');
        } else if (error.statusCode === 403) {
            console.error('\n Permission denied. Your API key may not have permission to view senders.');
        }
    }
}

async function listVerifiedSenders() {
    try {
        const response = await makeRequest('GET', '/v3/verified_senders');
        
        if (response.data && response.data.results) {
            const verified = response.data.results.filter(s => s.verified);
            const pending = response.data.results.filter(s => !s.verified);
            
            if (verified.length > 0) {
                console.log('\nVerified senders:\n');
                verified.forEach((sender, index) => {
                    const email = sender.from?.email || sender.email || sender.from || 'Unknown';
                    const name = sender.from?.name || sender.nickname || 'No name';
                    console.log(`  ${index + 1}. ${email} (${name})`);
                });
            }
            
            if (pending.length > 0) {
                console.log('\nPending verification:\n');
                pending.forEach((sender, index) => {
                    const email = sender.from?.email || sender.email || sender.from || 'Unknown';
                    console.log(`  ${index + 1}. ${email} - Check email for verification link`);
                });
            }
            
            if (verified.length === 0 && pending.length === 0) {
                console.log('\nNo senders found. Creating new sender...\n');
                await createSender();
            }
        }
    } catch (error) {
        console.error('Error listing senders:', error.error || error);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    console.log('SendGrid sender setup\n');
    console.log('API key: ' + SENDGRID_API_KEY.substring(0, 10) + '…\n');

    try {
        if (command === 'list' || command === 'status') {
            await checkSenderStatus();
        } else if (command === 'verified') {
            await listVerifiedSenders();
        } else {
            await checkSenderStatus();
        }
    } catch (error) {
        console.error('Setup failed — see errors above.\n');
        process.exit(1);
    }
}

main();
