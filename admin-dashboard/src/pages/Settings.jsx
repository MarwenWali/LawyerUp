import { useState } from 'react';
import { Bell, Globe, Shield } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';

export default function Settings() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#14213D', fontFamily: '"Playfair Display", Georgia, serif' }}>
          Settings
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage your dashboard preferences</p>
      </div>

      {/* Account card */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <h2 className="text-base font-bold mb-4" style={{ color: '#14213D', fontFamily: '"Playfair Display", Georgia, serif' }}>
          Account
        </h2>
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
            style={{ backgroundColor: '#14213D', color: '#D4A03C' }}
          >
            {(user?.full_name || user?.email || 'A').slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-800">{user?.full_name || 'Admin'}</p>
            <p className="text-sm text-gray-400">{user?.email}</p>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block"
              style={{ backgroundColor: 'rgba(20,33,61,0.08)', color: '#14213D' }}
            >
              Administrator
            </span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <h2 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: '#14213D', fontFamily: '"Playfair Display", Georgia, serif' }}>
          <Bell className="w-4 h-4" style={{ color: '#D4A03C' }} />
          Notifications
        </h2>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-gray-700">New lawyer applications</p>
            <p className="text-xs text-gray-400 mt-0.5">Receive an alert when a lawyer submits an application</p>
          </div>
          <button
            onClick={() => setNotifications(!notifications)}
            className="relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0"
            style={{ backgroundColor: notifications ? '#D4A03C' : '#E5E7EB' }}
          >
            <span
              className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
              style={{ transform: notifications ? 'translateX(20px)' : 'translateX(0)' }}
            />
          </button>
        </div>
      </div>

      {/* Platform info */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <h2 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: '#14213D', fontFamily: '"Playfair Display", Georgia, serif' }}>
          <Globe className="w-4 h-4" style={{ color: '#D4A03C' }} />
          Platform
        </h2>
        <div className="space-y-3">
          {[
            { label: 'Version', value: '1.0.0' },
            { label: 'Environment', value: 'Production' },
            { label: 'API URL', value: import.meta.env.VITE_API_URL || 'http://localhost:3000' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between py-2.5 border-b border-gray-50">
              <span className="text-sm text-gray-400">{label}</span>
              <span className="text-sm font-medium text-gray-700">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <h2 className="text-base font-bold mb-2 flex items-center gap-2" style={{ color: '#14213D', fontFamily: '"Playfair Display", Georgia, serif' }}>
          <Shield className="w-4 h-4" style={{ color: '#D4A03C' }} />
          Security
        </h2>
        <p className="text-xs text-gray-400">
          Sessions are secured with JWT tokens. Tokens expire in 7 days. Sign out to invalidate your session.
        </p>
      </div>
    </div>
  );
}
