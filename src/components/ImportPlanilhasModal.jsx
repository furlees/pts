import { useState } from 'react';
import {
  X, Cloud, Upload, History, Check, AlertTriangle,
  RefreshCw, Save, RotateCcw, FileSpreadsheet, Link2,
} from 'lucide-react';

// ── Helpers ─────────────────────────────────────────────────
function fmtData(ts) {
  if (!ts) return '—';
  try {
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

const SOURCE_LABEL = {
  google: 'Google Sheets',
  upload: 'Upload de arquivo',
  'edicao-manual': 'Edição manual',
  restauracao: 'Restauração',
  desconhecido: '—',
};

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)', background: 'var(--color-bg-input)',
  color: 'var(--color-text-primary)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
};

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px',
  borderRadius: 'var(--radius-md)', background: 'var(--color-accent)', color: '#fff',
  border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
};

const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px',
  borderRadius: 'var(--radius-md)', background: 'var(--color-bg-input)',
  color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)',
  fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
};

const label = { fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 };

// ── Component ───────────────────────────────────────────────
export default function ImportPlanilhasModal({ exec, onClose }) {
  const [tab, setTab] = useState('google');
  const [planoLink, setPlanoLink] = useState(exec.config?.planoSheet || '');
  const [dashLink, setDashLink] = useState(exec.config?.dashboardSheet || '');
  const [planoFile, setPlanoFile] = useState(null);
  const [dashFile, setDashFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const { sync } = exec;

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } catch { /* erro exibido pelo banner */ } finally { setBusy(false); }
  };

  const handleSaveConfig = () => run(() => exec.saveSheetConfig({ planoSheet: planoLink.trim(), dashboardSheet: dashLink.trim() }));
  const handleSync = () => run(async () => {
    await exec.saveSheetConfig({ planoSheet: planoLink.trim(), dashboardSheet: dashLink.trim() });
    await exec.importFromGoogle({ silent: false });
  });
  const handleUpload = () => run(() => exec.importFromUpload(planoFile, dashFile));
  const handleRestore = (entry) => run(() => exec.restoreVersion(entry));

  const TABS = [
    { id: 'google', label: 'Google Sheets', icon: <Cloud size={15} /> },
    { id: 'upload', label: 'Upload manual', icon: <Upload size={15} /> },
    { id: 'history', label: 'Histórico', icon: <History size={15} /> },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 760, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.35)', animation: 'slideDown 0.2s ease-out' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileSpreadsheet size={18} /> Importar / Sincronizar Planilhas
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', marginTop: 3 }}>
              Os indicadores do painel são alimentados pelas planilhas. Toda atualização gera uma versão no histórico.
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '12px 24px 0' }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
              border: 'none', cursor: 'pointer', fontSize: '0.83rem', fontWeight: tab === t.id ? 700 : 500,
              background: tab === t.id ? 'var(--color-bg-hover)' : 'transparent',
              color: tab === t.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              borderBottom: tab === t.id ? '2px solid var(--color-accent)' : '2px solid transparent',
            }}>{t.icon} {t.label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Status banner */}
          {sync.status !== 'idle' && sync.message && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.83rem',
              background: sync.status === 'error' ? 'rgba(239,68,68,0.1)' : sync.status === 'ok' ? 'rgba(16,185,129,0.1)' : 'var(--color-bg-hover)',
              color: sync.status === 'error' ? '#ef4444' : sync.status === 'ok' ? '#10b981' : 'var(--color-text-secondary)',
              border: `1px solid ${sync.status === 'error' ? 'rgba(239,68,68,0.3)' : sync.status === 'ok' ? 'rgba(16,185,129,0.3)' : 'var(--color-border)'}`,
            }}>
              {sync.status === 'syncing' && <RefreshCw size={15} className="spin" />}
              {sync.status === 'ok' && <Check size={15} />}
              {sync.status === 'error' && <AlertTriangle size={15} />}
              {sync.message}
            </div>
          )}

          {/* ── GOOGLE SHEETS ── */}
          {tab === 'google' && (
            <>
              {!exec.hasApiKey && (
                <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', fontSize: '0.8rem' }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>A chave da API do Google Sheets não está configurada (<code>VITE_GOOGLE_SHEETS_API_KEY</code>). Configure-a no ambiente para habilitar a sincronização automática.</span>
                </div>
              )}
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>
                Cole os links das duas planilhas no Google Sheets (compartilhadas como <strong>"qualquer pessoa com o link pode ver"</strong>). Ao abrir o painel, os números são buscados automaticamente da versão mais recente.
              </p>

              <div>
                <label style={label}><Link2 size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Planilha — Plano de Trabalho 2026 (Indicadores estratégicos)</label>
                <input style={inputStyle} value={planoLink} onChange={(e) => setPlanoLink(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." />
              </div>
              <div>
                <label style={label}><Link2 size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Planilha — DashboardInova 2026 (Indicadores operacionais)</label>
                <input style={inputStyle} value={dashLink} onChange={(e) => setDashLink(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={handleSync}>
                  <RefreshCw size={15} className={busy ? 'spin' : ''} /> Sincronizar agora
                </button>
                <button style={{ ...btnGhost, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={handleSaveConfig}>
                  <Save size={15} /> Salvar links
                </button>
              </div>
            </>
          )}

          {/* ── UPLOAD ── */}
          {tab === 'upload' && (
            <>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>
                Envie os arquivos <strong>.xlsx</strong> diretamente. Útil quando as planilhas não estão no Google Sheets. Cada importação também gera uma versão no histórico.
              </p>
              <div>
                <label style={label}>Plano de Trabalho 2026 — Indicadores (.xlsx)</label>
                <input type="file" accept=".xlsx,.xls" onChange={(e) => setPlanoFile(e.target.files?.[0] || null)} style={{ ...inputStyle, padding: 8 }} />
              </div>
              <div>
                <label style={label}>DashboardInova 2026 (.xlsx)</label>
                <input type="file" accept=".xlsx,.xls" onChange={(e) => setDashFile(e.target.files?.[0] || null)} style={{ ...inputStyle, padding: 8 }} />
              </div>
              <div>
                <button style={{ ...btnPrimary, opacity: busy || (!planoFile && !dashFile) ? 0.6 : 1 }} disabled={busy || (!planoFile && !dashFile)} onClick={handleUpload}>
                  <Upload size={15} /> Importar arquivos
                </button>
              </div>
            </>
          )}

          {/* ── HISTÓRICO ── */}
          {tab === 'history' && (
            <>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
                Cada atualização dos indicadores fica registrada aqui. Você pode restaurar uma versão anterior.
              </p>
              {exec.history.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.85rem' }}>
                  Nenhuma versão registrada ainda.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {exec.history.map((h) => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)', background: 'var(--color-bg-card)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {fmtData(h.createdAt || h.meta?.updatedAt)}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                        {SOURCE_LABEL[h.meta?.source] || h.meta?.source || '—'}
                        {h.meta?.userName ? ` · ${h.meta.userName}` : ''}
                        {h.meta?.fileNames ? ` · ${h.meta.fileNames}` : ''}
                      </div>
                    </div>
                    <button style={{ ...btnGhost, flexShrink: 0, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => handleRestore(h)}>
                      <RotateCcw size={14} /> Restaurar
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnGhost}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
