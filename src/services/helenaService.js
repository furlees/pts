import { supabase } from './supabase';

/**
 * Função utilitária para aplicar o filtro de datas em uma query do Supabase
 */
function applyDateFilter(query, dateColumn, startDate, endDate) {
  let q = query;
  if (startDate) {
    q = q.gte(dateColumn, startDate);
  }
  if (endDate) {
    q = q.lte(dateColumn, endDate);
  }
  return q;
}

// =============================================
// ATUALIZAÇÃO DE ACURÁCIA DO LEAD
// =============================================
export async function updateLeadAcuracia(leadId, isCorrect, correctDepartment = null) {
  try {
    const { data, error } = await supabase
      .from('dados_pts')
      .update({
        transferencia_correta: isCorrect,
        departamento_correto: correctDepartment
      })
      .eq('id', leadId)
      .select(); // Exige o retorno para validar
    
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error("Permissão Negada: Nenhuma linha foi atualizada. O 'Row Level Security (RLS)' do seu Supabase está bloqueando a edição na tabela dados_pts.");
    }
    
    return { error: null, success: true };
  } catch (err) {
    console.error('[HelenaService] Erro ao atualizar acurácia:', err);
    return { error: err.message || 'Erro ao atualizar.', success: false };
  }
}


// =============================================
// ATUALIZAÇÃO DO STATUS DO TICKET
// =============================================
export async function updateTicketStatus(leadId, status, justificativa = null) {
  try {
    const updatePayload = {
      ticket_status: status,
      ticket_justificativa: status === 'nao_concluido' ? justificativa : null,
      ticket_updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('dados_pts')
      .update(updatePayload)
      .eq('id', leadId)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error("Permissão Negada: Nenhuma linha foi atualizada. Verifique o RLS (Row Level Security) da tabela dados_pts no Supabase.");
    }

    return { error: null, success: true };
  } catch (err) {
    console.error('[HelenaService] Erro ao atualizar ticket:', err);
    return { error: err.message || 'Erro ao atualizar ticket.', success: false };
  }
}


// =============================================
// MÉTRICAS DE TICKETS DE FINALIZAÇÃO
// =============================================
export async function fetchTicketMetrics({ startDate, endDate } = {}) {
  let query = supabase
    .from('dados_pts')
    .select('id, nome, empresa, departamento, ticket_status, ticket_justificativa, ticket_updated_at, created_at')
    .order('created_at', { ascending: false });

  query = applyDateFilter(query, 'created_at', startDate, endDate);

  const { data, error } = await query;
  if (error) {
    console.error('[HelenaService] Erro fetchTicketMetrics:', error.message);
    return { metrics: null, leads: [], error };
  }

  const leads = data || [];
  const total = leads.length;
  const concluidos    = leads.filter(l => l.ticket_status === 'concluido').length;
  const naoConcluidos = leads.filter(l => l.ticket_status === 'nao_concluido').length;
  const pendentes     = total - concluidos - naoConcluidos;

  const pct = (n) => total > 0 ? parseFloat(((n / total) * 100).toFixed(1)) : 0;

  // Breakdown por área
  const areaMap = {};
  leads.forEach(l => {
    const area = l.departamento || 'Não definida';
    if (!areaMap[area]) areaMap[area] = { area, concluidos: 0, naoConcluidos: 0, pendentes: 0, total: 0 };
    areaMap[area].total++;
    if (l.ticket_status === 'concluido')          areaMap[area].concluidos++;
    else if (l.ticket_status === 'nao_concluido') areaMap[area].naoConcluidos++;
    else                                           areaMap[area].pendentes++;
  });
  const porArea = Object.values(areaMap).sort((a, b) => b.total - a.total);

  // Evolução diária (tickets finalizados)
  const evolucaoMap = {};
  leads.forEach(l => {
    if (!l.ticket_updated_at) return;
    const day = l.ticket_updated_at.slice(0, 10);
    if (!evolucaoMap[day]) evolucaoMap[day] = { day, concluidos: 0, naoConcluidos: 0 };
    if (l.ticket_status === 'concluido')          evolucaoMap[day].concluidos++;
    else if (l.ticket_status === 'nao_concluido') evolucaoMap[day].naoConcluidos++;
  });
  const evolucaoDiaria = Object.values(evolucaoMap)
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-30);

  // Áreas únicas para filtro dropdown
  const areasUnicas = [...new Set(leads.map(l => l.departamento).filter(Boolean))].sort();

  return {
    metrics: {
      total, concluidos, naoConcluidos, pendentes,
      pctConcluido: pct(concluidos),
      pctNaoConcluido: pct(naoConcluidos),
      pctPendente: pct(pendentes),
    },
    porArea,
    evolucaoDiaria,
    areasUnicas,
    leads,
    error: null,
  };
}



