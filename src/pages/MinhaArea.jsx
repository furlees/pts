import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchTicketMetrics } from '../services/helenaService';
import { updateTicketStatus } from '../services/helenaService';
import {
  CheckCircle, XCircle, Clock, Building2, ExternalLink,
  RotateCw, AlertCircle, Ticket, ChevronDown, RotateCcw,
} from 'lucide-react';

const STATUS_CONFIG = {
  concluido:     { label: 'Concluído',      color: '#10b981', bg: 'rgba(16,185,129,0.1)',  badgeClass: 'concluido'     },
  nao_concluido: { label: 'Não Concluído',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   badgeClass: 'nao-concluido' },
  pendente:      { label: 'Pendente',       color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  badgeClass: 'pendente'      },
};

const AREA_COLORS = {
  'Administrativo':          '#10b981',
  'CEFI':                    '#64748b',
  'CET':                     '#06b6d4',
  'Comercial':               '#3b82f6',
  'Comunicação':             '#14b8a6',
  'Compras':                 '#84cc16',
  'CPL':                     '#6366f1',
  'Eventos':                 '#06b6d4',
  'Financeiro':              '#f59e0b',
  'Jurídico':                '#8b5cf6',
  'Hubiz':                   '#f97316',
  'Inovação e Projetos':     '#ec4899',
  'Parcerias Estratégicas':  '#3b82f6',
  'RH':                      '#ec4899',
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  const mins  = Math.floor(diff / 60000);
  if (days  > 0) return `Há ${days}d`;
  if (hours > 0) return `Há ${hours}h`;
  if (mins  > 0) return `Há ${mins}min`;
  return 'Agora';
}

