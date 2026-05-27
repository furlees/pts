import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, MessageCircle, Settings, Sun, Moon, Database, LogOut, BarChart2, Building2, UserCog, LayoutGrid } from 'lucide-react';

const LOGO_LIGHT = 'https://usxkmalddprlijlmoufd.supabase.co/storage/v1/object/public/imagens/logopts.jpeg';
const LOGO_DARK  = 'https://usxkmalddprlijlmoufd.supabase.co/storage/v1/object/public/imagens/logopts1.enc';

const ADMIN_NAV = [
  { label: 'Dashboard',          path: '/',          icon: LayoutDashboard },
  { label: 'Chat em Tempo Real', path: '/chat',      icon: MessageCircle, badge: '3' },
  { label: 'Base de Leads',      path: '/leads',     icon: Database },
  { label: 'Indicadores',        path: '/tickets',   icon: BarChart2 },
  { label: 'Executivo',          path: '/executivo', icon: LayoutGrid },
  { label: 'Gestão de Usuários', path: '/admin',     icon: UserCog },
  { label: 'Configurações',      path: '/settings',  icon: Settings },
];

const AREA_NAV = [
  { label: 'Minha Área',    path: '/minha-area', icon: Building2 },
  { label: 'Configurações', path: '/settings',   icon: Settings },
];

// Colour per area for the badge
const AREA_COLORS = {
  'Jurídico':              '#8b5cf6',
  'Parcerias Estratégicas': '#3b82f6',
  'Administrativo':        '#10b981',
  'Financeiro':            '#f59e0b',
  'Inovação e Projetos':   '#ec4899',
  'Comunicação':           '#14b8a6',
  'CPL':                   '#6366f1',
  'HUBIZ':                 '#f97316',
  'Cel40':                 '#64748b',
  'Compras':               '#84cc16',
  'Eventos e Comunicação': '#06b6d4',
};

export default function Sidebar() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const { user, logout, isAdmin, userArea } = useAuth();
  const navigate = useNavigate();

  const logoUrl    = theme === 'dark' ? LOGO_DARK : LOGO_LIGHT;
  const navItems   = isAdmin ? ADMIN_NAV : AREA_NAV;
  const areaColor  = userArea ? (AREA_COLORS[userArea] || 'var(--color-accent)') : null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userInitials = user?.name
    ? user.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : 'AD';

  return (
    <aside className="sidebar" id="sidebar">
      {/* Header / Brand */}
      <div className="sidebar-header">
        <img src={logoUrl} alt="Logo Parque Tecnológico de Sorocaba" className="sidebar-logo" />
        <div className="sidebar-brand">
          <h1>Parque Tecnológico</h1>
          <span>Sorocaba</span>
        </div>
      </div>

      {/* Area badge (only for area users) */}
      {!isAdmin && userArea && (
        <div style={{
          margin: '12px 16px 0',
          padding: '8px 14px',
          borderRadius: 'var(--radius-md)',
          background: `${areaColor}18`,
          border: `1px solid ${areaColor}40`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: areaColor, flexShrink: 0 }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: areaColor, lineHeight: 1.3 }}>
            {userArea}
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="sidebar-nav">
        <span className="sidebar-section-label">
          {isAdmin ? 'Menu Principal' : 'Meu Painel'}
        </span>
        {navItems.map((item) => {
          const Icon     = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
              id={`nav-${item.path.replace(/\//g, '') || 'dashboard'}`}
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
            <div
              className="sidebar-footer-avatar"
              style={areaColor ? { background: areaColor } : {}}
            >
              {userInitials}
            </div>
            <div className="sidebar-footer-info" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span className="sidebar-footer-name">{user?.name || 'Administrador'}</span>
              <span className="sidebar-footer-role">
                {isAdmin ? 'Administrador' : (userArea || 'Usuário')}
              </span>
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
