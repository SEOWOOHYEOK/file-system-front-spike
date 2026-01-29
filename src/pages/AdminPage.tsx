/**
 * AdminPage - 500.관리자 시스템 상태 대시보드
 */
import { useState, useEffect, useCallback } from 'react';
import { useInternalAuth } from '../hooks/useInternalAuth';
import { adminSystemApi, setAdminLogCallback } from '../api/adminApi';
import { ResultLog } from '../components/ResultLog';
import type {
  CacheHealthResponse,
  NasHealthResponse,
  StorageConsistencyResponse,
  SyncEvent,
  AdminApiLogEntry,
} from '../types/admin.types';
import type { ApiLogEntry } from '../types/api.types';

export function AdminPage() {
  const { auth } = useInternalAuth();

  // 상태
  const [cacheHealth, setCacheHealth] = useState<CacheHealthResponse | null>(null);
  const [nasHealth, setNasHealth] = useState<NasHealthResponse | null>(null);
  const [storageConsistency, setStorageConsistency] = useState<StorageConsistencyResponse | null>(null);
  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>([]);

  // 로딩 상태
  const [loading, setLoading] = useState({
    cache: false,
    nas: false,
    storage: false,
    sync: false,
  });

  // API 로그
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);

  // 로그 콜백 설정
  useEffect(() => {
    setAdminLogCallback((log: AdminApiLogEntry) => {
      const convertedLog: ApiLogEntry = {
        id: log.id,
        timestamp: log.timestamp,
        method: log.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        url: log.url,
        status: log.status,
        duration: log.duration,
        request: log.request,
        response: log.response,
        error: log.error,
      };
      setLogs((prev) => [convertedLog, ...prev].slice(0, 100));
    });
    return () => setAdminLogCallback(null);
  }, []);

  // 캐시 상태 조회
  const fetchCacheHealth = useCallback(async () => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, cache: true }));
    try {
      const response = await adminSystemApi.getCacheHealth(auth.token);
      setCacheHealth(response);
    } catch (error) {
      console.error('Failed to fetch cache health:', error);
      setCacheHealth({ status: 'unhealthy', connected: false, error: 'Failed to fetch' });
    } finally {
      setLoading((prev) => ({ ...prev, cache: false }));
    }
  }, [auth.token]);

  // NAS 상태 조회
  const fetchNasHealth = useCallback(async () => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, nas: true }));
    try {
      const response = await adminSystemApi.getNasHealth(auth.token);
      setNasHealth(response);
    } catch (error) {
      console.error('Failed to fetch NAS health:', error);
      setNasHealth({ status: 'unhealthy', connected: false, error: 'Failed to fetch' });
    } finally {
      setLoading((prev) => ({ ...prev, nas: false }));
    }
  }, [auth.token]);



  // 동기화 이벤트 조회
  const fetchSyncEvents = useCallback(async () => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, sync: true }));
    try {
      const response = await adminSystemApi.getSyncEvents(auth.token);
      setSyncEvents(response.items);
    } catch (error) {
      console.error('Failed to fetch sync events:', error);
    } finally {
      setLoading((prev) => ({ ...prev, sync: false }));
    }
  }, [auth.token]);

  // 전체 새로고침
  const refreshAll = () => {
    fetchCacheHealth();
    fetchNasHealth();
    fetchStorageConsistency();
    fetchSyncEvents();
  };

  // 바이트를 GB로 변환
  const formatBytes = (bytes?: number) => {
    if (bytes === undefined) return '-';
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  if (!auth.isAuthenticated) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <p className="text-yellow-800">상단 헤더에서 SSO 로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">500.관리자</h2>
          <p className="text-sm text-gray-500">시스템 상태 대시보드</p>
        </div>
        <button
          onClick={refreshAll}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
        >
          전체 새로고침
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Left: Status Cards */}
        <div className="col-span-8 space-y-4">
          {/* Cache Health */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">캐시 스토리지 상태</h3>
              <button
                onClick={fetchCacheHealth}
                disabled={loading.cache}
                className="text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50"
              >
                {loading.cache ? '조회 중...' : '조회'}
              </button>
            </div>
            {cacheHealth ? (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className={`w-3 h-3 rounded-full ${cacheHealth.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm">{cacheHealth.status === 'healthy' ? '정상' : '오류'}</span>
                </div>
                <div className="text-sm text-gray-500">
                  연결: {cacheHealth.connected ? '연결됨' : '연결 안됨'}
                  {cacheHealth.latencyMs !== undefined && ` | 지연: ${cacheHealth.latencyMs}ms`}
                </div>
                {cacheHealth.error && <div className="text-sm text-red-500">{cacheHealth.error}</div>}
              </div>
            ) : (
              <p className="text-sm text-gray-400">조회 버튼을 클릭하세요</p>
            )}
          </div>

          {/* NAS Health */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">NAS 스토리지 상태</h3>
              <button
                onClick={fetchNasHealth}
                disabled={loading.nas}
                className="text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50"
              >
                {loading.nas ? '조회 중...' : '조회'}
              </button>
            </div>
            {nasHealth ? (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className={`w-3 h-3 rounded-full ${nasHealth.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm">{nasHealth.status === 'healthy' ? '정상' : '오류'}</span>
                </div>
                <div className="text-sm text-gray-500">
                  연결: {nasHealth.connected ? '연결됨' : '연결 안됨'}
                </div>
                {nasHealth.totalSpace !== undefined && (
                  <div className="text-sm text-gray-500">
                    전체: {formatBytes(nasHealth.totalSpace)} |
                    사용: {formatBytes(nasHealth.usedSpace)} |
                    여유: {formatBytes(nasHealth.freeSpace)} |
                    사용률: {nasHealth.usagePercent?.toFixed(1)}%
                  </div>
                )}
                {nasHealth.error && <div className="text-sm text-red-500">{nasHealth.error}</div>}
              </div>
            ) : (
              <p className="text-sm text-gray-400">조회 버튼을 클릭하세요</p>
            )}

          </div>

        </div>

        {/* Right: API Log */}
        <div className="col-span-4">
          <div className="h-[calc(100vh-280px)]">
            <ResultLog logs={logs} onClear={() => setLogs([])} />
          </div>
        </div>
      </div>
    </div >
  );
}
