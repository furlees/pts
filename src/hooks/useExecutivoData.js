// ============================================================
// useExecutivoData — orquestra os dados do Dashboard Executivo:
//  - lê a versão ativa do Firestore em tempo real (compartilhada);
//  - faz auto-sync do Google Sheets ao abrir (admin);
//  - importa por upload .xlsx;
//  - salva edições manuais e configuração das planilhas;
//  - expõe o histórico de versões e permite restaurar.
//
// Fallback: sem Firebase configurado, usa o seed local (localStorage).
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { loadExecutivoData, saveExecutivoData } from '../data/executivoData';
import { buildDataset } from '../services/sheetMapper';
import { fetchGoogleSheet } from '../services/googleSheets';
import { readXlsxFile } from '../services/xlsxReader';
import * as svc from '../services/executivoService';

const HAS_API_KEY = !!import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;

export function useExecutivoData(user) {
  // Inicialização sem Firebase = seed local (via inicializador lazy do useState).
  const [dataset, setDataset] = useState(() => (svc.HAS_FIREBASE ? null : loadExecutivoData()));
  const [meta, setMeta] = useState(null);
  const [config, setConfig] = useState({});
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(svc.HAS_FIREBASE);
  const [sync, setSync] = useState({ status: 'idle', message: '' }); // idle|syncing|ok|error

  const datasetRef = useRef(dataset); // mantida em sincronia por apply()
  const autoSynced = useRef(false);

  const apply = (data, m = null) => {
    setDataset(data);
    datasetRef.current = data;
    setMeta(m);
  };

  // 1) versão ativa (tempo real) — apenas com Firebase
  useEffect(() => {
    if (!svc.HAS_FIREBASE) return undefined;
    const unsub = svc.subscribeCurrent((payload) => {
      if (payload?.data) apply(payload.data, payload.meta || null);
      else apply(loadExecutivoData(), null); // ainda sem dados no Firestore -> seed
      setLoading(false);
    });
    return unsub;
  }, []);

  // 2) configuração + histórico
  useEffect(() => {
    if (!svc.HAS_FIREBASE) return undefined;
    const u1 = svc.subscribeConfig(setConfig);
    const u2 = svc.subscribeHistory(setHistory);
    return () => { u1(); u2(); };
  }, []);

  const metaInfo = useCallback((source, extra = {}) => ({
    source,
    userName: user?.name || null,
    userEmail: user?.email || null,
    ...extra,
  }), [user]);

  // ── Importação via Google Sheets ─────────────────────────
  const importFromGoogle = useCallback(async ({ silent = false } = {}) => {
    if (!config.planoSheet && !config.dashboardSheet) {
      throw new Error('Configure os links das planilhas do Google Sheets.');
    }
    if (!HAS_API_KEY) {
      throw new Error('Chave da API do Google Sheets não configurada (VITE_GOOGLE_SHEETS_API_KEY).');
    }
    setSync({ status: 'syncing', message: 'Lendo planilhas do Google Sheets...' });
    try {
      const [plano, dash] = await Promise.all([
        config.planoSheet ? fetchGoogleSheet(config.planoSheet) : Promise.resolve(null),
        config.dashboardSheet ? fetchGoogleSheet(config.dashboardSheet) : Promise.resolve(null),
      ]);
      const built = buildDataset(plano, dash, datasetRef.current);
      const changed = JSON.stringify(built) !== JSON.stringify(datasetRef.current);
      if (changed) {
        await svc.saveDataset(built, metaInfo('google'));
        setSync({ status: 'ok', message: 'Indicadores atualizados a partir do Google Sheets.' });
      } else {
        setSync({ status: 'ok', message: silent ? '' : 'Os indicadores já estão atualizados.' });
      }
      return built;
    } catch (e) {
      setSync({ status: 'error', message: e.message || 'Falha ao ler o Google Sheets.' });
      throw e;
    }
  }, [config, metaInfo]);

  // ── Importação via upload .xlsx ──────────────────────────
  const importFromUpload = useCallback(async (planoFile, dashFile) => {
    if (!planoFile && !dashFile) throw new Error('Selecione ao menos uma planilha.');
    setSync({ status: 'syncing', message: 'Lendo arquivos...' });
    try {
      const plano = planoFile ? await readXlsxFile(planoFile) : null;
      const dash = dashFile ? await readXlsxFile(dashFile) : null;
      const built = buildDataset(plano, dash, datasetRef.current);
      const fileNames = [planoFile?.name, dashFile?.name].filter(Boolean).join(' + ') || null;
      if (svc.HAS_FIREBASE) {
        await svc.saveDataset(built, metaInfo('upload', { fileNames }));
      } else {
        saveExecutivoData(built);
        apply(built);
      }
      setSync({ status: 'ok', message: 'Planilhas importadas com sucesso.' });
      return built;
    } catch (e) {
      setSync({ status: 'error', message: e.message || 'Falha ao importar os arquivos.' });
      throw e;
    }
  }, [metaInfo]);

  // ── Edição manual (indicadores operacionais / metas) ─────
  const saveEdited = useCallback(async (data) => {
    if (svc.HAS_FIREBASE) {
      await svc.saveDataset(data, metaInfo('edicao-manual'));
    } else {
      saveExecutivoData(data);
      apply(data);
    }
  }, [metaInfo]);

  // ── Configuração das planilhas ───────────────────────────
  const saveSheetConfig = useCallback(async (cfg) => {
    if (svc.HAS_FIREBASE) await svc.saveConfig(cfg);
    setConfig((prev) => ({ ...prev, ...cfg }));
  }, []);

  // ── Restaurar versão do histórico ────────────────────────
  const restoreVersion = useCallback(async (entry) => {
    const data = entry?.data;
    if (!data) return;
    await svc.saveDataset(data, metaInfo('restauracao', {
      note: `Restaurado de versão de ${entry.meta?.source || 'histórico'}`,
    }));
  }, [metaInfo]);

  const clearSync = useCallback(() => setSync({ status: 'idle', message: '' }), []);

  // ── Auto-sync ao abrir (admin, uma vez) ──────────────────
  useEffect(() => {
    if (autoSynced.current) return;
    if (!svc.HAS_FIREBASE || !HAS_API_KEY) return;
    if (user?.role !== 'Admin') return;
    if (!config.planoSheet && !config.dashboardSheet) return undefined;
    autoSynced.current = true;
    // diferido para fora da fase síncrona do efeito (evita cascata de render)
    const t = setTimeout(() => {
      importFromGoogle({ silent: true }).catch(() => { /* silencioso no auto-sync */ });
    }, 0);
    return () => clearTimeout(t);
  }, [config, user, importFromGoogle]);

  return {
    dataset, meta, config, history, loading, sync,
    hasFirebase: svc.HAS_FIREBASE, hasApiKey: HAS_API_KEY,
    importFromGoogle, importFromUpload, saveEdited,
    saveSheetConfig, restoreVersion, clearSync,
  };
}
