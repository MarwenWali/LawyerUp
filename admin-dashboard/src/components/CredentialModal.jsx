import { X, FileText, Mail, Phone, Briefcase } from 'lucide-react';
import { initials, formatDate } from '../lib/utils.js';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/** Resolve a potentially relative diploma URL to an absolute URL */
function resolveUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${BACKEND_URL}${url}`;
}

export default function CredentialModal({ profile, onClose }) {
  if (!profile) return null;

  const name = profile.full_name || profile.email || 'Lawyer';
  const ini = initials(name);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-modal overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold" style={{ color: '#14213D', fontFamily: '"Playfair Display", Georgia, serif' }}>
            Lawyer Credentials
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[80vh] overflow-y-auto scrollbar-thin">
          {/* Profile */}
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
              style={{ backgroundColor: '#14213D', color: '#D4A03C' }}
            >
              {ini}
            </div>
            <div>
              <p className="font-semibold text-gray-800">{name}</p>
              <div className="flex items-center gap-1.5 text-sm text-gray-400 mt-0.5">
                <Mail className="w-3.5 h-3.5" /> {profile.email}
              </div>
              {profile.phone_number && (
                <div className="flex items-center gap-1.5 text-sm text-gray-400 mt-0.5">
                  <Phone className="w-3.5 h-3.5" /> {profile.phone_number}
                </div>
              )}
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Status', value: profile.is_verified ? 'Verified' : profile.status === 'suspended' ? 'Suspended' : 'Pending' },
              { label: 'Specialization', value: profile.specialization || '—' },
              { label: 'Rating', value: profile.rating ? `${Number(profile.rating).toFixed(1)} / 5.0` : '—' },
              { label: 'Experience', value: profile.experience_years ? `${profile.experience_years} years` : '—' },
              { label: 'Cases Handled', value: profile.cases_handled ?? '—' },
              { label: 'Member Since', value: formatDate(profile.created_at) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className="text-sm font-semibold text-gray-700">{value}</p>
              </div>
            ))}
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1.5 font-medium">Bio</p>
              <p className="text-sm text-gray-600 leading-relaxed">{profile.bio}</p>
            </div>
          )}

          {/* Diploma / Document */}
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <FileText className="w-4 h-4" style={{ color: '#D4A03C' }} />
              Diploma / License
            </p>
            {profile.diploma_url ? (
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                <img
                  src={resolveUrl(profile.diploma_url)}
                  alt="Lawyer diploma"
                  className="w-full h-auto object-contain max-h-80"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden p-8 text-center text-gray-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Unable to display document</p>
                  <a href={resolveUrl(profile.diploma_url)} target="_blank" rel="noreferrer"
                    className="text-sm hover:underline mt-1 inline-block"
                    style={{ color: '#D4A03C' }}>
                    Open document link
                  </a>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center text-gray-400">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No document uploaded</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
