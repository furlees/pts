import { useState, useMemo, useCallback } from 'react';
import {
  ComposedChart, Area, LineChart, Line, BarChart, Bar, RadialBarChart, RadialBar,
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

function getCurvaSPlanejada(index, totalSteps = 12) {
  const factor = (1 - Math.cos((Math.PI * index) / totalSteps)) / 2;
  return Number((factor * 100).toFixed(2));
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
function Panel({ children, style = {}, ...props }) {
  return (
    <div 
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        ...style,
      }}
      {...props}
    >
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
function KpiCard({ ind, mesSelecionado, isActive, onClick }) {
  const valor = ind.valores[mesSelecionado];
  const prevMes = MESES[MESES.indexOf(mesSelecionado) - 1];
  const prevValor = prevMes ? ind.valores[prevMes] : null;
  const achievement = valor != null ? pct(valor, ind.meta) : 0;
  const c = getConceito(achievement);
  const growing = valor != null && prevValor != null && valor > prevValor;

  return (
    <Panel 
      onClick={onClick}
      style={{ 
        padding: '20px',
        cursor: 'pointer',
        border: isActive ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
        transform: isActive ? 'scale(1.02)' : 'none',
        boxShadow: isActive ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transition: 'all 0.2s ease',
      }}
    >
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
    <div style={{ 
      background: '#0a2317', 
      border: '1px solid #164e32', 
      borderRadius: 'var(--radius-md)', 
      padding: '10px 14px', 
      fontSize: '0.82rem', 
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      color: '#fff' 
    }}>
      <p style={{ fontWeight: 700, marginBottom: 6, color: '#fff', textTransform: 'capitalize' }}>{label}</p>
      {payload.map(p => {
        let displayColor = p.color;
        if (p.dataKey === 'curvaS') displayColor = '#94a3b8';
        if (p.dataKey === 'meta75') displayColor = '#fbbf24';
        
        return (
          <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: displayColor, flexShrink: 0 }} />
            <span style={{ color: '#a2c1a9' }}>{p.name}:</span>
            <span style={{ fontWeight: 700, color: '#fff' }}>
              {p.value !== null && p.value !== undefined ? `${p.value.toFixed(1)}%` : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const renderLegend = (props) => {
  const { payload } = props;
  return (
    <ul style={{ 
      display: 'flex', 
      flexWrap: 'wrap', 
      gap: '12px 18px', 
      justifyContent: 'center', 
      listStyle: 'none', 
      padding: 0, 
      margin: '12px 0 0 0', 
      fontSize: '0.82rem' 
    }}>
      {payload.map((entry, index) => {
        let color = entry.color;
        let labelText = entry.value;
        let dashArray = 'none';
        
        if (entry.dataKey === 'curvaS') {
          color = '#94a3b8';
          dashArray = '4 4';
        } else if (entry.dataKey === 'meta75') {
          color = '#fbbf24';
          dashArray = '2 2';
        } else if (entry.dataKey === 'eixoGeral') {
          color = '#adff2f';
        } else if (entry.dataKey === 'eixo1') {
          color = '#ffffff';
        } else if (entry.dataKey === 'eixo2') {
          color = '#22d3ee';
        } else if (entry.dataKey === 'eixo3') {
          color = '#fbbf24';
        } else if (entry.dataKey === 'eixo4') {
          color = '#ec4899';
        }
        
        return (
          <li key={`item-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: color, fontWeight: 700 }}>
            <svg width="18" height="6" style={{ display: 'inline-block', flexShrink: 0 }}>
              <line 
                x1="0" y1="3" x2="18" y2="3" 
                stroke={color} 
                strokeWidth={entry.dataKey === 'eixoGeral' ? 3 : 2} 
                strokeDasharray={dashArray}
              />
            </svg>
            <span>{labelText}</span>
          </li>
        );
      })}
    </ul>
  );
};

// ── Operational Dashboard Replication Components & Helpers ──

function findIndicator(data, keywords, defaultId) {
  if (!data?.indicadoresOperacionais) return null;
  const match = data.indicadoresOperacionais.find(ind => {
    const text = `${ind.nome} ${ind.descricao || ''} ${ind.observacao || ''}`.toLowerCase();
    return keywords.every(kw => text.includes(kw.toLowerCase()));
  });
  return match || data.indicadoresOperacionais.find(ind => ind.id === defaultId);
}

function getIndicatorValue(ind, selectedMonth, cumulative = false) {
  if (!ind) return 0;
  if (!cumulative) {
    return ind.valores[selectedMonth] ?? 0;
  }
  let sum = 0;
  for (const m of MESES) {
    sum += ind.valores[m] ?? 0;
    if (m === selectedMonth) break;
  }
  return sum;
}

function getCardValueInfo(data, mes, cardIndex) {
  if (!data) return { value: '—', sub: '', badge: '', badgeColor: '#ccc' };
  
  switch (cardIndex) {
    case 0: { // Residentes
      const perm = findIndicator(data, ['residentes', 'permissão'], 'op-20');
      const conc = findIndicator(data, ['residentes', 'concessão'], 'op-21');
      const vPerm = getIndicatorValue(perm, mes, false);
      const vConc = getIndicatorValue(conc, mes, false);
      return {
        value: (vPerm + vConc).toLocaleString('pt-BR'),
        sub: `${vPerm} perm. · ${vConc} conc.`,
        badge: 'ATIVO',
        badgeColor: '#adff2f',
      };
    }
    case 1: { // Memberships Ativos
      const ind = findIndicator(data, ['memberships', 'ativos'], 'op-23');
      const val = getIndicatorValue(ind, mes, false);
      return {
        value: val.toLocaleString('pt-BR'),
        sub: ind ? `Resp.: ${ind.responsavel || 'Juliana'}` : '—',
        badge: '▲ META',
        badgeColor: '#10b981',
      };
    }
    case 2: { // Startups Atendidas
      const ind = findIndicator(data, ['startups atendidas'], 'op-3');
      const val = getIndicatorValue(ind, mes, true);
      return {
        value: val.toLocaleString('pt-BR'),
        sub: ind?.observacao || 'Edital Hubiz 2026',
        badge: '▲ META',
        badgeColor: '#10b981',
      };
    }
    case 3: { // Eventos Realizados
      const ind = findIndicator(data, ['eventos realizados'], 'op-13');
      const val = getIndicatorValue(ind, mes, true);
      return {
        value: val.toLocaleString('pt-BR'),
        sub: ind ? `Resp.: ${ind.responsavel || 'Rebeca'}` : '—',
        badge: '▲ META',
        badgeColor: '#10b981',
      };
    }
    case 4: { // Visitantes — Eventos
      const ind = findIndicator(data, ['visitantes', 'eventos'], 'op-25');
      const val = getIndicatorValue(ind, mes, true);
      return {
        value: val.toLocaleString('pt-BR'),
        sub: ind ? ind.responsavel || 'Fabrício / Rebeca' : '—',
        badge: 'MONITORAR',
        badgeColor: '#3b82f6',
      };
    }
    case 5: { // Visitantes — Portaria
      const ind = findIndicator(data, ['visitantes', 'portaria'], 'op-26');
      const val = getIndicatorValue(ind, mes, true);
      return {
        value: val.toLocaleString('pt-BR'),
        sub: ind ? `Resp.: ${ind.responsavel || 'Mariane'}` : '—',
        badge: 'MONITORAR',
        badgeColor: '#3b82f6',
      };
    }
    case 6: { // Faturamento Lab
      const ind = findIndicator(data, ['faturamento', 'laboratório'], 'op-7');
      const val = getIndicatorValue(ind, mes, true);
      return {
        value: fmt(val, 'financeiro'),
        sub: ind ? `Resp.: ${ind.responsavel || 'Wallace'}` : '—',
        badge: 'FINANCEIRO',
        badgeColor: '#fbbf24',
      };
    }
    case 7: { // Faturamento Memberships
      const ind = findIndicator(data, ['memberships', 'faturamento'], 'op-8');
      const val = getIndicatorValue(ind, mes, true);
      return {
        value: fmt(val, 'financeiro'),
        sub: ind ? `Resp.: ${ind.responsavel || 'Juliana'}` : '—',
        badge: 'FINANCEIRO',
        badgeColor: '#fbbf24',
      };
    }
    case 8: { // Inovação Aplicada
      const ind1 = findIndicator(data, ['valores aplicados em inovação', 'mariane'], 'op-19');
      const ind2 = findIndicator(data, ['valores aplicados em inovação', 'priscilla'], 'op-18');
      const val1 = getIndicatorValue(ind1, mes, true);
      const val2 = getIndicatorValue(ind2, mes, true);
      return {
        value: fmt(val1 + val2, 'financeiro'),
        sub: 'Capacita + Conecta',
        badge: 'META B',
        badgeColor: '#10b981',
      };
    }
    case 9: { // Projetos Lab
      const ivan = findIndicator(data, ['número de projetos - laboratório', 'ivan'], 'op-5');
      const wall = findIndicator(data, ['número de projetos - laboratório', 'wallace'], 'op-6');
      const vIvan = getIndicatorValue(ivan, mes, true);
      const vWall = getIndicatorValue(wall, mes, true);
      return {
        value: vIvan.toLocaleString('pt-BR'),
        sub: `${vWall} convertidos em pedido`,
        badge: 'META A',
        badgeColor: '#10b981',
      };
    }
    default:
      return { value: '—', sub: '', badge: '', badgeColor: '#ccc' };
  }
}

function getEixoSubtext(data, eixoId, mes) {
  if (!data) return '';
  const e = data.eixos?.find(x => x.id === eixoId);
  if (!e) return '';
  
  const vFev = e.progressoMensal['fev'] ?? 0;
  const vMar = e.progressoMensal['mar'] ?? 0;
  
  const valDest = findIndicator(data, ['valores destinados', `eixo ${eixoId}`], `op-${13 + eixoId}`);
  const faturamento = getIndicatorValue(valDest, mes, false);
  
  return `Fev: ${vFev.toFixed(2)}% - Mar: ${vMar.toFixed(2)}% | ${fmt(faturamento, 'financeiro')}`;
}

function getEvolutionChartData(data, keywords, defaultId, isSumOfTwo = false, secondKeywords = [], secondDefaultId = '') {
  if (!data) return [];
  const ind1 = findIndicator(data, keywords, defaultId);
  const ind2 = isSumOfTwo ? findIndicator(data, secondKeywords, secondDefaultId) : null;
  
  const mesesOrdenados = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const labels = {
    jan: 'Jan', fev: 'Fev', mar: 'Mar', abr: 'Abr', mai: 'Mai', jun: 'Jun',
    jul: 'Jul', ago: 'Ago', set: 'Set', out: 'Out', nov: 'Nov', dez: 'Dez'
  };
  
  let cumulativeSum = 0;
  return mesesOrdenados.map(m => {
    const v1 = ind1 ? (ind1.valores[m] ?? 0) : 0;
    const v2 = ind2 ? (ind2.valores[m] ?? 0) : 0;
    const monthlyVal = v1 + v2;
    cumulativeSum += monthlyVal;
    return {
      mes: labels[m],
      mensal: monthlyVal,
      acumulado: cumulativeSum,
    };
  });
}

function getLargeScurveData(data) {
  if (!data) return [];
  const mesesOrdenados = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const labels = {
    jan: 'Jan', fev: 'Fev', mar: 'Mar', abr: 'Abr', mai: 'Mai', jun: 'Jun',
    jul: 'Jul', ago: 'Ago', set: 'Set', out: 'Out', nov: 'Nov', dez: 'Dez'
  };
  
  return mesesOrdenados.map((m, idx) => {
    let planned = 0;
    if (m === 'dez') {
      planned = 75.00;
    } else if (m !== 'jan') {
      planned = data.metaGlobalAcumulada?.[m] ?? (idx * (75 / 11));
    }
    
    const realized = m === 'jan' ? 0 : (data.progressoGeral?.[m] ?? 0);
    
    return {
      mes: labels[m],
      planejado: planned,
      realizado: realized,
      meta75: 75,
    };
  });
}

function getMiniScurveData(data) {
  if (!data) return [];
  const mesesOrdenados = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const labels = {
    jan: 'Jan', fev: 'Fev', mar: 'Mar', abr: 'Abr', mai: 'Mai', jun: 'Jun',
    jul: 'Jul', ago: 'Ago', set: 'Set', out: 'Out', nov: 'Nov', dez: 'Dez'
  };
  
  const e1 = data.eixos?.find(e => e.id === 1);
  const e2 = data.eixos?.find(e => e.id === 2);
  const e3 = data.eixos?.find(e => e.id === 3);
  const e4 = data.eixos?.find(e => e.id === 4);
  
  return mesesOrdenados.map((m, idx) => {
    let planned = 0;
    if (m === 'dez') {
      planned = 75.00;
    } else if (m !== 'jan') {
      planned = data.metaGlobalAcumulada?.[m] ?? (idx * (75 / 11));
    }
    
    return {
      mes: labels[m],
      planned,
      e1_real: m === 'jan' ? 0 : (e1?.progressoMensal?.[m] ?? 0),
      e2_real: m === 'jan' ? 0 : (e2?.progressoMensal?.[m] ?? 0),
      e3_real: m === 'jan' ? 0 : (e3?.progressoMensal?.[m] ?? 0),
      e4_real: m === 'jan' ? 0 : (e4?.progressoMensal?.[m] ?? 0),
    };
  });
}

function KpiCardNew({ title, valInfo }) {
  return (
    <div style={{
      background: '#0d3221',
      border: '1px solid #164e32',
      borderRadius: 'var(--radius-lg)',
      padding: '16px 20px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: '145px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a2c1a9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
      <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#ffffff', margin: '6px 0 2px 0' }}>{valInfo.value}</span>
      <span style={{ fontSize: '0.78rem', color: '#a2c1a9', marginBottom: '8px', minHeight: '1.2em' }}>{valInfo.sub}</span>
      <span style={{
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '0.68rem',
        fontWeight: 800,
        background: `${valInfo.badgeColor}15`,
        color: valInfo.badgeColor,
        border: `1px solid ${valInfo.badgeColor}35`,
        textTransform: 'uppercase',
      }}>{valInfo.badge}</span>
    </div>
  );
}

function EixoProgressNew({ title, val, sub }) {
  return (
    <div style={{
      background: '#0d3221',
      border: '1px solid #164e32',
      borderRadius: 'var(--radius-lg)',
      padding: '14px 18px',
      boxShadow: 'var(--shadow-sm)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff' }}>{title}</span>
        <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#adff2f' }}>{val.toFixed(2)}%</span>
      </div>
      <ProgressBar value={val} color="#adff2f" height={7} style={{ marginBottom: '6px' }} />
      <div style={{ fontSize: '0.7rem', color: '#a2c1a9' }}>{sub}</div>
    </div>
  );
}

function EvolutionMiniChart({ title, chartData, color, selectedMonth, unit }) {
  const mesesAbrev = {
    jan: 'Jan', fev: 'Fev', mar: 'Mar', abr: 'Abr', mai: 'Mai', jun: 'Jun',
    jul: 'Jul', ago: 'Ago', set: 'Set', out: 'Out', nov: 'Nov', dez: 'Dez'
  };
  const activeMonthLabel = mesesAbrev[selectedMonth];
  const activePoint = chartData.find(pt => pt.mes === activeMonthLabel);
  const currentAcumulado = activePoint ? activePoint.acumulado : 0;
  
  let displayVal = fmt(currentAcumulado, unit);
  if (unit === 'financeiro' && currentAcumulado >= 1000) {
    displayVal = `R$ ${(currentAcumulado / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`;
  }
  
  return (
    <div style={{
      background: '#0d3221',
      border: '1px solid #164e32',
      borderRadius: 'var(--radius-lg)',
      padding: '16px 20px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>{title}</h4>
          <span style={{ fontSize: '0.68rem', color: '#a2c1a9' }}>Jan-Dez 2026</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: color }}>
            {displayVal}
          </div>
          <span style={{ fontSize: '0.62rem', color: '#a2c1a9', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>▲ Acumulado</span>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={150}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#144e31" vertical={false} />
          <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#a2c1a9' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#a2c1a9' }} axisLine={false} tickLine={false} />
          <Tooltip 
            contentStyle={{ background: '#0a2317', border: '1px solid #164e32', borderRadius: 6, fontSize: '0.75rem', color: '#fff' }}
            labelFormatter={(label) => `Mês: ${label}`}
            formatter={(value, name) => [fmt(value, unit), name === 'mensal' ? 'Mensal' : 'Acumulado']}
          />
          <Bar dataKey="mensal" name="mensal" fill={color} opacity={0.3} radius={[2, 2, 0, 0]} barSize={12} />
          <Line type="monotone" dataKey="acumulado" name="acumulado" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function EixoMetaCard({ title, val }) {
  return (
    <div style={{
      background: '#0d3221',
      border: '1px solid #164e32',
      borderRadius: 'var(--radius-lg)',
      padding: '16px 20px',
      textAlign: 'center',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#adff2f', display: 'block', marginBottom: '4px' }}>{val.toFixed(2)}%</span>
      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', display: 'block', marginBottom: '2px' }}>{title} — Executado</span>
      <span style={{ fontSize: '0.7rem', color: '#a2c1a9' }}>Meta dez: 75%</span>
    </div>
  );
}

const renderScurveLegend = () => (
  <ul style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', listStyle: 'none', padding: 0, margin: '8px 0 0 0', fontSize: '0.78rem', color: '#a2c1a9' }}>
    <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 14, height: 3, background: '#adff2f' }} />
      <span>Planejado (Curva S)</span>
    </li>
    <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 14, height: 3, background: '#22d3ee' }} />
      <span>Realizado</span>
    </li>
    <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 14, height: 1, borderTop: '2px dotted #fbbf24' }} />
      <span>Meta 75%</span>
    </li>
  </ul>
);

const renderEixo12Legend = () => (
  <ul style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', listStyle: 'none', padding: 0, margin: '8px 0 0 0', fontSize: '0.7rem', color: '#a2c1a9' }}>
    <li style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 12, height: 1, borderTop: '2px dashed #adff2f' }} />
      <span>E1 plan</span>
    </li>
    <li style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 12, height: 2, background: '#adff2f' }} />
      <span>E1 real</span>
    </li>
    <li style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 12, height: 1, borderTop: '2px dashed #22d3ee' }} />
      <span>E2 plan</span>
    </li>
    <li style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 12, height: 2, background: '#22d3ee' }} />
      <span>E2 real</span>
    </li>
  </ul>
);

const renderEixo34Legend = () => (
  <ul style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', listStyle: 'none', padding: 0, margin: '8px 0 0 0', fontSize: '0.7rem', color: '#a2c1a9' }}>
    <li style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 12, height: 1, borderTop: '2px dashed #fbbf24' }} />
      <span>E3 plan</span>
    </li>
    <li style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 12, height: 2, background: '#fbbf24' }} />
      <span>E3 real</span>
    </li>
    <li style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 12, height: 1, borderTop: '2px dashed #f97316' }} />
      <span>E4 plan</span>
    </li>
    <li style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 12, height: 2, background: '#f97316' }} />
      <span>E4 real</span>
    </li>
  </ul>
);

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
  const [selectedOpInd, setSelectedOpInd] = useState(null);

  const activeOpIndId = selectedOpInd || data?.indicadoresOperacionais[0]?.id;
  const activeOpInd = data?.indicadoresOperacionais.find(i => i.id === activeOpIndId);

  const handleSaveEdit = useCallback((newData) => {
    exec.saveEdited(newData);
  }, [exec]);

  // ── Chart data ───────────────────────────────────────────
  const evolucaoData = useMemo(() => {
    if (!data) return [];
    
    // Marco zero: jan (Jan/26) com valores zerados para progresso acumulado
    const startPoint = {
      mes: 'jan',
      eixoGeral: 0,
      eixo1: null,
      eixo2: null,
      eixo3: null,
      eixo4: null,
      curvaS: 0,
      meta75: 75,
    };
    
    const points = MESES.map((m, idx) => {
      const step = idx + 1;
      return {
        mes: m,
        eixoGeral: data.progressoGeral?.[m],
        eixo1: data.eixos[0]?.progressoMensal[m],
        eixo2: data.eixos[1]?.progressoMensal[m],
        eixo3: data.eixos[2]?.progressoMensal[m],
        eixo4: data.eixos[3]?.progressoMensal[m],
        curvaS: getCurvaSPlanejada(step),
        meta75: 75,
      };
    });
    
    return [startPoint, ...points];
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
    
    const startPoint = {
      mes: 'jan',
      curvaS: 0,
      meta75: 75,
    };
    data.indicadoresOperacionais.forEach(ind => {
      startPoint[ind.id] = 0;
    });
    
    const points = MESES.map((m, idx) => {
      const step = idx + 1;
      const row = {
        mes: m,
        curvaS: getCurvaSPlanejada(step),
        meta75: 75,
      };
      data.indicadoresOperacionais.forEach(ind => {
        const v = ind.valores[m];
        row[ind.id] = v != null ? pct(v, ind.meta) : null;
      });
      return row;
    });
    
    return [startPoint, ...points];
  }, [data]);

  const OP_COLORS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ec4899','#14b8a6'];


  // Operational dashboard replication data
  const replicatedData = useMemo(() => {
    if (!data) return null;
    
    const largeScurve = getLargeScurveData(data);
    const miniScurves = getMiniScurveData(data);
    
    const evEventos = getEvolutionChartData(data, ['eventos realizados'], 'op-13', false);
    const evStartups = getEvolutionChartData(data, ['startups atendidas'], 'op-3', false);
    const evProjetos = getEvolutionChartData(data, ['número de projetos - laboratório', 'ivan'], 'op-5', false);
    const evVisitantesEventos = getEvolutionChartData(data, ['visitantes', 'eventos'], 'op-25', false);
    const evVisitantesPortaria = getEvolutionChartData(data, ['visitantes', 'portaria'], 'op-26', false);
    const evInovacao = getEvolutionChartData(data, ['valores aplicados em inovação', 'mariane'], 'op-19', true, ['valores aplicados em inovação', 'priscilla'], 'op-18');
    
    return {
      largeScurve,
      miniScurves,
      evEventos,
      evStartups,
      evProjetos,
      evVisitantesEventos,
      evVisitantesPortaria,
      evInovacao,
    };
  }, [data]);

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
          <Panel style={{ 
            padding: '20px 24px', 
            background: '#0d3221', 
            borderColor: '#164e32',
            boxShadow: 'var(--shadow-md)'
          }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', marginBottom: 20 }}>Evolução Mensal dos Eixos</h3>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={evolucaoData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#144e31" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#a2c1a9' }} />
                <YAxis tick={{ fontSize: 11, fill: '#a2c1a9' }} domain={[0, 100]} />
                <Tooltip content={<ChartTooltip />} />
                <Legend content={renderLegend} />
                
                {/* Eixo Geral (Area + Line) */}
                <Area 
                  type="monotone" 
                  dataKey="eixoGeral" 
                  name="Eixo Geral" 
                  stroke="#adff2f" 
                  strokeWidth={3} 
                  fill="rgba(173, 255, 47, 0.15)" 
                  dot={{ r: 4, fill: '#adff2f' }} 
                  activeDot={{ r: 6 }} 
                  connectNulls={false} 
                />
                
                {/* Eixos 1 a 4 */}
                <Line type="monotone" dataKey="eixo1" name="Eixo 1" stroke="#ffffff" strokeWidth={2.5} dot={{ r: 4, fill: '#ffffff' }} connectNulls={false} />
                <Line type="monotone" dataKey="eixo2" name="Eixo 2" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 4, fill: '#22d3ee' }} connectNulls={false} />
                <Line type="monotone" dataKey="eixo3" name="Eixo 3" stroke="#fbbf24" strokeWidth={2.5} dot={{ r: 4, fill: '#fbbf24' }} connectNulls={false} />
                <Line type="monotone" dataKey="eixo4" name="Eixo 4" stroke="#ec4899" strokeWidth={2.5} dot={{ r: 4, fill: '#ec4899' }} connectNulls={false} />
                
                {/* Curva S planejada */}
                <Line type="monotone" dataKey="curvaS" name="Curva S planejada" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls={false} />
                
                {/* Meta 75% (dez) */}
                <Line type="monotone" dataKey="meta75" name="Meta 75% (dez)" stroke="#fbbf24" strokeWidth={2} strokeDasharray="2 2" dot={false} connectNulls={false} />
              </ComposedChart>
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
      {/* ══════════════════════════════════════════════ */}
      {/* TAB OPERACIONAL                               */}
      {/* ══════════════════════════════════════════════ */}
      {activeTab === 'operacional' && replicatedData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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

          {/* SECTION 1: RESUMO DE RESULTADOS */}
          <div>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#7bc650', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #164e32', paddingBottom: '8px', marginBottom: '16px' }}>
              Resumo de Resultados — Acumulado 2026
            </h2>
            
            {/* KPI Cards Row 1 (6 columns) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 12 }}>
              <KpiCardNew title="Residentes" valInfo={getCardValueInfo(data, mesSel, 0)} />
              <KpiCardNew title="Memberships Ativos" valInfo={getCardValueInfo(data, mesSel, 1)} />
              <KpiCardNew title="Startups Atendidas" valInfo={getCardValueInfo(data, mesSel, 2)} />
              <KpiCardNew title="Eventos Realizados" valInfo={getCardValueInfo(data, mesSel, 3)} />
              <KpiCardNew title="Visitantes — Eventos" valInfo={getCardValueInfo(data, mesSel, 4)} />
              <KpiCardNew title="Visitantes — Portaria" valInfo={getCardValueInfo(data, mesSel, 5)} />
            </div>

            {/* KPI Cards Row 2 (4 columns) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 20 }}>
              <KpiCardNew title="Faturamento Lab" valInfo={getCardValueInfo(data, mesSel, 6)} />
              <KpiCardNew title="Faturamento Memberships" valInfo={getCardValueInfo(data, mesSel, 7)} />
              <KpiCardNew title="Inovação Aplicada" valInfo={getCardValueInfo(data, mesSel, 8)} />
              <KpiCardNew title="Projetos Lab" valInfo={getCardValueInfo(data, mesSel, 9)} />
            </div>

            {/* Eixo Progress Bars Row 3 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              <EixoProgressNew title="EIXO 1" val={data.eixos[0]?.progressoMensal[mesSel] ?? 0} sub={getEixoSubtext(data, 1, mesSel)} />
              <EixoProgressNew title="EIXO 2" val={data.eixos[1]?.progressoMensal[mesSel] ?? 0} sub={getEixoSubtext(data, 2, mesSel)} />
              <EixoProgressNew title="EIXO 3" val={data.eixos[2]?.progressoMensal[mesSel] ?? 0} sub={getEixoSubtext(data, 3, mesSel)} />
              <EixoProgressNew title="EIXO 4" val={data.eixos[3]?.progressoMensal[mesSel] ?? 0} sub={getEixoSubtext(data, 4, mesSel)} />
            </div>
          </div>

          {/* SECTION 2: EVOLUÇÃO MENSAL DE INDICADORES */}
          <div>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#7bc650', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #164e32', paddingBottom: '8px', marginBottom: '16px' }}>
              Evolução Mensal de Indicadores
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 12 }}>
              <EvolutionMiniChart title="Eventos Realizados" chartData={replicatedData.evEventos} color="#adff2f" selectedMonth={mesSel} unit="numero" />
              <EvolutionMiniChart title="Startups Atendidas" chartData={replicatedData.evStartups} color="#adff2f" selectedMonth={mesSel} unit="numero" />
              <EvolutionMiniChart title="Projetos Lab" chartData={replicatedData.evProjetos} color="#3b82f6" selectedMonth={mesSel} unit="numero" />
              <EvolutionMiniChart title="Visitantes — Eventos" chartData={replicatedData.evVisitantesEventos} color="#3b82f6" selectedMonth={mesSel} unit="numero" />
              <EvolutionMiniChart title="Visitantes — Portaria" chartData={replicatedData.evVisitantesPortaria} color="#3b82f6" selectedMonth={mesSel} unit="numero" />
              <EvolutionMiniChart title="Inovação Aplicada (R$)" chartData={replicatedData.evInovacao} color="#fbbf24" selectedMonth={mesSel} unit="financeiro" />
            </div>
          </div>

          {/* SECTION 3: METAS 2026 – CURVA S & ACOMPANHAMENTO */}
          <div>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#7bc650', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #164e32', paddingBottom: '8px', marginBottom: '16px' }}>
              Metas 2026 — Curva S & Acompanhamento
            </h2>
            
            {/* Eixo Meta cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 16 }}>
              <EixoMetaCard title="Eixo 1" val={data.eixos[0]?.progressoMensal[mesSel] ?? 0} />
              <EixoMetaCard title="Eixo 2" val={data.eixos[1]?.progressoMensal[mesSel] ?? 0} />
              <EixoMetaCard title="Eixo 3" val={data.eixos[2]?.progressoMensal[mesSel] ?? 0} />
              <EixoMetaCard title="Eixo 4" val={data.eixos[3]?.progressoMensal[mesSel] ?? 0} />
            </div>

            {/* Large S-Curve Chart */}
            <Panel style={{ 
              padding: '20px 24px', 
              background: '#0d3221', 
              borderColor: '#164e32',
              boxShadow: 'var(--shadow-md)',
              marginBottom: 14
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>
                    Curva S — Execução do Contrato de Gestão 2026
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: '#a2c1a9' }}>Planejado (Curva S) x Realizado x Meta 75% em Dezembro</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={replicatedData.largeScurve} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#144e31" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#a2c1a9' }} />
                  <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#a2c1a9' }} domain={[0, 80]} />
                  <Tooltip 
                    contentStyle={{ background: '#0a2317', border: '1px solid #164e32', borderRadius: 8, fontSize: '0.8rem', color: '#fff' }}
                    labelFormatter={(label) => `Mês: ${label}`}
                    formatter={(value) => [`${value.toFixed(2)}%`, 'Progresso']}
                  />
                  <Legend content={renderScurveLegend} />
                  <Line type="monotone" dataKey="planejado" name="Planejado (Curva S)" stroke="#adff2f" strokeWidth={3} dot={{ r: 4, fill: '#adff2f' }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="realizado" name="Realizado" stroke="#22d3ee" strokeWidth={3} dot={{ r: 4, fill: '#22d3ee' }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="meta75" name="Meta 75%" stroke="#fbbf24" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </Panel>

            {/* Side-by-side mini charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: 14 }}>
              {/* Eixo 1 & 2 */}
              <Panel style={{ 
                padding: '20px 24px', 
                background: '#0d3221', 
                borderColor: '#164e32',
                boxShadow: 'var(--shadow-md)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff' }}>
                      Curva S — Eixo 1 & 2
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: '#a2c1a9' }}>Planejado x Realizado</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={replicatedData.miniScurves} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#144e31" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#a2c1a9' }} />
                    <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: '#a2c1a9' }} domain={[0, 80]} />
                    <Tooltip contentStyle={{ background: '#0a2317', border: '1px solid #164e32', borderRadius: 8, fontSize: '0.75rem', color: '#fff' }} />
                    <Legend content={renderEixo12Legend} />
                    <Line type="monotone" dataKey="planned" name="E1 plan" stroke="#adff2f" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="e1_real" name="E1 real" stroke="#adff2f" strokeWidth={2.5} dot={{ r: 3, fill: '#adff2f' }} />
                    <Line type="monotone" dataKey="planned" name="E2 plan" stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="e2_real" name="E2 real" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 3, fill: '#22d3ee' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Panel>

              {/* Eixo 3 & 4 */}
              <Panel style={{ 
                padding: '20px 24px', 
                background: '#0d3221', 
                borderColor: '#164e32',
                boxShadow: 'var(--shadow-md)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff' }}>
                      Curva S — Eixo 3 & 4
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: '#a2c1a9' }}>Planejado x Realizado</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={replicatedData.miniScurves} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#144e31" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#a2c1a9' }} />
                    <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: '#a2c1a9' }} domain={[0, 80]} />
                    <Tooltip contentStyle={{ background: '#0a2317', border: '1px solid #164e32', borderRadius: 8, fontSize: '0.75rem', color: '#fff' }} />
                    <Legend content={renderEixo34Legend} />
                    <Line type="monotone" dataKey="planned" name="E3 plan" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="e3_real" name="E3 real" stroke="#fbbf24" strokeWidth={2.5} dot={{ r: 3, fill: '#fbbf24' }} />
                    <Line type="monotone" dataKey="planned" name="E4 plan" stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="e4_real" name="E4 real" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3, fill: '#f97316' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Panel>
            </div>
          </div>
        </div>
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
