import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { toast } from 'sonner';

export default function Auth() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#F0F2F5' }}
    >
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-modal overflow-hidden">
          {/* Top banner */}
          <div className="px-8 pt-8 pb-6 text-center" style={{ backgroundColor: '#14213D' }}>
            <div
              className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4"
              style={{ backgroundColor: '#D4A03C' }}
            >
              <Scale className="w-7 h-7" style={{ color: '#14213D' }} />
            </div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
              LawyerUp
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Admin Dashboard
            </p>
          </div>

          {/* Form */}
          <div className="px-8 py-7">
            <p className="text-sm text-gray-500 mb-6 text-center">Sign in to your admin account</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@lawyerup.tn"
                  required
                  className="w-full px-3.5 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pr-11 px-3.5 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white mt-2 transition hover:opacity-90 disabled:opacity-70 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#14213D' }}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-6">
              Admin access only · LawyerUp v1.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