// ── Ticket Card ────────────────────────────────────────────
function TicketCard({ lead, onStatusChange }) {
  const navigate = useNavigate();
  const ts        = lead.ticket_status || 'pendente';
  const config    = STATUS_CONFIG[ts];
  const [mode, setMode]           = useState(null); // null | 'nao_concluido'
  const [justificativa, setJustificativa] = useState('');
  const [saving, setSaving]       = useState(false);

  const handleSave = async (newStatus) => {
    if (newStatus === 'nao_concluido' && !justificativa.trim()) return;
    setSaving(true);
    const res = await updateTicketStatus(lead.id, newStatus, newStatus === 'nao_concluido' ? justificativa.trim() : null);
    setSaving(false);
    if (res.error || !res.success) {
      alert(`Erro ao salvar ticket.\n${res.error}`);
      return;
    }
    setMode(null);
    setJustificativa('');
    onStatusChange(lead.id, newStatus, newStatus === 'nao_concluido' ? justificativa.trim() : null);
  };

  const handleReset = async () => {
    setSaving(true);
    const res = await updateTicketStatus(lead.id, null, null);
    setSaving(false);
    if (!res.error && res.success) {
      onStatusChange(lead.id, null, null);
    }
  };

  return (
    <div
      style={{
        background: 'var(--color-bg-card)',
        border: `1px solid ${ts === 'pendente' ? 'var(--color-border)' : config.color + '40'}`,
        borderLeft: `4px solid ${config.color}`,
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        boxShadow: 'var(--shadow-sm)',
        transition: 'box-shadow 0.2s',
        animation: 'slideDown 0.2s ease-out',
      }}
      onMouseOver={e  => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
      onMouseOut={e   => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
    >
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lead.nome || 'Lead Anônimo'}
          </div>
          {lead.empresa && (
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-tertiary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lead.empresa}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span className={`ticket-badge ${config.badgeClass}`}>{config.label}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>{timeAgo(lead.created_at)}</span>
        </div>
      </div>

      {/* Motivo / resumo snippet */}
      {(lead.motivo || lead.resumo) && (
        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {lead.motivo || lead.resumo}
        </div>
      )}

      {/* Justificativa já salva */}
      {ts === 'nao_concluido' && lead.ticket_justificativa && (
        <div className="ticket-saved-justificativa" style={{ marginTop: 0 }}>
          <strong>Justificativa</strong>
          {lead.ticket_justificativa}
        </div>
      )}

      {/* Data de finalização */}
      {lead.ticket_updated_at && (
        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={11} /> Finalizado em: {formatDate(lead.ticket_updated_at)}
        </div>
      )}

      {/* Action area */}
      <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Inline textarea for Não Concluído */}
        {mode === 'nao_concluido' && (
          <div className="ticket-justificativa-box" style={{ marginTop: 0 }}>
            <textarea
              placeholder="Descreva o motivo de não conclusão... (obrigatório)"
              value={justificativa}
              onChange={e => setJustificativa(e.target.value)}
              autoFocus
              rows={3}
            />
            <div className="ticket-justificativa-footer">
              <button className="ticket-btn edit" onClick={() => { setMode(null); setJustificativa(''); }}>Cancelar</button>
              <button
                className="ticket-btn"
                style={{ background: '#ef4444', color: '#fff', opacity: justificativa.trim() ? 1 : 0.5 }}
                disabled={!justificativa.trim() || saving}
                onClick={() => handleSave('nao_concluido')}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}

        {/* Action buttons row */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>

          {ts === 'pendente' ? (
            <>
              <button
                id={`card-concluir-${lead.id}`}
                className="ticket-btn concluido"
                style={{ fontSize: '0.82rem', padding: '7px 14px' }}
                disabled={saving}
                onClick={() => handleSave('concluido')}
              >
                <CheckCircle size={14} /> {saving ? 'Salvando...' : 'Concluir'}
              </button>
              <button
                id={`card-nao-concluir-${lead.id}`}
                className="ticket-btn nao-concluido"
                style={{ fontSize: '0.82rem', padding: '7px 14px' }}
                disabled={saving}
                onClick={() => setMode(mode === 'nao_concluido' ? null : 'nao_concluido')}
              >
                <XCircle size={14} /> Não Concluído
              </button>
            </>
          ) : (
            <button
              className="ticket-btn edit"
              style={{ fontSize: '0.78rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
              disabled={saving}
              onClick={handleReset}
            >
              <RotateCcw size={12} /> Redefinir
            </button>
          )}

          <button
            id={`card-detalhes-${lead.id}`}
            onClick={() => navigate(`/leads?id=${lead.id}`)}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: 'var(--color-accent)', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: 'none' }}
          >
            Ver detalhes <ExternalLink size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function MinhaArea() {
  const { userArea } = useAuth();
  
  const userAreas = useMemo(() => {
    return userArea ? userArea.split(',').map(a => a.trim()).filter(Boolean) : [];
  }, [userArea]);

  const areaColor = userArea ? (AREA_COLORS[userAreas[0]] || 'var(--color-accent)') : 'var(--color-accent)';

  const [leads, setLeads]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [activeTab, setActiveTab] = useState('pendente'); // 'todos' | 'pendente' | 'concluido' | 'nao_concluido'
  const [filterArea, setFilterArea] = useState('all');

  const load = useCallback(async () => {
    if (userAreas.length === 0) return;
    setLoading(true);
    setError(null);
    const result = await fetchTicketMetrics({});
    if (result.error) {
      setError(result.error.message || 'Erro ao carregar tickets');
    } else {
      // Filter leads from any of the user's assigned areas
      const areaLeads = (result.leads || []).filter(l => userAreas.includes(l.departamento));
      // Sort: pendentes first, then by date desc
      areaLeads.sort((a, b) => {
        const aP = !a.ticket_status ? 0 : 1;
        const bP = !b.ticket_status ? 0 : 1;
        if (aP !== bP) return aP - bP;
        return new Date(b.created_at) - new Date(a.created_at);
      });
      setLeads(areaLeads);
    }
    setLoading(false);
  }, [userAreas]);

  useEffect(() => { load(); }, [load]);

  // Optimistic local update after card action
  const handleStatusChange = (leadId, newStatus, justificativa) => {
    setLeads(prev => prev.map(l =>
      l.id === leadId
        ? { ...l, ticket_status: newStatus, ticket_justificativa: justificativa, ticket_updated_at: newStatus ? new Date().toISOString() : null }
        : l
    ));
  };

  // Filtered list by area selection
  const filteredByAreaLeads = useMemo(() => {
    if (filterArea === 'all') return leads;
    return leads.filter(l => l.departamento === filterArea);
  }, [leads, filterArea]);

  // Filtered list by status tabs
  const visibleLeads = useMemo(() => {
    return activeTab === 'todos'
      ? filteredByAreaLeads
      : activeTab === 'pendente'
        ? filteredByAreaLeads.filter(l => !l.ticket_status)
        : filteredByAreaLeads.filter(l => l.ticket_status === activeTab);
  }, [filteredByAreaLeads, activeTab]);

  // KPIs based on area selection
  const total         = filteredByAreaLeads.length;
  const concluidos    = filteredByAreaLeads.filter(l => l.ticket_status === 'concluido').length;
  const naoConcluidos = filteredByAreaLeads.filter(l => l.ticket_status === 'nao_concluido').length;
  const pendentes     = filteredByAreaLeads.filter(l => !l.ticket_status).length;

  const TABS = [
    { id: 'pendente',      label: 'Pendentes',      count: pendentes,     color: '#f59e0b' },
    { id: 'concluido',     label: 'Concluídos',     count: concluidos,    color: '#10b981' },
    { id: 'nao_concluido', label: 'Não Concluídos', count: naoConcluidos, color: '#ef4444' },
    { id: 'todos',         label: 'Todos',           count: total,         color: 'var(--color-text-tertiary)' },
  ];

  if (!userArea) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '12px', color: 'var(--color-text-tertiary)' }}>
        <AlertCircle size={40} />
        <p>Nenhuma área vinculada ao seu perfil. Contacte o administrador.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Banner da área ──────────────────────────── */}
      <div style={{
        borderRadius: 'var(--radius-lg)',
        background: `linear-gradient(135deg, ${areaColor}22 0%, ${areaColor}08 100%)`,
        border: `1px solid ${areaColor}30`,
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: 'var(--radius-md)', background: areaColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Building2 size={26} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>{userAreas.join(', ')}</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
              Gerencie os tickets de atendimento da sua área
            </p>
          </div>
        </div>

        {/* Mini KPIs */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { label: 'Total',         value: total,         color: areaColor },
            { label: 'Pendentes',     value: pendentes,     color: '#f59e0b' },
            { label: 'Concluídos',    value: concluidos,    color: '#10b981' },
            { label: 'Não Concluídos', value: naoConcluidos, color: '#ef4444' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: 'var(--color-bg-card)', border: `1px solid ${kpi.color}30`, borderTop: `3px solid ${kpi.color}`, borderRadius: 'var(--radius-md)', padding: '12px 20px', textAlign: 'center', minWidth: '90px' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1 }}>
                {loading ? '…' : kpi.value}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)', marginTop: '4px', fontWeight: 500 }}>{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Refresh */}
        <button
          id="minha-area-refresh"
          onClick={load}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--color-text-tertiary)', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <RotateCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

      {/* ── Error ───────────────────────────────────── */}
      {error && (
        <div style={{ padding: '14px 18px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.875rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* ── Tabs & Area Filter ──────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '6px', width: 'fit-content', flexWrap: 'wrap' }}>
          {TABS.map(tab => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.83rem',
              fontWeight: activeTab === tab.id ? 700 : 500,
              background: activeTab === tab.id ? tab.color : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--color-text-secondary)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {tab.label}
            <span style={{
              background: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : 'var(--color-bg-hover)',
              color: activeTab === tab.id ? '#fff' : 'var(--color-text-tertiary)',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '1px 7px',
              borderRadius: '999px',
            }}>
              {loading ? '…' : tab.count}
            </span>
          </button>
        ))}
        </div>

        {/* Dropdown de filtro (só aparece se o usuário possuir mais de uma área) */}
        {userAreas.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filtrar Área:</span>
            <select
              value={filterArea}
              onChange={e => setFilterArea(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-primary)',
                fontSize: '0.83rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Todas as Minhas Áreas ({userAreas.length})</option>
              {userAreas.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Cards grid ─────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ height: '180px', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : visibleLeads.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--color-text-tertiary)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <Ticket size={40} opacity={0.3} />
          <p style={{ fontSize: '0.95rem' }}>
            {activeTab === 'pendente'
              ? 'Todos os tickets estão finalizados!'
              : 'Nenhum ticket nesta categoria.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {visibleLeads.map((lead, idx) => (
            <TicketCard
              key={lead.id || idx}
              lead={lead}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

    </div>
  );
}
