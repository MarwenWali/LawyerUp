import { useState, useMemo } from 'react';
import { Search, Edit, Trash2, UserCheck, UserX } from 'lucide-react';
import { useUsers, useUpdateStatus, useDeleteUser } from '../hooks/useData.js';
import EditUserModal from '../components/EditUserModal.jsx';
import { formatDate, initials } from '../lib/utils.js';

const ROLES = ['All', 'user', 'lawyer', 'admin'];
const STATUSES = ['All', 'active', 'suspended', 'pending'];

const STATUS_STYLE = {
  active:    { bg: 'rgba(22,163,74,0.1)',   color: '#16A34A' },
  suspended: { bg: 'rgba(220,38,38,0.1)',   color: '#DC2626' },
  pending:   { bg: 'rgba(245,158,11,0.1)',  color: '#F59E0B' },
};

const ROLE_STYLE = {
  admin:  { bg: 'rgba(20,33,61,0.08)',   color: '#14213D' },
  lawyer: { bg: 'rgba(212,160,60,0.12)', color: '#D4A03C' },
  user:   { bg: 'rgba(107,114,128,0.1)', color: '#6B7280' },
};

export default function Users() {
  const { data: users, isLoading } = useUsers();
  const updateStatus = useUpdateStatus();
  const deleteUser = useDeleteUser();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editUser, setEditUser] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const filtered = useMemo(() => {
    return (users || []).filter((u) => {
      const name = u.full_name || '';
      const matchSearch =
        name.toLowerCase().includes(search.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === 'All' || u.role === roleFilter;
      const matchStatus = statusFilter === 'All' || u.status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const handleDelete = () => {
    if (deleteId) {
      deleteUser.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const toggleStatus = (u) => {
    const next = u.status === 'suspended' ? 'active' : 'suspended';
    updateStatus.mutate({ id: u.id, status: next });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#14213D', fontFamily: '"Playfair Display", Georgia, serif' }}>
          Users
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {users?.length ?? 0} total users
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm focus:outline-none focus:bg-white focus:ring-2 transition"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm focus:outline-none cursor-pointer capitalize"
        >
          {ROLES.map((r) => <option key={r}>{r === 'All' ? 'All Roles' : r}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm focus:outline-none cursor-pointer capitalize"
        >
          {STATUSES.map((s) => <option key={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['User', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-400 ${h === 'Actions' ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-400 text-sm">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => {
                    const name = u.full_name || u.email || 'User';
                    const ini = initials(name);
                    const roleS = ROLE_STYLE[u.role] || ROLE_STYLE.user;
                    const statusS = STATUS_STYLE[u.status] || STATUS_STYLE.pending;

                    return (
                      <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: '#14213D', color: '#D4A03C' }}
                            >
                              {ini}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{name}</p>
                              <p className="text-xs text-gray-400">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
                            style={{ backgroundColor: roleS.bg, color: roleS.color }}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
                            style={{ backgroundColor: statusS.bg, color: statusS.color }}
                          >
                            {u.status || 'active'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-400">
                          {formatDate(u.created_at)}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            {u.role !== 'admin' && (
                              <button
                                onClick={() => toggleStatus(u)}
                                className="p-1.5 rounded-lg transition"
                                title={u.status === 'suspended' ? 'Activate' : 'Suspend'}
                                style={{ color: u.status === 'suspended' ? '#16A34A' : '#F59E0B' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = u.status === 'suspended' ? 'rgba(22,163,74,0.08)' : 'rgba(245,158,11,0.08)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                {u.status === 'suspended' ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                              </button>
                            )}
                            <button
                              onClick={() => setEditUser(u)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {u.role !== 'admin' && (
                              <button
                                onClick={() => setDeleteId(u.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal (read-only for now - backend supports limited updates) */}
      {editUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => e.target === e.currentTarget && setEditUser(null)}
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-modal p-6">
            <h3 className="text-lg font-bold mb-4" style={{ color: '#14213D', fontFamily: '"Playfair Display", Georgia, serif' }}>
              User Details
            </h3>
            {[
              { label: 'Full Name', value: editUser.full_name },
              { label: 'Email', value: editUser.email },
              { label: 'Role', value: editUser.role },
              { label: 'Status', value: editUser.status },
              { label: 'Phone', value: editUser.phone_number },
              { label: 'Joined', value: formatDate(editUser.created_at) },
            ].map(({ label, value }) => value && (
              <div key={label} className="flex justify-between py-2.5 border-b border-gray-50">
                <span className="text-sm text-gray-400">{label}</span>
                <span className="text-sm font-medium text-gray-700 capitalize">{value}</span>
              </div>
            ))}
            <button
              onClick={() => setEditUser(null)}
              className="w-full mt-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-modal">
            <h3 className="text-lg font-bold mb-2" style={{ color: '#14213D', fontFamily: '"Playfair Display", Georgia, serif' }}>
              Delete User
            </h3>
            <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: '#DC2626' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
