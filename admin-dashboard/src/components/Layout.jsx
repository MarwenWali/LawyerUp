import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import { useAuth } from '../hooks/useAuth.js';

export default function Layout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F0F2F5' }}>
        <div
          className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#D4A03C', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#F0F2F5' }}>
      <Sidebar />
      <main className="flex-1 pl-60 min-h-screen overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
