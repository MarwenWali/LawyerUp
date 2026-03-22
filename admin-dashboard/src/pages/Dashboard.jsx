import StatsCards from '../components/StatsCards.jsx';
import LawyerList from '../components/LawyerList.jsx';
import { useStats, useUsers } from '../hooks/useData.js';
import { RefreshCw } from 'lucide-react';

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useStats();
  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = useUsers();

  const lawyers = (users || []).filter((u) => u.role === 'lawyer');
  const isLoading = statsLoading || usersLoading;

  const handleRefresh = () => {
    refetchStats();
    refetchUsers();
  };

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#14213D', fontFamily: '"Playfair Display", Georgia, serif' }}>
            Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Platform overview & lawyer management</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-white hover:bg-gray-50 transition shadow-card"
          style={{ color: '#14213D' }}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl p-5 shadow-card h-28 animate-pulse">
              <div className="w-10 h-10 bg-gray-100 rounded-xl mb-4" />
              <div className="w-16 h-7 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <StatsCards stats={stats} />
      )}

      {/* Lawyer management */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#14213D', fontFamily: '"Playfair Display", Georgia, serif' }}>
              Lawyer Verification
            </h2>
            <p className="text-sm text-gray-400">Review and manage lawyer applications</p>
          </div>
          <span
            className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}
          >
            {lawyers.filter((l) => !l.is_verified && l.status !== 'suspended').length} pending
          </span>
        </div>
        {usersLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-5 h-40 animate-pulse" />
            ))}
          </div>
        ) : (
          <LawyerList lawyers={lawyers} />
        )}
      </div>
    </div>
  );
}
