// Leitor da API do Google Sheets (v4) -> { 'ABA': linhas[][] }
//
// Requisitos:
//  - VITE_GOOGLE_SHEETS_API_KEY definido (Google Cloud > Google Sheets API).
//  - A planilha compartilhada como "qualquer pessoa com o link pode ver".
//
// Usa valueRenderOption=UNFORMATTED_VALUE para receber números como números
// (frações 0..1), mantendo o mesmo formato do leitor de .xlsx.

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

/** Extrai o ID de uma URL do Google Sheets (ou devolve o próprio valor se já for ID). */
export function extractSheetId(urlOrId) {
  if (!urlOrId) return '';
  const s = String(urlOrId).trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  // se não for URL, assume que já é um ID
  return /^[a-zA-Z0-9-_]+$/.test(s) ? s : '';
}

function apiKey(explicit) {
  return explicit || import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || '';
}

async function readError(res) {
  try {
    const j = await res.json();
    return j?.error?.message || `Erro HTTP ${res.status}`;
  } catch {
    return `Erro HTTP ${res.status}`;
  }
}

/** Lista os títulos das abas da planilha. */
async function listSheetTitles(id, key) {
  const url = `${API}/${id}?fields=sheets.properties.title&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await readError(res));
  const json = await res.json();
  return (json.sheets || []).map((s) => s.properties?.title).filter(Boolean);
}

/** Range A1 a partir do título da aba (escapando aspas). */
function titleToRange(title) {
  return `'${String(title).replace(/'/g, "''")}'`;
}

/**
 * Busca todas as abas de uma planilha do Google Sheets.
 * @param {string} urlOrId  URL ou ID da planilha
 * @param {string} [explicitKey]  chave de API (senão usa a env)
 * @returns {Promise<{[sheet:string]: any[][]}>}
 */
export async function fetchGoogleSheet(urlOrId, explicitKey) {
  const key = apiKey(explicitKey);
  if (!key) throw new Error('Chave da API do Google Sheets não configurada (VITE_GOOGLE_SHEETS_API_KEY).');
  const id = extractSheetId(urlOrId);
  if (!id) throw new Error('Link ou ID da planilha do Google inválido.');

  const titles = await listSheetTitles(id, key);
  if (!titles.length) return {};

  const ranges = titles.map((t) => `ranges=${encodeURIComponent(titleToRange(t))}`).join('&');
  const url = `${API}/${id}/values:batchGet?${ranges}&majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await readError(res));
  const json = await res.json();

  const out = {};
  (json.valueRanges || []).forEach((vr, i) => {
    out[titles[i]] = vr.values || [];
  });
  return out;
}
