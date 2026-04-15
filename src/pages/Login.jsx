import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Lock, Mail } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const LOGO_LIGHT = 'https://usxkmalddprlijlmoufd.supabase.co/storage/v1/object/public/imagens/logopts.jpeg';
const LOGO_DARK = 'https://usxkmalddprlijlmoufd.supabase.co/storage/v1/object/public/imagens/logopts1.enc';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const logoUrl = theme === 'dark' ? LOGO_DARK : LOGO_LIGHT;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Simulate network delay to feel authentic
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (!email || !password) {
        throw new Error('Preencha os campos obrigatórios.');
      }

      const result = login(email, password);
      
      if (result.success) {
        navigate('/'); // Redirect to dashboard
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      setError(err.message || 'Falha ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      minHeight: '100vh', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: 'var(--color-bg-body)',
      padding: '20px',
      position: 'relative'
    }}>
      {/* Background Graphic Effect */}
      <div style={{ 
        position: 'absolute', 
        top: '20%', 
        left: '20%', 
        width: '40vmax', 
        height: '40vmax', 
        background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 60%)', 
        opacity: 0.05, 
        filter: 'blur(50px)',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      <div style={{
        background: 'var(--color-bg-card)',
        padding: '40px',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        width: '100%',
        maxWidth: '420px',
        border: '1px solid var(--color-border)',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        
        <img 
          src={logoUrl} 
          alt="Parque Tecnológico de Sorocaba" 
          style={{ height: '64px', marginBottom: '16px', borderRadius: '50%' }}
        />
        
        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '4px', textAlign: 'center' }}>
          Parque Tecnológico
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)', marginBottom: '32px', textAlign: 'center' }}>
          Plataforma de Insights de IA
        </p>

        {error && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            color: '#ef4444', 
            padding: '12px 16px', 
            borderRadius: '6px', 
            fontSize: '0.85rem', 
            width: '100%', 
            marginBottom: '20px',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block' }}>E-mail corporativo</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }}>
                <Mail size={16} />
              </div>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@empresa.com"
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 38px',
                  borderRadius: '6px',
                  background: 'var(--color-bg-input)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--color-accent)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block' }}>Senha</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }}>
                <Lock size={16} />
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha secreta"
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 38px',
                  borderRadius: '6px',
                  background: 'var(--color-bg-input)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--color-accent)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                autoComplete="current-password"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, var(--color-accent) 0%, #1e40af 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '14px',
              fontSize: '0.95rem',
              fontWeight: '600',
              marginTop: '12px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'opacity 0.2s',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}
          >
            {loading ? 'Entrando...' : (
              <>
                <LogIn size={18} /> Acessar Plataforma
              </>
            )}
          </button>
        </form>
        
        <div style={{ marginTop: '32px', fontSize: '0.75rem', color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
          Sistema interno confidencial.<br/>Acessos são monitorados.
        </div>
      </div>
    </div>
  );
}
