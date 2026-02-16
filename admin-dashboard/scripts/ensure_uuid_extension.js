#!/usr/bin/env node
require('dotenv').config();
const pool = require('../db/pool');

async function ensure() {
    try {
        await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        console.log('uuid-ossp extension ensured');
    } catch (err) {
        console.error('Failed to ensure uuid extension:', err.message || err);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

ensure();
