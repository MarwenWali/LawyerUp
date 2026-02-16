require('dotenv').config();
const pool = require('../db/pool');

async function run() {
    try {
        // List of all tables from the migration
        const tables = [
            'admins',
            'citizens',
            'lawyers',
            'consultations',
            'ai_sessions',
            'ai_messages',
            'lawyer_documents',
            'audit_logs',
            'notifications',
            'platform_statistics'
        ];

        console.log('Checking table existence and row counts:');
        for (const t of tables) {
            try {
                const r = await pool.query(`SELECT COUNT(*) AS cnt FROM ${t}`);
                console.log(`${t}: ${r.rows[0].cnt} rows`);
            } catch (tableErr) {
                console.error(`Error checking table ${t}: ${tableErr.message}`);
            }
        }

        // Sample data checks
        const sampleLawyers = await pool.query("SELECT id, name, email, status FROM lawyers ORDER BY created_at DESC LIMIT 5");
        console.log('\nRecent lawyers:');
        console.table(sampleLawyers.rows);

        const sampleCitizens = await pool.query("SELECT id, name, email FROM citizens ORDER BY created_at DESC LIMIT 3");
        console.log('\nRecent citizens:');
        console.table(sampleCitizens.rows);

        // Check foreign key integrity (basic test: ensure referenced records exist)
        console.log('\nChecking foreign key integrity...');
        const consultationsWithInvalidCitizen = await pool.query(`
            SELECT c.id FROM consultations c
            LEFT JOIN citizens ci ON c.citizen_id = ci.id
            WHERE ci.id IS NULL
        `);
        if (consultationsWithInvalidCitizen.rows.length > 0) {
            console.error('Foreign key violation: consultations with invalid citizen_id');
        } else {
            console.log('Consultations FK to citizens: OK');
        }

        const consultationsWithInvalidLawyer = await pool.query(`
            SELECT c.id FROM consultations c
            LEFT JOIN lawyers l ON c.lawyer_id = l.id
            WHERE l.id IS NULL
        `);
        if (consultationsWithInvalidLawyer.rows.length > 0) {
            console.error('Foreign key violation: consultations with invalid lawyer_id');
        } else {
            console.log('Consultations FK to lawyers: OK');
        }

        console.log('\nDatabase check completed successfully.');
    } catch (err) {
        console.error('DB check failed:', err.message || err);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

run();
