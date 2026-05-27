import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTicketMetrics } from '../services/helenaService';
import {
  Calendar, RotateCw, CheckCircle, XCircle, Clock, Ticket,
  Filter, ChevronRight, Building2, TrendingUp, AlertCircle,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';

const STATUS_COLORS = {
  concluido:    '#10b981',
  nao_concluido: '#ef4444',
  pendente:     '#f59e0b',
};

const STATUS_LABELS = {
  concluido:    'Concluído',
  nao_concluido: 'Não Concluído',
  pendente:     'Pendente',
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function SkeletonBar() {
  return (
    <div style={{ height: '14px', borderRadius: '8px', background: 'var(--color-bg-hover)', animation: 'pulse 1.5s infinite', marginBottom: '8px' }} />
  );
}

function KpiCard({ icon: Icon, label, value, sub, color, id }) {
  return (
    <div
      id={id}
      className="stat-card"
      style={{ flex: '1 1 0', minWidth: '160px', borderTop: `3px solid ${color}` }}
    >
      <div className="stat-card-header">
        <div className="stat-card-icon" style={{ background: color }}>
          <Icon size={20} />
        </div>
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
      {sub && (
        <div style={{ marginTop: '6px', fontSize: '0.78rem', color: 'var(--color-text-tertiary)', fontWeight: 500 }}>{sub}</div>
      )}
    </div>
  );
}

const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const { name, value } = payload[0];
    return (
      <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
        <strong>{name}</strong>: {value}
      </div>
    );
  }
  return null;
};

