import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLeadsData } from '../hooks/useHelenaData';
import { updateLeadAcuracia, updateTicketStatus } from '../services/helenaService';
import { Calendar, Search, Download, UserCircle, Building, Briefcase, Mail, Phone, ArrowRight, AlignLeft, User, CheckCircle, XCircle, RotateCcw, Ticket, Clock, Pencil } from 'lucide-react';

export default function Leads() {
  const location = useLocation();
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  
  const processedDateRange = {
    startDate: dateRange.startDate ? new Date(dateRange.startDate).toISOString() : null,
    endDate: dateRange.endDate ? new Date(dateRange.endDate + 'T23:59:59').toISOString() : null,
  };

  const { leadsList, loading, error, refetch } = useLeadsData(processedDateRange);

  useEffect(() => {
    // Escuta querystring para auto-pesquisa e auto-seleção
    const queryParams = new URLSearchParams(location.search);
    const targetId = queryParams.get('id');
    
    if (targetId && leadsList.length > 0) {
      // Confirma que o ID existe na lista recebida do backend
      const found = leadsList.find(l => String(l.id) === targetId);
      if (found) {
        setSelectedLeadId(found.id);
        // Scrollar na microtarefa depois que o DOM renderizar o item como Selected
        setTimeout(() => {
          const el = document.getElementById(`lead-item-${found.id}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [location.search, leadsList]);

  // Filter local by search text
  const filteredLeads = leadsList.filter(lead => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      (lead.nome && lead.nome.toLowerCase().includes(searchLower)) ||
      (lead.empresa && lead.empresa.toLowerCase().includes(searchLower)) ||
      (lead.telefone && String(lead.telefone).includes(searchLower)) ||
      (lead.email && lead.email.toLowerCase().includes(searchLower)) ||
      (lead.departamento && lead.departamento.toLowerCase().includes(searchLower))
    );
  });

  const selectedLead = filteredLeads.find(l => l.id === selectedLeadId) || null;
  
  const [acuraciaLocal, setAcuraciaLocal] = useState({});
  const [correctDeptText, setCorrectDeptText] = useState('');
  const [activeTabAcuracia, setActiveTabAcuracia] = useState(null); // 'correct' or 'incorrect'

  // Ticket state
  const [ticketLocal, setTicketLocal] = useState({}); // { [leadId]: { status, justificativa, updated_at } }
  const [ticketMode, setTicketMode] = useState(null); // null | 'nao_concluido'
  const [ticketJustificativa, setTicketJustificativa] = useState('');
  const [ticketSaving, setTicketSaving] = useState(false);

  const getTicketStatus = (lead) => {
    if (ticketLocal[lead.id]) return ticketLocal[lead.id];
    if (lead.ticket_status) return { status: lead.ticket_status, justificativa: lead.ticket_justificativa, updated_at: lead.ticket_updated_at };
    return null;
  };

  const handleSaveTicket = async (leadId, status) => {
    if (status === 'nao_concluido' && !ticketJustificativa.trim()) return;
    setTicketSaving(true);
    const justificativa = status === 'nao_concluido' ? ticketJustificativa.trim() : null;
    const res = await updateTicketStatus(leadId, status, justificativa);
    setTicketSaving(false);
    if (res.error || !res.success) {
      alert(`Erro ao salvar ticket.\n\nDetalhe: ${res.error}\n\nVerifique o RLS (Row Level Security) da tabela dados_pts no Supabase — é necessária uma política de UPDATE.`);
      return;
    }
    setTicketLocal(prev => ({ ...prev, [leadId]: { status, justificativa, updated_at: new Date().toISOString() } }));
    setTicketMode(null);
    setTicketJustificativa('');
    refetch();
  };

  const handleEditTicket = () => {
    setTicketMode(null);
    setTicketJustificativa('');
    // Clear local cache so user can re-choose
    if (selectedLead) {
      setTicketLocal(prev => { const n = {...prev}; delete n[selectedLead.id]; return n; });
    }
  };

  const handleSaveAcuracia = async (leadId, isCorrect) => {
    let dept = null;
    if (isCorrect === true) {
      dept = selectedLead.departamento;
    } else if (isCorrect === false) {
      dept = correctDeptText;
    }

    const res = await updateLeadAcuracia(leadId, isCorrect, dept);
    
    // Tratamento de Erro Crítico (RLS Policy)
    if (res.error || !res.success) {
      console.warn("DB Update result:", res);
      alert(`Erro Crítico Supabase!\n\nA sua classificação não foi salva no banco de dados.\nDetalhe: ${res.error}\n\nVocê precisa ir no Supabase > Table editor > dados_pts > desativar o "Row Level Security (RLS)" ou criar uma política de UPDATE.`);
      return; // Aborta e impede a UI de fingir que salvou
    }

    // Se a transferência foi sinalizada como incorreta, notifica o webhook
    if (isCorrect === false) {
      try {
        await fetch('https://webhooks.nextgoal.com.br/webhook/notifica', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            leadId,
            nome: selectedLead.nome,
            telefone: selectedLead.telefone,
            email: selectedLead.email,
            empresa: selectedLead.empresa,
            departamentoAtual: selectedLead.departamento,
            departamentoCorreto: dept,
            motivo: selectedLead.motivo,
            resumo: selectedLead.resumo
          }),
        });
      } catch (webhookErr) {
        console.error('Erro ao chamar webhook de notificação:', webhookErr);
      }
    }

    // Atualiza otimista na UI se passou com sucesso absoluto
    setAcuraciaLocal(prev => ({ ...prev, [leadId]: { isCorrect, correctDeptText: dept } }));
    setActiveTabAcuracia(null);
    setCorrectDeptText('');
    refetch(); // Recarrega para atualizar a métrica do dashboard
  };

  const handleExportCSV = () => {
    if (filteredLeads.length === 0) {
      alert("Nenhum lead para exportar.");
      return;
    }

    // Cabecalhos do CSV
    const headers = ['Data', 'Nome', 'Telefone', 'Email', 'Empresa', 'Cargo', 'Departamento', 'Motivo', 'Resumo', 'Avaliação (Correta?)', 'Depto Correto'];
    
    // Tratamento de escape de aspas e quebras de linha em cada célula
    const escapeCsv = (str) => {
      if (str == null) return '""';
      const s = String(str).replace(/"/g, '""'); // escapa aspas
      return `"${s}"`; // envolve em aspas
    };

    const csvContent = [
      headers.join(';'), // Usando Ponto e Virgula pro Excel BR
      ...filteredLeads.map(lead => {
        const rating = lead.transferencia_correta === true ? 'Sim' : (lead.transferencia_correta === false ? 'Não' : 'N/A');
        
        return [
          new Date(lead.created_at).toLocaleString('pt-BR'),
          lead.nome || '',
          lead.telefone || '',
          lead.email || '',
          lead.empresa || '',
          lead.cargo || '',
          lead.departamento || '',
          lead.motivo || '',
          lead.resumo || '',
          rating,
          lead.departamento_correto || ''
        ].map(escapeCsv).join(';');
      })
    ].join('\n');

    // Força o encode UTF-8 BOM pro Excel ler os acentos brasileiros sem bugar
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `leads_base_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      
      {/* Controle Cima: Filtros */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Lado Esquerdo: Buscador */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg-card)', padding: '8px 16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', flex: 1, maxWidth: '400px' }}>
          <Search size={18} style={{ marginRight: '12px', color: 'var(--color-text-tertiary)' }} />
          <input 
            type="text" 
            placeholder="Pesquisar leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', background: 'transparent', color: 'var(--color-text-primary)', outline: 'none', width: '100%', fontSize: '0.9rem' }}
          />
        </div>

        {/* Lado Direito: Filtros de Data e Recarregar */}
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
          
          <button onClick={refetch} style={{ color: 'var(--color-accent)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, marginLeft: '8px' }}>
            Atualizar
          </button>
        </div>
      </div>

      {/* Container Principal: Split View */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', flex: 1, minHeight: 0 }}>
        
        {/* Painel da Esquerda: Lista de Leads */}
        <div className="panel" style={{ width: '380px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div className="panel-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Leads Extraídos ({filteredLeads.length})</h3>
            <button 
              onClick={handleExportCSV}
              className="chat-send-btn" 
              style={{ width: 'auto', padding: '0 12px', background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', height: '28px', fontSize: '0.75rem' }}
            >
              <Download size={14} style={{ marginRight: '6px' }} />
              CSV
            </button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {loading ? (
               <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.85rem' }}>Carregando dados...</div>
            ) : error ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-error)', fontSize: '0.85rem' }}>Erro: {error}</div>
            ) : filteredLeads.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.85rem' }}>Nenhum lead encontrado.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {filteredLeads.map((lead, idx) => {
                  const isActive = selectedLeadId === lead.id;
                  const nameStr = lead.nome || lead.telefone || 'Lead Sem Nome';
                  const initials = nameStr.substring(0, 2).toUpperCase();
                  
                  return (
                    <div 
                      id={`lead-item-${lead.id}`}
                      key={lead.id || idx}
                      onClick={() => setSelectedLeadId(lead.id)}
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isActive ? 'var(--color-bg-active)' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'background-color 0.2s',
                        borderBottom: isActive ? 'none' : '1px solid var(--color-border-light)'
                      }}
                      onMouseOver={(e) => { if(!isActive) e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'; }}
                      onMouseOut={(e) => { if(!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--color-accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
                        {initials}
                      </div>

                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontWeight: isActive ? 700 : 600, color: isActive ? 'var(--color-text-accent)' : 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.95rem' }}>
                            {lead.nome || 'Lead Anônimo'}
                          </span>
                        </div>
                        
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {lead.empresa || lead.telefone || 'Faltam dados'}
                          </span>
                          <span style={{ flexShrink: 0, fontSize: '0.75rem' }}>
                            {new Date(lead.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                        
                        <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {lead.departamento && (
                            <span style={{ background: 'var(--color-warning)', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                              {lead.departamento}
                            </span>
                          )}
                          {(() => {
                            const ts = getTicketStatus(lead);
                            if (!ts) return <span className="ticket-badge pendente">● Pendente</span>;
                            if (ts.status === 'concluido') return <span className="ticket-badge concluido">✓ Concluído</span>;
                            if (ts.status === 'nao_concluido') return <span className="ticket-badge nao-concluido">✕ Não Concluído</span>;
                            return null;
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Painel da Direita: Detalhes do Lead (Card Expandido) */}
        <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          {!selectedLead ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', gap: '16px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--color-bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserCircle size={40} color="var(--color-text-tertiary)" />
              </div>
              <p style={{ fontSize: '1rem' }}>Selecione um lead na lista para visualizar todos os detalhes.</p>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
              
              {/* Header do Detalhe */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
                    {selectedLead.nome || 'Lead Anônimo'}
                  </h2>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', color: 'var(--color-text-tertiary)' }}>
                    <span>Entrou em: {new Date(selectedLead.created_at).toLocaleString('pt-BR')}</span>
                    {selectedLead.departamento && (
                      <>
                        <span>•</span>
                        <span style={{ background: 'var(--color-warning)', color: '#000', padding: '4px 12px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700 }}>
                          {selectedLead.departamento}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Grid de Informações Curtas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '24px', marginBottom: '40px' }}>
                
                {/* Contato */}
                <div style={{ background: 'var(--color-bg-hover)', padding: '20px', borderRadius: 'var(--radius-lg)' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <User size={16} /> Informações de Contato
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Phone size={14} color="var(--color-text-tertiary)" />
                      <span style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>{selectedLead.telefone || 'Não informado'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Mail size={14} color="var(--color-text-tertiary)" />
                      <span style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem', wordBreak: 'break-all' }}>{selectedLead.email || 'Não informado'}</span>
                    </div>
                  </div>
                </div>

                {/* Profissional */}
                <div style={{ background: 'var(--color-bg-hover)', padding: '20px', borderRadius: 'var(--radius-lg)' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <Briefcase size={16} /> Dados Profissionais
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Building size={14} color="var(--color-text-tertiary)" />
                      <span style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>{selectedLead.empresa || 'Não informada'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <UserCircle size={14} color="var(--color-text-tertiary)" />
                      <span style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>{selectedLead.cargo || 'Não informado'}</span>
                    </div>
                  </div>
                </div>

              </div>              

              {/* Blocos Descritivos Longos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                
                <div>
                  <h4 style={{ fontSize: '1.05rem', color: 'var(--color-text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <ArrowRight size={18} color="var(--color-accent)" /> Motivo do Contato
                  </h4>
                  <div style={{ background: 'var(--color-bg-hover)', padding: '24px', borderRadius: 'var(--radius-lg)', color: 'var(--color-text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                    {selectedLead.motivo || <span style={{ fontStyle: 'italic', color: 'var(--color-text-tertiary)' }}>Nenhum motivo específico registrado.</span>}
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '1.05rem', color: 'var(--color-text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <AlignLeft size={18} color="var(--color-accent)" /> Resumo Sistematizado da Conversa
                  </h4>
                  <div style={{ background: 'var(--color-bg-inner)', padding: '24px', borderRadius: 'var(--radius-lg)', color: 'var(--color-text-primary)', fontSize: '0.95rem', lineHeight: '1.8', border: '1px solid var(--color-border)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                    {selectedLead.resumo ? (
                      selectedLead.resumo.split('\n').map((paragraph, idx) => (
                        <p key={idx} style={{ marginBottom: idx === selectedLead.resumo.split('\n').length - 1 ? 0 : '16px' }}>
                          {paragraph}
                        </p>
                      ))
                    ) : (
                      <span style={{ fontStyle: 'italic', color: 'var(--color-text-tertiary)' }}>O resumo da interação não está disponível.</span>
                    )}
                  </div>
                </div>

              </div>

              {/* Box de Acurácia (Avaliação do Gestor) */}
              {selectedLead.departamento && (
                <div style={{ marginTop: '40px', background: 'var(--color-bg-hover)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                  <h4 style={{ fontSize: '1.05rem', color: 'var(--color-text-primary)', marginBottom: '8px', fontWeight: 700 }}>Avaliação de Acurácia da IA</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                    A Helena transferiu este lead para <strong>{selectedLead.departamento}</strong>. O direcionamento e a qualificação foram corretos?
                  </p>

                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    
                    {/* Botões de Ação Dinâmicos */}
                    {acuraciaLocal[selectedLead.id]?.isCorrect === true || (selectedLead.transferencia_correta === true && acuraciaLocal[selectedLead.id]?.isCorrect !== false && acuraciaLocal[selectedLead.id]?.isCorrect !== null) ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)', fontWeight: 600, fontSize: '0.9rem', padding: '8px 16px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-md)' }}>
                          <CheckCircle size={18} /> Triagem classificada como Correta!
                        </div>
                        <button onClick={() => handleSaveAcuracia(selectedLead.id, null)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-tertiary)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', textDecoration: 'underline' }}>
                          <RotateCcw size={14} /> Refazer
                        </button>
                      </div>
                    ) : acuraciaLocal[selectedLead.id]?.isCorrect === false || (selectedLead.transferencia_correta === false && acuraciaLocal[selectedLead.id]?.isCorrect !== null && acuraciaLocal[selectedLead.id]?.isCorrect !== true) ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-error)', fontWeight: 600, fontSize: '0.9rem', padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-md)' }}>
                          <XCircle size={18} /> Triagem Incorreta (Deveria ser p/ {acuraciaLocal[selectedLead.id]?.correctDeptText || selectedLead.departamento_correto})
                        </div>
                        <button onClick={() => handleSaveAcuracia(selectedLead.id, null)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-tertiary)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', textDecoration: 'underline' }}>
                          <RotateCcw size={14} /> Refazer
                        </button>
                      </div>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleSaveAcuracia(selectedLead.id, true)}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--color-success)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s' }}
                          onMouseOver={(e) => e.currentTarget.style.opacity = 0.8}
                          onMouseOut={(e) => e.currentTarget.style.opacity = 1}
                        >
                          <CheckCircle size={18} /> Sim, foi correta
                        </button>

                        <button 
                          onClick={() => setActiveTabAcuracia(activeTabAcuracia === 'incorrect' ? null : 'incorrect')}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'transparent', color: 'var(--color-error)', border: '1px solid var(--color-error)', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}
                          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <XCircle size={18} /> Não, foi incorreta
                        </button>
                      </>
                    )}

                    {/* Input se Errada */}
                    {activeTabAcuracia === 'incorrect' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', marginTop: '12px', animation: 'fadeIn 0.3s ease' }}>
                        <input 
                          type="text" 
                          placeholder="Para qual área deveria ter ido?"
                          value={correctDeptText}
                          onChange={(e) => setCorrectDeptText(e.target.value)}
                          style={{ flex: 1, maxWidth: '300px', padding: '10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-inner)', color: 'var(--color-text-primary)', outline: 'none' }}
                        />
                        <button 
                          onClick={() => handleSaveAcuracia(selectedLead.id, false)}
                          disabled={!correctDeptText.trim()}
                          style={{ padding: '10px 20px', background: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: correctDeptText.trim() ? 'pointer' : 'not-allowed', opacity: correctDeptText.trim() ? 1 : 0.5 }}
                        >
                          Salvar Correção
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ===== SEÇÃO DE TICKET DE ATENDIMENTO ===== */}
              <div className="ticket-section">
                <div className="ticket-section-header">
                  <h4 className="ticket-section-title">
                    <Ticket size={18} color="var(--color-accent)" />
                    Ticket de Atendimento
                  </h4>
                  {(() => {
                    const ts = getTicketStatus(selectedLead);
                    if (ts) {
                      if (ts.status === 'concluido') return <span className="ticket-badge concluido">✓ Concluído</span>;
                      if (ts.status === 'nao_concluido') return <span className="ticket-badge nao-concluido">✕ Não Concluído</span>;
                    }
                    return <span className="ticket-badge pendente">● Aguardando finalização</span>;
                  })()}
                </div>

                {(() => {
                  const ts = getTicketStatus(selectedLead);

                  // --- STATUS JÁ DEFINIDO ---
                  if (ts) {
                    return (
                      <>
                        <div className="ticket-status-display" style={{ marginTop: '16px' }}>
                          {ts.status === 'concluido' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', background: 'rgba(16,185,129,0.1)', borderRadius: 'var(--radius-md)', color: 'var(--color-success)', fontWeight: 600 }}>
                              <CheckCircle size={18} />
                              Ticket finalizado como Concluído
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-md)', color: 'var(--color-error)', fontWeight: 600 }}>
                              <XCircle size={18} />
                              Ticket finalizado como Não Concluído
                            </div>
                          )}
                          <button className="ticket-btn edit" onClick={handleEditTicket}>
                            <Pencil size={13} /> Editar
                          </button>
                        </div>

                        {ts.status === 'nao_concluido' && ts.justificativa && (
                          <div className="ticket-saved-justificativa">
                            <strong>Justificativa</strong>
                            {ts.justificativa}
                          </div>
                        )}

                        {ts.updated_at && (
                          <p className="ticket-updated-at">
                            <Clock size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                            Atualizado em: {new Date(ts.updated_at).toLocaleString('pt-BR')}
                          </p>
                        )}
                      </>
                    );
                  }

                  // --- AGUARDANDO AÇÃO ---
                  return (
                    <>
                      <p className="ticket-section-subtitle">
                        Registre o resultado final deste atendimento. A área responsável é <strong>{selectedLead.departamento || 'não definida'}</strong>.
                      </p>
                      <div className="ticket-actions">
                        <button
                          id={`ticket-concluido-${selectedLead.id}`}
                          className="ticket-btn concluido"
                          disabled={ticketSaving}
                          onClick={() => handleSaveTicket(selectedLead.id, 'concluido')}
                        >
                          <CheckCircle size={17} />
                          Concluído
                        </button>
                        <button
                          id={`ticket-nao-concluido-${selectedLead.id}`}
                          className="ticket-btn nao-concluido"
                          disabled={ticketSaving}
                          onClick={() => setTicketMode(ticketMode === 'nao_concluido' ? null : 'nao_concluido')}
                        >
                          <XCircle size={17} />
                          Não Concluído
                        </button>
                      </div>

                      {ticketMode === 'nao_concluido' && (
                        <div className="ticket-justificativa-box">
                          <textarea
                            id={`ticket-justificativa-${selectedLead.id}`}
                            placeholder="Descreva o motivo de não conclusão deste atendimento... (obrigatório)"
                            value={ticketJustificativa}
                            onChange={(e) => setTicketJustificativa(e.target.value)}
                            autoFocus
                          />
                          <div className="ticket-justificativa-footer">
                            <button
                              className="ticket-btn edit"
                              onClick={() => { setTicketMode(null); setTicketJustificativa(''); }}
                            >
                              Cancelar
                            </button>
                            <button
                              id={`ticket-salvar-${selectedLead.id}`}
                              className="ticket-btn concluido"
                              style={{ background: 'var(--color-error)', opacity: ticketJustificativa.trim() ? 1 : 0.5 }}
                              disabled={!ticketJustificativa.trim() || ticketSaving}
                              onClick={() => handleSaveTicket(selectedLead.id, 'nao_concluido')}
                            >
                              {ticketSaving ? 'Salvando...' : 'Salvar Justificativa'}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
