// ============================================================
// SHEET MAPPER — converte linhas cruas das planilhas (rows[][])
// no formato de dados do Dashboard Executivo (executivoData).
//
// É puro: recebe um objeto { 'NOME DA ABA': linhas[][] } por
// workbook e devolve o dataset. Funciona tanto para dados vindos
// da API do Google Sheets quanto de upload .xlsx (SheetJS), pois
// ambos são normalizados para matrizes de linhas.
// ============================================================

import { MESES } from '../data/executivoData.js';

// ── Constantes de layout ────────────────────────────────────
// Planilha "Plano de Trabalho" (estratégico) — abas RESUMO/ACOMPANHAMENTO:
// colunas dos blocos por meta -> A=0(rótulo), fev..jan = índices 1..12
const STRAT_COL = { fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11, jan: 12 };

// RESUMO bloco lateral (O..AA): O=14(rótulo), fev..jan = índices 15..26
const OBLOCK_COL = { fev: 15, mar: 16, abr: 17, mai: 18, jun: 19, jul: 20, ago: 21, set: 22, out: 23, nov: 24, dez: 25, jan: 26 };

// DashboardInova aba "KPIS PTS": I..T = JAN..DEZ (calendário) -> índices 8..19
const KPI_CAL = [
  ['jan', 8], ['fev', 9], ['mar', 10], ['abr', 11], ['mai', 12], ['jun', 13],
  ['jul', 14], ['ago', 15], ['set', 16], ['out', 17], ['nov', 18], ['dez', 19],
];

// Abreviações dos eixos (rótulos do app)
const EIXO_ABREV = {
  1: 'Comunicação',
  2: 'Competitividade',
  3: 'Inovação Aplicada',
  4: 'Responsabilidade Social',
};

// ── Helpers ─────────────────────────────────────────────────
function cell(row, idx) {
  if (!row) return undefined;
  return row[idx];
}

