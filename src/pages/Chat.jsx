import { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, User, Search } from 'lucide-react';
import { useChatData } from '../hooks/useHelenaData';

function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now - date;
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMins / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInDays > 0) return `${diffInDays}d`;
  if (diffInHours > 0) return `${diffInHours}h`;
  if (diffInMins > 0) return `${diffInMins}m`;
  return 'agora';
}

function cleanPhone(sessionId) {
  if (!sessionId) return 'Número desconhecido';
  return sessionId.replace('@s.whatsapp.net', '').replace('@lid', '');
}

/**
 * Função ultrarrobusta para tratar o Evolution API JSON maluco e formatar como Markdown em Blocos
 */
function processMessageBlocks(rawMessageRow, msgIndex) {
  let obj = rawMessageRow.message;
  
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj);
    } catch(e) { }
  }

  let rawString = '';
  let isBot = false;

  // 1. Extração SOMENTE do "content" ou do "text" root, IGNORANDO TODO O RESTO.
  if (obj && typeof obj === 'object') {
    if (obj.content !== undefined && obj.content !== null) {
      if (typeof obj.content === 'string') {
        rawString = obj.content;
      } else {
        // Se content for um objeto, tenta puxar o text dele
        rawString = obj.content.text || JSON.stringify(obj.content);
      }
      isBot = obj.type === 'ai';
    } else if (obj.text !== undefined && obj.text !== null) {
      rawString = typeof obj.text === 'string' ? obj.text : JSON.stringify(obj.text);
      isBot = false; // Presume-se lead se for só text e sem type
    } else {
      // Diferente de antes, não fazemos JSON.stringify do obj inteiro. Se não tiver content, é lixo sistêmico.
      return [];
    }
  } else if (typeof obj === 'string') {
    rawString = obj;
  }

  if (!rawString || rawString.trim() === '') return [];

  // 2. Limpeza de JSON vazado no "content" (Ex: {"text": "...", "previewType": 0})
  let cleanedString = rawString;
  if (cleanedString.includes('{"text":')) {
    let firstBrace = cleanedString.indexOf('{');
    let lastBrace = cleanedString.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      let possibleJson = cleanedString.substring(firstBrace, lastBrace + 1);
      try {
        let parsed = JSON.parse(possibleJson);
        if (parsed.text) {
          cleanedString = cleanedString.substring(0, firstBrace) + parsed.text + cleanedString.substring(lastBrace + 1);
        }
      } catch(e) {
        // Tenta regex como fallback
        let match = cleanedString.match(/"text"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        if (match && match[1]) {
          try {
             let unescaped = JSON.parse('"' + match[1] + '"');
             cleanedString = cleanedString.substring(0, firstBrace) + unescaped + cleanedString.substring(lastBrace + 1);
          } catch(ex) {
             cleanedString = cleanedString.substring(0, firstBrace) + match[1] + cleanedString.substring(lastBrace + 1);
          }
        }
      }
    }
  }

  // Se após a limpeza sobrou só espaço vazio, descarta o balão
  cleanedString = cleanedString.trim();
  if (!cleanedString) return [];

  // 3. Quebra em Blocos Múltiplos via \n\n (para virarem balões separados)
  const blocks = cleanedString.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);

  // 4. Mapeia cada bloco aplicando Negrito, Itálico e Quebras Múltiplas
  return blocks.map((blockTxt, blockIdx) => {
    let html = blockTxt
      // Markdown para Negrito (**texto**)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Markdown para Negrito WhatsApp (*texto*)
      .replace(/(^|\s)\*(.*?)\*(?=\s|$)/g, '$1<strong>$2</strong>')
      // Markdown para Itálico (_texto_)
      .replace(/_(.*?)_/g, '<em>$1</em>')
      // Markdown para Riscado (~texto~)
      .replace(/~(.*?)~/g, '<del>$1</del>')
      // Transformar quebras \n simples em <br/>
      .replace(/\n/g, '<br/>');

    const cssColor = isBot ? 'received' : 'sent';
    
    return {
      id: `${rawMessageRow.id || msgIndex}-${blockIdx}`,
      html: html,
      date: rawMessageRow.date,
      sender: isBot ? 'Helena' : 'Lead',
      cssColor: cssColor
    };
  });
}

