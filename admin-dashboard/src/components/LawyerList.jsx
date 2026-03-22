import { useState, useMemo } from 'react';
import { Search, CheckCircle, XCircle, Trash2, Eye, Filter } from 'lucide-react';
import { useVerifyLawyer, useDeleteUser } from '../hooks/useData.js';
import { initials, formatDate } from '../lib/utils.js';
import CredentialModal from './CredentialModal.jsx';

const TABS = ['All', 'Pending', 'Verified', 'Rejected'];
const SPECIALIZATIONS = ['All', 'Family', 'Commercial', 'Criminal', 'Labor', 'Property'];

export default function LawyerList({ lawyers }) {
  const verifyLawyer = useVerifyLawyer();
  const deleteLawyerM = useDeleteUser();
  const [tab, setTab] = useState('All');
  const [search, setSearch] = useState('');
  const [spec, setSpec] = useState('All');
  const [credProfile, setCredProfile] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const filtered = useMemo(() => {
    return (lawyers || []).filter((l) => {
      const matchSearch =
        (l.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.email || '').toLowerCase().includes(search.toLowerCase());
      const matchSpec = spec === 'All' || l.specialization === spec;
      const isVerified = l.is_verified;
      const isRejected = l.status === 'rejected';
      const isPending = !isVerified && !isRejected;
      const matchTab =
        tab === 'All' ||
        (tab === 'Pending' && isPending) ||
        (tab === 'Verified' && isVerified) ||
        (tab === 'Rejected' && isRejected);
      return matchSearch && matchSpec && matchTab;
    });
  }, [lawyers, search, spec, tab]);

  const counts = useMemo(() => ({
    All: (lawyers || []).length,
    Pending: (lawyers || []).filter((l) => !l.is_verified && l.status !== 'rejected').length,
    Verified: (lawyers || []).filter((l) => l.is_verified).length,
    Rejected: (lawyers || []).filter((l) => l.status === 'rejected').length,
  }), [lawyers]);

  const confirmDelete = () => {
    if (deleteId) {
      deleteLawyerM.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': '#D4A03C' }}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <select
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            className="pl-8 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none appearance-none cursor-pointer"
          >
            {SPECIALIZATIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all"
            style={
              tab === t
                ? { backgroundColor: 'white', color: '#14213D', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                : { color: '#6B7280' }
            }
          >
            {t}
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
              style={{
                backgroundColor: tab === t ? 'rgba(20,33,61,0.08)' : 'rgba(0,0,0,0.04)',
                color: tab === t ? '#14213D' : '#9CA3AF',
              }}
            >
              {counts[t]}
            </span>
          </button>
        ))}
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No lawyers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((l) => (
            <LawyerCard
              key={l.id}
              lawyer={l}
              onVerify={() => verifyLawyer.mutate({ id: l.id, action: 'verify' })}
              onReject={() => verifyLawyer.mutate({ id: l.id, action: 'reject' })}
              onRevoke={() => verifyLawyer.mutate({ id: l.id, action: 'revoke' })}
              onView={() => setCredProfile(l)}
              onDelete={() => setDeleteId(l.id)}
            />
          ))}
        </div>
      )}

      {/* Credential modal */}
      <CredentialModal profile={credProfile} onClose={() => setCredProfile(null)} />

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-modal">
            <h3 className="text-lg font-bold mb-2" style={{ color: '#14213D', fontFamily: '"Playfair Display", Georgia, serif' }}>
              Remove Lawyer
            </h3>
            <p className="text-sm text-gray-500 mb-6">This action cannot be undone. Are you sure?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition"
                style={{ backgroundColor: '#DC2626' }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LawyerCard({ lawyer, onVerify, onReject, onRevoke, onView, onDelete }) {
  const name = lawyer.full_name || lawyer.email || 'Lawyer';
  const ini = initials(name);
  const isVerified = lawyer.is_verified;
  const isRejected = lawyer.status === 'rejected';
  const isPending = !isVerified && !isRejected;

  return (
    <div className="bg-white rounded-xl p-5 shadow-card flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ backgroundColor: '#14213D', color: '#D4A03C' }}
          >
            {ini}
          </div>
          <div>
            <button
              onClick={onView}
              className="font-semibold text-sm text-left hover:underline"
              style={{ color: '#14213D' }}
            >
              {name}
            </button>
            {lawyer.specialization && (
              <p className="text-xs text-gray-400 mt-0.5">{lawyer.specialization}</p>
            )}
          </div>
        </div>
          <StatusBadge verified={isVerified} rejected={isRejected} />
      </div>

      <div className="text-xs text-gray-400 space-y-1">
        <p>{lawyer.email}</p>
        {lawyer.phone_number && <p>{lawyer.phone_number}</p>}
        {lawyer.rating && (
          <p>⭐ {Number(lawyer.rating).toFixed(1)} rating</p>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-100 mt-auto">
        {isPending && (
          <>
            <button
              onClick={onVerify}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: '#16A34A' }}
            >
              <CheckCircle className="w-3.5 h-3.5" /> Verify
            </button>
            <button
              onClick={onReject}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: '#DC2626' }}
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
          </>
        )}
        {isVerified && (
          <button
            onClick={onRevoke}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
          >
            Revoke
          </button>
        )}
        {isRejected && (
          <button
            onClick={onVerify}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-90"
            style={{ backgroundColor: 'rgba(20,33,61,0.08)', color: '#14213D' }}
          >
            <CheckCircle className="w-3.5 h-3.5" /> Re-approve
          </button>
        )}
        <div className="ml-auto flex gap-1">
          <button onClick={onView} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ verified, rejected }) {
  if (verified) return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
      Verified
    </span>
  );
  if (rejected) return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>
      Rejected
    </span>
  );
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>
      Pending
    </span>
  );
}
