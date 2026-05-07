# LawyerUp Admin Dashboard

Admin frontend for LawyerUp.

## Stack
- React + Vite + TypeScript
- Backend API: `../backend` (PostgreSQL)

## Setup
1. Install dependencies:
```bash
npm install
```
2. (Optional) create `.env`:
```bash
VITE_API_URL=http://localhost:3001
```
3. Start admin frontend:
```bash
npm run dev
```
4. Start backend separately:
```bash
cd ../backend
npm start
```

## Notes
- No Supabase dependency.
- Data is fetched from backend REST APIs under `/api`.
