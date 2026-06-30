// Leitor de arquivos .xlsx (upload manual) -> { 'ABA': linhas[][] }
// Usa SheetJS no navegador (build ESM, via ArrayBuffer).
// O SheetJS é grande e só é necessário no upload manual, então é carregado
// sob demanda (dynamic import) para não pesar no bundle principal.

/**
 * Lê um File (.xlsx/.xls) e retorna as abas como matrizes de linhas.
 * @param {File} file
 * @returns {Promise<{[sheet:string]: any[][]}>}
 */
export async function readXlsxFile(file) {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const out = {};
  for (const name of wb.SheetNames) {
    out[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], {
      header: 1,    // matriz de linhas
      raw: true,    // números como números (frações 0..1, etc.)
      defval: null, // células vazias -> null
    });
  }
  return out;
}
