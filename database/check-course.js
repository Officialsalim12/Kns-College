(function loadEnv() {
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '..');
    for (const name of ['.env.local', '.env', '.env.production']) {
        const full = path.join(root, name);
        if (fs.existsSync(full)) {
            require('dotenv').config({ path: full });
            break;
        }
    }
})();

const { query, isDbConfigured, closePool } = require('./pg');

async function main() {
    if (!isDbConfigured()) {
        console.error('DATABASE_URL is not set.');
        process.exit(1);
    }
    
    console.log('Checking for Digital Skills Training course...');
    const result = await query("SELECT * FROM online_courses WHERE course_key = 'digital-skills-training'");
    console.log('Course found:', result.rows.length > 0);
    if (result.rows.length > 0) {
        console.log('Course details:', result.rows[0]);
    }
    
    console.log('\nAll training courses:');
    const allTrainings = await query("SELECT * FROM online_courses WHERE category_slug = 'trainings'");
    console.log('Training courses count:', allTrainings.rows.length);
    allTrainings.rows.forEach(row => {
        console.log(`- ${row.course_key}: ${row.display_title} (amount: ${row.amount_sle_minor})`);
    });
    
    await closePool();
}

main().catch(async (err) => {
    console.error('Check failed:', err.message);
    await closePool();
    process.exit(1);
});
