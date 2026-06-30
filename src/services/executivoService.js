// ============================================================
// EXECUTIVO SERVICE — persistência do Dashboard Executivo no
// Firestore (dataset atual compartilhado + histórico de versões
// + configuração das planilhas do Google Sheets).
//
// Estrutura:
//   executivo/current            -> { data, meta }            (versão ativa)
//   executivo/config             -> { planoSheet, dashboardSheet }
//   executivo_historico/{auto}   -> { data, meta, createdAt } (snapshots)
// ============================================================

import { db } from './firebase';
import {
  doc, getDoc, setDoc,
  collection, addDoc, getDocs,
  onSnapshot, query, orderBy, limit,
  serverTimestamp,
} from 'firebase/firestore';

export const HAS_FIREBASE = !!import.meta.env.VITE_FIREBASE_PROJECT_ID;

const COL = 'executivo';
const HIST = 'executivo_historico';
const CURRENT = 'current';
const CONFIG = 'config';
const HIST_LIMIT = 30;

const currentRef = () => doc(db, COL, CURRENT);
const configRef = () => doc(db, COL, CONFIG);
const histCol = () => collection(db, HIST);

/** Remove undefined/funções tornando o objeto seguro para o Firestore. */
function sanitize(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ── Dataset atual ───────────────────────────────────────────
/**
 * Escuta a versão ativa do dataset em tempo real.
 * @param {(payload: {data:object, meta:object}|null) => void} cb
 * @returns {() => void} unsubscribe
 */
export function subscribeCurrent(cb) {
  if (!HAS_FIREBASE) { cb(null); return () => {}; }
  return onSnapshot(
    currentRef(),
    (snap) => cb(snap.exists() ? snap.data() : null),
    (err) => { console.error('[executivo] subscribeCurrent:', err); cb(null); },
  );
}

/** Lê a versão ativa uma única vez. */
export async function getCurrent() {
  if (!HAS_FIREBASE) return null;
  const snap = await getDoc(currentRef());
  return snap.exists() ? snap.data() : null;
}

/**
 * Salva o dataset como versão ativa e grava um snapshot no histórico.
 * @param {object} data  dataset (formato executivoData)
 * @param {object} meta  { source, userName, userEmail, fileNames?, note? }
 */
export async function saveDataset(data, meta = {}) {
  if (!HAS_FIREBASE) throw new Error('Firebase não configurado.');
  const safeData = sanitize(data);
  const metaRecord = {
    source: meta.source || 'desconhecido',     // 'google' | 'upload' | 'edicao-manual'
    userName: meta.userName || null,
    userEmail: meta.userEmail || null,
    fileNames: meta.fileNames || null,
    note: meta.note || null,
    updatedAt: serverTimestamp(),
  };

  // 1) versão ativa
  await setDoc(currentRef(), { data: safeData, meta: metaRecord });

  // 2) snapshot de histórico
  try {
    await addDoc(histCol(), {
      data: safeData,
      meta: metaRecord,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // histórico é melhor-esforço; não bloqueia a atualização principal
    console.error('[executivo] falha ao gravar histórico:', err);
  }
}

// ── Histórico ───────────────────────────────────────────────
/**
 * Escuta a lista de versões do histórico (mais recentes primeiro).
 * @param {(items: Array<{id:string, meta:object, createdAt:any}>) => void} cb
 */
export function subscribeHistory(cb) {
  if (!HAS_FIREBASE) { cb([]); return () => {}; }
  const q = query(histCol(), orderBy('createdAt', 'desc'), limit(HIST_LIMIT));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error('[executivo] subscribeHistory:', err); cb([]); },
  );
}

/** Lê o dataset de uma versão específica do histórico. */
export async function getHistoryEntry(id) {
  if (!HAS_FIREBASE) return null;
  const snap = await getDoc(doc(db, HIST, id));
  return snap.exists() ? snap.data() : null;
}

// ── Configuração das planilhas ──────────────────────────────
/**
 * Escuta a configuração das planilhas (links do Google Sheets).
 * @param {(cfg: {planoSheet?:string, dashboardSheet?:string}) => void} cb
 */
export function subscribeConfig(cb) {
  if (!HAS_FIREBASE) { cb({}); return () => {}; }
  return onSnapshot(
    configRef(),
    (snap) => cb(snap.exists() ? snap.data() : {}),
    (err) => { console.error('[executivo] subscribeConfig:', err); cb({}); },
  );
}

export async function getConfig() {
  if (!HAS_FIREBASE) return {};
  const snap = await getDoc(configRef());
  return snap.exists() ? snap.data() : {};
}

export async function saveConfig(cfg) {
  if (!HAS_FIREBASE) throw new Error('Firebase não configurado.');
  await setDoc(configRef(), sanitize(cfg), { merge: true });
}

/** Apaga o histórico antigo além do limite (utilitário opcional). */
export async function pruneHistory() {
  if (!HAS_FIREBASE) return;
  const q = query(histCol(), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  // mantido como utilitário; não remove automaticamente para preservar trilha.
  return snap.size;
}
