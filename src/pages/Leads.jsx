import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useLeadsData } from '../hooks/useHelenaData';
import { useAuth } from '../contexts/AuthContext';
import { updateLeadAcuracia, fetchMessagesForPhone, updateLeadFields } from '../services/helenaService';
import { Calendar, Search, Download, UserCircle, Building, Briefcase, Mail, Phone, ArrowRight, AlignLeft, User, CheckCircle, XCircle, RotateCcw, Clock, Pencil, History, Send, MessageSquare, MessageCircle, PhoneCall, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, addDoc, getDocs, query, where, doc, setDoc, onSnapshot } from 'firebase/firestore';

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
        rawString = obj.content.text || JSON.stringify(obj.content);
      }
      isBot = obj.type === 'ai';
    } else if (obj.text !== undefined && obj.text !== null) {
      rawString = typeof obj.text === 'string' ? obj.text : JSON.stringify(obj.text);
      isBot = false;
    } else {
      return [];
    }
  } else if (typeof obj === 'string') {
    rawString = obj;
  }

  if (!rawString || rawString.trim() === '') return [];

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

  cleanedString = cleanedString.trim();
  if (!cleanedString) return [];

  const blocks = cleanedString.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);

  return blocks.map((blockTxt, blockIdx) => {
    let html = blockTxt
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\s)\*(.*?)\*(?=\s|$)/g, '$1<strong>$2</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/~(.*?)~/g, '<del>$1</del>')
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

export default function Leads() {
  const { user, isAdmin, userArea, areas = [], users = [] } = useAuth();
  const location = useLocation();
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const listContainerRef = useRef(null);
  const detailsContainerRef = useRef(null);
  const lastScrollTopRef = useRef(0);
  const processedUrlIdRef = useRef(null);

  const processedDateRange = {
    startDate: dateRange.startDate ? new Date(dateRange.startDate).toISOString() : null,
    endDate: dateRange.endDate ? new Date(dateRange.endDate + 'T23:59:59').toISOString() : null,
  };

  const { leadsList = [], loading, error, refetch } = useLeadsData(processedDateRange);

  const AREAS_LIST = useMemo(() => (areas || []).map(a => a.name), [areas]);

  // Real-time contact response statuses for leads (E-mail, WhatsApp, Telefone, Presencial, etc.)
  const [responseStatuses, setResponseStatuses] = useState({});
  // Fallback compatibility with previous lead_email_status collection
  const [emailStatuses, setEmailStatuses] = useState({});

  useEffect(() => {
    if (!db) return;
    const unsubResp = onSnapshot(collection(db, 'lead_response_status'), (snapshot) => {
      const statuses = {};
      snapshot.docs.forEach(docDoc => {
        statuses[docDoc.id] = docDoc.data();
      });
      setResponseStatuses(statuses);
    });
    const unsubEmail = onSnapshot(collection(db, 'lead_email_status'), (snapshot) => {
      const statuses = {};
      snapshot.docs.forEach(docDoc => {
        statuses[docDoc.id] = docDoc.data();
      });
      setEmailStatuses(statuses);
    });
    return () => {
      unsubResp();
      unsubEmail();
    };
  }, []);

  // Real-time forwarding statuses for all leads (derived from lead_forwards)
  const [forwardStatuses, setForwardStatuses] = useState({});

  useEffect(() => {
    if (!db) return;
    const unsubForwards = onSnapshot(collection(db, 'lead_forwards'), (snapshot) => {
      const statuses = {};
      snapshot.docs.forEach(docSnap => {
        const d = docSnap.data();
        if (d.leadId) {
          const id = String(d.leadId);
          const existing = statuses[id];
          if (!existing || new Date(d.dataEnvio) > new Date(existing.dataEnvio)) {
            statuses[id] = {
              encaminhado: true,
              destinatarios: d.destinatarios,
              dataEnvio: d.dataEnvio,
              remetenteNome: d.remetenteNome
            };
          }
        }
      });
      setForwardStatuses(statuses);
    });
    return () => unsubForwards();
  }, []);

  // Rastreamento em tempo real do histórico de triagem da IA e direcionamento de leads
  const [leadTriagens, setLeadTriagens] = useState({});

  useEffect(() => {
    if (!db) return;
    const unsubTriagens = onSnapshot(collection(db, 'lead_triagens'), (snapshot) => {
      const map = {};
      snapshot.docs.forEach(docSnap => {
        map[docSnap.id] = docSnap.data();
      });
      setLeadTriagens(map);
    });
    return () => unsubTriagens();
  }, []);

  // Helper to obtain the accurate contact response status
  const getResponseStatus = (leadId) => {
    if (!leadId) return null;
    const id = String(leadId);
    if (responseStatuses[id] !== undefined) {
      return responseStatuses[id];
    }
    if (emailStatuses[id] !== undefined) {
      return emailStatuses[id];
    }
    return null;
  };

  // Save or update contact response
  const saveContactResponse = async (leadId, { respondido, canal = 'email', observacao = '', dataResposta = new Date().toISOString() }) => {
    if (!db || !leadId) return;
    try {
      const payload = {
        leadId: String(leadId),
        respondido: !!respondido,
        canal: respondido ? canal : null,
        observacao: respondido ? (observacao || '').trim() : null,
        dataResposta: respondido ? dataResposta : null,
        respondidoPor: respondido ? (user?.name || 'Sistema') : null,
        respondidoPorEmail: respondido ? (user?.email || '') : null,
        atualizadoEm: new Date().toISOString()
      };
      await setDoc(doc(db, 'lead_response_status', String(leadId)), payload);
      // Sincroniza com lead_email_status para retrocompatibilidade
      await setDoc(doc(db, 'lead_email_status', String(leadId)), {
        leadId: String(leadId),
        respondido: !!respondido,
        canal: payload.canal,
        observacao: payload.observacao,
        dataResposta: payload.dataResposta,
        respondidoPor: payload.respondidoPor
      });
      return { success: true };
    } catch (err) {
      console.error("Erro ao salvar status de resposta ao contato:", err);
      alert("Erro ao salvar status de resposta: " + (err.message || err));
      return { success: false, error: err };
    }
  };

  // State for Response Modal
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [responseForm, setResponseForm] = useState({
    canal: 'email',
    dataResposta: new Date().toISOString().slice(0, 16),
    observacao: '',
    respondido: true
  });
  const [savingResponse, setSavingResponse] = useState(false);

  const handleOpenResponseModal = (lead) => {
    const targetLead = lead || selectedLead;
    if (!targetLead) return;
    const current = getResponseStatus(targetLead.id);
    const defaultCanal = targetLead.email ? 'email' : (targetLead.telefone ? 'whatsapp' : 'email');
    setResponseForm({
      canal: current?.canal || defaultCanal,
      dataResposta: current?.dataResposta 
        ? new Date(current.dataResposta).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16),
      observacao: current?.observacao || '',
      respondido: current?.respondido !== undefined ? current.respondido : true
    });
    setShowResponseModal(true);
  };

  // Legacy Cleanup: allow resetting leads marked as 'respondido' solely by the old forward bug
  const handleResetOldForwardedStatuses = async () => {
    const suspectLeads = leadsList.filter(l => {
      const resp = getResponseStatus(l.id);
      return resp?.respondido && !resp?.canal;
    });

    if (suspectLeads.length === 0) {
      alert("Nenhum lead com marcação legada/automática antiga encontrado. Todos os registros atuais já possuem canal de contato ou estão pendentes!");
      return;
    }

    if (!window.confirm(`Foram identificados ${suspectLeads.length} leads marcados como 'Respondidos' pelo antigo sistema ao encaminhar, sem registro real de resposta ao cliente.\n\nDeseja redefini-los para 'Sem Resposta ao Contato'?`)) {
      return;
    }

    let count = 0;
    for (const lead of suspectLeads) {
      await saveContactResponse(lead.id, { respondido: false });
      count++;
    }
    alert(`Sucesso! ${count} leads foram redefinidos para 'Sem Resposta ao Contato'.`);
  };

  // Load editing/auditing history for the selected lead
  const [editHistory, setEditHistory] = useState([]);
  const [loadingEditHistory, setLoadingEditHistory] = useState(false);
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [editForm, setEditForm] = useState({ nome: '', empresa: '', telefone: '', email: '', cargo: '', departamento: '', motivo: '', resumo: '' });
  const [savingLeadEdits, setSavingLeadEdits] = useState(false);

  useEffect(() => {
    if (!selectedLeadId) {
      setEditHistory([]);
      return;
    }

    const fetchEditHistory = async () => {
      if (!db) {
        console.warn("Firestore db is not initialized.");
        return;
      }
      setLoadingEditHistory(true);
      try {
        const q = query(
          collection(db, 'lead_edits'),
          where('leadId', '==', selectedLeadId)
        );
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        list.sort((a, b) => new Date(b.dataAlteracao) - new Date(a.dataAlteracao));
        setEditHistory(list);
      } catch (err) {
        console.error("Erro ao buscar histórico de auditoria:", err);
      } finally {
        setLoadingEditHistory(false);
      }
    };

    fetchEditHistory();
  }, [selectedLeadId]);

  useEffect(() => {
    const selectedLead = leadsList.find(l => l.id === selectedLeadId) || null;
    if (selectedLead) {
      setEditForm({
        nome: selectedLead.nome || '',
        empresa: selectedLead.empresa || '',
        telefone: selectedLead.telefone || '',
        email: selectedLead.email || '',
        cargo: selectedLead.cargo || '',
        departamento: selectedLead.departamento || '',
        motivo: selectedLead.motivo || '',
        resumo: selectedLead.resumo || ''
      });
      setIsEditingLead(false);
    } else {
      setIsEditingLead(false);
    }
    setEditingAcuraciaLeadId(null);
    setActiveTabAcuracia(null);
    setSelectedCorrectDept('');
  }, [selectedLeadId, leadsList]);

  const handleSaveLeadEdits = async () => {
    const selectedLead = leadsList.find(l => l.id === selectedLeadId) || null;
    if (!selectedLead) return;

    // Calculate changes
    const changes = {};
    const updatedFields = {};

    const fieldsToCheck = ['nome', 'empresa', 'telefone', 'email', 'cargo', 'departamento', 'motivo', 'resumo'];
    fieldsToCheck.forEach(field => {
      const oldValue = selectedLead[field] || '';
      const newValue = editForm[field] || '';
      if (oldValue !== newValue) {
        changes[field] = { antes: oldValue, depois: newValue };
        updatedFields[field] = newValue;
      }
    });

    if (Object.keys(changes).length === 0) {
      setIsEditingLead(false);
      return;
    }

    setSavingLeadEdits(true);
    try {
      // Save log to Firestore for traceability
      const auditLog = {
        leadId: selectedLead.id,
        leadNome: selectedLead.nome || 'Anônimo',
        editorNome: user?.name || 'Administrador',
        editorEmail: user?.email || '',
        dataAlteracao: new Date().toISOString(),
        alteracoes: changes
      };

      if (db) {
        await addDoc(collection(db, 'lead_edits'), auditLog);
      }

      // Update in Supabase
      const res = await updateLeadFields(selectedLead.id, updatedFields);
      if (res.error) throw res.error;

      // Update local history
      setEditHistory(prev => [{ id: `local_edit_${Date.now()}`, ...auditLog }, ...prev]);

      await refetch(true);
      setIsEditingLead(false);
    } catch (err) {
      console.error("Erro ao salvar alterações no lead:", err);
      alert("Erro ao salvar alterações no banco de dados.");
    } finally {
      setSavingLeadEdits(false);
    }
  };

  // Forwarding states
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardRecipients, setForwardRecipients] = useState('');
  const [forwardHistory, setForwardHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sendingForward, setSendingForward] = useState(false);
  const [emailProvider, setEmailProvider] = useState('gmail');
  const [forwardStep, setForwardStep] = useState('input'); // 'input' or 'success'

  // Chat message states
  const [chatMessages, setChatMessages] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [includeChatHistory, setIncludeChatHistory] = useState(true);
  const [showChatModal, setShowChatModal] = useState(false);

  const formattedChatMessages = useMemo(() => {
    const sorted = [...chatMessages].sort((a, b) => new Date(a.date) - new Date(b.date));
    const list = [];
    sorted.forEach((rawMsg, idx) => {
      const blocks = processMessageBlocks(rawMsg, idx);
      list.push(...blocks);
    });
    return list;
  }, [chatMessages]);

  // Load WhatsApp chat history for selected lead
  useEffect(() => {
    if (!selectedLeadId) {
      setChatMessages([]);
      return;
    }

    const fetchChat = async () => {
      const selectedLead = leadsList.find(l => l.id === selectedLeadId) || null;
      if (!selectedLead || !selectedLead.telefone) {
        setChatMessages([]);
        return;
      }
      setLoadingChat(true);
      try {
        const res = await fetchMessagesForPhone(selectedLead.telefone);
        setChatMessages(res.data || []);
      } catch (err) {
        console.error("Erro ao buscar mensagens do WhatsApp:", err);
      } finally {
        setLoadingChat(false);
      }
    };

    fetchChat();
  }, [selectedLeadId, leadsList]);

  // Load forwarding history for the selected lead
  useEffect(() => {
    if (!selectedLeadId) {
      setForwardHistory([]);
      return;
    }

    const fetchHistory = async () => {
      if (!db) {
        console.warn("Firestore db is not initialized.");
        return;
      }
      setLoadingHistory(true);
      try {
        const q = query(
          collection(db, 'lead_forwards'),
          where('leadId', '==', selectedLeadId)
        );
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort in memory by date descending (prevents index requirement crash)
        list.sort((a, b) => new Date(b.dataEnvio) - new Date(a.dataEnvio));
        setForwardHistory(list);
      } catch (err) {
        console.error("Erro ao buscar histórico de encaminhamentos:", err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [selectedLeadId]);

  const formatChatMessages = (msgList) => {
    if (!msgList || msgList.length === 0) return "Nenhuma conversa de WhatsApp encontrada.";
    
    return msgList.map(msg => {
      let raw = msg.message;
      let sender = 'Lead';
      let text = '';
      
      if (typeof raw === 'string') {
        if (raw.startsWith('{')) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed.sender === 'bot' || parsed.type === 'bot' || parsed.type === 'ai' || parsed.isBot) {
              sender = 'Helena IA';
            } else {
              sender = 'Lead';
            }
            text = parsed.text || parsed.content || JSON.stringify(parsed);
          } catch (_) {
            text = raw;
          }
        } else {
          text = raw;
        }
      } else if (raw && typeof raw === 'object') {
        if (raw.sender === 'bot' || raw.type === 'bot' || raw.type === 'ai' || raw.isBot) {
          sender = 'Helena IA';
        }
        text = raw.text || raw.content || JSON.stringify(raw);
      }
      
      // Clean JSON leaks in content
      if (typeof text === 'string' && text.includes('{"text":')) {
        try {
          const parsed = JSON.parse(text);
          if (parsed.text) text = parsed.text;
        } catch (_) {}
      }
      
      const time = msg.date ? new Date(msg.date).toLocaleString('pt-BR') : '';
      return `[${time}] ${sender}: ${text}`;
    }).join('\n');
  };

  const generateHtmlBody = (selectedLead, chatMessages, includeChatHistory, user) => {
    const logoUrl = 'https://usxkmalddprlijlmoufd.supabase.co/storage/v1/object/public/imagens/logopts.jpeg';
    const supportEmail = 'contato@agenciainova.org.br';
    
    const correctSubj = `Retorno Acuracia Helena - Ticket #${selectedLead.id}`;
    const correctBody = `Confirmado. A triagem da Helena para o lead ${selectedLead.nome || 'Anônimo'} atribuído a ${selectedLead.departamento || 'Sem área'} foi CORRETA.`;
    const correctMailto = `mailto:${supportEmail}?subject=${encodeURIComponent(correctSubj)}&body=${encodeURIComponent(correctBody)}`;

    const incorrectSubj = `Retorno Acuracia Helena - Ticket #${selectedLead.id}`;
    const incorrectBody = `A triagem da Helena para o lead ${selectedLead.nome || 'Anônimo'} atribuído a ${selectedLead.departamento || 'Sem área'} foi INCORRETA.\n\nO departamento correto deveria ser: [Digite o setor correto aqui]\n`;
    const incorrectMailto = `mailto:${supportEmail}?subject=${encodeURIComponent(incorrectSubj)}&body=${encodeURIComponent(incorrectBody)}`;

    const finalizeConcluidoSubj = `[Finalização de Atendimento] Ticket #${selectedLead.id} - Concluído`;
    const finalizeConcluidoBody = `Olá,\n\nConfirmo que o atendimento do Ticket #${selectedLead.id} (Lead: ${selectedLead.nome || 'Anônimo'} - Área: ${selectedLead.departamento || 'Sem área'}) foi CONCLUÍDO com sucesso.\n\nObservações adicionais (opcional):\n`;
    const finalizeConcluidoMailto = `mailto:${supportEmail}?subject=${encodeURIComponent(finalizeConcluidoSubj)}&body=${encodeURIComponent(finalizeConcluidoBody)}`;

    const finalizeNaoConcluidoSubj = `[Finalização de Atendimento] Ticket #${selectedLead.id} - Não Concluído`;
    const finalizeNaoConcluidoBody = `Olá,\n\nInformo que o atendimento do Ticket #${selectedLead.id} (Lead: ${selectedLead.nome || 'Anônimo'} - Área: ${selectedLead.departamento || 'Sem área'}) NÃO FOI CONCLUÍDO.\n\nMotivo/Justificativa:\n[Informe aqui o motivo da não conclusão]\n`;
    const finalizeNaoConcluidoMailto = `mailto:${supportEmail}?subject=${encodeURIComponent(finalizeNaoConcluidoSubj)}&body=${encodeURIComponent(finalizeNaoConcluidoBody)}`;

    let chatHtml = '';
    if (includeChatHistory && chatMessages && chatMessages.length > 0) {
      const messagesList = chatMessages.map(msg => {
        let raw = msg.message;
        let sender = 'Lead';
        let text = '';
        
        if (typeof raw === 'string') {
          if (raw.startsWith('{')) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed.sender === 'bot' || parsed.type === 'bot' || parsed.type === 'ai' || parsed.isBot) {
                sender = 'Helena IA';
              } else {
                sender = 'Lead';
              }
              text = parsed.text || parsed.content || JSON.stringify(parsed);
            } catch (_) {
              text = raw;
            }
          } else {
            text = raw;
          }
        } else if (raw && typeof raw === 'object') {
          if (raw.sender === 'bot' || raw.type === 'bot' || raw.type === 'ai' || raw.isBot) {
            sender = 'Helena IA';
          }
          text = raw.text || raw.content || JSON.stringify(raw);
        }
        
        // Clean JSON leaks in content
        if (typeof text === 'string' && text.includes('{"text":')) {
          try {
            const parsed = JSON.parse(text);
            if (parsed.text) text = parsed.text;
          } catch (_) {}
        }
        
        const time = msg.date ? new Date(msg.date).toLocaleString('pt-BR') : '';
        const bgColor = sender === 'Helena IA' ? '#f0f4f9' : '#f1f3f4';
        const senderColor = sender === 'Helena IA' ? '#0b57d0' : '#1f1f1f';
        
        return `
          <div style="margin-bottom: 8px; padding: 12px; background-color: ${bgColor}; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.4;">
            <strong style="color: ${senderColor}; font-size: 12px;">${sender}</strong>
            <span style="font-size: 11px; color: #5f6368; margin-left: 8px;">${time}</span>
            <div style="margin-top: 4px; color: #1f1f1f; white-space: pre-wrap;">${text}</div>
          </div>
        `;
      }).join('');
      
      chatHtml = `
        <div style="margin-top: 24px; border-top: 1px solid #e0e0e0; padding-top: 16px;">
          <h4 style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #1f1f1f; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">Histórico de Conversas (WhatsApp)</h4>
          <div style="max-height: 350px; overflow-y: auto; padding-right: 4px;">
            ${messagesList}
          </div>
        </div>
      `;
    }

    return `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f1f1f; background-color: #f8f9fa;">
        <div style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e0e0e0; overflow: hidden;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #0e1e24, #1b353f, #234654); padding: 28px 24px; text-align: center;">
            <img src="${logoUrl}" alt="Parque Tecnológico de Sorocaba" style="max-height: 56px; display: block; margin: 0 auto 12px; border-radius: 8px; background: #ffffff; padding: 4px;" />
            <h2 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">Encaminhamento de Lead</h2>
            <p style="margin: 4px 0 0 0; color: #a1b0b5; font-size: 12px;">Helena Inteligência Artificial — PTS</p>
          </div>
          
          <!-- Lead Info Card -->
          <div style="padding: 28px;">
            <h3 style="margin: 0 0 16px 0; font-size: 15px; color: #1b353f; border-bottom: 2px solid #1b353f; padding-bottom: 6px; display: inline-block; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Ficha Cadastral do Lead</h3>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 10px 0; width: 140px; font-weight: 700; font-size: 13px; color: #5f6368; border-bottom: 1px solid #f1f3f4;">Nome:</td>
                <td style="padding: 10px 0; font-size: 14px; color: #1f1f1f; border-bottom: 1px solid #f1f3f4; font-weight: 600;">${selectedLead.nome || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: 700; font-size: 13px; color: #5f6368; border-bottom: 1px solid #f1f3f4;">Empresa:</td>
                <td style="padding: 10px 0; font-size: 14px; color: #1f1f1f; border-bottom: 1px solid #f1f3f4;">${selectedLead.empresa || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: 700; font-size: 13px; color: #5f6368; border-bottom: 1px solid #f1f3f4;">E-mail:</td>
                <td style="padding: 10px 0; font-size: 14px; color: #1f1f1f; border-bottom: 1px solid #f1f3f4;"><a href="mailto:${selectedLead.email}" style="color: #0b57d0; text-decoration: none;">${selectedLead.email || '—'}</a></td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: 700; font-size: 13px; color: #5f6368; border-bottom: 1px solid #f1f3f4;">Telefone:</td>
                <td style="padding: 10px 0; font-size: 14px; color: #1f1f1f; border-bottom: 1px solid #f1f3f4;">${selectedLead.telefone || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: 700; font-size: 13px; color: #5f6368; border-bottom: 1px solid #f1f3f4;">Cargo:</td>
                <td style="padding: 10px 0; font-size: 14px; color: #1f1f1f; border-bottom: 1px solid #f1f3f4;">${selectedLead.cargo || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: 700; font-size: 13px; color: #5f6368; border-bottom: 1px solid #f1f3f4;">Área Direcionada:</td>
                <td style="padding: 10px 0; font-size: 14px; color: #0b57d0; border-bottom: 1px solid #f1f3f4; font-weight: 700;">${selectedLead.departamento || 'Sem área'}</td>
              </tr>
            </table>

            <!-- Motivo & Resumo -->
            <div style="background-color: #f8f9fa; border-left: 4px solid #1b353f; padding: 14px 16px; margin-bottom: 16px; border-radius: 0 8px 8px 0;">
              <strong style="font-size: 12px; color: #1b353f; display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Motivo do Contato:</strong>
              <div style="font-size: 13px; line-height: 1.5; color: #1f1f1f; white-space: pre-wrap;">${selectedLead.motivo || '—'}</div>
            </div>

            <div style="background-color: #f8f9fa; border-left: 4px solid #0b57d0; padding: 14px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
              <strong style="font-size: 12px; color: #0b57d0; display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Resumo do Atendimento:</strong>
              <div style="font-size: 13px; line-height: 1.5; color: #1f1f1f; white-space: pre-wrap;">${selectedLead.resumo || '—'}</div>
            </div>

            <!-- Chat messages -->
            ${chatHtml}

            <!-- Finalização do Atendimento -->
            <div style="margin-top: 28px; padding: 22px; background: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0; text-align: center;">
              <h4 style="margin: 0 0 6px 0; font-size: 14px; color: #166534; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Finalização do Atendimento</h4>
              <p style="margin: 0 0 16px 0; font-size: 12px; color: #374151; line-height: 1.4;">Após atender este lead, confirme a conclusão do atendimento diretamente por e-mail:</p>
              
              <div style="display: inline-block;">
                <a href="${finalizeConcluidoMailto}" style="display: inline-block; padding: 10px 22px; color: #ffffff; background-color: #10b981; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 12px; margin: 4px 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.15);">
                  ✓ Atendimento Concluído
                </a>
                <a href="${finalizeNaoConcluidoMailto}" style="display: inline-block; padding: 10px 22px; color: #ffffff; background-color: #ef4444; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 12px; margin: 4px 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.15);">
                  ✕ Não Concluído
                </a>
              </div>
            </div>

            <!-- Evaluation Card -->
            <div style="margin-top: 16px; padding: 22px; background: #f0f4f9; border-radius: 12px; border: 1px solid #d3e3fd; text-align: center;">
              <h4 style="margin: 0 0 6px 0; font-size: 14px; color: #0b57d0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Avaliação de Acurácia</h4>
              <p style="margin: 0 0 16px 0; font-size: 12px; color: #5f6368; line-height: 1.4;">Clique em uma das opções abaixo para relatar o resultado da triagem diretamente por e-mail:</p>
              
              <div style="display: inline-block;">
                <a href="${correctMailto}" style="display: inline-block; padding: 10px 20px; color: #ffffff; background-color: #137333; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 12px; margin: 4px 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.15);">
                  ✓ Acurácia CORRETA
                </a>
                <a href="${incorrectMailto}" style="display: inline-block; padding: 10px 20px; color: #ffffff; background-color: #b31412; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 12px; margin: 4px 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.15);">
                  ✗ Acurácia INCORRETA
                </a>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f1f3f4; padding: 16px 24px; font-size: 11px; color: #5f6368; text-align: center; border-top: 1px solid #e0e0e0;">
            Encaminhado por: <strong>${user?.name || 'Sistema'}</strong> (${user?.email || ''})<br/>
            Data: ${new Date().toLocaleString('pt-BR')} | Helena PTS
          </div>

        </div>
      </div>
    `;
  };

  const handleSendForward = async () => {
    if (!forwardRecipients.trim()) {
      alert("Por favor, digite ao menos um destinatário.");
      return;
    }

    const emails = forwardRecipients.split(',')
      .map(e => e.trim())
      .filter(e => e.includes('@'));

    if (emails.length === 0) {
      alert("Por favor, informe e-mails válidos.");
      return;
    }

    setSendingForward(true);
    try {
      const selectedLead = filteredLeads.find(l => l.id === selectedLeadId) || null;
      if (!selectedLead) return;

      // 1. Save forwarding trace to Firestore
      const logData = {
        leadId: selectedLead.id,
        leadNome: selectedLead.nome || 'Anônimo',
        destinatarios: emails.join(', '),
        remetenteNome: user?.name || 'Sistema',
        remetenteEmail: user?.email || '',
        dataEnvio: new Date().toISOString(),
        detalhesLead: {
          empresa: selectedLead.empresa || '',
          telefone: selectedLead.telefone || '',
          email: selectedLead.email || '',
          cargo: selectedLead.cargo || '',
          departamento: selectedLead.departamento || '',
          motivo: selectedLead.motivo || '',
          resumo: selectedLead.resumo || ''
        }
      };

      if (db) {
        await addDoc(collection(db, 'lead_forwards'), logData);
        // Encaminhamento interno registrado com sucesso (sem marcar contato como respondido)
      }

      // 2. Compose mailto link and open it
      const subject = `[Lead PTS] Encaminhamento de Lead - ${selectedLead.nome || 'Anônimo'}`;
      
      let body = `Olá,\n\nSegue o encaminhamento dos dados do lead de atendimento do PTS:\n\n` +
        `• Nome: ${selectedLead.nome || '—'}\n` +
        `• Empresa: ${selectedLead.empresa || '—'}\n` +
        `• E-mail: ${selectedLead.email || '—'}\n` +
        `• Telefone: ${selectedLead.telefone || '—'}\n` +
        `• Cargo: ${selectedLead.cargo || '—'}\n` +
        `• Departamento/Área: ${selectedLead.departamento || '—'}\n\n` +
        `Motivo do Atendimento:\n${selectedLead.motivo || '—'}\n\n` +
        `Resumo do Atendimento:\n${selectedLead.resumo || '—'}\n\n`;

      if (includeChatHistory) {
        const transcript = formatChatMessages(chatMessages);
        body += `=========================================\n` +
          `HISTÓRICO COMPLETO DA CONVERSA (WHATSAPP):\n` +
          `=========================================\n` +
          `${transcript}\n\n`;
      }

      // Add feedback/approval and finalization links for external managers/agents
      const supportEmail = 'contato@agenciainova.org.br';
      const finalizeConcluidoSubj = `[Finalização de Atendimento] Ticket #${selectedLead.id} - Concluído`;
      const finalizeConcluidoBody = `Olá,\n\nConfirmo que o atendimento do Ticket #${selectedLead.id} (Lead: ${selectedLead.nome || 'Anônimo'} - Área: ${selectedLead.departamento || 'Sem área'}) foi CONCLUÍDO com sucesso.\n\nObservações adicionais (opcional):\n`;
      const finalizeConcluidoMailto = `mailto:${supportEmail}?subject=${encodeURIComponent(finalizeConcluidoSubj)}&body=${encodeURIComponent(finalizeConcluidoBody)}`;

      const finalizeNaoConcluidoSubj = `[Finalização de Atendimento] Ticket #${selectedLead.id} - Não Concluído`;
      const finalizeNaoConcluidoBody = `Olá,\n\nInformo que o atendimento do Ticket #${selectedLead.id} (Lead: ${selectedLead.nome || 'Anônimo'} - Área: ${selectedLead.departamento || 'Sem área'}) NÃO FOI CONCLUÍDO.\n\nMotivo/Justificativa:\n[Informe aqui o motivo da não conclusão]\n`;
      const finalizeNaoConcluidoMailto = `mailto:${supportEmail}?subject=${encodeURIComponent(finalizeNaoConcluidoSubj)}&body=${encodeURIComponent(finalizeNaoConcluidoBody)}`;

      const correctSubj = `Retorno Acuracia Helena - Ticket #${selectedLead.id}`;
      const correctBody = `Confirmado. A triagem da Helena para o lead ${selectedLead.nome || 'Anônimo'} atribuído a ${selectedLead.departamento || 'Sem área'} foi CORRETA.`;
      const correctMailto = `mailto:${supportEmail}?subject=${encodeURIComponent(correctSubj)}&body=${encodeURIComponent(correctBody)}`;

      const incorrectSubj = `Retorno Acuracia Helena - Ticket #${selectedLead.id}`;
      const incorrectBody = `A triagem da Helena para o lead ${selectedLead.nome || 'Anônimo'} atribuído a ${selectedLead.departamento || 'Sem área'} foi INCORRETA.\n\nO departamento correto deveria ser: [Digite o setor correto aqui]\n`;
      const incorrectMailto = `mailto:${supportEmail}?subject=${encodeURIComponent(incorrectSubj)}&body=${encodeURIComponent(incorrectBody)}`;

      body += `=========================================\n` +
        `FINALIZAÇÃO DO ATENDIMENTO (Ação do Responsável):\n` +
        `=========================================\n` +
        `Após atender este lead, registre a conclusão clicando em uma das opções abaixo:\n\n` +
        `👉 ATENDIMENTO CONCLUÍDO: Clique aqui para registrar a conclusão do atendimento\n` +
        `   ${finalizeConcluidoMailto}\n\n` +
        `👉 NÃO CONCLUÍDO: Clique aqui para relatar atendimento não concluído\n` +
        `   ${finalizeNaoConcluidoMailto}\n\n` +
        `=========================================\n` +
        `AVALIAÇÃO DE ACURÁCIA (Ação Externa do Gestor):\n` +
        `=========================================\n` +
        `Se você é o gestor responsável e deseja avaliar a acurácia deste atendimento diretamente pelo seu e-mail (sem precisar fazer login na plataforma), clique em uma das opções abaixo:\n\n` +
        `👉 Acurácia CORRETA: Clique aqui para confirmar o direcionamento\n` +
        `   ${correctMailto}\n\n` +
        `👉 Acurácia INCORRETA: Clique aqui para relatar desvio ou corrigir o setor\n` +
        `   ${incorrectMailto}\n\n` +
        `-----------------------------------------\n` +
        `Encaminhado por: ${user?.name || 'Sistema'} (${user?.email || ''})\n` +
        `Data do Encaminhamento: ${new Date().toLocaleString('pt-BR')}\n`;

      // Copy formatted HTML template to clipboard
      try {
        const htmlContent = generateHtmlBody(selectedLead, chatMessages, includeChatHistory, user);
        const blobHtml = new Blob([htmlContent], { type: 'text/html' });
        const blobText = new Blob([body], { type: 'text/plain' });
        
        if (typeof ClipboardItem !== 'undefined') {
          const item = new ClipboardItem({
            'text/html': blobHtml,
            'text/plain': blobText
          });
          await navigator.clipboard.write([item]);
        } else {
          await navigator.clipboard.writeText(body);
        }
      } catch (clipErr) {
        console.error("Erro ao copiar e-mail formatado:", clipErr);
        try {
          await navigator.clipboard.writeText(body);
        } catch (_) {}
      }

      // Open email composer window with placeholders
      const placeholderSubject = `[Lead PTS] Encaminhamento de Lead - ${selectedLead.nome || 'Anônimo'}`;
      const placeholderBody = `👉 Pressione Ctrl+V (ou Cmd+V) para colar a ficha formatada do lead com a logo do PTS!`;

      if (emailProvider === 'gmail') {
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emails.join(','))}&su=${encodeURIComponent(placeholderSubject)}&body=${encodeURIComponent(placeholderBody)}`;
        window.open(gmailUrl, '_blank');
      } else {
        const mailtoUrl = `mailto:${encodeURIComponent(emails.join(','))}?subject=${encodeURIComponent(placeholderSubject)}&body=${encodeURIComponent(placeholderBody)}`;
        window.location.href = mailtoUrl;
      }

      // Update local state history
      setForwardHistory(prev => [{
        id: `local_${Date.now()}`,
        ...logData
      }, ...prev]);

      setForwardStep('success');
    } catch (err) {
      console.error("Erro ao registrar encaminhamento:", err);
      alert("Erro ao salvar histórico de envio no banco de dados.");
    } finally {
      setSendingForward(false);
    }
  };

  const responsibleUsers = useMemo(() => {
    const selectedLead = leadsList.find(l => l.id === selectedLeadId) || null;
    if (!selectedLead || !selectedLead.departamento) return [];
    const dept = selectedLead.departamento.trim().toLowerCase();
    return (users || []).filter(u => {
      if (!u.area) return false;
      return u.area.split(',').map(a => a.trim().toLowerCase()).includes(dept);
    });
  }, [selectedLeadId, leadsList, users]);

  const responsibleEmails = useMemo(() => {
    return responsibleUsers.map(u => u.email).join(', ');
  }, [responsibleUsers]);

  const handleForwardDirect = async (emailsStr) => {
    if (!emailsStr.trim()) {
      alert("Nenhum e-mail de responsável encontrado.");
      return;
    }

    const emails = emailsStr.split(',')
      .map(e => e.trim())
      .filter(e => e.includes('@'));

    if (emails.length === 0) {
      alert("Nenhum e-mail de responsável válido encontrado.");
      return;
    }

    setSendingForward(true);
    try {
      const selectedLead = leadsList.find(l => l.id === selectedLeadId) || null;
      if (!selectedLead) return;

      // 1. Save forwarding trace to Firestore
      const logData = {
        leadId: selectedLead.id,
        leadNome: selectedLead.nome || 'Anônimo',
        destinatarios: emails.join(', '),
        remetenteNome: user?.name || 'Sistema',
        remetenteEmail: user?.email || '',
        dataEnvio: new Date().toISOString(),
        detalhesLead: {
          empresa: selectedLead.empresa || '',
          telefone: selectedLead.telefone || '',
          email: selectedLead.email || '',
          cargo: selectedLead.cargo || '',
          departamento: selectedLead.departamento || '',
          motivo: selectedLead.motivo || '',
          resumo: selectedLead.resumo || ''
        }
      };

      if (db) {
        await addDoc(collection(db, 'lead_forwards'), logData);
        // Encaminhamento direto registrado com sucesso (sem marcar contato como respondido)
      }

      // 2. Compose mailto link and open it
      const subject = `[Lead PTS] Encaminhamento de Lead - ${selectedLead.nome || 'Anônimo'}`;
      
      let body = `Olá,\n\nSegue o encaminhamento dos dados do lead de atendimento do PTS:\n\n` +
        `• Nome: ${selectedLead.nome || '—'}\n` +
        `• Empresa: ${selectedLead.empresa || '—'}\n` +
        `• E-mail: ${selectedLead.email || '—'}\n` +
        `• Telefone: ${selectedLead.telefone || '—'}\n` +
        `• Cargo: ${selectedLead.cargo || '—'}\n` +
        `• Departamento/Área: ${selectedLead.departamento || '—'}\n\n` +
        `Motivo do Atendimento:\n${selectedLead.motivo || '—'}\n\n` +
        `Resumo do Atendimento:\n${selectedLead.resumo || '—'}\n\n`;

      if (includeChatHistory) {
        const transcript = formatChatMessages(chatMessages);
        body += `=========================================\n` +
          `HISTÓRICO COMPLETO DA CONVERSA (WHATSAPP):\n` +
          `=========================================\n` +
          `${transcript}\n\n`;
      }

      // Add feedback/approval and finalization links for external managers/agents
      const supportEmail = 'contato@agenciainova.org.br';
      const finalizeConcluidoSubj = `[Finalização de Atendimento] Ticket #${selectedLead.id} - Concluído`;
      const finalizeConcluidoBody = `Olá,\n\nConfirmo que o atendimento do Ticket #${selectedLead.id} (Lead: ${selectedLead.nome || 'Anônimo'} - Área: ${selectedLead.departamento || 'Sem área'}) foi CONCLUÍDO com sucesso.\n\nObservações adicionais (opcional):\n`;
      const finalizeConcluidoMailto = `mailto:${supportEmail}?subject=${encodeURIComponent(finalizeConcluidoSubj)}&body=${encodeURIComponent(finalizeConcluidoBody)}`;

      const finalizeNaoConcluidoSubj = `[Finalização de Atendimento] Ticket #${selectedLead.id} - Não Concluído`;
      const finalizeNaoConcluidoBody = `Olá,\n\nInformo que o atendimento do Ticket #${selectedLead.id} (Lead: ${selectedLead.nome || 'Anônimo'} - Área: ${selectedLead.departamento || 'Sem área'}) NÃO FOI CONCLUÍDO.\n\nMotivo/Justificativa:\n[Informe aqui o motivo da não conclusão]\n`;
      const finalizeNaoConcluidoMailto = `mailto:${supportEmail}?subject=${encodeURIComponent(finalizeNaoConcluidoSubj)}&body=${encodeURIComponent(finalizeNaoConcluidoBody)}`;

      const correctSubj = `Retorno Acuracia Helena - Ticket #${selectedLead.id}`;
      const correctBody = `Confirmado. A triagem da Helena para o lead ${selectedLead.nome || 'Anônimo'} atribuído a ${selectedLead.departamento || 'Sem área'} foi CORRETA.`;
      const correctMailto = `mailto:${supportEmail}?subject=${encodeURIComponent(correctSubj)}&body=${encodeURIComponent(correctBody)}`;

      const incorrectSubj = `Retorno Acuracia Helena - Ticket #${selectedLead.id}`;
      const incorrectBody = `A triagem da Helena para o lead ${selectedLead.nome || 'Anônimo'} atribuído a ${selectedLead.departamento || 'Sem área'} foi INCORRETA.\n\nO departamento correto deveria ser: [Digite o setor correto aqui]\n`;
      const incorrectMailto = `mailto:${supportEmail}?subject=${encodeURIComponent(incorrectSubj)}&body=${encodeURIComponent(incorrectBody)}`;

      body += `=========================================\n` +
        `FINALIZAÇÃO DO ATENDIMENTO (Ação do Responsável):\n` +
        `=========================================\n` +
        `Após atender este lead, registre a conclusão clicando em uma das opções abaixo:\n\n` +
        `👉 ATENDIMENTO CONCLUÍDO: Clique aqui para registrar a conclusão do atendimento\n` +
        `   ${finalizeConcluidoMailto}\n\n` +
        `👉 NÃO CONCLUÍDO: Clique aqui para relatar atendimento não concluído\n` +
        `   ${finalizeNaoConcluidoMailto}\n\n` +
        `=========================================\n` +
        `AVALIAÇÃO DE ACURÁCIA (Ação Externa do Gestor):\n` +
        `=========================================\n` +
        `Se você é o gestor responsável e deseja avaliar a acurácia deste atendimento diretamente pelo seu e-mail (sem precisar fazer login na plataforma), clique em uma das opções abaixo:\n\n` +
        `👉 Acurácia CORRETA: Clique aqui para confirmar o direcionamento\n` +
        `   ${correctMailto}\n\n` +
        `👉 Acurácia INCORRETA: Clique aqui para relatar desvio ou corrigir o setor\n` +
        `   ${incorrectMailto}\n\n` +
        `-----------------------------------------\n` +
        `Encaminhado por: ${user?.name || 'Sistema'} (${user?.email || ''})\n` +
        `Data do Encaminhamento: ${new Date().toLocaleString('pt-BR')}\n`;

      // Copy formatted HTML template to clipboard
      try {
        const htmlContent = generateHtmlBody(selectedLead, chatMessages, includeChatHistory, user);
        const blobHtml = new Blob([htmlContent], { type: 'text/html' });
        const blobText = new Blob([body], { type: 'text/plain' });
        
        if (typeof ClipboardItem !== 'undefined') {
          const item = new ClipboardItem({
            'text/html': blobHtml,
            'text/plain': blobText
          });
          await navigator.clipboard.write([item]);
        } else {
          await navigator.clipboard.writeText(body);
        }
      } catch (clipErr) {
        console.error("Erro ao copiar e-mail formatado:", clipErr);
        try {
          await navigator.clipboard.writeText(body);
        } catch (_) {}
      }

      // Open email composer window
      const placeholderSubject = `[Lead PTS] Encaminhamento de Lead - ${selectedLead.nome || 'Anônimo'}`;
      const placeholderBody = `👉 Pressione Ctrl+V (ou Cmd+V) para colar a ficha formatada do lead com a logo do PTS!`;

      if (emailProvider === 'gmail') {
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emails.join(','))}&su=${encodeURIComponent(placeholderSubject)}&body=${encodeURIComponent(placeholderBody)}`;
        window.open(gmailUrl, '_blank');
      } else {
        const mailtoUrl = `mailto:${encodeURIComponent(emails.join(','))}?subject=${encodeURIComponent(placeholderSubject)}&body=${encodeURIComponent(placeholderBody)}`;
        window.location.href = mailtoUrl;
      }

      // Update local state history
      setForwardHistory(prev => [{
        id: `local_${Date.now()}`,
        ...logData
      }, ...prev]);

      setForwardRecipients(emails.join(', '));
      setForwardStep('success');
      setShowForwardModal(true);
    } catch (err) {
      console.error("Erro ao registrar encaminhamento:", err);
      alert("Erro ao salvar histórico de envio no banco de dados.");
    } finally {
      setSendingForward(false);
    }
  };


  useEffect(() => {
    // Escuta querystring para auto-pesquisa e auto-seleção inicial apenas
    const queryParams = new URLSearchParams(location.search);
    const targetId = queryParams.get('id');
    
    if (targetId && leadsList.length > 0 && processedUrlIdRef.current !== targetId) {
      // Confirma que o ID existe na lista recebida do backend
      const found = leadsList.find(l => String(l.id) === targetId);
      if (found) {
        processedUrlIdRef.current = targetId;
        setSelectedLeadId(found.id);
        // Scrollar na microtarefa depois que o DOM renderizar o item como Selected
        setTimeout(() => {
          const el = document.getElementById(`lead-item-${found.id}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [location.search, leadsList]);

  const [responseFilter, setResponseFilter] = useState('all'); // 'all' | 'sem_resposta' | 'respondido' | 'encaminhado' | 'nao_encaminhado'

  // Counters for response & forwarding indicators
  const kpiStats = useMemo(() => {
    let total = leadsList.length;
    let respondidos = 0;
    let semResposta = 0;
    let encaminhados = 0;
    let naoEncaminhados = 0;

    leadsList.forEach(lead => {
      const resp = getResponseStatus(lead.id);
      if (resp?.respondido) {
        respondidos++;
      } else {
        semResposta++;
      }
      if (forwardStatuses[String(lead.id)]?.encaminhado) {
        encaminhados++;
      } else {
        naoEncaminhados++;
      }
    });

    const taxaResposta = total > 0 ? ((respondidos / total) * 100).toFixed(1) : '0';

    return { total, respondidos, semResposta, encaminhados, naoEncaminhados, taxaResposta };
  }, [leadsList, responseStatuses, emailStatuses, forwardStatuses]);

  // Filter local by search text, user area, and response/forwarding status
  const filteredLeads = leadsList.filter(lead => {
    if (!isAdmin && userArea) {
      const userAreas = userArea.split(',').map(a => a.trim()).filter(Boolean);
      if (!userAreas.includes(lead.departamento)) return false;
    }

    const resp = getResponseStatus(lead.id);
    const isReplied = !!resp?.respondido;
    const isForwarded = !!forwardStatuses[String(lead.id)]?.encaminhado;

    if (responseFilter === 'sem_resposta' && isReplied) return false;
    if (responseFilter === 'respondido' && !isReplied) return false;
    if (responseFilter === 'encaminhado' && !isForwarded) return false;
    if (responseFilter === 'nao_encaminhado' && isForwarded) return false;
    
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
  const [editingAcuraciaLeadId, setEditingAcuraciaLeadId] = useState(null);
  const [selectedCorrectDept, setSelectedCorrectDept] = useState('');
  const [isSavingAcuracia, setIsSavingAcuracia] = useState(false);

  // Lista estritamente das áreas cadastradas no sistema (Gestão de Usuários / Áreas)
  const allAvailableAreas = useMemo(() => {
    const defaultList = [
      'Administrativo',
      'CEFI',
      'CET',
      'Comercial',
      'Comunicação',
      'Compras',
      'CPL',
      'Eventos',
      'Financeiro',
      'Jurídico',
      'Hubiz',
      'Inovação e Projetos',
      'Parcerias Estratégicas',
      'RH',
      'Cel40'
    ];
    
    // Utiliza apenas as áreas oficiais do sistema (areas cadastradas no painel)
    const sourceList = (areas && areas.length > 0)
      ? areas.map(a => a?.name).filter(Boolean)
      : defaultList;

    // Normaliza e deduplica evitando repetições e diferenças de maiúsculas/minúsculas
    const seen = new Set();
    const unique = [];
    sourceList.forEach(name => {
      const trimmed = name.trim();
      const lower = trimmed.toLowerCase();
      if (trimmed && !seen.has(lower)) {
        seen.add(lower);
        unique.push(trimmed);
      }
    });

    return unique.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [areas]);

  // Recupera com segurança o departamento original transferido pela Helena
  const helenaOriginalDept = useMemo(() => {
    if (!selectedLead) return '';
    const stored = leadTriagens[String(selectedLead.id)]?.originalDepartamento;
    if (stored) return stored;
    return selectedLead.departamento || '';
  }, [selectedLead, leadTriagens]);



  const handleSaveAcuracia = async (leadId, isCorrect, chosenDept = null) => {
    const targetLead = leadsList.find(l => l.id === leadId) || selectedLead;
    if (!targetLead) return;

    // Preserva o departamento original da triagem
    const originalDept = leadTriagens[String(leadId)]?.originalDepartamento || targetLead.departamento;

    let targetDept = null;
    let redirectDept = null;

    if (isCorrect === true) {
      targetDept = null;
      redirectDept = originalDept;
    } else if (isCorrect === false) {
      targetDept = (chosenDept || selectedCorrectDept || correctDeptText || '').trim();
      redirectDept = targetDept;
    } else if (isCorrect === null) {
      targetDept = null;
      redirectDept = originalDept;
    }

    setIsSavingAcuracia(true);
    try {
      // Salva no banco de dados e realiza automaticamente o direcionamento se incorreto
      const res = await updateLeadAcuracia(leadId, isCorrect, targetDept, redirectDept);
      
      // Tratamento de Erro Crítico (RLS Policy)
      if (res.error || !res.success) {
        console.warn("DB Update result:", res);
        alert(`Erro Crítico Supabase!\n\nA sua classificação não foi salva no banco de dados.\nDetalhe: ${res.error}\n\nVocê precisa ir no Supabase > Table editor > dados_pts > desativar o "Row Level Security (RLS)" ou criar uma política de UPDATE.`);
        return; // Aborta e impede a UI de fingir que salvou
      }

      // Salva no Firestore para rastreabilidade e garantia da triagem original
      if (db) {
        try {
          await setDoc(doc(db, 'lead_triagens', String(leadId)), {
            leadId,
            originalDepartamento: originalDept,
            ultimoDepartamento: redirectDept || originalDept,
            transferencia_correta: isCorrect,
            departamento_correto: targetDept,
            atualizadoEm: new Date().toISOString(),
            atualizadoPor: user?.name || user?.email || 'Administrador'
          }, { merge: true });

          // Se houve alteração de direcionamento, salva no histórico de auditoria
          if (isCorrect === false && targetDept && targetLead.departamento !== targetDept) {
            await addDoc(collection(db, 'lead_edits'), {
              leadId: targetLead.id,
              leadNome: targetLead.nome || 'Anônimo',
              editorNome: user?.name || 'Administrador',
              editorEmail: user?.email || '',
              dataAlteracao: new Date().toISOString(),
              alteracoes: {
                departamento: { antes: targetLead.departamento, depois: targetDept },
                acuracia: { antes: targetLead.transferencia_correta ? 'Correta' : 'Pendente/Incorreta', depois: `Incorreta (Redirecionado para ${targetDept})` }
              }
            });
          }
        } catch (fsErr) {
          console.error("Erro ao registrar histórico no Firestore:", fsErr);
        }
      }

      // Se a transferência foi sinalizada como incorreta, notifica o webhook
      if (isCorrect === false && targetDept) {
        try {
          await fetch('https://webhooks.nextgoal.com.br/webhook/notifica', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              leadId,
              nome: targetLead.nome,
              telefone: targetLead.telefone,
              email: targetLead.email,
              empresa: targetLead.empresa,
              departamentoAtual: originalDept,
              departamentoCorreto: targetDept,
              motivo: targetLead.motivo,
              resumo: targetLead.resumo
            }),
          });
        } catch (webhookErr) {
          console.error('Erro ao chamar webhook de notificação:', webhookErr);
        }
      }

      // Guarda a posição atual de scroll da listagem e dos detalhes antes de atualizar
      const savedListScroll = listContainerRef.current ? listContainerRef.current.scrollTop : lastScrollTopRef.current;
      const savedDetailsScroll = detailsContainerRef.current ? detailsContainerRef.current.scrollTop : 0;

      // Atualiza otimista na UI se passou com sucesso absoluto
      setAcuraciaLocal(prev => ({ ...prev, [leadId]: { isCorrect, correctDeptText: targetDept } }));
      setActiveTabAcuracia(null);
      setEditingAcuraciaLeadId(null);
      setSelectedCorrectDept('');
      setCorrectDeptText('');

      await refetch(true); // Recarrega silenciosamente sem desmontar a listagem nem resetar o scroll

      // Preserva exatamente a posição em que o usuário estava na listagem e na tela
      if (listContainerRef.current && savedListScroll !== null && savedListScroll !== undefined) {
        listContainerRef.current.scrollTop = savedListScroll;
      }
      if (detailsContainerRef.current && savedDetailsScroll > 0) {
        detailsContainerRef.current.scrollTop = savedDetailsScroll;
      }
      requestAnimationFrame(() => {
        if (listContainerRef.current && savedListScroll !== null && savedListScroll !== undefined) {
          listContainerRef.current.scrollTop = savedListScroll;
        }
        if (detailsContainerRef.current && savedDetailsScroll > 0) {
          detailsContainerRef.current.scrollTop = savedDetailsScroll;
        }
      });
    } catch (err) {
      console.error('Erro geral ao salvar acurácia:', err);
      alert('Erro ao salvar acurácia: ' + (err.message || 'Tente novamente'));
    } finally {
      setIsSavingAcuracia(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredLeads.length === 0) {
      alert("Nenhum lead para exportar.");
      return;
    }

    // Cabecalhos do CSV
    const headers = [
      'Data de Entrada',
      'Nome',
      'Telefone',
      'Email',
      'Empresa',
      'Cargo',
      'Departamento',
      'Motivo',
      'Resumo',
      'Status Ticket',
      'Encaminhado Internamente',
      'Destinatários do Encaminhamento',
      'Data de Encaminhamento',
      'Respondido ao Contato',
      'Canal de Resposta',
      'Data da Resposta',
      'Respondido Por',
      'Observação da Resposta',
      'Avaliação IA (Correta?)',
      'Depto Correto'
    ];
    
    // Tratamento de escape de aspas e quebras de linha em cada célula
    const escapeCsv = (str) => {
      if (str == null) return '""';
      const s = String(str).replace(/"/g, '""'); // escapa aspas
      return `"${s}"`; // envolve em aspas
    };

    const canalLabels = {
      email: 'E-mail',
      whatsapp: 'WhatsApp',
      telefone: 'Telefone',
      reuniao: 'Presencial / Reunião',
      outro: 'Outro'
    };

    const csvContent = [
      headers.join(';'), // Usando Ponto e Virgula pro Excel BR
      ...filteredLeads.map(lead => {
        const rating = lead.transferencia_correta === true ? 'Sim' : (lead.transferencia_correta === false ? 'Não' : 'N/A');
        const ticketLabel = lead.ticket_status === 'concluido' ? 'Concluído' : (lead.ticket_status === 'nao_concluido' ? 'Não Concluído' : 'Pendente');
        const fwd = forwardStatuses[String(lead.id)];
        const resp = getResponseStatus(lead.id);

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
          ticketLabel,
          fwd?.encaminhado ? 'Sim' : 'Não',
          fwd?.destinatarios || '',
          fwd?.dataEnvio ? new Date(fwd.dataEnvio).toLocaleString('pt-BR') : '',
          resp?.respondido ? 'Sim' : 'Não',
          resp?.canal ? (canalLabels[resp.canal] || resp.canal) : '',
          resp?.dataResposta ? new Date(resp.dataResposta).toLocaleString('pt-BR') : '',
          resp?.respondidoPor || '',
          resp?.observacao || '',
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
          {isAdmin && (
            <button
              onClick={handleResetOldForwardedStatuses}
              title="Identifica e corrige leads que ficaram marcados como 'Respondidos' pelo sistema antigo de encaminhamento sem ter confirmação de contato real."
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'transparent',
                border: '1px dashed var(--color-border)',
                color: 'var(--color-text-tertiary)',
                fontSize: '0.75rem',
                padding: '5px 10px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                marginLeft: '4px'
              }}
            >
              <RefreshCw size={12} /> Saneamento Legado
            </button>
          )}
        </div>
      </div>

      {/* Indicadores Reais de Atendimento & Despacho */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
        <div 
          onClick={() => setResponseFilter('all')}
          style={{ 
            background: 'var(--color-bg-card)', 
            padding: '10px 14px', 
            borderRadius: 'var(--radius-lg)', 
            border: responseFilter === 'all' ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total de Leads</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '2px' }}>{kpiStats.total}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '1px' }}>no período selecionado</div>
        </div>

        <div 
          onClick={() => setResponseFilter('sem_resposta')}
          style={{ 
            background: responseFilter === 'sem_resposta' ? 'rgba(239,68,68,0.08)' : 'var(--color-bg-card)', 
            padding: '10px 14px', 
            borderRadius: 'var(--radius-lg)', 
            border: responseFilter === 'sem_resposta' ? '2px solid #ef4444' : '1px solid var(--color-border)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={13} /> Sem Resposta ao Contato
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ef4444', marginTop: '2px' }}>{kpiStats.semResposta}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '1px' }}>aguardando retorno</div>
        </div>

        <div 
          onClick={() => setResponseFilter('respondido')}
          style={{ 
            background: responseFilter === 'respondido' ? 'rgba(16,185,129,0.08)' : 'var(--color-bg-card)', 
            padding: '10px 14px', 
            borderRadius: 'var(--radius-lg)', 
            border: responseFilter === 'respondido' ? '2px solid #10b981' : '1px solid var(--color-border)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle size={13} /> Respondidos ao Contato
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10b981', marginTop: '2px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span>{kpiStats.respondidos}</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10b981' }}>({kpiStats.taxaResposta}%)</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '1px' }}>atendimento registrado</div>
        </div>

        <div 
          onClick={() => setResponseFilter('encaminhado')}
          style={{ 
            background: responseFilter === 'encaminhado' ? 'rgba(59,130,246,0.08)' : 'var(--color-bg-card)', 
            padding: '10px 14px', 
            borderRadius: 'var(--radius-lg)', 
            border: responseFilter === 'encaminhado' ? '2px solid #3b82f6' : '1px solid var(--color-border)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Send size={13} /> Encaminhados p/ Áreas
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#3b82f6', marginTop: '2px' }}>{kpiStats.encaminhados}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '1px' }}>despacho interno</div>
        </div>
      </div>

      {/* Container Principal: Split View */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: '14px', flex: 1, minHeight: 0 }}>
        
        {/* Painel da Esquerda: Lista de Leads */}
        <div className="panel" style={{ width: '320px', minWidth: '280px', maxWidth: '340px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
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
          
          <div 
            ref={listContainerRef}
            onScroll={(e) => {
              lastScrollTopRef.current = e.currentTarget.scrollTop;
            }}
            style={{ flex: 1, overflowY: 'auto', padding: '12px' }}
          >
            {loading && leadsList.length === 0 ? (
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
                          {/* Badge de Encaminhamento Interno */}
                          {(() => {
                            const fwd = forwardStatuses[String(lead.id)];
                            if (fwd?.encaminhado) {
                              return (
                                <span 
                                  title={`Encaminhado para: ${fwd.destinatarios || 'área'}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '2px 7px',
                                    borderRadius: '4px',
                                    background: 'rgba(59,130,246,0.1)',
                                    color: '#2563eb',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    border: '1px solid rgba(59,130,246,0.25)'
                                  }}
                                >
                                  📤 Encaminhado
                                </span>
                              );
                            }
                            return null;
                          })()}

                          {/* Badge de Resposta ao Contato */}
                          {(() => {
                            const resp = getResponseStatus(lead.id);
                            const isReplied = !!resp?.respondido;
                            const canalIcons = {
                              email: '✉',
                              whatsapp: '💬',
                              telefone: '📞',
                              reuniao: '🤝',
                              outro: '📌'
                            };
                            const icon = (resp?.canal && canalIcons[resp.canal]) || '✓';

                            if (isReplied) {
                              return (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: 'rgba(16,185,129,0.1)',
                                  color: '#10b981',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  border: '1px solid rgba(16,185,129,0.25)'
                                }}>
                                  {icon} Respondido
                                </span>
                              );
                            }
                            return (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: 'rgba(239,68,68,0.08)',
                                color: '#ef4444',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                border: '1px solid rgba(239,68,68,0.2)'
                              }}>
                                ⏳ Sem Resposta
                              </span>
                            );
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
            <div ref={detailsContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              
              {/* Header do Detalhe - Totalmente Responsivo */}
              <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)' }}>
                {/* Linha 1: Nome do Lead */}
                <div style={{ marginBottom: '8px' }}>
                  <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.25, wordBreak: 'break-word' }}>
                    {selectedLead.nome || 'Lead Anônimo'}
                  </h2>
                </div>

                {/* Linha 2: Badges e Metadados (em linha flexível contínua) */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
                  <span>Entrou em: {new Date(selectedLead.created_at).toLocaleString('pt-BR')}</span>
                  
                  {selectedLead.departamento && (
                    <span style={{ background: 'var(--color-warning)', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                      {selectedLead.departamento}
                    </span>
                  )}

                  {/* Status de Encaminhamento */}
                  {(() => {
                    const fwd = forwardStatuses[String(selectedLead.id)];
                    if (fwd?.encaminhado) {
                      return (
                        <span 
                          title={`Destinatários: ${fwd.destinatarios || 'área'}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'rgba(59,130,246,0.1)',
                            color: '#2563eb',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            border: '1px solid rgba(59,130,246,0.25)'
                          }}
                        >
                          📤 Encaminhado p/ Área
                        </span>
                      );
                    }
                    return (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'var(--color-bg-hover)',
                        color: 'var(--color-text-secondary)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        border: '1px solid var(--color-border)'
                      }}>
                        📤 Não Encaminhado
                      </span>
                    );
                  })()}

                  {/* Status de Resposta ao Contato */}
                  {(() => {
                    const resp = getResponseStatus(selectedLead.id);
                    const isReplied = !!resp?.respondido;
                    const canalMap = {
                      email: 'E-mail',
                      whatsapp: 'WhatsApp',
                      telefone: 'Ligação',
                      reuniao: 'Presencial',
                      outro: 'Outro'
                    };
                    const canalStr = resp?.canal ? (canalMap[resp.canal] || resp.canal) : 'E-mail';

                    return (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: isReplied ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                        color: isReplied ? '#10b981' : '#ef4444',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        border: isReplied ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(239,68,68,0.25)'
                      }}>
                        {isReplied ? `✓ Respondido (${canalStr})` : '⏳ Sem Resposta ao Contato'}
                      </span>
                    );
                  })()}
                </div>

                {/* Linha 3: Barra de Ações do Lead (Ação de Toolbar adaptável) */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--color-border)' }}>
                  <button
                    id="btn-registrar-resposta-header"
                    onClick={() => handleOpenResponseModal(selectedLead)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: getResponseStatus(selectedLead.id)?.respondido 
                        ? 'var(--color-bg-hover)' 
                        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: getResponseStatus(selectedLead.id)?.respondido ? 'var(--color-text-secondary)' : '#fff',
                      border: getResponseStatus(selectedLead.id)?.respondido ? '1px solid var(--color-border)' : 'none',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: getResponseStatus(selectedLead.id)?.respondido ? 'none' : '0 2px 6px rgba(16,185,129,0.25)'
                    }}
                  >
                    <CheckCircle size={15} /> 
                    {getResponseStatus(selectedLead.id)?.respondido ? 'Alterar Resposta' : 'Registrar Resposta'}
                  </button>

                  <button
                    id="btn-ver-conversa"
                    onClick={() => setShowChatModal(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-bg-card)',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border)',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'}
                    onMouseOut={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-card)'}
                  >
                    <MessageSquare size={15} /> Ver conversa
                  </button>

                  {responsibleEmails && (
                    <button
                      id="btn-encaminhar-direto"
                      onClick={() => handleForwardDirect(responsibleEmails)}
                      disabled={sendingForward}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 14px',
                        borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#fff',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 2px 6px rgba(16,185,129,0.25)'
                      }}
                      onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                      onMouseOut={e => e.currentTarget.style.filter = 'none'}
                    >
                      <Send size={15} /> Encaminhar p/ Responsável
                    </button>
                  )}

                  <button
                    id="btn-encaminhar-lead"
                    onClick={() => { setShowForwardModal(true); setForwardStep('input'); }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-accent)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                    onMouseOut={e => e.currentTarget.style.filter = 'none'}
                  >
                    <Mail size={15} /> Encaminhar Lead
                  </button>

                  {isAdmin && !isEditingLead && (
                    <button
                      id="btn-editar-ficha-lead"
                      onClick={() => {
                        setIsEditingLead(true);
                        setEditForm({
                          nome: selectedLead.nome || '',
                          empresa: selectedLead.empresa || '',
                          telefone: selectedLead.telefone || '',
                          email: selectedLead.email || '',
                          cargo: selectedLead.cargo || '',
                          departamento: selectedLead.departamento || '',
                          motivo: selectedLead.motivo || '',
                          resumo: selectedLead.resumo || ''
                        });
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 14px',
                        borderRadius: 'var(--radius-md)',
                        background: 'transparent',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-accent)'; }}
                      onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
                    >
                      <Pencil size={15} /> Editar Ficha
                    </button>
                  )}
                </div>
              </div>

              {isEditingLead ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  
                  {/* Grid de Informações Curtas */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '24px' }}>
                    
                    {/* Contato */}
                    <div style={{ background: 'var(--color-bg-hover)', padding: '20px', borderRadius: 'var(--radius-lg)' }}>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                        <User size={16} /> Informações de Contato
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Nome</label>
                          <input
                            type="text"
                            value={editForm.nome}
                            onChange={e => setEditForm(p => ({ ...p, nome: e.target.value }))}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Telefone</label>
                          <input
                            type="text"
                            value={editForm.telefone}
                            onChange={e => setEditForm(p => ({ ...p, telefone: e.target.value }))}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>E-mail</label>
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Profissional */}
                    <div style={{ background: 'var(--color-bg-hover)', padding: '20px', borderRadius: 'var(--radius-lg)' }}>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                        <Briefcase size={16} /> Dados Profissionais & Área
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Empresa</label>
                          <input
                            type="text"
                            value={editForm.empresa}
                            onChange={e => setEditForm(p => ({ ...p, empresa: e.target.value }))}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Cargo</label>
                          <input
                            type="text"
                            value={editForm.cargo}
                            onChange={e => setEditForm(p => ({ ...p, cargo: e.target.value }))}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Área (Departamento)</label>
                          <select
                            value={editForm.departamento}
                            onChange={e => setEditForm(p => ({ ...p, departamento: e.target.value }))}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.9rem', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
                          >
                            <option value="">Sem área definida</option>
                            {AREAS_LIST.map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Long Texts */}
                  <div>
                    <h4 style={{ fontSize: '1.05rem', color: 'var(--color-text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                      <ArrowRight size={18} color="var(--color-accent)" /> Motivo do Contato
                    </h4>
                    <textarea
                      value={editForm.motivo}
                      onChange={e => setEditForm(p => ({ ...p, motivo: e.target.value }))}
                      style={{ width: '100%', minHeight: '120px', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.95rem', lineHeight: '1.6', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <h4 style={{ fontSize: '1.05rem', color: 'var(--color-text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                      <AlignLeft size={18} color="var(--color-accent)" /> Resumo Sistematizado da Conversa
                    </h4>
                    <textarea
                      value={editForm.resumo}
                      onChange={e => setEditForm(p => ({ ...p, resumo: e.target.value }))}
                      style={{ width: '100%', minHeight: '180px', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.95rem', lineHeight: '1.8', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Edit Actions */}
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--color-border-light)' }}>
                    <button
                      onClick={() => setIsEditingLead(false)}
                      style={{ padding: '10px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveLeadEdits}
                      disabled={savingLeadEdits}
                      style={{ padding: '10px 22px', borderRadius: 'var(--radius-md)', background: 'var(--color-accent)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}
                    >
                      <CheckCircle size={16} /> {savingLeadEdits ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                  </div>

                </div>
              ) : (
                <>
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
                </>
              )}

              {/* Box de Acurácia (Avaliação do Gestor) */}
              {(selectedLead.departamento || helenaOriginalDept) && (
                <div style={{ marginTop: '40px', background: 'var(--color-bg-hover)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
                    <h4 style={{ fontSize: '1.05rem', color: 'var(--color-text-primary)', margin: 0, fontWeight: 700 }}>
                      Avaliação de Acurácia da IA
                    </h4>
                    {/* Badge indicando se o lead está atualmente redirecionado */}
                    {(selectedLead.transferencia_correta === false || acuraciaLocal[selectedLead.id]?.isCorrect === false) && (
                      <span style={{ fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.12)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '4px 10px', borderRadius: 'var(--radius-full)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Check size={13} /> Direcionamento atual: {selectedLead.departamento}
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                    A Helena transferiu este lead para <strong>{helenaOriginalDept || selectedLead.departamento}</strong>. O direcionamento e a qualificação foram corretos?
                  </p>

                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* MODO DE EDIÇÃO / CORREÇÃO (quando clica em Refazer ou em "Não, foi incorreta") */}
                    {(editingAcuraciaLeadId === selectedLead.id || activeTabAcuracia === 'incorrect') ? (
                      <div style={{ background: 'var(--color-bg-inner)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', width: '100%', boxSizing: 'border-box', animation: 'fadeIn 0.25s ease' }}>
                        <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-text-primary)', display: 'block', marginBottom: '10px' }}>
                          Para qual área este lead deveria ter sido direcionado?
                        </label>

                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <select
                            value={selectedCorrectDept}
                            onChange={(e) => setSelectedCorrectDept(e.target.value)}
                            style={{
                              flex: 1,
                              minWidth: '240px',
                              maxWidth: '380px',
                              padding: '11px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-border)',
                              background: 'var(--color-bg-input)',
                              color: 'var(--color-text-primary)',
                              fontSize: '0.92rem',
                              fontWeight: 500,
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="">-- Selecione a área correta --</option>
                            {allAvailableAreas.map(areaName => {
                              const isInitial = areaName.toLowerCase() === (helenaOriginalDept || selectedLead.departamento || '').toLowerCase();
                              return (
                                <option key={areaName} value={areaName}>
                                  {areaName} {isInitial ? '(Atribuída inicialmente)' : ''}
                                </option>
                              );
                            })}
                          </select>

                          <button 
                            onClick={() => handleSaveAcuracia(selectedLead.id, false, selectedCorrectDept)}
                            disabled={!selectedCorrectDept || isSavingAcuracia}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '11px 22px',
                              background: 'var(--color-accent)',
                              color: 'white',
                              border: 'none',
                              borderRadius: 'var(--radius-md)',
                              fontWeight: 600,
                              fontSize: '0.9rem',
                              cursor: (!selectedCorrectDept || isSavingAcuracia) ? 'not-allowed' : 'pointer',
                              opacity: (!selectedCorrectDept || isSavingAcuracia) ? 0.5 : 1,
                              transition: 'opacity 0.2s'
                            }}
                          >
                            {isSavingAcuracia ? 'Salvando...' : 'Confirmar e Redirecionar'}
                          </button>

                          <button 
                            onClick={() => {
                              setEditingAcuraciaLeadId(null);
                              setActiveTabAcuracia(null);
                              setSelectedCorrectDept('');
                            }}
                            disabled={isSavingAcuracia}
                            style={{
                              padding: '11px 16px',
                              background: 'transparent',
                              color: 'var(--color-text-tertiary)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-md)',
                              fontWeight: 500,
                              fontSize: '0.85rem',
                              cursor: 'pointer'
                            }}
                          >
                            Cancelar
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-tertiary)' }}>
                            💡 O sistema utilizará a área selecionada para realizar o direcionamento automático do lead.
                          </span>
                          
                          <button
                            onClick={() => handleSaveAcuracia(selectedLead.id, true)}
                            disabled={isSavingAcuracia}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-success)',
                              fontSize: '0.82rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontWeight: 600,
                              textDecoration: 'underline'
                            }}
                          >
                            <CheckCircle size={14} /> Na verdade foi correta (Sim)
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Botões de Ação Dinâmicos */}
                        {acuraciaLocal[selectedLead.id]?.isCorrect === true || (selectedLead.transferencia_correta === true && acuraciaLocal[selectedLead.id]?.isCorrect !== false && acuraciaLocal[selectedLead.id]?.isCorrect !== null) ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)', fontWeight: 600, fontSize: '0.9rem', padding: '8px 16px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-md)' }}>
                              <CheckCircle size={18} /> Triagem classificada como Correta!
                            </div>
                            <button 
                              onClick={() => {
                                setEditingAcuraciaLeadId(selectedLead.id);
                                setActiveTabAcuracia('incorrect');
                                setSelectedCorrectDept('');
                              }} 
                              style={{ background: 'transparent', border: 'none', color: 'var(--color-text-tertiary)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              <RotateCcw size={14} /> Refazer
                            </button>
                          </div>
                        ) : acuraciaLocal[selectedLead.id]?.isCorrect === false || (selectedLead.transferencia_correta === false && acuraciaLocal[selectedLead.id]?.isCorrect !== null && acuraciaLocal[selectedLead.id]?.isCorrect !== true) ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-error)', fontWeight: 600, fontSize: '0.9rem', padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-md)' }}>
                              <XCircle size={18} /> Triagem Incorreta (Deveria ser p/ {acuraciaLocal[selectedLead.id]?.correctDeptText || selectedLead.departamento_correto})
                            </div>
                            <button 
                              onClick={() => {
                                setEditingAcuraciaLeadId(selectedLead.id);
                                setActiveTabAcuracia('incorrect');
                                const currentDept = acuraciaLocal[selectedLead.id]?.correctDeptText || selectedLead.departamento_correto || '';
                                const matched = allAvailableAreas.find(a => a.toLowerCase() === currentDept.toLowerCase()) || '';
                                setSelectedCorrectDept(matched);
                              }} 
                              style={{ background: 'transparent', border: 'none', color: 'var(--color-text-tertiary)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              <RotateCcw size={14} /> Refazer
                            </button>
                          </div>
                        ) : (
                          <>
                            <button 
                              onClick={() => handleSaveAcuracia(selectedLead.id, true)}
                              disabled={isSavingAcuracia}
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--color-success)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s' }}
                              onMouseOver={(e) => e.currentTarget.style.opacity = 0.8}
                              onMouseOut={(e) => e.currentTarget.style.opacity = 1}
                            >
                              <CheckCircle size={18} /> Sim, foi correta
                            </button>

                            <button 
                              onClick={() => {
                                setEditingAcuraciaLeadId(selectedLead.id);
                                setActiveTabAcuracia('incorrect');
                                setSelectedCorrectDept('');
                              }}
                              disabled={isSavingAcuracia}
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'transparent', color: 'var(--color-error)', border: '1px solid var(--color-error)', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}
                              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <XCircle size={18} /> Não, foi incorreta
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Card de Atendimento / Resposta ao Contato */}
              <div style={{ marginTop: '24px', background: 'var(--color-bg-hover)', borderRadius: 'var(--radius-lg)', padding: '24px', border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MessageCircle size={18} color="var(--color-accent)" /> Atendimento ao Contato (Retorno ao Lead)
                    </h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
                      Controle real se este contato recebido via Helena já foi atendido por alguém da equipe.
                    </p>
                  </div>
                  <button
                    onClick={() => handleOpenResponseModal(selectedLead)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-accent)',
                      color: '#fff',
                      border: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <CheckCircle size={14} />
                    {getResponseStatus(selectedLead.id)?.respondido ? 'Editar Registro de Resposta' : 'Registrar Resposta Agora'}
                  </button>
                </div>

                {(() => {
                  const resp = getResponseStatus(selectedLead.id);
                  if (resp?.respondido) {
                    const canalLabels = {
                      email: 'E-mail',
                      whatsapp: 'WhatsApp',
                      telefone: 'Ligação Telefônica',
                      reuniao: 'Presencial / Reunião',
                      outro: 'Outro Canal'
                    };
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-bg-card)', padding: '16px 20px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.3)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            background: 'rgba(16,185,129,0.15)',
                            color: '#10b981',
                            fontWeight: 700,
                            fontSize: '0.85rem'
                          }}>
                            ✓ Respondido via {canalLabels[resp.canal] || resp.canal || 'E-mail'}
                          </span>
                          {resp.dataResposta && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
                              Em: {new Date(resp.dataResposta).toLocaleString('pt-BR')}
                            </span>
                          )}
                        </div>

                        {resp.respondidoPor && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                            <strong>Atendente responsável:</strong> {resp.respondidoPor} {resp.respondidoPorEmail ? `(${resp.respondidoPorEmail})` : ''}
                          </div>
                        )}

                        {resp.observacao && (
                          <div style={{ background: 'var(--color-bg-hover)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
                            <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--color-text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Observações do Atendimento:</strong>
                            {resp.observacao}
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                          <button
                            onClick={async () => {
                              if (window.confirm("Deseja desmarcar a resposta deste lead e marcá-lo como 'Sem Resposta ao Contato'?")) {
                                await saveContactResponse(selectedLead.id, { respondido: false });
                              }
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-error)',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              textDecoration: 'underline'
                            }}
                          >
                            Desmarcar resposta (voltar para Sem Resposta)
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'rgba(239,68,68,0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.2)', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Clock size={20} color="#ef4444" />
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ef4444' }}>Aguardando Retorno ao Cliente</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Este contato ainda não possui registro de retorno por e-mail, WhatsApp ou telefone.</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenResponseModal(selectedLead)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 'var(--radius-md)',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#fff',
                          border: 'none',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(16,185,129,0.3)'
                        }}
                      >
                        Registrar Resposta Agora
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* Histórico de Alterações (Auditoria) */}
              {isAdmin && (
                <div style={{ marginTop: '40px', paddingTop: '32px', borderTop: '1px solid var(--color-border)' }}>
                  <h4 style={{ fontSize: '1.05rem', color: 'var(--color-text-primary)', marginBottom: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <History size={18} color="var(--color-accent)" /> Histórico de Alterações (Auditoria)
                  </h4>
                  
                  {loadingEditHistory ? (
                    <div style={{ fontSize: '0.88rem', color: 'var(--color-text-tertiary)' }}>Carregando auditoria...</div>
                  ) : editHistory.length === 0 ? (
                    <div style={{ padding: '16px', background: 'var(--color-bg-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '0.85rem', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                      Nenhuma alteração registrada para este lead.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {editHistory.map(log => (
                        <div
                          key={log.id}
                          style={{
                            background: 'var(--color-bg-hover)',
                            padding: '16px 20px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            fontSize: '0.85rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--color-text-tertiary)', fontSize: '0.78rem' }}>
                            <span>Alterado por: <strong>{log.editorNome}</strong> ({log.editorEmail})</span>
                            <span>{new Date(log.dataAlteracao).toLocaleString('pt-BR')}</span>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                            {Object.entries(log.alteracoes || {}).map(([campo, diff]) => (
                              <div key={campo} style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
                                • Campo <strong style={{ textTransform: 'capitalize' }}>{campo}</strong>: 
                                <span style={{ color: 'var(--color-error)', textDecoration: 'line-through', marginLeft: '6px' }}>
                                  "{diff.antes || 'vazio'}"
                                </span>
                                <span style={{ color: 'var(--color-text-tertiary)', margin: '0 6px' }}>➔</span>
                                <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                                  "{diff.depois || 'vazio'}"
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Histórico de Encaminhamentos */}
              <div style={{ marginTop: '40px', paddingTop: '32px', borderTop: '1px solid var(--color-border)' }}>
                <h4 style={{ fontSize: '1.05rem', color: 'var(--color-text-primary)', marginBottom: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History size={18} color="var(--color-accent)" /> Histórico de Encaminhamentos
                </h4>
                
                {loadingHistory ? (
                  <div style={{ fontSize: '0.88rem', color: 'var(--color-text-tertiary)' }}>Carregando histórico...</div>
                ) : forwardHistory.length === 0 ? (
                  <div style={{ padding: '16px', background: 'var(--color-bg-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '0.85rem', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                    Este lead ainda não foi encaminhado por e-mail.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {forwardHistory.map(log => (
                      <div
                        key={log.id}
                        style={{
                          background: 'var(--color-bg-hover)',
                          padding: '16px 20px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          fontSize: '0.85rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--color-text-tertiary)', fontSize: '0.78rem' }}>
                          <span>Enviado por: <strong>{log.remetenteNome}</strong> ({log.remetenteEmail})</span>
                          <span>{new Date(log.dataEnvio).toLocaleString('pt-BR')}</span>
                        </div>
                        <div style={{ color: 'var(--color-text-primary)' }}>
                          Destinatários: <strong style={{ color: 'var(--color-accent)' }}>{log.destinatarios}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

      </div>

      {/* Modal de Registro de Resposta ao Contato */}
      {showResponseModal && selectedLead && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-xl, 16px)', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', width: '100%', maxWidth: '540px', overflow: 'hidden', animation: 'slideDown 0.2s ease-out', border: '1px solid var(--color-border)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '24px 28px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <CheckCircle size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>Registrar Resposta ao Contato</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-tertiary)', margin: '2px 0 0 0' }}>Confirme o retorno real concedido a este lead</p>
                </div>
              </div>
              <button 
                onClick={() => setShowResponseModal(false)} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: '4px' }}
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Card Resumo do Lead */}
              <div style={{ background: 'var(--color-bg-hover)', padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px', fontSize: '0.95rem' }}>
                  {selectedLead.nome || 'Lead Anônimo'}
                </div>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
                  {selectedLead.email && <span>✉ {selectedLead.email}</span>}
                  {selectedLead.telefone && <span>💬 {selectedLead.telefone}</span>}
                  {selectedLead.empresa && <span>🏢 {selectedLead.empresa}</span>}
                </div>
              </div>

              {/* Canal de Resposta */}
              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Canal Utilizado para Responder *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'email', label: 'E-mail', icon: '✉' },
                    { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
                    { id: 'telefone', label: 'Ligação', icon: '📞' },
                    { id: 'reuniao', label: 'Presencial', icon: '🤝' },
                    { id: 'outro', label: 'Outro', icon: '📌' }
                  ].map(c => {
                    const isSelected = responseForm.canal === c.id;
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setResponseForm(p => ({ ...p, canal: c.id }))}
                        style={{
                          padding: '10px 8px',
                          borderRadius: 'var(--radius-md)',
                          border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                          background: isSelected ? 'rgba(59,130,246,0.08)' : 'var(--color-bg-card)',
                          color: isSelected ? 'var(--color-accent)' : 'var(--color-text-primary)',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span>{c.icon}</span> {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Data e Hora */}
              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Data e Hora do Atendimento *
                </label>
                <input
                  type="datetime-local"
                  value={responseForm.dataResposta}
                  onChange={e => setResponseForm(p => ({ ...p, dataResposta: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Observação / Detalhes */}
              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Observações / Resumo da Resposta (Opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex.: Enviado e-mail com informações do edital de inovação e tiradas as dúvidas sobre os requisitos..."
                  value={responseForm.observacao}
                  onChange={e => setResponseForm(p => ({ ...p, observacao: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.85rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 28px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-card)' }}>
              <div>
                {getResponseStatus(selectedLead.id)?.respondido && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm("Desmarcar a resposta deste lead e marcá-lo como 'Sem Resposta ao Contato'?")) {
                        setSavingResponse(true);
                        await saveContactResponse(selectedLead.id, { respondido: false });
                        setSavingResponse(false);
                        setShowResponseModal(false);
                      }
                    }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-error)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Marcar como Sem Resposta
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowResponseModal(false)}
                  style={{ padding: '10px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingResponse}
                  onClick={async () => {
                    setSavingResponse(true);
                    const res = await saveContactResponse(selectedLead.id, {
                      respondido: true,
                      canal: responseForm.canal,
                      dataResposta: responseForm.dataResposta ? new Date(responseForm.dataResposta).toISOString() : new Date().toISOString(),
                      observacao: responseForm.observacao
                    });
                    setSavingResponse(false);
                    if (res?.success) {
                      setShowResponseModal(false);
                    }
                  }}
                  style={{
                    padding: '10px 22px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#fff',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(16,185,129,0.25)'
                  }}
                >
                  {savingResponse ? 'Salvando...' : 'Salvar Resposta ao Contato'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Encaminhamento por E-mail */}
      {showForwardModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-xl, 16px)', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', width: '100%', maxWidth: '600px', overflow: 'hidden', animation: 'slideDown 0.2s ease-out' }}>
            
            {/* Header */}
            <div style={{ padding: '24px 28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail size={18} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Encaminhar Lead por E-mail</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-tertiary)' }}>Envie os dados formatados do lead</p>
                </div>
              </div>
              <button onClick={() => { setShowForwardModal(false); setForwardRecipients(''); setForwardStep('input'); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: '4px' }}>
                <XCircle size={20} />
              </button>
            </div>

            {/* Content & Footer */}
            {forwardStep === 'success' ? (
              <div style={{ padding: '30px 28px', textAlign: 'center' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#e6f4ea', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#137333' }}>
                  <CheckCircle size={32} />
                </div>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '8px' }}>E-mail Pronto para Envio!</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: '1.5', margin: '0 0 20px 0' }}>
                  O e-mail formatado (HTML) com a <strong>logo do Parque Tecnológico</strong> e a ficha completa do lead foi copiado para sua área de transferência.
                </p>
                <div style={{ background: 'var(--color-bg-inner)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '16px', fontSize: '0.85rem', color: 'var(--color-text-secondary)', textAlign: 'left', marginBottom: '24px' }}>
                  <strong style={{ color: 'var(--color-text-primary)', display: 'block', marginBottom: '8px' }}>👉 Próximos passos:</strong>
                  <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
                    <li>Aguarde a janela de composição do seu provedor de e-mail carregar.</li>
                    <li>Clique no corpo do e-mail (onde escreve a mensagem).</li>
                    <li>Pressione <strong>Ctrl+V</strong> (ou <strong>Cmd+V</strong> no Mac) para colar o template formatado.</li>
                    <li>Revise e envie o e-mail!</li>
                  </ol>
                </div>
                <button
                  onClick={() => { setShowForwardModal(false); setForwardRecipients(''); setForwardStep('input'); }}
                  style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--color-accent)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  Fechar Janela
                </button>
              </div>
            ) : (
              <>
                {/* Content */}
                <div style={{ padding: '24px 28px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Recipients */}
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Destinatários (separe múltiplos por vírgula) *
                      </label>
                      <input
                        type="text"
                        placeholder="exemplo1@agenciainova.org.br, exemplo2@agenciainova.org.br"
                        value={forwardRecipients}
                        onChange={e => setForwardRecipients(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* Provedor de E-mail */}
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                        Enviar usando:
                      </label>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--color-text-primary)', cursor: 'pointer', userSelect: 'none' }}>
                          <input
                            type="radio"
                            name="emailProvider"
                            value="gmail"
                            checked={emailProvider === 'gmail'}
                            onChange={() => setEmailProvider('gmail')}
                            style={{ cursor: 'pointer' }}
                          />
                          Gmail / Google Workspace (Web)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--color-text-primary)', cursor: 'pointer', userSelect: 'none' }}>
                          <input
                            type="radio"
                            name="emailProvider"
                            value="system"
                            checked={emailProvider === 'system'}
                            onChange={() => setEmailProvider('system')}
                            style={{ cursor: 'pointer' }}
                          />
                          E-mail Padrão do Sistema (mailto)
                        </label>
                      </div>
                    </div>

                    {/* Checkbox to include history */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-primary)', marginTop: '4px', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={includeChatHistory}
                        onChange={e => setIncludeChatHistory(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>Incluir histórico de conversas do WhatsApp ({chatMessages.length} mensagens)</span>
                    </label>

                    {/* Email Preview */}
                    {selectedLeadId && (() => {
                      const lead = filteredLeads.find(l => l.id === selectedLeadId);
                      if (!lead) return null;
                      return (
                        <div>
                          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                            Pré-visualização da Mensagem (E-mail)
                          </label>
                          <div style={{
                            background: 'var(--color-bg-inner)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '16px',
                            fontSize: '0.82rem',
                            color: 'var(--color-text-secondary)',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            fontFamily: 'monospace',
                            whiteSpace: 'pre-wrap',
                            lineHeight: '1.4'
                          }}>
                            <strong>Assunto:</strong> [Lead PTS] Encaminhamento de Lead - {lead.nome || 'Anônimo'}{'\n\n'}
                            Olá,{'\n\n'}
                            Segue o encaminhamento dos dados do lead de atendimento do PTS:{'\n\n'}
                            • Nome: {lead.nome || '—'}{'\n'}
                            • Empresa: {lead.empresa || '—'}{'\n'}
                            • E-mail: {lead.email || '—'}{'\n'}
                            • Telefone: {lead.telefone || '—'}{'\n'}
                            • Cargo: {lead.cargo || '—'}{'\n'}
                            • Departamento/Área: {lead.departamento || '—'}{'\n\n'}
                            <strong>Motivo do Atendimento:</strong>{'\n'}{lead.motivo || '—'}{'\n\n'}
                            <strong>Resumo do Atendimento:</strong>{'\n'}{lead.resumo || '—'}{'\n\n'}
                            {includeChatHistory && (
                              <>
                                <strong>Histórico de Conversas (WhatsApp):</strong>{'\n'}
                                {formatChatMessages(chatMessages)}{'\n\n'}
                              </>
                            )}
                            <strong>Links de Avaliação (Ação Direta do Gestor):</strong>{'\n'}
                            👉 Acurácia Correta: mailto:contato@agenciainova.org.br?subject=Retorno...{'\n'}
                            👉 Acurácia Incorreta: mailto:contato@agenciainova.org.br?subject=Retorno...
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '16px 28px 24px', borderTop: '1px solid var(--color-border-light)' }}>
                  <button
                    type="button"
                    onClick={() => { setShowForwardModal(false); setForwardRecipients(''); setForwardStep('input'); }}
                    style={{ padding: '10px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={sendingForward}
                    onClick={handleSendForward}
                    style={{ padding: '10px 22px', borderRadius: 'var(--radius-md)', background: 'var(--color-accent)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}
                  >
                    <Send size={15} /> {sendingForward ? 'Encaminhando...' : 'Encaminhar'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* Modal de Visualização da Conversa do WhatsApp */}
      {showChatModal && selectedLead && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-xl, 16px)', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', width: '100%', maxWidth: '700px', height: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'slideDown 0.2s ease-out' }}>
            
            {/* Header */}
            <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
                  {selectedLead.nome ? selectedLead.nome.substring(0, 2).toUpperCase() : 'LD'}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                    {selectedLead.nome || 'Lead Anônimo'}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', margin: 0 }}>
                    WhatsApp: {selectedLead.telefone || 'Sem número'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowChatModal(false)} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: '4px' }}
              >
                <XCircle size={24} />
              </button>
            </div>

            {/* Conversation Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: 'var(--color-bg-inner)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {loadingChat ? (
                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.9rem' }}>
                  Carregando mensagens da conversa...
                </div>
              ) : formattedChatMessages.length === 0 ? (
                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                  Nenhuma mensagem de conversa encontrada para este lead.
                </div>
              ) : (
                formattedChatMessages.map((msg, index) => {
                  const isSentByLead = msg.cssColor === 'sent';
                  return (
                    <div 
                      key={msg.id || index} 
                      style={{ 
                        alignSelf: isSentByLead ? 'flex-end' : 'flex-start', 
                        maxWidth: '80%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isSentByLead ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div 
                        style={{ 
                          padding: '12px 16px',
                          borderRadius: '12px',
                          borderTopRightRadius: isSentByLead ? '0' : '12px',
                          borderTopLeftRadius: isSentByLead ? '12px' : '0',
                          backgroundColor: isSentByLead ? 'var(--color-bg-card)' : 'var(--color-accent)',
                          color: isSentByLead ? 'var(--color-text-primary)' : 'white',
                          border: isSentByLead ? '1px solid var(--color-border)' : 'none',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                          fontSize: '0.9rem',
                          lineHeight: '1.4'
                        }}
                        dangerouslySetInnerHTML={{ __html: msg.html }}
                      />
                      <div style={{ 
                        marginTop: '4px',
                        fontSize: '0.72rem', 
                        color: 'var(--color-text-tertiary)',
                        display: 'flex',
                        gap: '6px',
                        justifyContent: isSentByLead ? 'flex-end' : 'flex-start'
                      }}>
                        <span style={{ fontWeight: 600 }}>
                          {msg.sender === 'Helena' ? '🤖 Helena IA' : `🙎‍♂️ ${selectedLead.nome || 'Lead'}`}
                        </span>
                        <span>·</span>
                        <span>
                          {new Date(msg.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border)' }}>
              <button
                onClick={() => setShowChatModal(false)}
                style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', background: 'var(--color-accent)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
              >
                Fechar Conversa
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
