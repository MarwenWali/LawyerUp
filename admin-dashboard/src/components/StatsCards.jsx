import { useNavigate } from 'react-router-dom';
import { Users, Briefcase, FileText, Clock, TrendingUp, UserCheck } from 'lucide-react';

const CARDS = [
  {
    key: 'totalUsers',
    label: 'Total Users',
    subKey: 'newUsersThisMonth',
    subLabel: 'new this month',
    icon: Users,
    color: '#14213D',
    bg: 'rgba(20,33,61,0.08)',
    route: '/users',
  },
  {
    key: 'activeLawyers',
    label: 'Active Lawyers',
    subKey: 'pendingLawyerVerifications',
    subLabel: 'pending verification',
    icon: UserCheck,
    color: '#D4A03C',
    bg: 'rgba(212,160,60,0.12)',
    route: '/users?role=lawyer',
  },
  {
    key: 'casesThisMonth',
    label: 'Cases This Month',
    subKey: null,
    subLabel: null,
    icon: FileText,
    color: '#16A34A',
    bg: 'rgba(22,163,74,0.10)',
    route: null,
  },
  {
    key: 'pendingCases',
    label: 'Pending Cases',
    subKey: null,
    subLabel: null,
    icon: Clock,
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.10)',
    route: null,
  },
];

export default function StatsCards({ stats }) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {CARDS.map(({ key, label, subKey, subLabel, icon: Icon, color, bg, route }) => (
        <div
          key={key}
          onClick={() => route && navigate(route)}
          className={`bg-white rounded-xl p-5 shadow-card transition-all ${route ? 'cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5' : ''}`}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: bg }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            {subKey && stats?.[subKey] != null && (
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" style={{ color: '#16A34A' }} />
                <span className="text-xs font-semibold" style={{ color: '#16A34A' }}>
                  +{stats[subKey]}
                </span>
              </div>
            )}
          </div>
          <p className="text-3xl font-bold" style={{ color: '#14213D', fontFamily: '"Playfair Display", Georgia, serif' }}>
            {stats ? (stats[key] ?? '—') : <span className="text-gray-300">—</span>}
          </p>
          <p className="text-sm text-gray-500 mt-1">{label}</p>
          {subKey && stats?.[subKey] != null && (
            <p className="text-xs mt-1" style={{ color: '#16A34A' }}>
              +{stats[subKey]} {subLabel}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
