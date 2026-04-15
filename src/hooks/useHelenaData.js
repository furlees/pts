import { useState, useEffect, useCallback } from 'react';
import { fetchDashboardData, fetchRecentActivity, fetchChatConversations, fetchAllLeads } from '../services/helenaService';

/**
 * Hook personalizado para buscar e gerenciar os dados da Helena.
 */
export function useHelenaData(dateRange = { startDate: null, endDate: null }) {
  const [data, setData] = useState({
    totalLeads: 0,
    leadsAtendidos: 0,
    leadsTransferidos: 0,
    taxaConversao: 0,
    avgResponseTime: '0 seg',
    areas: [],
    insights: {
      peakHours: [],
      leadProfiles: {},
      topKeywords: [],
      acuracia: null,
      totalAvaliados: 0
    }
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Busca os dados passando os filtros de data
      const [dashboardResult, activityResult] = await Promise.all([
        fetchDashboardData(dateRange),
        fetchRecentActivity({ limit: 10, ...dateRange }),
      ]);

      if (dashboardResult.error) {
        throw new Error(dashboardResult.error.message || 'Erro ao buscar dados do dashboard');
      }

      if (activityResult.error) {
        throw new Error(activityResult.error.message || 'Erro ao buscar atividade recente');
      }

      setData({
        totalLeads: dashboardResult.totalLeads,
        leadsAtendidos: dashboardResult.leadsAtendidos,
        leadsTransferidos: dashboardResult.leadsTransferidos,
        taxaConversao: dashboardResult.taxaConversao,
        avgResponseTime: dashboardResult.avgResponseTime || '0 seg',
        areas: dashboardResult.areas,
        insights: dashboardResult.insights,
      });

      setRecentActivity(activityResult.data);
    } catch (err) {
      console.error('[useHelenaData] Erro:', err);
      setError(err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, recentActivity, loading, error, refetch };
}

export function useHelenaDataWithAutoRefresh(intervalMs = 30000, dateRange) {
  const helenaData = useHelenaData(dateRange);

  useEffect(() => {
    if (intervalMs <= 0) return;

    const interval = setInterval(() => {
      helenaData.refetch();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs, helenaData.refetch]);

  return helenaData;
}

/**
 * Hook para a página de Chat - Lista conversas IA-Lead
 */
export function useChatData(dateRange = { startDate: null, endDate: null }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await fetchChatConversations({ limit: 1000, ...dateRange });
      
      if (error) {
        throw new Error(error.message || 'Erro ao buscar conversas do chat');
      }
      
      setConversations(data || []);
    } catch (err) {
      console.error('[useChatData] Erro:', err);
      setError(err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { conversations, loading, error, refetch };
}

/**
 * Hook para a página de Leads - Tabela de Leads Completa
 */
export function useLeadsData(dateRange = { startDate: null, endDate: null }) {
  const [leadsList, setLeadsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await fetchAllLeads({ limit: 1000, ...dateRange });
      
      if (error) {
        throw new Error(error.message || 'Erro ao buscar Lista de Leads');
      }
      
      setLeadsList(data || []);
    } catch (err) {
      console.error('[useLeadsData] Erro:', err);
      setError(err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { leadsList, loading, error, refetch };
}
