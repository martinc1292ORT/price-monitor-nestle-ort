import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const isActive = (path: string) =>
    location.pathname === path
      ? 'text-white font-500 border-b-2 border-white pb-1'
      : 'text-red-100 hover:text-white transition-colors';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f5f5f5' }}>
      <header style={{ background: '#D71920' }}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
              <span style={{ color: '#D71920', fontWeight: 700, fontSize: 14 }}>N</span>
            </div>
            <span className="text-white font-medium text-base">Price Monitor</span>
          </Link>

          <nav className="flex items-center gap-6">
            <Link to="/dashboard" className={isActive('/dashboard')} style={{ fontSize: 14 }}>
              Dashboard
            </Link>
            {user?.rol === 'admin' && (
              <Link to="/admin" className={isActive('/admin')} style={{ fontSize: 14 }}>
                Administración
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-red-800 flex items-center justify-center">
                <span className="text-white text-xs font-medium">
                  {user?.nombre?.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-red-100 text-sm">{user?.nombre}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-red-200 hover:text-white text-sm transition-colors border border-red-400 hover:border-white px-3 py-1 rounded"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        <Outlet />
      </main>

      <footer style={{ background: '#D71920' }} className="py-2">
        <p className="text-center text-red-200 text-xs">
          Nestlé © {new Date().getFullYear()} — Sistema de Monitoreo de Precios
        </p>
      </footer>
    </div>
  );
}