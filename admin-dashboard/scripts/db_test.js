require('dotenv').config();
const pool = require('../db/pool');

async function testCRUD() {
    console.log('Testing CRUD operations...');
    try {
        await pool.query('BEGIN');

        // Create (Insert)
        const newCitizen = await pool.query(
            `INSERT INTO citizens (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id`,
            ['Test User', 'testuser@example.com', 'hashed_pass']
        );
        console.log('Inserted citizen:', newCitizen.rows[0]);

        const newLawyer = await pool.query(
            `INSERT INTO lawyers (name, email, password_hash, specialization, status) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            ['Test Lawyer', 'testlawyer@example.com', 'hashed_pass', ['Test Law'], 'approved']
        );
        console.log('Inserted lawyer:', newLawyer.rows[0]);

        const newConsultation = await pool.query(
            `INSERT INTO consultations (citizen_id, lawyer_id, case_description) VALUES ($1, $2, $3) RETURNING id`,
            [newCitizen.rows[0].id, newLawyer.rows[0].id, 'Test case']
        );
        console.log('Inserted consultation:', newConsultation.rows[0]);

        // Read
        const readConsultation = await pool.query('SELECT * FROM consultations WHERE id = $1', [newConsultation.rows[0].id]);
        console.log('Read consultation:', readConsultation.rows[0]);

        // Update
        await pool.query('UPDATE consultations SET status = $1 WHERE id = $2', ['completed', newConsultation.rows[0].id]);
        console.log('Updated consultation status to completed');

        // Delete
        await pool.query('DELETE FROM consultations WHERE id = $1', [newConsultation.rows[0].id]);
        await pool.query('DELETE FROM lawyers WHERE id = $1', [newLawyer.rows[0].id]);
        await pool.query('DELETE FROM citizens WHERE id = $1', [newCitizen.rows[0].id]);
        console.log('Deleted test records');

        await pool.query('COMMIT');
        console.log('CRUD test passed.');
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('CRUD test failed:', err.message);
        throw err;
    }
}

async function testConstraints() {
    console.log('Testing constraints and edge cases...');
    try {
        // Test unique constraint on email
        try {
            await pool.query(`INSERT INTO citizens (name, email, password_hash) VALUES ($1, $2, $3)`, ['Duplicate', 'citizen@example.com', 'pass']);
            console.error('Unique constraint failed: duplicate email inserted');
        } catch (err) {
            if (err.code === '23505') console.log('Unique constraint on email: OK');
            else throw err;
        }

        // Test not null constraint
        try {
            await pool.query(`INSERT INTO citizens (email, password_hash) VALUES ($1, $2)`, ['nullname@example.com', 'pass']);
            console.error('Not null constraint failed: null name inserted');
        } catch (err) {
            if (err.code === '23502') console.log('Not null constraint on name: OK');
            else throw err;
        }

        // Test FK constraint
        try {
            await pool.query(`INSERT INTO consultations (citizen_id, lawyer_id) VALUES ($1, $2)`, ['00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000']);
            console.error('FK constraint failed: invalid IDs inserted');
        } catch (err) {
            if (err.code === '23503') console.log('Foreign key constraints: OK');
            else throw err;
        }

        console.log('Constraints test passed.');
    } catch (err) {
        console.error('Constraints test failed:', err.message);
        throw err;
    }
}

async function testPerformance() {
    console.log('Testing performance with bulk inserts...');
    try {
        const start = Date.now();
        await pool.query('BEGIN');
        for (let i = 0; i < 100; i++) {
            await pool.query(`INSERT INTO audit_logs (user_type, user_id, action, table_name, record_id) VALUES ($1, $2, $3, $4, $5)`,
                ['citizen', '00000000-0000-0000-0000-000000000000', 'test', 'test', '00000000-0000-0000-0000-000000000000']);
        }
        await pool.query('COMMIT');
        const end = Date.now();
        console.log(`Bulk insert (100 records) took ${end - start} ms`);

        // Clean up
        await pool.query('DELETE FROM audit_logs WHERE action = $1', ['test']);
        console.log('Performance test passed.');
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Performance test failed:', err.message);
        throw err;
    }
}

async function runTests() {
    try {
        await testCRUD();
        await testConstraints();
        await testPerformance();
        console.log('All tests completed successfully.');
    } catch (err) {
        console.error('Tests failed:', err);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runTests();
