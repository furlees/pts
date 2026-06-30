import { useState, useMemo, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, RadialBarChart, RadialBar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import {
  MESES, MESES_LABEL,
  EIXO_CORES, getConceito, getProgressoAtual,
} from '../data/executivoData';
import { useAuth } from '../contexts/AuthContext';
import { useExecutivoData } from '../hooks/useExecutivoData';
import ImportPlanilhasModal from '../components/ImportPlanilhasModal';
import {
  TrendingUp, Target, ChevronDown, ChevronRight, CheckCircle,
  Circle, Pencil, X, Check, BarChart2, LayoutGrid, AlertTriangle,
  FileSpreadsheet, RefreshCw, Cloud,
} from 'lucide-react';

// ── Helpers ─────────────────────────────────────────────────
function fmt(v, unidade) {
  if (v === null || v === undefined) return '—';
  if (unidade === 'financeiro') return `R$ ${Number(v).toLocaleString('pt-BR')}`;
  if (unidade === 'percentual') return `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
  return Number(v).toLocaleString('pt-BR');
}

function pct(value, max) {
  if (!max) return 0;
  return Math.min(100, (value / max) * 100);
}

// ── Progress Bar ────────────────────────────────────────────
function ProgressBar({ value, color = 'var(--color-accent)', height = 6, style = {} }) {
  return (
    <div style={{ background: 'var(--color-bg-hover)', borderRadius: 999, height, overflow: 'hidden', ...style }}>
      <div style={{
        width: `${Math.min(100, Math.max(0, value))}%`,
        height: '100%',
        background: color,
        borderRadius: 999,
        transition: 'width 0.6s ease',
      }} />
    </div>
  );
}

// ── Conceito Badge ──────────────────────────────────────────
function ConceitoBadge({ pctValue, small }) {
  const c = getConceito(pctValue);
  return (
    <span style={{
      padding: small ? '2px 8px' : '4px 12px',
      borderRadius: 999,
      fontSize: small ? '0.72rem' : '0.8rem',
      fontWeight: 700,
      background: c.bg,
      color: c.color,
      border: `1px solid ${c.color}40`,
      whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  );
}

// ── Panel wrapper ───────────────────────────────────────────
function Panel({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--color-bg-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Meta Expandable Card ────────────────────────────────────
function MetaCard({ meta, cor }) {
  const [open, setOpen] = useState(false);
  const current = getProgressoAtual({ progresso: meta.progresso });
  const c = getConceito(current);

  return (
    <div style={{
      border: `1px solid ${open ? cor + '50' : 'var(--color-border-light)'}`,
      borderLeft: `3px solid ${cor}`,
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          padding: '14px 16px',
          background: open ? `${cor}06` : 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          textAlign: 'left',
          transition: 'background 0.15s',
        }}
      >
        {/* ID badge */}
        <span style={{
          padding: '2px 8px', borderRadius: 6,
          background: `${cor}18`, color: cor,
          fontSize: '0.75rem', fontWeight: 800, flexShrink: 0,
        }}>
          {meta.id}
        </span>

        {/* Name */}
        <span style={{ flex: 1, fontWeight: 600, fontSize: '0.88rem', color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
          {meta.nome}
        </span>

        {/* Responsavel */}
        {meta.responsavel && (
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
            {meta.responsavel}
          </span>
        )}

        {/* Progress */}
        <div style={{ width: 120, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>Progresso</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: c.color }}>{current.toFixed(1)}%</span>
          </div>
          <ProgressBar value={current} color={c.color} height={5} />
        </div>

        {/* Conceito */}
        <ConceitoBadge pctValue={current} small />

        {/* Chevron */}
        <span style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>

      {/* Expanded content */}
      {open && (
        <div style={{ padding: '16px 20px 20px', borderTop: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: '14px', animation: 'slideDown 0.2s ease-out' }}>
          {/* Justificativa */}
          {meta.justificativa && (
            <div style={{ padding: '12px 14px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderLeft: '3px solid #f59e0b', borderRadius: 'var(--radius-md)', fontSize: '0.83rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              <strong style={{ fontSize: '0.72rem', display: 'block', color: '#f59e0b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status / Justificativa</strong>
              {meta.justificativa}
            </div>
          )}

          {/* Atividades */}
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Atividades</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {meta.atividades.map((at, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {at.concluida
                    ? <CheckCircle size={16} color="#10b981" fill="rgba(16,185,129,0.15)" />
                    : <Circle size={16} color="var(--color-text-tertiary)" />
                  }
                  <span style={{ fontSize: '0.85rem', color: at.concluida ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', textDecoration: at.concluida ? 'none' : 'none' }}>
                    {at.nome}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly mini-progress */}
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Evolução Mensal</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {MESES.map(m => {
                const v = meta.progresso[m];
                if (v === null) return null;
                return (
                  <div key={m} style={{ textAlign: 'center', minWidth: 48 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)', marginBottom: 3 }}>{MESES_LABEL[m]?.slice(0, 3)}</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: cor }}>{v.toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Operational KPI Card ────────────────────────────────────
function KpiCard({ ind, mesSelecionado }) {
  const valor = ind.valores[mesSelecionado];
  const prevMes = MESES[MESES.indexOf(mesSelecionado) - 1];
  const prevValor = prevMes ? ind.valores[prevMes] : null;
  const achievement = valor != null ? pct(valor, ind.meta) : 0;
  const c = getConceito(achievement);
  const growing = valor != null && prevValor != null && valor > prevValor;

  return (
    <Panel style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-secondary)', lineHeight: 1.3, maxWidth: '65%' }}>{ind.nome}</p>
        {valor != null && prevValor != null && (
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: growing ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: 3 }}>
            <TrendingUp size={12} style={{ transform: growing ? 'none' : 'scaleY(-1)' }} />
            {growing ? '+' : ''}{fmt(valor - prevValor, ind.unidade)}
          </span>
        )}
      </div>

      <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1, marginBottom: 6 }}>
        {fmt(valor, ind.unidade)}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginBottom: 12 }}>
        Meta: {fmt(ind.meta, ind.unidade)}
      </div>

      <ProgressBar value={achievement} color={c.color} height={7} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>{achievement.toFixed(1)}% da meta</span>
        <ConceitoBadge pctValue={achievement} small />
      </div>
    </Panel>
  );
}

// ── Edit Indicator Modal ────────────────────────────────────
function EditModal({ data, onSave, onClose }) {
  const [form, setForm] = useState(() => JSON.parse(JSON.stringify(data)));

  const handleChange = (indId, mes, val) => {
    setForm(prev => ({
      ...prev,
      indicadoresOperacionais: prev.indicadoresOperacionais.map(ind =>
        ind.id !== indId ? ind : { ...ind, valores: { ...ind.valores, [mes]: val === '' ? null : Number(val) } }
      ),
    }));
  };

  const handleMetaChange = (indId, val) => {
    setForm(prev => ({
      ...prev,
      indicadoresOperacionais: prev.indicadoresOperacionais.map(ind =>
        ind.id !== indId ? ind : { ...ind, meta: val === '' ? null : Number(val) }
      ),
    }));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 700, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.35)', animation: 'slideDown 0.2s ease-out' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Editar Indicadores Operacionais</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}><X size={20} /></button>
        </div>
        <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {form.indicadoresOperacionais.map(ind => (
            <div key={ind.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
                <p style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-text-primary)' }}>{ind.nome}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>Meta (alvo):</label>
                  <input
                    type="number"
                    value={ind.meta ?? ''}
                    onChange={e => handleMetaChange(ind.id, e.target.value)}
                    placeholder="—"
                    style={{ width: 110, padding: '5px 9px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.8rem', outline: 'none' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {MESES.map(m => (
                  <div key={m}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 3 }}>{MESES_LABEL[m]}</label>
                    <input
                      type="number"
                      value={ind.valores[m] ?? ''}
                      onChange={e => handleChange(ind.id, m, e.target.value)}
                      placeholder="—"
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => { onSave(form); onClose(); }} style={{ padding: '8px 22px', borderRadius: 'var(--radius-md)', background: 'var(--color-accent)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={15} /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Custom Tooltip ──────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.82rem', boxShadow: 'var(--shadow-md)' }}>
      <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--color-text-primary)' }}>{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: 'var(--color-text-secondary)' }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{p.value?.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════
export default function ExecutivoDashboard() {
  const { user, isAdmin } = useAuth();
  const exec = useExecutivoData(user);
  const data = exec.dataset;
  const [activeTab, setActiveTab] = useState('estrategico');
  const [eixoAtivo, setEixoAtivo] = useState(1);
  const [editModal, setEditModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [mesSel, setMesSel]       = useState('abr');

  const handleSaveEdit = useCallback((newData) => {
    exec.saveEdited(newData);
  }, [exec]);

  // ── Chart data ───────────────────────────────────────────
  const evolucaoData = useMemo(() => {
    if (!data) return [];
    return MESES
      .filter(m => data.eixos.some(e => e.progressoMensal[m] !== null))
      .map(m => ({
        mes: MESES_LABEL[m],
        eixo1: data.eixos[0]?.progressoMensal[m],
        eixo2: data.eixos[1]?.progressoMensal[m],
        eixo3: data.eixos[2]?.progressoMensal[m],
        eixo4: data.eixos[3]?.progressoMensal[m],
        meta:  data.metaGlobalAcumulada?.[m],
      }));
  }, [data]);

  const eixoSelecionado = data?.eixos.find(e => e.id === eixoAtivo);

  // Pontuation table
  const tabela = useMemo(() => data ? [
    ...data.eixos.map(e => ({
      nome: `Eixo ${e.id} — ${e.nomeAbrev}`,
      cor: EIXO_CORES[e.id],
      maxima: e.pontuacao.maxima,
      alcancada: e.pontuacao.alcancada,
      pct: e.pontuacao.percentual,
    })),
    {
      nome: 'Total Geral',
      cor: 'var(--color-text-primary)',
      maxima: data.pontuacaoGlobal.maxima,
      alcancada: data.pontuacaoGlobal.alcancada,
      pct: data.pontuacaoGlobal.percentual,
      isTotal: true,
    },
  ] : [], [data]);

  // Operational chart (normalized %)
  const opChartData = useMemo(() => {
    if (!data) return [];
    return MESES
      .filter(m => data.indicadoresOperacionais.some(i => i.valores[m] !== null))
      .map(m => {
        const row = { mes: MESES_LABEL[m] };
        data.indicadoresOperacionais.forEach(ind => {
          const v = ind.valores[m];
          row[ind.id] = v != null ? pct(v, ind.meta) : null;
        });
        return row;
      });
  }, [data]);

  const OP_COLORS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ec4899','#14b8a6'];

  // ── Estado de carregamento ───────────────────────────────
  if (exec.loading || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: 14, color: 'var(--color-text-tertiary)' }}>
        <RefreshCw size={28} className="spin" />
        <p style={{ fontSize: '0.9rem' }}>Carregando indicadores...</p>
      </div>
    );
  }

  const globalConceito = getConceito(data.pontuacaoGlobal.percentual);

  const fmtUpdate = (ts) => {
    if (!ts) return null;
    try {
      const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
      return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch { return null; }
  };
  const updateLabel = fmtUpdate(exec.meta?.updatedAt);
  const SOURCE_LABEL = { google: 'Google Sheets', upload: 'upload', 'edicao-manual': 'edição manual', restauracao: 'restauração' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Barra: status de atualização + importação ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
          {exec.sync.status === 'syncing'
            ? (<><RefreshCw size={14} className="spin" /> Sincronizando com o Google Sheets...</>)
            : updateLabel
              ? (<><Cloud size={14} /> Última atualização: <strong style={{ color: 'var(--color-text-secondary)' }}>{updateLabel}</strong>
                  {exec.meta?.source && <> · via {SOURCE_LABEL[exec.meta.source] || exec.meta.source}</>}
                  {exec.meta?.userName && <> · por {exec.meta.userName}</>}</>)
              : (<><AlertTriangle size={14} /> Dados de exemplo — importe as planilhas para alimentar o painel.</>)}
        </div>
        {isAdmin && (
          <button
            id="import-planilhas-btn"
            onClick={() => setImportModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 'var(--radius-md)', background: 'var(--color-accent)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}
          >
            <FileSpreadsheet size={15} /> Importar / Sincronizar Planilhas
          </button>
        )}
      </div>

      {/* ── Tab Bar ──────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 6, width: 'fit-content' }}>
        {[
          { id: 'estrategico', label: 'Estratégico', icon: <Target size={15} /> },
          { id: 'operacional',  label: 'Operacional', icon: <BarChart2 size={15} /> },
        ].map(t => (
          <button
            key={t.id}
            id={`exec-tab-${t.id}`}
            onClick={() => setActiveTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 20px', borderRadius: 'var(--radius-md)',
              border: 'none', cursor: 'pointer', fontWeight: activeTab === t.id ? 700 : 500,
              fontSize: '0.88rem',
              background: activeTab === t.id ? 'var(--color-accent)' : 'transparent',
              color: activeTab === t.id ? '#fff' : 'var(--color-text-secondary)',
              transition: 'all 0.2s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* TAB ESTRATÉGICO                               */}
      {/* ══════════════════════════════════════════════ */}
      {activeTab === 'estrategico' && (
        <>
          {/* Section 1 — Visão Geral */}
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'stretch' }}>

            {/* Pontuação Global card */}
            <Panel style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 12, background: `linear-gradient(135deg, ${globalConceito.bg} 0%, var(--color-bg-card) 100%)`, border: `1px solid ${globalConceito.color}30` }}>
              {/* Circular gauge */}
              <div style={{ position: 'relative', width: 120, height: 120 }}>
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-bg-hover)" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" r="50" fill="none"
                    stroke={globalConceito.color} strokeWidth="10"
                    strokeDasharray={`${2 * Math.PI * 50}`}
                    strokeDashoffset={`${2 * Math.PI * 50 * (1 - data.pontuacaoGlobal.percentual / 100)}`}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, color: globalConceito.color, lineHeight: 1 }}>
                    {data.pontuacaoGlobal.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                  </span>
                </div>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pontuação Global</p>
                <p style={{ fontSize: '0.82rem', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                  {data.pontuacaoGlobal.alcancada} / {data.pontuacaoGlobal.maxima} pts
                </p>
              </div>
              <span style={{ padding: '5px 14px', borderRadius: 999, fontSize: '0.82rem', fontWeight: 800, background: globalConceito.bg, color: globalConceito.color, border: `1px solid ${globalConceito.color}40` }}>
                {globalConceito.label}
              </span>
            </Panel>

            {/* 4 Eixo mini-cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {data.eixos.map(e => {
                const cur = getProgressoAtual({ progresso: undefined, progressoMensal: e.progressoMensal });
                const cor = EIXO_CORES[e.id];
                return (
                  <button
                    key={e.id}
                    onClick={() => { setEixoAtivo(e.id); document.getElementById('eixo-selector')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                    style={{ background: 'var(--color-bg-card)', border: `1px solid var(--color-border)`, borderLeft: `4px solid ${cor}`, borderRadius: 'var(--radius-md)', padding: '16px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: 8 }}
                    onMouseOver={e2 => { e2.currentTarget.style.boxShadow = 'var(--shadow-md)'; e2.currentTarget.style.borderColor = cor; }}
                    onMouseOut={e2  => { e2.currentTarget.style.boxShadow = 'none'; e2.currentTarget.style.borderColor = 'var(--color-border)'; e2.currentTarget.style.borderLeftColor = cor; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: cor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Eixo {e.id}</span>
                      <ConceitoBadge pctValue={e.pontuacao.percentual} small />
                    </div>
                    <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>{e.nomeAbrev}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '1.3rem', fontWeight: 800, color: cor }}>{cur.toFixed(1)}%</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>{e.pontuacao.alcancada}/{e.pontuacao.maxima} pts</span>
                    </div>
                    <ProgressBar value={cur} color={cor} height={6} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2 — Linha temporal */}
          <Panel style={{ padding: '20px 24px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 20 }}>Evolução Mensal dos Eixos</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={evolucaoData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'var(--color-text-tertiary)' }} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }} domain={[0, 60]} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                {data.eixos.map(e => (
                  <Line key={e.id} type="monotone" dataKey={`eixo${e.id}`} name={`Eixo ${e.id} — ${e.nomeAbrev}`} stroke={EIXO_CORES[e.id]} strokeWidth={2.5} dot={{ r: 4, fill: EIXO_CORES[e.id] }} connectNulls={false} />
                ))}
                <Line type="monotone" dataKey="meta" name="Meta Acumulada" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 5" dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          {/* Section 3 — Eixo selector + metas */}
          <Panel style={{ padding: '20px 24px' }} id="eixo-selector-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Metas por Eixo</h3>
              {/* Eixo selector buttons */}
              <div id="eixo-selector" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {data.eixos.map(e => {
                  const cor = EIXO_CORES[e.id];
                  const sel = eixoAtivo === e.id;
                  return (
                    <button
                      key={e.id}
                      id={`eixo-btn-${e.id}`}
                      onClick={() => setEixoAtivo(e.id)}
                      style={{
                        padding: '7px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', fontWeight: sel ? 700 : 500,
                        background: sel ? cor : 'transparent',
                        color: sel ? '#fff' : 'var(--color-text-secondary)',
                        border: `1px solid ${sel ? cor : 'var(--color-border)'}`,
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}
                    >
                      Eixo {e.id}
                    </button>
                  );
                })}
              </div>
            </div>

            {eixoSelecionado && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Eixo header */}
                <div style={{ padding: '16px 18px', background: `${EIXO_CORES[eixoAtivo]}08`, border: `1px solid ${EIXO_CORES[eixoAtivo]}25`, borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: EIXO_CORES[eixoAtivo], textTransform: 'uppercase', letterSpacing: '0.05em' }}>Eixo {eixoAtivo}</span>
                      <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 3, lineHeight: 1.3 }}>{eixoSelecionado.nome}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: EIXO_CORES[eixoAtivo] }}>{getProgressoAtual({ progressoMensal: eixoSelecionado.progressoMensal }).toFixed(1)}%</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)' }}>Progresso</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>{eixoSelecionado.pontuacao.alcancada}/{eixoSelecionado.pontuacao.maxima}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)' }}>Pontos</div>
                      </div>
                      <ConceitoBadge pctValue={eixoSelecionado.pontuacao.percentual} />
                    </div>
                  </div>
                  <ProgressBar value={getProgressoAtual({ progressoMensal: eixoSelecionado.progressoMensal })} color={EIXO_CORES[eixoAtivo]} height={8} />
                </div>

                {/* Metas list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {eixoSelecionado.metas.map(m => (
                    <MetaCard key={m.id} meta={m} cor={EIXO_CORES[eixoAtivo]} />
                  ))}
                </div>
              </div>
            )}
          </Panel>

          {/* Section 4 — Tabela PESO */}
          <Panel style={{ padding: '20px 24px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 16 }}>Pontuação por Eixo (PESO)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', minWidth: 500 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-hover)' }}>
                    {['Eixo','Pontos Máximos','Pontos Obtidos','%','Conceito'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabela.map((row, i) => {
                    const ec = getConceito(row.pct);
                    return (
                      <tr
                        key={i}
                        style={{ borderBottom: `1px solid ${row.isTotal ? 'var(--color-border)' : 'var(--color-border-light)'}`, fontWeight: row.isTotal ? 800 : 400, background: row.isTotal ? 'var(--color-bg-hover)' : 'transparent' }}
                      >
                        <td style={{ padding: '12px 14px', color: row.isTotal ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {row.cor !== 'var(--color-text-primary)' && <span style={{ width: 10, height: 10, borderRadius: '50%', background: row.cor, flexShrink: 0, display: 'inline-block' }} />}
                            {row.nome}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)' }}>{row.maxima}</td>
                        <td style={{ padding: '12px 14px', color: 'var(--color-text-primary)', fontWeight: 700 }}>{row.alcancada}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: ec.color }}>{row.pct.toFixed(2)}%</td>
                        <td style={{ padding: '12px 14px' }}><ConceitoBadge pctValue={row.pct} small /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* TAB OPERACIONAL                               */}
      {/* ══════════════════════════════════════════════ */}
      {activeTab === 'operacional' && (
        <>
          {/* Filter + edit bar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select
                id="op-mes-select"
                value={mesSel}
                onChange={e => setMesSel(e.target.value)}
                style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', fontSize: '0.88rem', outline: 'none', cursor: 'pointer' }}
              >
                {MESES.map(m => (
                  <option key={m} value={m}>{MESES_LABEL[m]}</option>
                ))}
              </select>
              <select style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', fontSize: '0.88rem', outline: 'none', cursor: 'pointer' }}>
                <option>2026</option>
              </select>
            </div>
            {isAdmin && (
              <button
                id="edit-indicadores-btn"
                onClick={() => setEditModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 'var(--radius-md)', background: 'var(--color-accent)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}
              >
                <Pencil size={14} /> Editar Indicadores
              </button>
            )}
          </div>

          {/* KPI grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {data.indicadoresOperacionais.map(ind => (
              <KpiCard key={ind.id} ind={ind} mesSelecionado={mesSel} />
            ))}
          </div>

          {/* Trend chart */}
          <Panel style={{ padding: '20px 24px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 20 }}>
              Evolução dos Indicadores (% da Meta)
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={opChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'var(--color-text-tertiary)' }} />
                <YAxis tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }} domain={[0, 110]} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
                {data.indicadoresOperacionais.map((ind, i) => (
                  <Line key={ind.id} type="monotone" dataKey={ind.id} name={ind.nome} stroke={OP_COLORS[i % OP_COLORS.length]} strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          {/* Summary bar chart */}
          <Panel style={{ padding: '20px 24px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 20 }}>
              Alcance de Meta — {MESES_LABEL[mesSel]}
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={data.indicadoresOperacionais.map((ind, i) => ({
                  nome: ind.nome.length > 20 ? ind.nome.slice(0, 20) + '…' : ind.nome,
                  alcance: ind.valores[mesSel] != null ? pct(ind.valores[mesSel], ind.meta) : 0,
                  cor: OP_COLORS[i % OP_COLORS.length],
                }))}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                <XAxis dataKey="nome" tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }} domain={[0, 100]} />
                <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'Alcance']} contentStyle={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '0.82rem' }} />
                <Bar dataKey="alcance" name="Alcance da Meta" radius={[4, 4, 0, 0]}>
                  {data.indicadoresOperacionais.map((_, i) => (
                    <Cell key={i} fill={OP_COLORS[i % OP_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </>
      )}

      {/* Edit Modal */}
      {editModal && (
        <EditModal data={data} onSave={handleSaveEdit} onClose={() => setEditModal(false)} />
      )}

      {/* Import / Sync Modal */}
      {importModal && (
        <ImportPlanilhasModal exec={exec} onClose={() => { exec.clearSync(); setImportModal(false); }} />
      )}

    </div>
  );
}
