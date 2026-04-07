import { NavLink, useNavigate } from 'react-router-dom';
import { Scale, LayoutDashboard, Users, FileText, Settings, LogOut, MessageSquare } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';

const NAV = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, end: true },
  { label: 'Users', path: '/users', icon: Users },
  { label: 'Messages', path: '/messages', icon: MessageSquare },
  { label: 'Activity Logs', path: '/logs', icon: FileText },
  { label: 'Settings', path: '/settings', icon: Settings },
];

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    navigate('/auth');
  };

  const initials = (user?.full_name || user?.email || '?')
    .split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <aside
      className="fixed top-0 left-0 h-screen w-60 flex flex-col scrollbar-thin"
      style={{ backgroundColor: '#14213D', zIndex: 40 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#D4A03C' }}
        >
          <Scale className="w-5 h-5" style={{ color: '#14213D' }} />
        </div>
        <div>
          <span className="font-display font-bold text-white text-base leading-tight block">LawyerUp</span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Admin Panel</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-thin">
        <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Navigation
        </p>
        {NAV.map(({ label, path, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-all ${
                isActive
                  ? 'text-white'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`
            }
            style={({ isActive }) =>
              isActive ? { backgroundColor: 'rgba(212,160,60,0.15)', color: '#D4A03C' } : {}
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-4 h-4 flex-shrink-0" style={isActive ? { color: '#D4A03C' } : {}} />
                <span>{label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#D4A03C' }} />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer / User */}
      <div className="px-3 pb-4 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: '#D4A03C', color: '#14213D' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.full_name || 'Admin'}</p>
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm transition-all"
          style={{ color: 'rgba(255,255,255,0.45)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
