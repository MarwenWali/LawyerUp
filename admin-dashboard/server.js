const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Mock database
let pendingLawyers = [
  {
    id: '1',
    name: 'Ahmed Saidi',
    email: 'ahmed@example.com',
    phone: '+216 90 123 456',
    specialization: 'Constitutional Law',
    experience: 5,
    diplomaUrl: 'diploma_1.jpg',
    submittedAt: new Date('2026-01-25'),
    status: 'pending'
  },
  {
    id: '2',
    name: 'Leila Mansouri',
    email: 'leila@example.com',
    phone: '+216 91 234 567',
    specialization: 'Labor Law',
    experience: 3,
    diplomaUrl: 'diploma_2.jpg',
    submittedAt: new Date('2026-01-26'),
    status: 'pending'
  }
];

let approvedLawyers = [
  {
    id: '101',
    name: 'Mehdi Ben Ali',
    email: 'mehdi@example.com',
    phone: '+216 20 000 000',
    specialization: 'Family Law',
    experience: 8,
    fees: 50,
    rating: 4.5,
    approvedAt: new Date('2026-01-20'),
    status: 'approved'
  },
  {
    id: '102',
    name: 'Amina Trabelsi',
    email: 'amina@example.com',
    phone: '+216 21 111 111',
    specialization: 'Criminal Law',
    experience: 10,
    fees: 80,
    rating: 4.8,
    approvedAt: new Date('2026-01-18'),
    status: 'approved'
  }
];

let rejectedLawyers = [];

let citizens = [
  { id: 'c1', name: 'Tunisian Citizen 1', email: 'citizen1@example.com', joinedAt: new Date('2026-01-15') },
  { id: 'c2', name: 'Tunisian Citizen 2', email: 'citizen2@example.com', joinedAt: new Date('2026-01-20') }
];

// API Routes

// Get all pending lawyer applications
app.get('/api/pending-lawyers', (req, res) => {
  res.json(pendingLawyers);
});

// Get all approved lawyers
app.get('/api/approved-lawyers', (req, res) => {
  res.json(approvedLawyers);
});

// Get all rejected lawyers
app.get('/api/rejected-lawyers', (req, res) => {
  res.json(rejectedLawyers);
});

// Get dashboard statistics
app.get('/api/stats', (req, res) => {
  res.json({
    totalCitizens: citizens.length,
    totalLawyers: approvedLawyers.length,
    pendingApplications: pendingLawyers.length,
    rejectedApplications: rejectedLawyers.length,
    totalUsers: citizens.length + approvedLawyers.length
  });
});

// Approve a lawyer
app.post('/api/approve-lawyer/:id', (req, res) => {
  const lawyerId = req.params.id;
  const lawyer = pendingLawyers.find(l => l.id === lawyerId);

  if (!lawyer) {
    return res.status(404).json({ error: 'Lawyer not found' });
  }

  const approved = {
    ...lawyer,
    fees: req.body.fees || 0,
    rating: 4.5,
    approvedAt: new Date(),
    status: 'approved'
  };

  approvedLawyers.push(approved);
  pendingLawyers = pendingLawyers.filter(l => l.id !== lawyerId);

  res.json({ message: 'Lawyer approved', lawyer: approved });
});

// Reject a lawyer
app.post('/api/reject-lawyer/:id', (req, res) => {
  const lawyerId = req.params.id;
  const lawyer = pendingLawyers.find(l => l.id === lawyerId);

  if (!lawyer) {
    return res.status(404).json({ error: 'Lawyer not found' });
  }

  const rejected = {
    ...lawyer,
    rejectedAt: new Date(),
    status: 'rejected'
  };

  rejectedLawyers.push(rejected);
  pendingLawyers = pendingLawyers.filter(l => l.id !== lawyerId);
  res.json({ message: 'Lawyer rejected' });
});

// Serve the HTML dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Admin Dashboard running on http://localhost:${PORT}`);
});
