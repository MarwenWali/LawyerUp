import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#F0F2F5' }}
    >
      <div className="text-center">
        <p className="text-7xl font-bold mb-4" style={{ color: '#14213D', fontFamily: '"Playfair Display", Georgia, serif' }}>
          404
        </p>
        <h1 className="text-xl font-semibold text-gray-600 mb-2">Page not found</h1>
        <p className="text-sm text-gray-400 mb-8">The page you're looking for doesn't exist.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: '#14213D' }}
        >
          <Home className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
