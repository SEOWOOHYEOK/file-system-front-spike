/**
 * useObservability - NAS Observability 대시보드 데이터 폴링 훅
 */
import { useState, useEffect, useCallback } from 'react';
import { observabilityApi } from '../api/adminApi';
import type {
  ObservabilityCurrent,
  ObservabilityHistory,
  ObservabilitySettings,
  UpdateObservabilitySettings,
} from '../types/observability';

interface UseObservabilityOptions {
  /** current + history 폴링 간격 (ms). 기본 60초 */
  pollingInterval?: number;
  /** 자동 폴링 활성화 여부. 기본 true */
  enabled?: boolean;
  /** 이력 조회 기간 (시간). 기본 24 */
  historyHours?: number;
}

interface UseObservabilityReturn {
  current: ObservabilityCurrent | null;
  history: ObservabilityHistory | null;
  settings: ObservabilitySettings | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateSettings: (data: UpdateObservabilitySettings) => Promise<void>;
}

export function useObservability(
  token: string | null,
  options: UseObservabilityOptions = {}
): UseObservabilityReturn {
  const { pollingInterval = 60_000, enabled = true, historyHours = 24 } = options;

  const [current, setCurrent] = useState<ObservabilityCurrent | null>(null);
  const [history, setHistory] = useState<ObservabilityHistory | null>(null);
  const [settings, setSettings] = useState<ObservabilitySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [currentData, historyData] = await Promise.all([
        observabilityApi.getCurrent(token),
        observabilityApi.getHistory(token, historyHours),
      ]);
      setCurrent(currentData);
      setHistory(historyData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API 호출 실패');
    } finally {
      setLoading(false);
    }
  }, [token, historyHours]);

  // 설정은 한 번만 로드
  useEffect(() => {
    if (!token) return;
    observabilityApi
      .getSettings(token)
      .then(setSettings)
      .catch(console.error);
  }, [token]);

  // 폴링
  useEffect(() => {
    if (!token || !enabled) return;

    fetchData();

    const timer = setInterval(fetchData, pollingInterval);
    return () => clearInterval(timer);
  }, [token, enabled, pollingInterval, fetchData]);

  const handleUpdateSettings = useCallback(
    async (data: UpdateObservabilitySettings) => {
      if (!token) return;
      try {
        const updated = await observabilityApi.updateSettings(token, data);
        setSettings(updated);
      } catch (err) {
        throw err;
      }
    },
    [token]
  );

  return {
    current,
    history,
    settings,
    loading,
    error,
    refetch: fetchData,
    updateSettings: handleUpdateSettings,
  };
}
