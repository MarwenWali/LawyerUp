const express = require('express');
const bodyParser = require('body-parser');
const pool = require('./db/pool');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

// Helpers
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// GET approved lawyers
app.get('/api/approved-lawyers', wrap(async (req, res) => {
    const result = await pool.query("SELECT * FROM lawyers WHERE status = $1 ORDER BY approved_at DESC", ['approved']);
    res.json(result.rows);
}));

// GET pending lawyers
app.get('/api/pending-lawyers', wrap(async (req, res) => {
    const result = await pool.query("SELECT * FROM lawyers WHERE status = $1 ORDER BY created_at DESC", ['pending']);
    res.json(result.rows);
}));

// GET rejected lawyers
app.get('/api/rejected-lawyers', wrap(async (req, res) => {
    const result = await pool.query("SELECT * FROM lawyers WHERE status = $1", ['rejected']);
    res.json(result.rows);
}));

// GET stats
app.get('/api/stats', wrap(async (req, res) => {
    const approved = (await pool.query("SELECT COUNT(*) FROM lawyers WHERE status = $1", ['approved'])).rows[0].count;
    const pending = (await pool.query("SELECT COUNT(*) FROM lawyers WHERE status = $1", ['pending'])).rows[0].count;
    const rejected = (await pool.query("SELECT COUNT(*) FROM lawyers WHERE status = $1", ['rejected'])).rows[0].count;
    const citizens = (await pool.query("SELECT COUNT(*) FROM citizens")).rows[0].count;
    res.json({ approved: Number(approved), pending: Number(pending), rejected: Number(rejected), citizens: Number(citizens) });
}));

// Approve lawyer
app.post('/api/approve-lawyer/:id', wrap(async (req, res) => {
    const { fees, rating, approved_by } = req.body;
    const id = req.params.id;
    const result = await pool.query(
        `UPDATE lawyers SET status=$1, fees=$2, rating=$3, approved_at=now(), approved_by=$4 WHERE id=$5 RETURNING *`,
        ['approved', fees || null, rating || null, approved_by || null, id]
    );
    res.json(result.rows[0]);
}));

// Reject lawyer
app.post('/api/reject-lawyer/:id', wrap(async (req, res) => {
    const id = req.params.id;
    const result = await pool.query(
        `UPDATE lawyers SET status=$1, rejected_at=now() WHERE id=$2 RETURNING *`,
        ['rejected', id]
    );
    res.json(result.rows[0]);
}));

// CRUD: create lawyer
app.post('/api/lawyers', wrap(async (req, res) => {
    const { name, email, password_hash, phone, specialization, experience_years, fees } = req.body;
    const result = await pool.query(
        `INSERT INTO lawyers (name, email, password_hash, phone, specialization, experience_years, fees)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [name, email, password_hash || 'placeholder', phone || null, specialization || ['General'], experience_years || null, fees || null]
    );
    res.status(201).json(result.rows[0]);
}));

// Read lawyer
app.get('/api/lawyers/:id', wrap(async (req, res) => {
    const id = req.params.id;
    const result = await pool.query('SELECT * FROM lawyers WHERE id = $1', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
}));

// Update lawyer
app.put('/api/lawyers/:id', wrap(async (req, res) => {
    const id = req.params.id;
    const fields = req.body;
    const keys = Object.keys(fields);
    if (!keys.length) return res.status(400).json({ error: 'No fields to update' });
    const sets = keys.map((k, i) => `${k}=$${i + 1}`).join(', ');
    const values = keys.map(k => fields[k]);
    values.push(id);
    const result = await pool.query(`UPDATE lawyers SET ${sets}, updated_at=now() WHERE id=$${values.length} RETURNING *`, values);
    res.json(result.rows[0]);
}));

// Delete lawyer
app.delete('/api/lawyers/:id', wrap(async (req, res) => {
    const id = req.params.id;
    const result = await pool.query('DELETE FROM lawyers WHERE id = $1 RETURNING *', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true, lawyer: result.rows[0] });
}));

// Basic error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Admin API listening on port ${PORT}`));
