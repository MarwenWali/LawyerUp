import { useState, useMemo } from 'react';
import { Search, Info, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { useLogs } from '../hooks/useData.js';
import { timeAgo } from '../lib/utils.js';

const TYPES = ['All', 'info', 'warning', 'error'];

const TYPE_CONFIG = {
  info:    { icon: Info,          color: '#14213D', bg: 'rgba(20,33,61,0.08)',   label: 'Info'    },
  warning: { icon: AlertTriangle, color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', label: 'Warning' },
  error:   { icon: XCircle,      color: '#DC2626', bg: 'rgba(220,38,38,0.08)',   label: 'Error'   },
};

export default function Logs() {
  const { data: logs, isLoading, refetch } = useLogs();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');

  const filtered = useMemo(() => {
    return (logs || []).filter((l) => {
      const matchSearch =
        (l.user_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.action || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.details || '').toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === 'All' || l.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [logs, search, typeFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#14213D', fontFamily: '"Playfair Display", Georgia, serif' }}>
            Activity Logs
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{logs?.length ?? 0} total events</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-white hover:bg-gray-50 transition shadow-card"
          style={{ color: '#14213D' }}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm focus:outline-none focus:bg-white transition"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition capitalize"
              style={
                typeFilter === t
                  ? { backgroundColor: '#14213D', color: 'white' }
                  : { backgroundColor: '#F0F2F5', color: '#6B7280' }
              }
            >
              {t === 'All' ? 'All' : TYPE_CONFIG[t]?.label ?? t}
            </button>
          ))}
        </div>
      </div>

      {/* Log list */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">No logs match your filters</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((log) => {
              const cfg = TYPE_CONFIG[log.type] || TYPE_CONFIG.info;
              const Icon = cfg.icon;
              return (
                <div key={log.id} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50/50 transition">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: cfg.bg }}
                  >
                    <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{log.user_name}</span>
                      <span className="text-sm text-gray-500">{log.action}</span>
                    </div>
                    {log.details && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{log.details}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{timeAgo(log.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
