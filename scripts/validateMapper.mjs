// Validação do mapeador contra as planilhas reais (uso local apenas).
// Executar: node scripts/validateMapper.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import { buildDataset } from '../src/services/sheetMapper.js';

function readWorkbook(path) {
  const wb = XLSX.readFile(path);
  const out = {};
  for (const name of wb.SheetNames) {
    out[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
  }
  return out;
}

const PLANO = '/Users/furle/Downloads/Plano de Trabalho 2026_Indicadores (1).xlsx';
const DASH = '/Users/furle/Downloads/DashboardInova2026 (1).xlsx';

const plano = readWorkbook(PLANO);
const dash = readWorkbook(DASH);

const data = buildDataset(plano, dash);

console.log('=== PONTUAÇÃO GLOBAL ===');
console.log(data.pontuacaoGlobal);
console.log('\n=== META GLOBAL ACUMULADA ===');
console.log(data.metaGlobalAcumulada);
console.log('\n=== PROGRESSO GERAL ===');
console.log(data.progressoGeral);

for (const e of data.eixos) {
  console.log(`\n=== EIXO ${e.id} — ${e.nomeAbrev} | pontuacao=`, e.pontuacao, '===');
  console.log('nome:', e.nome.slice(0, 60));
  console.log('progressoMensal:', JSON.stringify(e.progressoMensal));
  for (const m of e.metas) {
    console.log(`  [${m.id}] ${String(m.nome).slice(0, 40)} | resp=${m.responsavel} | peso=${m.peso} nota=${m.nota} pontGlobal=${m.pontuacaoGlobal} res=${m.resultado}`);
    console.log(`        prog=${JSON.stringify(m.progresso)}`);
    console.log(`        ativ=${m.atividades.map(a => (a.concluida ? '[x]' : '[ ]') + a.nome.slice(0, 18)).join(' ')}`);
    if (m.justificativa) console.log(`        just=${m.justificativa.slice(0, 60)}`);
  }
}

console.log('\n\n=== INDICADORES OPERACIONAIS (', data.indicadoresOperacionais.length, ') ===');
for (const i of data.indicadoresOperacionais) {
  console.log(`  ${i.id} | ${i.nome.slice(0, 38)} | un=${i.unidade} resp=${i.responsavel} total=${i.resultadoTotal}`);
  console.log(`        valores=${JSON.stringify(i.valores)}`);
}
