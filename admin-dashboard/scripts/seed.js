#!/usr/bin/env node
require('dotenv').config();
const pool = require('../db/pool');

async function seed() {
    try {
        await pool.query('BEGIN');

        // Insert a sample citizen
        const citizenRes = await pool.query(
            `INSERT INTO citizens (name, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, name, email`,
            ['Test Citizen', 'citizen@example.com', 'hashed_password_placeholder']
        );

        // Insert sample lawyers
        const lawyer1 = await pool.query(
            `INSERT INTO lawyers (name, email, password_hash, phone, specialization, experience_years, status, fees, rating)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, name, email`,
            [
                'Alice Doe',
                'alice@example.com',
                'hashed_password_placeholder',
                '+10000000001',
                ['Family Law'],
                8,
                'approved',
                100.0,
                4.7,
            ]
        );

        const lawyer2 = await pool.query(
            `INSERT INTO lawyers (name, email, password_hash, phone, specialization, experience_years, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, name, email`,
            ['Bob Smith', 'bob@example.com', 'hashed_password_placeholder', '+10000000002', ['Criminal Law'], 3, 'pending']
        );

        await pool.query('COMMIT');

        console.log('Seed complete:');
        if (citizenRes.rows[0]) console.log('  citizen:', citizenRes.rows[0]);
        if (lawyer1.rows[0]) console.log('  lawyer:', lawyer1.rows[0]);
        if (lawyer2.rows[0]) console.log('  lawyer:', lawyer2.rows[0]);
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Seed failed:', err);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

seed();
