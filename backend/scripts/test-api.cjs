require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');

// Sign a token for lawyer Gharbi Mohamed (c3d69874-5a1e-4c37-91de-183040432692)
const token = jwt.sign(
  { id: 'c3d69874-5a1e-4c37-91de-183040432692', role: 'lawyer' },
  process.env.JWT_SECRET
);

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/conversations',
  method: 'GET',
  headers: { Authorization: `Bearer ${token}` },
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    const parsed = JSON.parse(data);
    const convs = parsed?.conversations || parsed?.data || [];
    convs.forEach((c) => {
      console.log('--- Conversation', c.id, '---');
      console.log('  other_participant:', JSON.stringify(c.other_participant, null, 4));
      console.log('  citizen:', JSON.stringify(c.citizen, null, 4));
    });
  });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.end();
