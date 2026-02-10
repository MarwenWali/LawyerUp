const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize, User } = require('./database');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../admin-dashboard/public')));

// Initialize DB
sequelize.sync().then(() => {
  console.log('Database synced');
}).catch(err => {
  console.error('Failed to sync db:', err);
});

// API Routes

// Sign Up
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, phone, type, specialization, diploma } = req.body;

    // Check if user exists
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const userData = {
      name,
      email,
      phone,
      role: type,
      status: type === 'lawyer' ? 'pending' : 'active',
      submissionDate: new Date()
    };

    if (type === 'lawyer') {
      userData.specialization = 'General'; // Default, update later
      userData.diplomaUrl = diploma;
    }

    const user = await User.create(userData);
    res.json({ message: 'User created', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all pending lawyer applications
app.get('/api/pending-lawyers', async (req, res) => {
  try {
    const lawyers = await User.findAll({ where: { role: 'lawyer', status: 'pending' } });
    res.json(lawyers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all approved lawyers
app.get('/api/approved-lawyers', async (req, res) => {
  try {
    const lawyers = await User.findAll({ where: { role: 'lawyer', status: 'approved' } });
    res.json(lawyers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all rejected lawyers
app.get('/api/rejected-lawyers', async (req, res) => {
  try {
    const lawyers = await User.findAll({ where: { role: 'lawyer', status: 'rejected' } });
    res.json(lawyers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get dashboard statistics
app.get('/api/stats', async (req, res) => {
  try {
    const totalCitizens = await User.count({ where: { role: 'citizen' } });
    const approvedLawyers = await User.count({ where: { role: 'lawyer', status: 'approved' } });
    const pendingApplications = await User.count({ where: { role: 'lawyer', status: 'pending' } });
    const rejectedApplications = await User.count({ where: { role: 'lawyer', status: 'rejected' } });

    res.json({
      totalCitizens,
      totalLawyers: approvedLawyers,
      pendingApplications,
      rejectedApplications,
      totalUsers: totalCitizens + approvedLawyers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve a lawyer
app.post('/api/approve-lawyer/:id', async (req, res) => {
  try {
    const lawyerId = req.params.id;
    const lawyer = await User.findByPk(lawyerId);

    if (!lawyer) {
      return res.status(404).json({ error: 'Lawyer not found' });
    }

    lawyer.status = 'approved';
    lawyer.fees = req.body.fees || 50; // Default fees if not provided
    lawyer.rating = 4.5; // Default starting rating
    lawyer.approvalDate = new Date();

    await lawyer.save();

    res.json({ message: 'Lawyer approved', lawyer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const { getAiResponse } = require('./ai_service');

// ... existing routes ...

// Chat with AI
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // In a real app, you'd fetch user context here
    const aiResponse = await getAiResponse(message);
    res.json(aiResponse);
  } catch (error) {
    console.error('AI Service Error:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

// Reject a lawyer
app.post('/api/reject-lawyer/:id', async (req, res) => {
  try {
    const lawyerId = req.params.id;
    const lawyer = await User.findByPk(lawyerId);

    if (!lawyer) {
      return res.status(404).json({ error: 'Lawyer not found' });
    }

    lawyer.status = 'rejected';
    lawyer.rejectionDate = new Date();

    await lawyer.save();

    res.json({ message: 'Lawyer rejected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve the HTML dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin-dashboard/public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Admin Dashboard running on http://localhost:${PORT}`);
});
