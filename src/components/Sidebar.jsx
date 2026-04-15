import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, MessageCircle, Settings, Sun, Moon, Database, LogOut } from 'lucide-react';

const LOGO_LIGHT = 'https://usxkmalddprlijlmoufd.supabase.co/storage/v1/object/public/imagens/logopts.jpeg';
const LOGO_DARK = 'https://usxkmalddprlijlmoufd.supabase.co/storage/v1/object/public/imagens/logopts1.enc';

const navItems = [
  {
    label: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
  },
  {
    label: 'Chat em Tempo Real',
    path: '/chat',
    icon: MessageCircle,
    badge: '3',
  },
  {
    label: 'Base de Leads',
    path: '/leads',
    icon: Database,
  },
  {
    label: 'Configurações',
    path: '/settings',
    icon: Settings,
  },
];

export default function Sidebar() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const logoUrl = theme === 'dark' ? LOGO_DARK : LOGO_LIGHT;
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userInitials = user?.name ? user.name.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase() : 'AD';

  return (
    <aside className="sidebar" id="sidebar">
      {/* Header / Brand */}
      <div className="sidebar-header">
        <img
          src={logoUrl}
          alt="Logo Parque Tecnológico de Sorocaba"
          className="sidebar-logo"
        />
        <div className="sidebar-brand">
          <h1>Parque Tecnológico</h1>
          <span>Sorocaba</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Menu Principal</span>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
              id={`nav-${item.path.replace('/', '') || 'dashboard'}`}
            >
              <Icon className="sidebar-link-icon" size={20} />
              <span>{item.label}</span>
              {item.badge && (
                <span className="sidebar-link-badge">{item.badge}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {/* Theme Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <div className="theme-toggle">
            <button
              className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => theme !== 'light' && toggleTheme()}
              title="Tema Claro"
              id="theme-light-btn"
            >
              <Sun size={16} />
            </button>
            <button
              className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => theme !== 'dark' && toggleTheme()}
              title="Tema Escuro"
              id="theme-dark-btn"
            >
              <Moon size={16} />
            </button>
          </div>
        </div>

        <div className="sidebar-footer-user" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
            <div className="sidebar-footer-avatar">{userInitials}</div>
            <div className="sidebar-footer-info" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span className="sidebar-footer-name">{user?.name || 'Administrador'}</span>
              <span className="sidebar-footer-role">{user?.role || 'Admin'}</span>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            style={{ background: 'transparent', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Sair"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
