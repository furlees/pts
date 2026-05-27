// ============================================================
// EXECUTIVE DASHBOARD — DATA LAYER
// Data extracted from PTS strategic planning spreadsheets
// Months: fev/26 → jan/27 (keys: 'fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez','jan')
// ============================================================

const STORAGE_KEY = 'pts_executivo_data';

// ── Scoring helpers ─────────────────────────────────────────
export function getConceito(pct) {
  if (pct >= 85)  return { label: 'B - BOM',          color: '#10b981', bg: 'rgba(16,185,129,0.1)'  };
  if (pct >= 70)  return { label: 'B - BOM',          color: '#34d399', bg: 'rgba(52,211,153,0.1)'  };
  if (pct >= 50)  return { label: 'C - REGULAR',      color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  };
  return           { label: 'D - INSUFICIENTE',        color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   };
}

export const MESES = ['fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez','jan'];
export const MESES_LABEL = {
  fev:'Fev/26', mar:'Mar/26', abr:'Abr/26', mai:'Mai/26', jun:'Jun/26',
  jul:'Jul/26', ago:'Ago/26', set:'Set/26', out:'Out/26', nov:'Nov/26', dez:'Dez/26', jan:'Jan/27',
};

export const EIXO_CORES = {
  1: '#3b82f6',
  2: '#10b981',
  3: '#8b5cf6',
  4: '#f59e0b',
};

