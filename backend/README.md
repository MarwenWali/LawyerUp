# LawyerUp Admin Dashboard

This is the admin web dashboard for managing lawyer applications and approvals in the LawyerUp mobile application.

## Features

- View pending lawyer applications
- Approve/reject lawyer applications
- View all approved lawyers
- Real-time statistics

## Setup & Installation

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation Steps

1. Navigate to the admin dashboard directory:
```bash
cd admin-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

The admin dashboard will be available at: **http://localhost:3001**

### Development Mode

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### Get Pending Lawyers
```
GET /api/pending-lawyers
```
Returns a list of all pending lawyer applications.

### Get Approved Lawyers
```
GET /api/approved-lawyers
```
Returns a list of all approved lawyers.

### Approve a Lawyer
```
POST /api/approve-lawyer/:id
```
Approves a pending lawyer application by ID.

### Reject a Lawyer
```
POST /api/reject-lawyer/:id
```
Rejects and removes a pending lawyer application by ID.

## How It Works

1. **Pending Applications Tab**: Shows all lawyers awaiting admin approval. Each application displays:
   - Lawyer's name and specialization
   - Contact information (email, phone)
   - Submission date
   - Approve/Reject buttons

2. **Approved Lawyers Tab**: Shows all lawyers who have been approved and are active on the platform.

3. **Approval Workflow**:
   - When a lawyer signs up on the mobile app with their diploma, they appear in the "Pending Applications" tab
   - Admin reviews and approves or rejects the application
   - Approved lawyers can immediately start receiving client inquiries
   - Rejected lawyers are removed from the pending list

## Integration with Mobile App

The mobile app will:
1. Send lawyer signup requests with diploma images to the backend
2. Store the lawyer's `approved: false` status locally until admin approval
3. Check approval status when lawyer tries to log in
4. Show "Awaiting Admin Approval" message if not yet approved

## Database Integration

Currently, the dashboard uses in-memory storage. To persist data permanently:

1. Replace the `pendingLawyers` and `approvedLawyers` arrays with database calls
2. Connect to MongoDB, PostgreSQL, or another database
3. Update the API endpoints to use database operations

Example MongoDB integration (future enhancement):
```javascript
const MongoDB = require('mongodb').MongoClient;
// ... database connection code
```

## Security Considerations

For production deployment:
- Add authentication (JWT, OAuth2)
- Implement HTTPS
- Add rate limiting
- Validate all inputs
- Use environment variables for sensitive data
- Implement CORS properly based on your domain

## Future Enhancements

- File upload for diploma verification
- Admin user management
- Application status history
- Email notifications for approval/rejection
- Search and advanced filtering
- Lawyer profile editing
- Suspension/ban functionality