export default function Tickets() {
  const navigate = useNavigate();
  const [dateRange, setDateRange]   = useState({ startDate: '', endDate: '' });
  const [areaFilter, setAreaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [rawData, setRawData]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const processedDateRange = {
    startDate: dateRange.startDate ? new Date(dateRange.startDate).toISOString() : null,
    endDate:   dateRange.endDate   ? new Date(dateRange.endDate + 'T23:59:59').toISOString() : null,
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchTicketMetrics(processedDateRange);
    if (result.error) {
      setError(result.error.message || 'Erro ao carregar métricas');
    } else {
      setRawData(result);
    }
    setLoading(false);
  }, [dateRange.startDate, dateRange.endDate]);

  useEffect(() => { load(); }, [load]);

  // ── Derived / filtered data ────────────────────────────
  const m          = rawData?.metrics;
  const areasUnicas = rawData?.areasUnicas || [];

  // Filter leads table
  const filteredLeads = (rawData?.leads || []).filter(l => {
    const ts = l.ticket_status || 'pendente';
    if (areaFilter   && l.departamento !== areaFilter) return false;
    if (statusFilter && ts !== statusFilter)           return false;
    return true;
  });

  // Pie data
  const pieData = !m ? [] : [
    { name: 'Concluído',      value: m.concluidos,    color: STATUS_COLORS.concluido },
    { name: 'Não Concluído',  value: m.naoConcluidos, color: STATUS_COLORS.nao_concluido },
    { name: 'Pendente',       value: m.pendentes,     color: STATUS_COLORS.pendente },
  ].filter(d => d.value > 0);

  // Bar data (by area, filtered)
  const barData = (rawData?.porArea || [])
    .filter(a => !areaFilter || a.area === areaFilter)
    .slice(0, 8)
    .map(a => ({ name: a.area, Concluído: a.concluidos, 'Não Concluído': a.naoConcluidos, Pendente: a.pendentes }));

  const hasData = m && m.total > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Filtros ─────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>

          {/* Período De */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg-card)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <Calendar size={15} style={{ marginRight: '8px', color: 'var(--color-text-tertiary)' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 600, marginRight: '6px', color: 'var(--color-text-secondary)' }}>De:</span>
            <input
              id="ticket-filter-start"
              type="date"
              value={dateRange.startDate}
              onChange={e => setDateRange(p => ({ ...p, startDate: e.target.value }))}
              style={{ border: 'none', background: 'transparent', color: 'var(--color-text-primary)', outline: 'none', fontSize: '0.85rem' }}
            />
          </div>

          {/* Período Até */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg-card)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, marginRight: '6px', color: 'var(--color-text-secondary)' }}>Até:</span>
            <input
              id="ticket-filter-end"
              type="date"
              value={dateRange.endDate}
              onChange={e => setDateRange(p => ({ ...p, endDate: e.target.value }))}
              style={{ border: 'none', background: 'transparent', color: 'var(--color-text-primary)', outline: 'none', fontSize: '0.85rem' }}
            />
          </div>

          {/* Área */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg-card)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', gap: '8px' }}>
            <Building2 size={15} color="var(--color-text-tertiary)" />
            <select
              id="ticket-filter-area"
              value={areaFilter}
              onChange={e => setAreaFilter(e.target.value)}
              style={{ border: 'none', background: 'transparent', color: 'var(--color-text-primary)', outline: 'none', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              <option value="">Todas as áreas</option>
              {areasUnicas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg-card)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', gap: '8px' }}>
            <Filter size={15} color="var(--color-text-tertiary)" />
            <select
              id="ticket-filter-status"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ border: 'none', background: 'transparent', color: 'var(--color-text-primary)', outline: 'none', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              <option value="">Todos os status</option>
              <option value="concluido">✓ Concluído</option>
              <option value="nao_concluido">✕ Não Concluído</option>
              <option value="pendente">● Pendente</option>
            </select>
          </div>

          {(dateRange.startDate || dateRange.endDate || areaFilter || statusFilter) && (
            <button
              onClick={() => { setDateRange({ startDate: '', endDate: '' }); setAreaFilter(''); setStatusFilter(''); }}
              style={{ fontSize: '0.78rem', color: 'var(--color-text-accent)', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Limpar filtros
            </button>
          )}
        </div>

        <button
          id="ticket-refresh-btn"
          onClick={load}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--color-text-tertiary)', cursor: 'pointer', padding: '6px 12px', borderRadius: '4px', transition: 'background 0.2s' }}
          onMouseOver={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
          onMouseOut={e  => e.currentTarget.style.background = 'transparent'}
        >
          <RotateCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '16px 20px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.875rem' }}>
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* ── KPI Cards ───────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        <KpiCard
          id="kpi-total"
          icon={Ticket}
          label="Total de Atendimentos"
          value={loading ? '...' : (m?.total ?? 0)}
          color="#3b82f6"
        />
        <KpiCard
          id="kpi-concluidos"
          icon={CheckCircle}
          label="Concluídos"
          value={loading ? '...' : (m?.concluidos ?? 0)}
          sub={!loading && m ? `${m.pctConcluido}% do total` : undefined}
          color={STATUS_COLORS.concluido}
        />
        <KpiCard
          id="kpi-nao-concluidos"
          icon={XCircle}
          label="Não Concluídos"
          value={loading ? '...' : (m?.naoConcluidos ?? 0)}
          sub={!loading && m ? `${m.pctNaoConcluido}% do total` : undefined}
          color={STATUS_COLORS.nao_concluido}
        />
        <KpiCard
          id="kpi-pendentes"
          icon={Clock}
          label="Pendentes"
          value={loading ? '...' : (m?.pendentes ?? 0)}
          sub={!loading && m ? `${m.pctPendente}% do total` : undefined}
          color={STATUS_COLORS.pendente}
        />
        <KpiCard
          id="kpi-taxa-conclusao"
          icon={TrendingUp}
          label="Taxa de Conclusão"
          value={loading ? '...' : (m && m.total > 0 ? `${m.pctConcluido}%` : '—')}
          sub={!loading && m && m.total > 0 ? `sobre ${m.total - m.pendentes} avaliados` : undefined}
          color="#8b5cf6"
        />
      </div>

      {/* ── Gráficos ────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)', gap: '16px' }}>

        {/* Pizza */}
        <div className="panel">
          <div className="panel-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Ticket size={17} color="var(--color-accent)" />
              Distribuição de Status
            </h3>
          </div>
          <div style={{ height: '280px', display: 'flex', alignItems: 'center', padding: '16px 24px' }}>
            {loading ? (
              <div style={{ width: '100%' }}><SkeletonBar /><SkeletonBar /><SkeletonBar /></div>
            ) : !hasData ? (
              <div style={{ width: '100%', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.85rem' }}>Sem dados no período.</div>
            ) : (
              <>
                <ResponsiveContainer width="55%" height="100%">
                  <PieChart>
                    <Pie data={pieData} innerRadius={55} outerRadius={82} paddingAngle={4} dataKey="value" stroke="none">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {pieData.map(d => (
                    <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                        {d.name}
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Barras por área */}
        <div className="panel">
          <div className="panel-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={17} color="var(--color-accent)" />
              Tickets por Área
            </h3>
          </div>
          <div style={{ height: '280px', padding: '16px 24px 8px' }}>
            {loading ? (
              <div><SkeletonBar /><SkeletonBar /><SkeletonBar /><SkeletonBar /></div>
            ) : barData.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.85rem', paddingTop: '60px' }}>Sem dados para exibir.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                  <XAxis type="number" stroke="var(--color-text-tertiary)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" stroke="var(--color-text-tertiary)" fontSize={11} tickLine={false} axisLine={false} width={90} />
                  <Tooltip
                    cursor={{ fill: 'var(--color-bg-hover)' }}
                    contentStyle={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', fontSize: '0.82rem' }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.78rem', paddingTop: '8px' }} />
                  <Bar dataKey="Concluído"     stackId="a" fill={STATUS_COLORS.concluido}     radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Não Concluído" stackId="a" fill={STATUS_COLORS.nao_concluido} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Pendente"      stackId="a" fill={STATUS_COLORS.pendente}      radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabela Detalhada ────────────────────────── */}
      <div className="panel">
        <div className="panel-header" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={17} color="var(--color-accent)" />
            Atendimentos Detalhados
            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text-tertiary)', marginLeft: '4px' }}>({filteredLeads.length})</span>
          </h3>
        </div>

        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '480px' }}>
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.85rem' }}>Carregando...</div>
          ) : filteredLeads.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.85rem' }}>Nenhum atendimento encontrado com os filtros aplicados.</div>
          ) : (
            <table style={{ width: '100%', minWidth: '860px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-hover)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', width: '220px', minWidth: '180px' }}>Lead</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', width: '180px', minWidth: '140px' }}>Área</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', width: '140px', minWidth: '120px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Justificativa</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', width: '145px', minWidth: '130px' }}>Finalizado em</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead, idx) => {
                  const ts = lead.ticket_status || 'pendente';
                  const badgeClass = ts === 'concluido' ? 'concluido' : ts === 'nao_concluido' ? 'nao-concluido' : 'pendente';
                  return (
                    <tr
                      key={lead.id || idx}
                      style={{ borderBottom: '1px solid var(--color-border-light)', transition: 'background 0.15s', cursor: 'pointer' }}
                      onMouseOver={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                      onMouseOut={e  => e.currentTarget.style.background = 'transparent'}
                      onClick={() => navigate(`/leads?id=${lead.id}`)}
                    >
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.nome || 'Anônimo'}</div>
                        {lead.empresa && <div style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.empresa}</div>}
                      </td>
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        {lead.departamento ? (
                          <span style={{ background: 'var(--color-warning)', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {lead.departamento}
                          </span>
                        ) : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <span className={`ticket-badge ${badgeClass}`}>
                          {STATUS_LABELS[ts]}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', maxWidth: '280px' }}>
                        {lead.ticket_justificativa
                          ? <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{lead.ticket_justificativa}</span>
                          : <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>—</span>
                        }
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                        {formatDate(lead.ticket_updated_at)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <ChevronRight size={16} color="var(--color-text-tertiary)" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