export default function Chat() {
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  
  const processedDateRange = {
    startDate: dateRange.startDate ? new Date(dateRange.startDate).toISOString() : null,
    endDate: dateRange.endDate ? new Date(dateRange.endDate + 'T23:59:59').toISOString() : null,
  };

  const { conversations, loading, error, refetch } = useChatData(processedDateRange);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const messagesEndRef = useRef(null);

  // Group messages by cleaned phone number to avoid duplicates
  const groupedSessions = useMemo(() => {
    const groups = {};
    
    conversations.forEach((msg) => {
      const rawSid = msg.session_id || 'unknown';
      const cleanSid = cleanPhone(rawSid);
      if (!groups[cleanSid]) {
        groups[cleanSid] = {
          session_id: rawSid,
          displayPhone: cleanSid,
          rawMessages: [],
          lastDate: msg.date,
          count: 0
        };
      }
      groups[cleanSid].rawMessages.push(msg);
      groups[cleanSid].count += 1;
      
      if (new Date(msg.date) > new Date(groups[cleanSid].lastDate)) {
        groups[cleanSid].lastDate = msg.date;
      }
    });

    return Object.values(groups).sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));
  }, [conversations]);

  const filteredSessions = useMemo(() => {
    if (!searchTerm.trim()) return groupedSessions;
    const lowerSearch = searchTerm.toLowerCase();
    return groupedSessions.filter(session => 
      session.displayPhone.toLowerCase().includes(lowerSearch) ||
      session.session_id.toLowerCase().includes(lowerSearch)
    );
  }, [groupedSessions, searchTerm]);

  const activeSession = groupedSessions.find(s => s.displayPhone === activeSessionId);
  
  const activeMessages = useMemo(() => {
    if (!activeSession) return [];
    
    // Invertemos para ficar cronológico (ordenando por data, e por ID como desempate se as datas forem idênticas)
    const chronological = [...activeSession.rawMessages].sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return a.id - b.id;
    });
    
    // Processamos as linhas expandindo os arrays de blocos
    let finalBlocks = [];
    chronological.forEach((msgRow, index) => {
      const blocks = processMessageBlocks(msgRow, index);
      finalBlocks = finalBlocks.concat(blocks);
    });

    return finalBlocks;
  }, [activeSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* Filtro do Chat */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
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
      </div>

      <div className="chat-container" style={{ display: 'flex', flexDirection: 'row', gap: '16px', maxHeight: 'calc(100vh - 160px)', flex: 1 }}>
        
        {/* Painel da Esquerda */}
        <div className="panel" style={{ width: '320px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div className="panel-header" style={{ height: '60px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '0.9rem' }}>Conversas ({filteredSessions.length})</h3>
            <button onClick={refetch} style={{ color: 'var(--color-accent)', cursor: 'pointer', fontSize: '0.8rem' }}>Atualizar</button>
          </div>

          {/* Campo de Busca */}
          <div style={{ padding: '0 12px 12px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg-card)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <Search size={16} style={{ marginRight: '8px', color: 'var(--color-text-tertiary)' }} />
              <input 
                type="text" 
                placeholder="Buscar conversa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ border: 'none', background: 'transparent', color: 'var(--color-text-primary)', outline: 'none', width: '100%', fontSize: '0.8rem' }}
              />
            </div>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {loading && filteredSessions.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.8rem' }}>Carregando...</div>
            ) : error ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-error)', fontSize: '0.8rem' }}>{error}</div>
            ) : filteredSessions.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.8rem' }}>Nenhuma conversa encontrada.</div>
            ) : (
              filteredSessions.map((session) => {
                const isActive = activeSessionId === session.displayPhone;
                return (
                  <div
                    key={session.displayPhone}
                    onClick={() => setActiveSessionId(session.displayPhone)}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isActive ? 'var(--color-bg-active)' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '4px',
                      transition: 'background-color var(--transition-fast)'
                    }}
                    onMouseOver={(e) => { if(!isActive) e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'; }}
                    onMouseOut={(e) => { if(!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}>
                      <User size={18} />
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: isActive ? '700' : '600', color: isActive ? 'var(--color-text-accent)' : 'var(--color-text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {session.displayPhone}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                        <span>{session.count} msgs</span>
                        <span>{new Date(session.lastDate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '')}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Painel da Direita */}
        <div className="panel" id="chat-messages-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {!activeSession ? (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', flexDirection: 'column', gap: '12px' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--color-bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Search size={24} color="var(--color-text-tertiary)" />
              </div>
              <p>Selecione uma conversa na lista para visualizar o histórico.</p>
            </div>
          ) : (
            <>
              <div className="panel-header" style={{ height: '60px', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  <User size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.9rem', margin: 0, fontWeight: 700 }}>{activeSession.displayPhone}</h3>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)' }}>
                    Iniciado em: {activeSession.lastDate ? new Date(activeSession.rawMessages[activeSession.rawMessages.length - 1].date).toLocaleString('pt-BR') : ''}
                  </div>
                </div>
              </div>

              <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {activeMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.85rem' }}>O conteúdo desta conversa está vazio.</div>
                ) : (
                  activeMessages.map((msg, index) => {
                    return (
                      <div key={msg.id || index} className={`chat-message ${msg.cssColor}`} style={{ alignSelf: msg.cssColor === 'sent' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                        <div className="chat-message-content">
                          <div 
                            className="chat-message-bubble" 
                            style={
                              msg.cssColor === 'sent' 
                                ? { backgroundColor: 'var(--color-bg-hover)', color: 'var(--color-text-primary)' }
                                : { backgroundColor: 'var(--color-accent)', color: 'white', borderColor: 'var(--color-accent)' }
                            }
                            dangerouslySetInnerHTML={{ __html: msg.html }}
                          />
                          <div className="chat-message-time" style={{ textAlign: msg.cssColor === 'sent' ? 'right' : 'left', display: 'flex', justifyContent: msg.cssColor === 'sent' ? 'flex-end' : 'flex-start', gap: '4px' }}>
                            <span style={{ fontWeight: 600 }}>{msg.sender === 'Helena' ? '🤖 Helena' : '🙎‍♂️ Lead'}</span>
                            <span>·</span>
                            <span>{new Date(msg.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute:'2-digit' }).replace(',', '')}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
