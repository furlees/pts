import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowUpRight, ArrowDownRight, MessageSquare, PhoneForwarded, Building2, TrendingUp, Activity, RotateCw, Calendar, Clock, CheckCircle, BarChart3, PieChart, Hash } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart as RechartsPie, Pie, Cell } from 'recharts';
import { useHelenaDataWithAutoRefresh } from '../hooks/useHelenaData';

const AREA_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#14b8a6'];

function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now - date;
  
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMins / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInDays > 0) return `Há ${diffInDays} d`;
  if (diffInHours > 0) return `Há ${diffInHours} h`;
  if (diffInMins > 0) return `Há ${diffInMins} min`;
  return 'Agora mesmo';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [demandView, setDemandView] = useState('hora'); // 'hora' | 'dia'
  
  // Transform empty strings to null for backend queries
  const processedDateRange = {
    startDate: dateRange.startDate ? new Date(dateRange.startDate).toISOString() : null,
    endDate: dateRange.endDate ? new Date(dateRange.endDate + 'T23:59:59').toISOString() : null,
  };

  const { data, recentActivity, loading, error, refetch } = useHelenaDataWithAutoRefresh(30000, processedDateRange);

  const stats = [
    { label: 'Leads Atendidos', value: data.leadsAtendidos.toString(), icon: MessageSquare, iconColor: 'green' },
    { label: 'Leads Transferidos', value: data.leadsTransferidos.toString(), icon: PhoneForwarded, iconColor: 'purple' },
    { label: 'Sucesso Automação', value: `${data.taxaConversao}%`, icon: TrendingUp, iconColor: 'blue' },
    { label: 'Tempo de Resposta', value: data.avgResponseTime || '0 seg', icon: Clock, iconColor: 'orange' },
    { label: 'Acurácia da Triagem', value: data.insights?.acuracia !== null && data.insights?.acuracia !== undefined ? `${data.insights.acuracia}%` : '-', icon: CheckCircle, iconColor: 'teal' },
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
  
  // Format data for PieChart
  const profileData = Object.entries(data.insights?.leadProfiles || {})
    .filter(([_, count]) => count > 0)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  if (error) {
    return (
      <div className="empty-state">
        <div style={{ color: 'var(--color-error)', marginBottom: '16px' }}>Erro ao carregar dados: {error}</div>
        <button onClick={refetch} className="chat-send-btn" style={{ width: 'auto', padding: '0 20px' }}>
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Header com Filtros */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg-card)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <Calendar size={16} style={{ marginRight: '8px', color: 'var(--color-text-tertiary)' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, marginRight: '8px', color: 'var(--color-text-secondary)' }}>De:</span>
            <input 
              type="date" 
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              style={{ border: 'none', background: 'transparent', color: 'var(--color-text-primary)', outline: 'none', fontSize: '0.85rem' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg-card)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, marginRight: '8px', color: 'var(--color-text-secondary)' }}>Até:</span>
            <input 
              type="date" 
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              style={{ border: 'none', background: 'transparent', color: 'var(--color-text-primary)', outline: 'none', fontSize: '0.85rem' }}
            />
          </div>
          {(dateRange.startDate || dateRange.endDate) && (
            <button 
              onClick={() => setDateRange({ startDate: '', endDate: '' })}
              style={{ fontSize: '0.75rem', color: 'var(--color-text-accent)', textDecoration: 'underline' }}
            >
              Limpar Filtro
            </button>
          )}
        </div>

        <button 
          onClick={refetch}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem',
            color: 'var(--color-text-tertiary)', cursor: 'pointer', padding: '6px 12px',
            borderRadius: '4px', transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <RotateCw size={14} className={loading ? 'animate-pulse' : ''} />
          {loading ? 'Atualizando...' : 'Atualizar dados'}
        </button>
      </div>

      <div className="cards-grid" style={{ display: 'flex', flexWrap: 'nowrap', width: '100%', overflowX: 'auto', gap: '20px', paddingBottom: '8px' }}>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div className="stat-card" key={stat.label} style={{ flex: '1 1 0', minWidth: '180px' }}>
              <div className="stat-card-header">
                <div className={`stat-card-icon ${stat.iconColor}`}>
                  <Icon size={22} />
                </div>
              </div>
              <div className="stat-card-value">{loading && stat.value === '0' ? '...' : stat.value}</div>
              <div className="stat-card-label">{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header" style={{ flexShrink: 0 }}>
            <h3><Activity size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-accent)' }} />Atividade Recente</h3>
          </div>
          <div className="panel-body list-body" style={{ padding: 0, height: '340px', overflowY: 'auto' }}>
            {recentActivity.length === 0 && !loading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.85rem' }}>Nenhuma atividade no período.</div>
            ) : (
              recentActivity.map((item, index) => {
                const isTransferido = !!item.departamento;
                const nomeDisplay = item.nome || 'Lead Anônimo';
                const iniciais = nomeDisplay.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || 'L';
                const actionText = isTransferido ? `Transferido p/ ${item.departamento}` : (item.motivo ? `Motivo: ${item.motivo}` : 'Atendido pela Helena');

                return (
                  <div 
                    key={item.id || index} 
                    onClick={() => navigate(`/leads?id=${item.id}`)}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 24px', 
                      borderBottom: index < recentActivity.length - 1 ? '1px solid var(--color-border-light)' : 'none', 
                      transition: 'background-color var(--transition-fast)',
                      cursor: 'pointer'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--color-accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)', fontWeight: '700', fontSize: '0.75rem', flexShrink: 0 }}>
                      {iniciais}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{nomeDisplay} {item.empresa ? `(${item.empresa})` : ''}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{actionText}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span className={`status-dot ${isTransferido ? 'online' : 'offline'}`} style={isTransferido ? { background: 'var(--color-warning)' } : {}} />
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)' }}>{formatTimeAgo(item.created_at)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header" style={{ flexShrink: 0 }}>
            <h3><Building2 size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-accent)' }} />Áreas de Transferência</h3>
          </div>
          <div className="panel-body list-body" style={{ height: '340px', overflowY: 'auto' }}>
            {data.areas.length === 0 && !loading ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.85rem', marginTop: '20px' }}>Nenhuma transferência no período.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {data.areas.map((area, idx) => {
                  const color = AREA_COLORS[idx % AREA_COLORS.length];
                  return (
                    <div key={area.area}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>{area.area}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>{area.count} leads ({area.percentage}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', borderRadius: '999px', background: 'var(--color-bg-input)', overflow: 'hidden' }}>
                        <div style={{ width: `${area.percentage}%`, height: '100%', borderRadius: '999px', background: color, transition: 'width 1s ease-out' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Seção Gráficos Analíticos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px', marginTop: '20px' }}>
        
        {/* Horários e Dias de Pico */}
        <div className="panel">
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3><BarChart3 size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-accent)' }} />Pico de Demanda</h3>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--color-bg-inner)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
              <button 
                onClick={() => setDemandView('hora')} 
                style={{ padding: '4px 12px', fontSize: '0.75rem', borderRadius: '4px', background: demandView === 'hora' ? 'var(--color-bg-card)' : 'transparent', color: demandView === 'hora' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', fontWeight: demandView === 'hora' ? 700 : 500, border: 'none', cursor: 'pointer', boxShadow: demandView === 'hora' ? 'var(--shadow-sm)' : 'none', transition: 'all 0.2s' }}>
                Por Hora
              </button>
              <button 
                onClick={() => setDemandView('dia')}
                style={{ padding: '4px 12px', fontSize: '0.75rem', borderRadius: '4px', background: demandView === 'dia' ? 'var(--color-bg-card)' : 'transparent', color: demandView === 'dia' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', fontWeight: demandView === 'dia' ? 700 : 500, border: 'none', cursor: 'pointer', boxShadow: demandView === 'dia' ? 'var(--shadow-sm)' : 'none', transition: 'all 0.2s' }}>
                Por Dia
              </button>
            </div>
          </div>
          <div className="panel-body" style={{ height: '300px', paddingTop: '24px' }}>
            {!(demandView === 'hora' ? data.insights?.peakHours : data.insights?.peakDays)?.find(p => p.count > 0) && !loading ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.85rem', marginTop: '40px' }}>Dados insuficientes.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(demandView === 'hora' ? data.insights?.peakHours : data.insights?.peakDays) || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="timeUnit" stroke="var(--color-text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'var(--color-bg-hover)' }}
                    contentStyle={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)' }}
                    itemStyle={{ color: 'var(--color-accent)' }}
                  />
                  <Bar dataKey="count" name="Qtd Leads" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Perfil do Lead */}
        <div className="panel">
          <div className="panel-header">
            <h3><PieChart size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-accent)' }} />Perfil Exato do Lead</h3>
          </div>
          <div className="panel-body" style={{ height: '300px', paddingTop: '20px', display: 'flex', alignItems: 'center' }}>
            {profileData.length === 0 && !loading ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.85rem', width: '100%' }}>Dados insuficientes para leitura.</div>
            ) : (
              <>
                <ResponsiveContainer width="50%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={profileData}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {profileData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '20px' }}>
                  {profileData.map((entry, index) => (
                    <div key={entry.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length] }} />
                        {entry.name}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{entry.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Principais Dúvidas - Full Width */}
        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-header">
            <h3><MessageSquare size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-accent)' }} />Principais Dúvidas e Intenções Identificadas</h3>
          </div>
          <div className="panel-body" style={{ padding: '24px' }}>
            {!data.insights?.topKeywords?.length && !loading ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.85rem' }}>Aguardando interações para gerar insights.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {data.insights?.topKeywords?.map((kw, idx) => (
                  <div key={kw.word} style={{ 
                    background: idx < 3 ? 'var(--color-accent)' : 'var(--color-bg-inner)', 
                    color: idx < 3 ? 'white' : 'var(--color-text-secondary)',
                    padding: '8px 16px', borderRadius: '999px', fontSize: '0.9rem', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '8px', border: idx >= 3 ? '1px solid var(--color-border)' : 'none'
                  }}>
                    <span style={{ order: 2 }}>{kw.word}</span>
                    <span style={{ 
                      order: 1,
                      background: idx < 3 ? 'rgba(255,255,255,0.2)' : 'var(--color-bg-hover)', 
                      padding: '2px 8px', borderRadius: '999px', fontSize: '0.75rem' 
                    }}>
                      {kw.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
