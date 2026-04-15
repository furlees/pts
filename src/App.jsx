import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Leads from './pages/Leads';
import Login from './pages/Login';
import { Bell, Search } from 'lucide-react';

const pageInfo = {
  '/': { title: 'Dashboard', subtitle: 'Visão geral da plataforma' },
  '/chat': { title: 'Chat em Tempo Real', subtitle: 'Conversas com a Helena IA' },
  '/leads': { title: 'Base de Leads', subtitle: 'Consulte os atendimentos e triagens realizadas' },
  '/settings': { title: 'Configurações', subtitle: 'Gerencie suas preferências' },
};

function AppLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const currentPage = pageInfo[location.pathname] || pageInfo['/'];

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <header className="main-header">
          <div className="main-header-left">
            <div>
              <h2 style={{ fontSize: '1.25rem' }}>Bem vindo, {user?.name.split(' ')[0]}!</h2>
              <p>{currentPage.title} - {currentPage.subtitle}</p>
            </div>
          </div>
          <div className="main-header-right">
            <button className="header-icon-btn" id="btn-search" title="Buscar">
              <Search size={20} />
            </button>
            <button className="header-icon-btn" id="btn-notifications" title="Notificações">
              <Bell size={20} />
              <span className="notification-dot" />
            </button>
          </div>
        </header>
        <main className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return null; // Avoid flickering on fast reload
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