// =============================================
// TOTAL DE LEADS (dados_pts)
// =============================================

export async function fetchTotalLeads({ startDate, endDate } = {}) {
  let query = supabase
    .from('dados_pts')
    .select('*', { count: 'exact', head: true });

  query = applyDateFilter(query, 'created_at', startDate, endDate);

  const { count, error } = await query;
  if (error) console.error('[HelenaService] Erro Total Leads:', error.message);
  return { count: count || 0, error: error || null };
}

// =============================================
// LEADS TRANSFERIDOS (dados_pts com departamento)
// =============================================
export async function fetchLeadsTransferidos({ startDate, endDate } = {}) {
  let query = supabase
    .from('dados_pts')
    .select('*', { count: 'exact', head: true })
    .not('departamento', 'is', null)
    .neq('departamento', '');

  query = applyDateFilter(query, 'created_at', startDate, endDate);

  const { count, error } = await query;
  if (error) console.error('[HelenaService] Erro Leads Transferidos:', error.message);
  return { count: count || 0, error: error || null };
}

// =============================================
// LEADS ATENDIDOS (chat_pts) - CONTAGEM DE TELEFONES ÚNICOS
// =============================================
export async function fetchLeadsAtendidos({ startDate, endDate } = {}) {
  let uniqueSessions = new Set();
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  try {
    while (hasMore) {
      // Busca apenas a coluna session_id via paginação
      let query = supabase
        .from('chat_pts')
        .select('session_id')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      query = applyDateFilter(query, 'date', startDate, endDate);

      const { data, error } = await query;

      if (error) {
        console.error('[HelenaService] Erro Leads Atendidos Únicos:', error.message);
        return { count: 0, error };
      }

      if (data && data.length > 0) {
        data.forEach(row => {
          if (row.session_id) uniqueSessions.add(row.session_id);
        });
        if (data.length < pageSize) {
          hasMore = false; // Acabou
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    return { count: uniqueSessions.size, error: null };
  } catch (err) {
    console.error('[HelenaService] Exceção em Leads Atendidos:', err);
    return { count: 0, error: err };
  }
}

// =============================================
// LEADS POR DEPARTAMENTO (dados_pts)
// =============================================
export async function fetchLeadsPorDepartamento({ startDate, endDate } = {}) {
  let query = supabase
    .from('dados_pts')
    .select('departamento')
    .not('departamento', 'is', null)
    .neq('departamento', '');

  query = applyDateFilter(query, 'created_at', startDate, endDate);

  const { data, error } = await query;
  if (error) {
    console.error('[HelenaService] Erro Departamentos:', error.message);
    return { areas: [], totalTransferidos: 0, error };
  }

  const deptMap = {};
  (data || []).forEach((row) => {
    const dept = row.departamento || 'Não especificado';
    deptMap[dept] = (deptMap[dept] || 0) + 1;
  });

  const totalTransferidos = data?.length || 0;
  const areas = Object.entries(deptMap)
    .map(([area, count]) => ({
      area,
      count,
      percentage: totalTransferidos > 0 ? parseFloat(((count / totalTransferidos) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return { areas, totalTransferidos, error: null };
}

// =============================================
// ATIVIDADE RECENTE (dados_pts)
// =============================================
export async function fetchRecentActivity({ startDate, endDate, limit = 10 } = {}) {
  let query = supabase
    .from('dados_pts')
    .select('id, created_at, nome, empresa, departamento, motivo, resumo')
    .order('created_at', { ascending: false })
    .limit(limit);

  query = applyDateFilter(query, 'created_at', startDate, endDate);

  const { data, error } = await query;
  if (error) console.error('[HelenaService] Erro Atividade Recente:', error.message);
  return { data: data || [], error: error || null };
}

// =============================================
// TEMPO MÉDIO DE RESPOSTA DA IA (chat_pts)
// =============================================
export async function fetchAverageResponseTime({ startDate, endDate } = {}) {
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  let allMessages = [];

  try {
    while (hasMore) {
      let query = supabase
        .from('chat_pts')
        .select('session_id, message, date')
        .order('date', { ascending: true }) // Garantir ordem cronológica
        .range(page * pageSize, (page + 1) * pageSize - 1);

      query = applyDateFilter(query, 'date', startDate, endDate);

      const { data, error } = await query;

      if (error) {
        console.error('[HelenaService] Erro Tempo de Resposta:', error.message);
        return { avgText: '0 seg', error };
      }

      if (data && data.length > 0) {
        allMessages = allMessages.concat(data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    // Organizando as mensagens de forma cronológica por sessões para calcular a diferença
    const sessionMap = {};
    allMessages.forEach(row => {
      const sid = row.session_id;
      if (!sid) return;
      if (!sessionMap[sid]) sessionMap[sid] = [];
      
      let isAi = false;
      let obj = row.message;
      if (typeof obj === 'string') {
        try { obj = JSON.parse(obj); } catch(e) {}
      }
      if (obj && typeof obj === 'object') {
        if (obj.type === 'ai') isAi = true;
      }
      
      sessionMap[sid].push({
        date: new Date(row.date).getTime(),
        isAi
      });
    });

    let totalDiffMs = 0;
    let responseCount = 0;

    Object.values(sessionMap).forEach(messages => {
      let pendingHumanTime = null;
      messages.forEach(msg => {
        if (!msg.isAi) {
          // É uma mensagem puramente humana - começar tracking
          if (pendingHumanTime === null) {
            pendingHumanTime = msg.date;
          }
        } else {
          // É uma mensagem da IA - ver se estávamos aguardando uma human...
          if (pendingHumanTime !== null) {
            totalDiffMs += (msg.date - pendingHumanTime);
            responseCount++;
            pendingHumanTime = null; // Reinicia para a próxima bateria
          }
        }
      });
    });

    if (responseCount === 0) return { avgText: '-', error: null };

    const avgMs = totalDiffMs / responseCount;
    const avgSeconds = Math.round(avgMs / 1000);
    const mins = Math.floor(avgSeconds / 60);
    const secs = avgSeconds % 60;
    
    let avgText = '';
    if (mins > 0) {
      avgText = `${mins} min${mins > 1 ? 's' : ''}`;
      if (secs > 0) avgText += ` ${secs} seg`;
    } else {
      avgText = `${Math.max(0, secs)} seg`;
    }

    return { avgText, error: null };
  } catch (err) {
    console.error('[HelenaService] Exceção em Tempo de Resposta:', err);
    return { avgText: '0 seg', error: err };
  }
}

// =============================================
// BASE GERAL DE LEADS (dados_pts) - TABELA COMPLETA E INSIGHTS
// =============================================
export async function fetchAllLeads({ startDate, endDate, limit = 500 } = {}) {
  let query = supabase
    .from('dados_pts')
    .select('id, created_at, nome, empresa, telefone, email, cargo, departamento, motivo, resumo, transferencia_correta, departamento_correto, ticket_status, ticket_justificativa, ticket_updated_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  query = applyDateFilter(query, 'created_at', startDate, endDate);

  const { data, error } = await query;
  if (error) console.error('[HelenaService] Erro Base de Leads:', error.message);
  
  // Se não houve erro, fazemos a análise de insights avançados no frontend
  let peakHours = {};
  let peakDays = { 'Dom': 0, 'Seg': 0, 'Ter': 0, 'Qua': 0, 'Qui': 0, 'Sex': 0, 'Sáb': 0 };
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  
  let leadProfiles = {
    'Startups / Incubação': 0,
    'Parcerias / P&D': 0,
    'Estudantes / Pesquisas': 0,
    'Eventos / Visitação': 0,
    'Outros': 0
  };
  let wordFreq = {};
  let acuraciaTransfCorretas = 0;
  let totalAvaliados = 0;

  const stopwords = ['de','a','o','que','e','do','da','em','um','para','com','não','uma','os','no','se','na','por','mais','as','dos','como','mas','ao','ele','das','à','seu','sua','ou','quando','muito','nos','já','eu','também','só','pelo','pela','até','isso','ela','entre','depois','sem','mesmo','aos','seus','quem','nas','me','esse','eles','você','essa','num','nem','suas','meu','às','minha','numa','pelos','elas','qual','nós','lhe','deles','essas','esses','pelas','este','dele','tu','te','vocês','vos','lhes','meus','minhas','teu','tua','teus','tuas','nosso','nossa','nossos','nossas','dela','delas','esta','estes','estas','aquele','aquela','aqueles','aquelas','isto','aquilo','estou','está','estamos','estão','estive','esteve','estivemos','estiveram','estava','estávamos','estavam','estivera','estivéramos','esteja','estejamos','estejam','estivesse','estivéssemos','estivessem','estiver','estivermos','estiverem','hei','há','havemos','hão','houve','houvemos','houveram','houvera','houvéramos','haja','hajamos','hajam','houvesse','houvéssemos','houvessem','houver','houvermos','houverem','houverei','houverá','houveremos','houverão','houveria','houveríamos','houveriam','sou','somos','são','era','éramos','eram','fui','foi','fomos','foram','fora','fôramos','seja','sejamos','sejam','fosse','fôssemos','fossem','for','formos','forem','serei','será','seremos','serão','seria','seríamos','seriam','tenho','tem','temos','tém','tinha','tínhamos','tinham','tive','teve','tivemos','tiveram','tivera','tivéramos','tenha','tenhamos','tenham','tivesse','tivéssemos','tivessem','tiver','tivermos','tiverem','terei','terá','teremos','terão','teria','teríamos','teriam','buscando','sobre','informações','gostaria','saber','parque','sorocaba','tecnológico'];

  if (data) {
    data.forEach(lead => {
      // 1. Horários de Pico e Dias de Pico
      if (lead.created_at) {
        const dateObj = new Date(lead.created_at);
        const hour = dateObj.getHours();
        const day = dateObj.getDay();
        
        peakHours[hour] = (peakHours[hour] || 0) + 1;
        peakDays[weekDays[day]]++;
      }

      // 2. Perfil de Interesse
      const text = `${lead.motivo || ''} ${lead.resumo || ''} ${lead.departamento || ''}`.toLowerCase();
      if (text.match(/startup|incubação|incubar|sala|instalação|coworking/)) leadProfiles['Startups / Incubação']++;
      else if (text.match(/parceria|p&d|laboratório|investimento|empresa/)) leadProfiles['Parcerias / P&D']++;
      else if (text.match(/estudante|pesquisa|mestrado|tcc|doutorado|universidade|alun/)) leadProfiles['Estudantes / Pesquisas']++;
      else if (text.match(/evento|visita|auditório|palestra|workshop|agendamento/)) leadProfiles['Eventos / Visitação']++;
      else leadProfiles['Outros']++;

      // 3. Principais Dúvidas e Intenções (Mapeamento Analítico Estratégico)
      const textForDuvidas = `${lead.motivo || ''} ${lead.resumo || ''}`.toLowerCase();
      
      const intentMapping = {
        'Como incubar uma Startup?': ['incuba', 'startup', 'abrir empresa', 'aceleração'],
        'Locação de Salas e Espaços Físicos': ['alugar', 'sala', 'coworking', 'espaço fisico', 'instalação', 'infraestrutura'],
        'Como agendar visita / Conhecer o Parque': ['visita', 'conhecer o parque', 'agendar', 'tour', 'visitação'],
        'Como realizar Eventos aqui?': ['evento', 'auditório', 'locação de espaço', 'palestra', 'workshop'],
        'Propostas de Parcerias e P&D': ['parceria', 'p&d', 'desenvolvimento', 'projeto em conjunto', 'laboratório'],
        'Busca por Vagas ou Bolsas': ['vaga', 'emprego', 'estágio', 'trabalhar', 'currículo', 'rh', 'bolsa'],
        'Oferecimento de Serviços (Fornecedores)': ['oferecer', 'vender', 'apresentar serviço', 'fornecedor', 'comercial', 'prestação de serviço'],
        'Dúvidas Estudantis/Acadêmicas': ['pesquisa', 'tcc', 'mestrado', 'doutorado', 'universidade', 'estudante']
      };

      Object.entries(intentMapping).forEach(([intent, keys]) => {
        if (keys.some(k => textForDuvidas.includes(k))) {
          wordFreq[intent] = (wordFreq[intent] || 0) + 1;
        }
      });

      // 4. Acurácia
      if (lead.transferencia_correta !== null && lead.transferencia_correta !== undefined) {
        totalAvaliados++;
        if (lead.transferencia_correta) acuraciaTransfCorretas++;
      }
    });
  }

  // Prepara Array de Pico (24h)
  const peakHoursArray = Array.from({length: 24}, (_, i) => ({
    timeUnit: `${i}h`,
    count: peakHours[i] || 0
  }));

  // Prepara Array de Pico (Dias da Semana)
  const peakDaysArray = weekDays.map(day => ({
    timeUnit: day,
    count: peakDays[day]
  }));

  // Top Keywords
  const topKeywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(entry => ({ word: entry[0], count: entry[1] }));

  // % de Acurácia
  const acuracia = totalAvaliados > 0 ? parseFloat(((acuraciaTransfCorretas / totalAvaliados) * 100).toFixed(1)) : null;

  // Gerar Planos de Ação (IA Recomendada)
  const recommendations = [];
  if (topKeywords.length > 0) {
    const top = topKeywords[0].word;
    if (top === 'Como agendar visita / Conhecer o Parque') {
      recommendations.push({ type: 'Staff', text: 'Pico de interesse em visitas: Reforce a equipe de recepção e guias no período da tarde.' });
      recommendations.push({ type: 'FAQ', text: 'Criar um vídeo de "Tour 360" no site para filtrar curiosos e otimizar tempo da equipe.' });
    } else if (top === 'Como incubar uma Startup?') {
      recommendations.push({ type: 'Serviço', text: 'Alta demanda por Incubação: Considere abrir um pré-edital de fluxo contínuo para startups.' });
      recommendations.push({ type: 'FAQ', text: 'Atualizar FAQ sobre "Requisitos para Entrar no Parque" para esclarecer dúvidas recorrentes.' });
    } else if (top === 'Locação de Salas e Espaços Físicos') {
      recommendations.push({ type: 'Serviço', text: 'Busca por espaço: Criar plano de "Coworking Flex" para atender quem não precisa de sala privativa.' });
    } else if (top === 'Como realizar Eventos aqui?') {
      recommendations.push({ type: 'Staff', text: 'Demanda por Eventos acima da média: Revisar calendário de disponibilidade do auditório.' });
    }
  }

  // Se não tem recomendação específica, coloca default estratégico
  if (recommendations.length === 0) {
    recommendations.push({ type: 'Insight', text: 'Mantenha as conversas atualizadas para que a Helena possa extrair novas tendências do ecossistema.' });
  }

  return { 
    data: data || [], 
    insights: {
      peakHours: peakHoursArray,
      peakDays: peakDaysArray,
      leadProfiles,
      topKeywords,
      acuracia,
      totalAvaliados,
      recommendations
    },
    error: error || null 
  };
}

// =============================================
// HISTÓRICO DE CHAT DA IA (chat_pts)
// =============================================
export async function fetchChatConversations({ startDate, endDate, limit } = {}) {
  try {
    let allMessages = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    // Se um limite pequeno for especificado, fazemos uma query direta simples
    if (limit && limit < pageSize) {
      let query = supabase
        .from('chat_pts')
        .select('id, session_id, message, date')
        .order('date', { ascending: false })
        .limit(limit);

      query = applyDateFilter(query, 'date', startDate, endDate);
      const { data, error } = await query;
      if (error) throw error;
      return { data: data || [], error: null };
    }

    // Caso contrário (ou se for ilimitado), paginamos para obter todos/limite solicitado
    while (hasMore) {
      let query = supabase
        .from('chat_pts')
        .select('id, session_id, message, date')
        .order('date', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      query = applyDateFilter(query, 'date', startDate, endDate);
      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        allMessages = allMessages.concat(data);
        if (limit && allMessages.length >= limit) {
          allMessages = allMessages.slice(0, limit);
          hasMore = false;
        } else if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    return { data: allMessages, error: null };
  } catch (err) {
    console.error('[HelenaService] Erro Chat IA:', err.message || err);
    return { data: [], error: err || null };
  }
}

// =============================================
// DADOS DO DASHBOARD AVANÇADO
// =============================================
export async function fetchDashboardData({ startDate, endDate } = {}) {
  const options = { startDate, endDate };
  
  const [
    atendidosResult,
    transferidosResult,
    areasResult,
    responseTimeResult,
    insightsResult
  ] = await Promise.all([
    fetchLeadsAtendidos(options),
    fetchLeadsTransferidos(options),
    fetchLeadsPorDepartamento(options),
    fetchAverageResponseTime(options),
    fetchAllLeads({ ...options, limit: 1000 })
  ]);

  const firstError = atendidosResult.error || transferidosResult.error || areasResult.error || responseTimeResult.error || insightsResult.error;

  const leadsAtendidos = atendidosResult.count;
  const leadsTransferidos = transferidosResult.count;

  // Calculo Real de Conversão (Automatização com Sucesso)
  let taxaConversao = 0;
  if (leadsAtendidos > 0) {
    taxaConversao = parseFloat(((leadsTransferidos / leadsAtendidos) * 100).toFixed(1));
  }

  // Agrega insights da base completa
  const insights = insightsResult.insights || {};

  return {
    leadsAtendidos,
    leadsTransferidos,
    taxaConversao,
    avgResponseTime: responseTimeResult.avgText,
    areas: areasResult.areas,
    insights,
    error: firstError || null,
  };
}
