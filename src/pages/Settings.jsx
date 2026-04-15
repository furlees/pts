import { useTheme } from '../contexts/ThemeContext';
import { Palette, Bell, Shield, Globe, Check } from 'lucide-react';

export default function SettingsPage() {
  const { theme, setLightTheme, setDarkTheme } = useTheme();

  return (
    <div className="settings-grid">
      {/* Appearance */}
      <div className="settings-section" id="settings-appearance">
        <div className="settings-section-header">
          <Palette size={20} className="icon" />
          <h3>Aparência</h3>
        </div>
        <div className="settings-section-body">
          <div className="settings-row">
            <div className="settings-row-info">
              <h4>Tema da Interface</h4>
              <p>Selecione o tema de sua preferência</p>
            </div>
          </div>

          <div className="theme-selector" style={{ marginTop: '16px' }}>
            <button
              className={`theme-option ${theme === 'light' ? 'active' : ''}`}
              onClick={setLightTheme}
              id="theme-option-light"
            >
              <div className="theme-option-preview light">
                <div className="mini-sidebar" />
                <div className="mini-content">
                  <div className="mini-bar" />
                  <div className="mini-bar" />
                  <div className="mini-bar" />
                </div>
              </div>
              <span className="theme-option-label">Claro</span>
              <div className="theme-option-check">
                {theme === 'light' && <Check size={14} />}
              </div>
            </button>

            <button
              className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
              onClick={setDarkTheme}
              id="theme-option-dark"
            >
              <div className="theme-option-preview dark">
                <div className="mini-sidebar" />
                <div className="mini-content">
                  <div className="mini-bar" />
                  <div className="mini-bar" />
                  <div className="mini-bar" />
                </div>
              </div>
              <span className="theme-option-label">Escuro</span>
              <div className="theme-option-check">
                {theme === 'dark' && <Check size={14} />}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="settings-section" id="settings-notifications">
        <div className="settings-section-header">
          <Bell size={20} className="icon" />
          <h3>Notificações</h3>
        </div>
        <div className="settings-section-body">
          <div className="settings-row">
            <div className="settings-row-info">
              <h4>Notificações por E-mail</h4>
              <p>Receba atualizações sobre novos leads por e-mail</p>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" defaultChecked id="toggle-email-notifications" />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="settings-row">
            <div className="settings-row-info">
              <h4>Notificações Push</h4>
              <p>Alertas em tempo real no navegador</p>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" defaultChecked id="toggle-push-notifications" />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="settings-row">
            <div className="settings-row-info">
              <h4>Sons de Notificação</h4>
              <p>Reproduzir som ao receber novas mensagens</p>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" id="toggle-sound" />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="settings-section" id="settings-security">
        <div className="settings-section-header">
          <Shield size={20} className="icon" />
          <h3>Segurança</h3>
        </div>
        <div className="settings-section-body">
          <div className="settings-row">
            <div className="settings-row-info">
              <h4>Autenticação em dois fatores</h4>
              <p>Adicione uma camada extra de proteção à sua conta</p>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" id="toggle-2fa" />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="settings-row">
            <div className="settings-row-info">
              <h4>Sessões Ativas</h4>
              <p>Gerencie dispositivos conectados</p>
            </div>
            <button
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-input)',
                color: 'var(--color-text-primary)',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              Gerenciar
            </button>
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="settings-section" id="settings-language">
        <div className="settings-section-header">
          <Globe size={20} className="icon" />
          <h3>Idioma e Região</h3>
        </div>
        <div className="settings-section-body">
          <div className="settings-row">
            <div className="settings-row-info">
              <h4>Idioma</h4>
              <p>Selecione o idioma padrão da plataforma</p>
            </div>
            <select
              defaultValue="pt-BR"
              id="language-select"
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-input)',
                color: 'var(--color-text-primary)',
                fontSize: '0.8rem',
                fontWeight: '500',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="pt-BR">Português (BR)</option>
              <option value="en-US">English (US)</option>
              <option value="es">Español</option>
            </select>
          </div>
          <div className="settings-row">
            <div className="settings-row-info">
              <h4>Fuso Horário</h4>
              <p>Configure o fuso horário da sua região</p>
            </div>
            <select
              defaultValue="America/Sao_Paulo"
              id="timezone-select"
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-input)',
                color: 'var(--color-text-primary)',
                fontSize: '0.8rem',
                fontWeight: '500',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
              <option value="America/Manaus">Manaus (GMT-4)</option>
              <option value="America/Noronha">Fernando de Noronha (GMT-2)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