function str(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/**
 * Converte valor de célula em número. Tolera números nativos e strings
 * formatadas em pt-BR ("R$ 1.234,56", "250.000", "4.170,94"), "-", "" e null.
 * Heurística: o último separador é decimal SE tiver 1-2 dígitos após ele;
 * caso contrário (3 dígitos) é separador de milhar.
 */
function num(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (s === '' || s === '-' || s === '—') return null;
  const neg = /^-/.test(s);
  s = s.replace(/[^\d.,]/g, ''); // mantém dígitos e separadores
  if (s === '') return null;
  const lastSep = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  let normalized;
  if (lastSep === -1) {
    normalized = s;
  } else {
    const after = s.slice(lastSep + 1).replace(/[.,]/g, '');
    const before = s.slice(0, lastSep).replace(/[.,]/g, '');
    normalized = (after.length === 3 || after.length === 0)
      ? before + after                 // separador de milhar -> inteiro
      : `${before}.${after}`;          // separador decimal
  }
  const n = parseFloat(normalized);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

/** Fração (0..1) -> percentual (0..100), arredondado a 2 casas. */
function pct(v) {
  const n = num(v);
  if (n === null) return null;
  return Math.round(n * 10000) / 100; // *100 com 2 casas
}

function emptyMonths() {
  return MESES.reduce((acc, m) => { acc[m] = null; return acc; }, {});
}

function isMetaId(s) {
  return /^\d+\.\d+$/.test(String(s).trim());
}

// ── ESTRATÉGICO (Plano de Trabalho) ─────────────────────────
export function parseEstrategico(sheets) {
  const resumo = sheets['RESUMO'] || [];
  const peso = sheets['PESO'] || [];
  const metas = sheets['METAS'] || [];
  const acomp = sheets['ACOMPANHAMENTO'] || [];

  // 1) RESUMO — progresso mensal por meta + nomes de eixo
  const metaProgresso = {};      // { '1.1': {fev:..} }
  const eixoNome = {};           // { 1: 'EIXO 1 - ...' }
  for (const row of resumo) {
    const a = str(cell(row, 0));
    const mEixo = a.match(/^EIXO\s*([1-4])\b/i);
    if (mEixo) { eixoNome[+mEixo[1]] = a; continue; }
    const mMeta = a.match(/^(\d+)\.(\d+)\b/);
    if (mMeta) {
      const id = `${mMeta[1]}.${mMeta[2]}`;
      const months = emptyMonths();
      for (const m of MESES) months[m] = pct(cell(row, STRAT_COL[m]));
      metaProgresso[id] = months;
    }
  }

  // 2) RESUMO bloco lateral (O..AA) — progresso por eixo, geral e meta acumulada
  const eixoProgresso = {};      // { 1: {fev:..} }
  let metaGlobalAcumulada = emptyMonths();
  let progressoGeral = emptyMonths();
  for (const row of resumo) {
    const label = str(cell(row, 14));
    if (!label) continue;
    const readO = () => {
      const o = emptyMonths();
      for (const m of MESES) o[m] = pct(cell(row, OBLOCK_COL[m]));
      return o;
    };
    const mE = label.match(/^EIXO\s*([1-4])$/i);
    if (mE) { eixoProgresso[+mE[1]] = readO(); continue; }
    if (/^EIXO\s*GERAL$/i.test(label)) { progressoGeral = readO(); continue; }
    if (/^Meta$/i.test(label)) { metaGlobalAcumulada = readO(); continue; }
  }

  // 3) PESO — detalhes por meta (peso/nota/pontuação/resultado) + totais por eixo
  const metaDetalhe = {};        // { '1.1': {peso,nota,pontos,pontuacaoGlobal,resultado} }
  const eixoPontuacao = {};      // { 1: {maxima,alcancada,percentual} }
  for (const row of peso) {
    const mid = str(cell(row, 12)); // coluna M
    if (isMetaId(mid)) {
      metaDetalhe[mid] = {
        peso: num(cell(row, 14)),
        nota: num(cell(row, 15)),
        pontos: num(cell(row, 16)),
        pontuacaoGlobal: num(cell(row, 17)),
        resultado: str(cell(row, 18)) || null,
      };
    }
    const a = str(cell(row, 0)); // coluna A — totais "EIXO N"
    const mE = a.match(/^EIXO\s*([1-4])$/i);
    if (mE) {
      eixoPontuacao[+mE[1]] = {
        maxima: num(cell(row, 1)) || 0,
        alcancada: num(cell(row, 2)) || 0,
        percentual: num(cell(row, 3)) || 0,
      };
    }
  }

  // 4) METAS — metadados (nome completo, responsável, prazo, financeiro)
  const metaMeta = {};           // { '1.1': {nome,responsavel,prazo,...} }
  for (const row of metas) {
    const id = str(cell(row, 2)); // coluna C
    if (!isMetaId(id)) continue;
    metaMeta[id] = {
      nome: str(cell(row, 6)) || null,        // G
      responsavel: str(cell(row, 3)) || null, // D
      prioridade: str(cell(row, 4)) || null,  // E
      prazo: str(cell(row, 7)) || str(cell(row, 17)) || null, // H ou R(Início)
      valorComprometido: num(cell(row, 13)),  // N
      valorDestinado: num(cell(row, 14)),     // O
      valorPrevisto: num(cell(row, 15)),      // P
      valorCaptado: num(cell(row, 16)),       // Q
    };
  }

  // 5) ACOMPANHAMENTO — atividades + justificativa por meta
  // Cada bloco de meta é a linha imediatamente acima de uma linha "MÊS".
  // O id da meta às vezes vem como DATA na coluna A (erro de digitação),
  // então atribuímos o id sequencialmente dentro de cada eixo (ordem garantida).
  const metaAtividades = {};     // { '1.1': [{nome,concluida,mesesPlanejados}] }
  const metaJustificativa = {};  // { '1.1': 'texto' }
  const isMes = (v) => /^m[êe]s$/i.test(str(v));
  // Índice (na ordem MESES) do último mês com progresso reportado para a meta.
  const lastReportedIdx = (id) => {
    const p = metaProgresso[id];
    if (!p) return -1;
    let last = -1;
    MESES.forEach((m, idx) => { if (p[m] !== null && p[m] !== undefined) last = idx; });
    return last;
  };
  let curEixo = 0;
  const eixoCount = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (let i = 0; i < acomp.length; i++) {
    const row = acomp[i];
    const a = str(cell(row, 0));
    const mE = a.match(/^EIXO\s*([1-4])\b/i);
    if (mE) { curEixo = +mE[1]; continue; }
    // cabeçalho de bloco: próxima linha é "MÊS"
    const next = acomp[i + 1];
    if (curEixo && next && isMes(cell(next, 0))) {
      const id = `${curEixo}.${++eixoCount[curEixo]}`;
      metaAtividades[id] = [];
      const curIdx = lastReportedIdx(id);
      // justificativa: coluna O (índice 14) da linha "MÊS"
      const just = str(cell(next, 14));
      if (just && !/^justificativa$/i.test(just)) {
        metaJustificativa[id] = just.replace(/^status:\s*/i, '');
      }
      // atividades: da linha após "MÊS" até o próximo cabeçalho/EIXO/fim.
      // Colunas de mês: C..N = fev/26..jan/27 -> MESES[col-2] (col=2..13).
      for (let j = i + 2; j < acomp.length; j++) {
        const arow = acomp[j];
        const aname = str(cell(arow, 0));
        if (/^EIXO\s*[1-4]\b/i.test(aname)) break;
        const jnext = acomp[j + 1];
        if (jnext && isMes(cell(jnext, 0))) break; // início do próximo bloco
        if (isMes(aname) || /^cumprimento da meta/i.test(aname) || !aname) continue;
        const mesesPlanejados = [];
        let lastPlanned = -1;
        for (let col = 2; col <= 13; col++) {
          const n = num(cell(arow, col));
          if (n && n >= 1) {
            const mi = col - 2;
            mesesPlanejados.push(MESES[mi]);
            if (mi > lastPlanned) lastPlanned = mi;
          }
        }
        // Concluída quando todo o período planejado já passou (último mês
        // planejado <= último mês reportado). Critério transparente, pois as
        // planilhas não têm coluna explícita de conclusão.
        const concluida = lastPlanned >= 0 && curIdx >= 0 && lastPlanned <= curIdx;
        metaAtividades[id].push({ nome: aname, concluida, mesesPlanejados });
      }
    }
  }

  // 6) Montagem dos eixos
  // Ids confiáveis vêm de METAS (autoritativo) e do RESUMO; atividades/peso
  // são apenas anexados por id para não criar metas fantasma em caso de
  // contagem divergente.
  const allMetaIds = new Set([
    ...Object.keys(metaMeta),
    ...Object.keys(metaProgresso),
  ]);

  const eixos = [1, 2, 3, 4].map((id) => {
    const ids = [...allMetaIds]
      .filter((mid) => parseInt(mid.split('.')[0], 10) === id)
      .sort((a, b) => parseInt(a.split('.')[1], 10) - parseInt(b.split('.')[1], 10));

    const metasArr = ids.map((mid) => {
      const det = metaDetalhe[mid] || {};
      const meta = metaMeta[mid] || {};
      return {
        id: mid,
        nome: meta.nome || `Meta ${mid}`,
        responsavel: meta.responsavel || null,
        prazo: meta.prazo || null,
        prioridade: meta.prioridade || null,
        peso: det.peso ?? null,
        nota: det.nota ?? null,
        pontuacaoGlobal: det.pontuacaoGlobal ?? null,
        pontos: det.pontos ?? null,
        resultado: det.resultado || null,
        justificativa: metaJustificativa[mid] || null,
        valorComprometido: meta.valorComprometido ?? null,
        valorDestinado: meta.valorDestinado ?? null,
        valorPrevisto: meta.valorPrevisto ?? null,
        valorCaptado: meta.valorCaptado ?? null,
        progresso: metaProgresso[mid] || emptyMonths(),
        atividades: metaAtividades[mid] || [],
      };
    });

    return {
      id,
      nome: eixoNome[id] || `Eixo ${id}`,
      nomeAbrev: EIXO_ABREV[id] || `Eixo ${id}`,
      progressoMensal: eixoProgresso[id] || emptyMonths(),
      pontuacao: eixoPontuacao[id] || { maxima: 0, alcancada: 0, percentual: 0 },
      metas: metasArr,
    };
  });

  // 7) Pontuação global = soma dos eixos
  const maxima = eixos.reduce((s, e) => s + (e.pontuacao.maxima || 0), 0);
  const alcancada = eixos.reduce((s, e) => s + (e.pontuacao.alcancada || 0), 0);
  const pontuacaoGlobal = {
    maxima,
    alcancada,
    percentual: maxima ? Math.round((alcancada / maxima) * 10000) / 100 : 0,
  };

  return { eixos, metaGlobalAcumulada, progressoGeral, pontuacaoGlobal };
}

// ── OPERACIONAL (DashboardInova — aba "KPIS PTS") ───────────
const GENERIC_METRICS = new Set(['NUMEROS DO PTS', 'NÚMEROS DO PTS']);

function inferUnidade(texto) {
  const t = texto.toLowerCase();
  if (/fatur|valor|r\$|invest|mensalidade/.test(t)) return 'financeiro';
  if (/taxa|percentual|%|execução|execucao/.test(t)) return 'percentual';
  return 'numero';
}

export function parseOperacional(sheets) {
  const rows = sheets['KPIS PTS'] || sheets['KPIS'] || [];
  // localiza linha de cabeçalho (contém "MÉTRICA")
  let headerIdx = rows.findIndex((r) => r && r.some((c) => /m[ée]trica/i.test(str(c))));
  if (headerIdx < 0) headerIdx = 1;

  const indicadores = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const metrica = str(cell(row, 2)); // C
    const descricao = str(cell(row, 3)); // D
    const a = str(cell(row, 0));
    // parar na legenda
    if (/procedimento para pontua/i.test(a) || /procedimento para pontua/i.test(metrica) || /índice|indice/i.test(metrica)) break;
    if (!metrica && !descricao) continue;
    // pular linhas de eixo (pertencem ao estratégico)
    if (/^EIXO/i.test(metrica)) continue;

    const nome = (metrica && !GENERIC_METRICS.has(metrica.toUpperCase()))
      ? metrica
      : (descricao || metrica);
    if (!nome) continue;

    const valores = emptyMonths();
    for (const [key, idx] of KPI_CAL) valores[key] = num(cell(row, idx));

    const resultadoTotal = num(cell(row, 7));
    // descarta indicadores totalmente vazios (sem total e sem valores mensais)
    const temDados = resultadoTotal !== null || MESES.some((m) => valores[m] !== null);
    if (!temDados) continue;

    indicadores.push({
      id: `op-${i + 1}`,
      nome,
      descricao: descricao || null,
      responsavel: str(cell(row, 5)) || null, // F
      observacao: str(cell(row, 6)) || null,  // G
      unidade: inferUnidade(`${metrica} ${descricao}`),
      meta: null, // alvo definido manualmente pelo admin
      resultadoTotal,                           // H
      valores,
    });
  }
  return indicadores;
}

// ── COMBINAÇÃO ──────────────────────────────────────────────
/**
 * Monta o dataset completo a partir dos dois workbooks.
 * @param {{[sheet:string]: any[][]}} planoSheets  abas do "Plano de Trabalho"
 * @param {{[sheet:string]: any[][]}} dashboardSheets  abas do "DashboardInova"
 * @param {object} [prev]  dataset anterior (para preservar metas operacionais já definidas)
 */
export function buildDataset(planoSheets, dashboardSheets, prev) {
  const estrategico = planoSheets ? parseEstrategico(planoSheets) : null;
  let indicadoresOperacionais = dashboardSheets ? parseOperacional(dashboardSheets) : null;

  // Preserva metas/alvos operacionais definidos manualmente antes (casa por nome)
  if (indicadoresOperacionais && prev?.indicadoresOperacionais) {
    const prevByName = new Map(prev.indicadoresOperacionais.map((i) => [i.nome, i]));
    indicadoresOperacionais = indicadoresOperacionais.map((ind) => {
      const old = prevByName.get(ind.nome);
      return old && old.meta != null ? { ...ind, meta: old.meta } : ind;
    });
  }

  return {
    ...(prev || {}),
    ...(estrategico || {}),
    indicadoresOperacionais: indicadoresOperacionais
      ?? prev?.indicadoresOperacionais
      ?? [],
  };
}
