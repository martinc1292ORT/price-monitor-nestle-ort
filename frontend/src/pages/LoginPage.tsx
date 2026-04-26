import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      setError('Email o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f5f5' }}>
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200">
          <div className="py-6 px-8 flex flex-col items-center" style={{ background: '#D71920' }}>
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mb-3">
              <span style={{ color: '#D71920', fontWeight: 700, fontSize: 22 }}>N</span>
            </div>
            <h1 className="text-white font-medium text-lg">Price Monitor</h1>
            <p className="text-red-200 text-xs mt-1">Sistema de monitoreo de precios</p>
          </div>

          <div className="p-8">
            {error && (
              <div className="mb-4 px-3 py-2 rounded-lg text-sm" style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="usuario@nestle.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': '#D71920' } as React.CSSProperties}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Contraseña</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg transition-opacity text-sm"
                style={{ background: '#D71920', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </div>
          </div>
        </div>
        <p className="text-center text-gray-400 text-xs mt-4">
          Nestlé © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}