// ── Seed data ───────────────────────────────────────────────
const SEED = {
  // Meta global acumulada ao longo do ano (linha "Meta" da aba RESUMO)
  metaGlobalAcumulada: {
    fev: 11.54, mar: 17.31, abr: 23.08, mai: 28.85, jun: 34.62,
    jul: 40.38, ago: 46.15, set: 51.92, out: 57.69, nov: null, dez: null, jan: null,
  },

  // Progresso geral real (linha "EIXO GERAL" da aba RESUMO)
  progressoGeral: {
    fev: 6.15, mar: 13.20, abr: 24.14, mai: null, jun: null,
    jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null,
  },

  // Pontuação global do PESO
  pontuacaoGlobal: {
    maxima: 1055,
    alcancada: 218,
    percentual: 27.52,
  },

  eixos: [
    // ═══════════════════════════════════════════════════════
    // EIXO 1 — COMUNICAÇÃO
    // ═══════════════════════════════════════════════════════
    {
      id: 1,
      nome: 'Comunicação: Reconhecimento do PTS (Municipal, Estadual, Nacional e Internacional)',
      nomeAbrev: 'Comunicação',
      progressoMensal: {
        fev: 6.95, mar: 17.57, abr: 31.67, mai: null, jun: null,
        jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null,
      },
      pontuacao: { maxima: 275, alcancada: 192, percentual: 35.00 },
      metas: [
        {
          id: '1.1',
          nome: 'Certificação e Implantação CERNE',
          responsavel: 'Rafael',
          prazo: '8/5/2025',
          peso: 57,
          nota: 4,
          pontuacaoGlobal: 76,
          resultado: 'C',
          justificativa: 'Houve préauditoria dia 25/05 do consultor. Estamos inserindo as práticas com as Startups. Notificado a Anprotec referente ao pedido da Auditoria. Previsão de auditoria para certificação: meados de 20/06.',
          progresso: { fev: 19.05, mar: 38.10, abr: 57.14, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Elaboração de documentos',                    concluida: true },
            { nome: 'Validação de documentos',                     concluida: true },
            { nome: 'Implantação das práticas chaves',             concluida: false },
            { nome: 'Monitoramento das ações para certificação',   concluida: false },
            { nome: 'Certificação CERNE',                          concluida: false },
          ],
        },
        {
          id: '1.2',
          nome: 'Feira da Indústria – Conecta Indústria',
          responsavel: 'Giuliano / Rebeca',
          prazo: '8/5/2025',
          peso: 48,
          nota: 3,
          pontuacaoGlobal: 20,
          resultado: 'D',
          justificativa: 'Primeiras vendas de cotas, divulgação externa FEIMEC, redefinição da data. Próx. passos: articulação com parceiros estratégicos, definição do conteúdo.',
          progresso: { fev: 12.90, mar: 29.03, abr: 45.16, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Definição de parceiro estratégico',           concluida: true },
            { nome: 'Planejamento',                                concluida: true },
            { nome: 'Elaboração de mídia KIT',                     concluida: true },
            { nome: 'Captação de patrocínios',                     concluida: false },
            { nome: 'Divulgação externa',                          concluida: false },
            { nome: 'Preparatório da Feira',                       concluida: false },
            { nome: 'Execução da Feira',                           concluida: false },
            { nome: 'Compilação dos resultados da Feira',          concluida: false },
          ],
        },
        {
          id: '1.3',
          nome: 'Maquete Sorocaba 2050',
          responsavel: 'Giuliano',
          prazo: null,
          peso: 8,
          nota: 4,
          pontuacaoGlobal: 4,
          resultado: 'D',
          justificativa: 'Definido projeto final para impressão. Próx. passos: início do processo de compra/cotações.',
          progresso: { fev: 0.00, mar: 0.00, abr: 7.69, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Termo de referência',    concluida: false },
            { nome: 'Processo de compra',     concluida: false },
            { nome: 'Execução',               concluida: false },
            { nome: 'Lançamento',             concluida: false },
            { nome: 'Acompanhamento',         concluida: false },
          ],
        },
        {
          id: '1.4',
          nome: 'Criação do Selo da Inovação',
          responsavel: 'Giuliano',
          prazo: null,
          peso: 31,
          nota: 4,
          pontuacaoGlobal: 16,
          resultado: 'D',
          justificativa: 'Definição das regras modelagem Cubo. Próx. passos: definição do prêmio no evento Conecta Indústria.',
          progresso: { fev: 7.69, mar: 15.38, abr: 30.77, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Benchmarking',                              concluida: true },
            { nome: 'Definir regras para premiação',             concluida: true },
            { nome: 'Criar edital',                              concluida: false },
            { nome: 'Divulgação externa',                        concluida: false },
            { nome: 'Execução evento para premiação',            concluida: false },
            { nome: 'Compilação dos resultados',                 concluida: false },
          ],
        },
        {
          id: '1.5',
          nome: 'Evento Tech City',
          responsavel: 'Giuliano / Rebeca',
          prazo: '8/5/2025',
          peso: 38,
          nota: 4,
          pontuacaoGlobal: 20,
          resultado: 'D',
          justificativa: null,
          progresso: { fev: 0.00, mar: 11.11, abr: 22.22, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Planejamento do evento',           concluida: false },
            { nome: 'Definição de parceiros',           concluida: false },
            { nome: 'Divulgação',                       concluida: false },
            { nome: 'Execução',                         concluida: false },
            { nome: 'Compilação de resultados',         concluida: false },
          ],
        },
        {
          id: '1.6',
          nome: 'Estruturação Evento de Games',
          responsavel: 'Giuliano / Rebeca',
          prazo: 'Inicia em 09/2026',
          peso: 48,
          nota: 4,
          pontuacaoGlobal: 4,
          resultado: 'D',
          justificativa: null,
          progresso: { fev: 0.00, mar: 0.00, abr: 0.00, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Planejamento estratégico',         concluida: false },
            { nome: 'Modelo de negócios',               concluida: false },
            { nome: 'Estratégias de comunicação',       concluida: false },
            { nome: 'Prospecção de apoiadores',         concluida: false },
          ],
        },
        {
          id: '1.7',
          nome: 'Métricas Dashboard',
          responsavel: 'Flávio',
          prazo: '8/5/2025',
          peso: 42,
          nota: 5,
          pontuacaoGlobal: 26,
          resultado: 'C',
          justificativa: null,
          progresso: { fev: 7.14, mar: 21.43, abr: 42.86, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Criação de dashboard de métricas',  concluida: false },
            { nome: 'Acompanhamento das metas',          concluida: false },
            { nome: 'Processos do PTS',                  concluida: false },
          ],
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // EIXO 2 — COMPETITIVIDADE & SUSTENTABILIDADE
    // ═══════════════════════════════════════════════════════
    {
      id: 2,
      nome: 'Competitividade & Sustentabilidade (Hélice Quíntupla: Governo, Empresas, IES, Sociedade e Meio Ambiente)',
      nomeAbrev: 'Competitividade',
      progressoMensal: {
        fev: 6.67, mar: 13.33, abr: 20.60, mai: null, jun: null,
        jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null,
      },
      pontuacao: { maxima: 240, alcancada: 62, percentual: 25.83 },
      metas: [
        {
          id: '2.1', nome: 'Programa de Inovação Aberta para Empresas', responsavel: 'Paolo', prazo: '8/5/2025',
          peso: 32, nota: 3, pontuacaoGlobal: 16, resultado: 'D',
          justificativa: null,
          progresso: { fev: 14.29, mar: 28.57, abr: 33.33, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Chamamento público',             concluida: true },
            { nome: 'Edital de seleção',              concluida: true },
            { nome: 'Identificação de desafios',      concluida: false },
            { nome: 'Seleção de empresas',            concluida: false },
            { nome: 'Execução do programa',           concluida: false },
          ],
        },
        {
          id: '2.2', nome: 'Aplicação do Master Plan do PTS', responsavel: 'Giuliano', prazo: null,
          peso: 20, nota: 3, pontuacaoGlobal: 16, resultado: 'D',
          justificativa: null,
          progresso: { fev: 6.25, mar: 12.50, abr: 21.88, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Revisão do masterplan',          concluida: false },
            { nome: 'Organização dos serviços',       concluida: false },
            { nome: 'Atração de empresas',            concluida: false },
            { nome: 'Estruturação das ações',         concluida: false },
          ],
        },
        {
          id: '2.3', nome: 'Estruturação Departamento Comercial', responsavel: null, prazo: null,
          peso: 20, nota: 2, pontuacaoGlobal: 10, resultado: 'D',
          justificativa: null,
          progresso: { fev: 3.33, mar: 6.67, abr: 20.00, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Definição de estrutura',         concluida: false },
            { nome: 'Contratação de equipe',          concluida: false },
            { nome: 'Desenvolvimento de processos',   concluida: false },
          ],
        },
        {
          id: '2.4', nome: 'Captação de Recursos para Ampliação do Prédio do PTS', responsavel: null, prazo: null,
          peso: 8, nota: 4, pontuacaoGlobal: 0, resultado: 'D',
          justificativa: null,
          progresso: { fev: 6.12, mar: 12.24, abr: 18.37, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Mapeamento de editais',          concluida: false },
            { nome: 'Elaboração de projetos',         concluida: false },
            { nome: 'Submissão de propostas',         concluida: false },
          ],
        },
        {
          id: '2.5', nome: 'Inovação Aberta para o Poder Público', responsavel: null, prazo: null,
          peso: 30, nota: 4, pontuacaoGlobal: 8, resultado: 'D',
          justificativa: null,
          progresso: { fev: 0.00, mar: 0.00, abr: 30.00, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Mapeamento de demandas',         concluida: false },
            { nome: 'Desenvolvimento de proposta',    concluida: false },
            { nome: 'Execução',                       concluida: false },
          ],
        },
        {
          id: '2.6', nome: 'Smart Park', responsavel: null, prazo: null,
          peso: 30, nota: 4, pontuacaoGlobal: 12, resultado: 'D',
          justificativa: null,
          progresso: { fev: 10.00, mar: 20.00, abr: 30.00, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Planejamento Smart Park',        concluida: false },
            { nome: 'Infraestrutura tecnológica',     concluida: false },
            { nome: 'Implementação de sensores',      concluida: false },
          ],
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // EIXO 3 — FOMENTAR INOVAÇÃO APLICADA
    // ═══════════════════════════════════════════════════════
    {
      id: 3,
      nome: 'Fomentar Inovação Aplicada, Pesquisa e Temáticas Energias Renováveis (Eólica, Hidrogênio, Fotovoltaica etc)',
      nomeAbrev: 'Inovação Aplicada',
      progressoMensal: {
        fev: 4.45, mar: 10.00, abr: 20.60, mai: null, jun: null,
        jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null,
      },
      pontuacao: { maxima: 240, alcancada: 62, percentual: 19.97 },
      metas: [
        {
          id: '3.1', nome: 'Estruturação de Hub Digital de Inteligência Artificial', responsavel: null, prazo: null,
          peso: 7, nota: 3, pontuacaoGlobal: 1, resultado: 'D',
          justificativa: null,
          progresso: { fev: 0.00, mar: 0.00, abr: 7.14, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Mapeamento de parceiros IA',     concluida: false },
            { nome: 'Definição de espaço físico',     concluida: false },
            { nome: 'Lançamento do hub',              concluida: false },
          ],
        },
        {
          id: '3.2', nome: 'Início de Estruturação da ICT do Parque Tecnológico', responsavel: null, prazo: null,
          peso: 5, nota: 3, pontuacaoGlobal: 0, resultado: 'D',
          justificativa: null,
          progresso: { fev: 0.00, mar: 0.00, abr: 0.00, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Análise legal e regulatória',    concluida: false },
            { nome: 'Definição do modelo ICT',        concluida: false },
            { nome: 'Formalização',                   concluida: false },
          ],
        },
        {
          id: '3.3', nome: 'Implantação de Laboratório de Nano Satélites', responsavel: null, prazo: null,
          peso: 30, nota: 3, pontuacaoGlobal: 12, resultado: 'D',
          justificativa: null,
          progresso: { fev: 0.00, mar: 20.00, abr: 30.00, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Captação de recursos',           concluida: false },
            { nome: 'Aquisição de equipamentos',      concluida: false },
            { nome: 'Implantação',                    concluida: false },
            { nome: 'Inauguração',                    concluida: false },
          ],
        },
        {
          id: '3.4', nome: 'Implantação do Open Lab Indústria 5.0', responsavel: null, prazo: null,
          peso: 30, nota: 3, pontuacaoGlobal: 12, resultado: 'D',
          justificativa: null,
          progresso: { fev: 10.00, mar: 20.00, abr: 30.00, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Planejamento do espaço',         concluida: false },
            { nome: 'Captação de parceiros',          concluida: false },
            { nome: 'Implantação',                    concluida: false },
          ],
        },
        {
          id: '3.5', nome: 'Implantação do Laboratório Escola de Simulação 3D', responsavel: null, prazo: null,
          peso: 30, nota: 4, pontuacaoGlobal: 8, resultado: 'D',
          justificativa: null,
          progresso: { fev: 10.00, mar: 20.00, abr: 30.00, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Aquisição de equipamentos',      concluida: false },
            { nome: 'Instalação',                     concluida: false },
            { nome: 'Programa pedagógico',            concluida: false },
          ],
        },
        {
          id: '3.6', nome: 'Implantação da Incubadora do Parque Tecnológico', responsavel: null, prazo: null,
          peso: 30, nota: 4, pontuacaoGlobal: 16, resultado: 'D',
          justificativa: null,
          progresso: { fev: 10.00, mar: 20.00, abr: 30.00, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Edital de seleção',              concluida: false },
            { nome: 'Seleção de startups',            concluida: false },
            { nome: 'Mentorias e suporte',            concluida: false },
          ],
        },
        {
          id: '3.7', nome: 'Desenvolvimento e Execução do Projeto CAPACITA', responsavel: null, prazo: null,
          peso: 1, nota: 4, pontuacaoGlobal: 0, resultado: 'D',
          justificativa: null,
          progresso: { fev: 0.00, mar: 1.49, abr: 1.49, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Planejamento das capacitações',  concluida: false },
            { nome: 'Execução dos cursos',            concluida: false },
            { nome: 'Avaliação de resultados',        concluida: false },
          ],
        },
        {
          id: '3.8', nome: 'Desenvolvimento e Execução do Projeto SPAI Connect', responsavel: null, prazo: null,
          peso: 30, nota: 4, pontuacaoGlobal: 0, resultado: 'D',
          justificativa: null,
          progresso: { fev: 0.00, mar: 0.00, abr: 0.00, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Definição do escopo',            concluida: false },
            { nome: 'Desenvolvimento',                concluida: false },
            { nome: 'Lançamento',                     concluida: false },
          ],
        },
        {
          id: '3.9', nome: 'Implantação do HUBIZ Conexões – Centro de Negócios', responsavel: null, prazo: null,
          peso: 22, nota: 3, pontuacaoGlobal: 12, resultado: 'D',
          justificativa: null,
          progresso: { fev: 0.05, mar: 9.09, abr: 22.73, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Estruturação do espaço',         concluida: false },
            { nome: 'Atração de empresas parceiras',  concluida: false },
            { nome: 'Inauguração',                    concluida: false },
          ],
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // EIXO 4 — RESPONSABILIDADE SOCIAL
    // ═══════════════════════════════════════════════════════
    {
      id: 4,
      nome: 'Responsabilidade Social (Cidades Inteligentes, Capacitação, Empreendedorismo, Economia Criativa, Sandbox etc)',
      nomeAbrev: 'Responsabilidade Social',
      progressoMensal: {
        fev: 6.53, mar: 11.85, abr: 23.69, mai: null, jun: null,
        jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null,
      },
      pontuacao: { maxima: 200, alcancada: 35, percentual: 27.50 },
      metas: [
        {
          id: '4.1', nome: 'Capacitação em Comércio Exterior', responsavel: null, prazo: null,
          peso: 48, nota: 5, pontuacaoGlobal: 26, resultado: 'C',
          justificativa: null,
          progresso: { fev: 16.67, mar: 27.78, abr: 44.44, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Planejamento dos cursos',        concluida: true },
            { nome: 'Contratação de instrutores',     concluida: true },
            { nome: 'Execução das turmas',            concluida: false },
            { nome: 'Avaliação de resultados',        concluida: false },
          ],
        },
        {
          id: '4.2', nome: 'Implantação de Cursos de Nível Superior no PTS', responsavel: null, prazo: null,
          peso: 27, nota: 3, pontuacaoGlobal: 12, resultado: 'D',
          justificativa: null,
          progresso: { fev: 0.00, mar: 13.33, abr: 26.67, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Articulação com IES',            concluida: false },
            { nome: 'Definição de cursos',            concluida: false },
            { nome: 'Implementação',                  concluida: false },
          ],
        },
        {
          id: '4.3', nome: 'Programa PTS na Escola e Novo Ônibus', responsavel: null, prazo: null,
          peso: 7, nota: 4, pontuacaoGlobal: 4, resultado: 'D',
          justificativa: null,
          progresso: { fev: 0.00, mar: 0.00, abr: 8.57, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Planejamento das visitas',       concluida: false },
            { nome: 'Execução do programa escolar',   concluida: false },
          ],
        },
        {
          id: '4.4', nome: 'Programa Sandbox', responsavel: null, prazo: null,
          peso: 17, nota: 4, pontuacaoGlobal: 8, resultado: 'D',
          justificativa: null,
          progresso: { fev: 3.33, mar: 10.00, abr: 16.67, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Definição do modelo sandbox',    concluida: false },
            { nome: 'Seleção de participantes',       concluida: false },
            { nome: 'Execução',                       concluida: false },
          ],
        },
        {
          id: '4.5', nome: 'PTS Vai à Cidade', responsavel: null, prazo: null,
          peso: 6, nota: 3, pontuacaoGlobal: 0, resultado: 'D',
          justificativa: null,
          progresso: { fev: 0.00, mar: 0.00, abr: 7.69, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Planejamento dos eventos',       concluida: false },
            { nome: 'Execução',                       concluida: false },
          ],
        },
        {
          id: '4.6', nome: 'Desenvolvimento de CPL', responsavel: null, prazo: null,
          peso: 2, nota: 3, pontuacaoGlobal: 0, resultado: 'D',
          justificativa: null,
          progresso: { fev: 12.50, mar: 20.00, abr: 40.00, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
          atividades: [
            { nome: 'Estruturação do CPL',            concluida: false },
            { nome: 'Treinamento da equipe',          concluida: false },
          ],
        },
      ],
    },
  ],

  // ── Indicadores Operacionais (editáveis pelo admin) ───────
  indicadoresOperacionais: [
    {
      id: 'op-1', nome: 'Leads Atendidos pela Helena IA', unidade: 'numero', meta: 500,
      valores: { fev: 160, mar: 245, abr: 312, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
    },
    {
      id: 'op-2', nome: 'Empresas Incubadas / Residentes', unidade: 'numero', meta: 30,
      valores: { fev: 18, mar: 20, abr: 22, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
    },
    {
      id: 'op-3', nome: 'Eventos Realizados', unidade: 'numero', meta: 24,
      valores: { fev: 3, mar: 5, abr: 8, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
    },
    {
      id: 'op-4', nome: 'Captação de Recursos (R$)', unidade: 'financeiro', meta: 2000000,
      valores: { fev: 120000, mar: 350000, abr: 480000, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
    },
    {
      id: 'op-5', nome: 'Metas Estratégicas Cumpridas (%)', unidade: 'percentual', meta: 100,
      valores: { fev: 6.15, mar: 13.20, abr: 24.14, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
    },
    {
      id: 'op-6', nome: 'Pessoas Capacitadas', unidade: 'numero', meta: 300,
      valores: { fev: 42, mar: 78, abr: 130, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, jan: null },
    },
  ],
};

// ── Public API ───────────────────────────────────────────────
export function loadExecutivoData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (_) {}
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
  return SEED;
}

export function saveExecutivoData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function resetExecutivoData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
  return SEED;
}

export function getProgressoAtual(entidade) {
  const meses = Object.values(entidade.progresso || entidade.progressoMensal || {});
  const real   = meses.filter(v => v !== null && v !== undefined);
  return real.length > 0 ? real[real.length - 1] : 0;
}
