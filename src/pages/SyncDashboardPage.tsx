/**
 * SyncDashboardPage - 문서 모니터링 화면
 * sync-query API 기반 (/v1/admin/sync-query/*)
 */
import { useState, useEffect, useCallback } from 'react';
import { syncQueryApi } from '../api/syncQueryApi';
import type {
  SyncDisplayStatus,
  SyncQuerySummaryResponse,
  SyncQueryEventItem,
  SyncQueryEventListResponse,
  SyncQueryUploader,
} from '../types/sync-query.types';

// ─── 상수 ───

const STATUS_CONFIG: Record<SyncDisplayStatus, { color: string; bg: string; dot: string }> = {
  '정상': { color: 'text-green-700', bg: 'bg-green-50', dot: 'bg-green-400' },
  '동기화 중': { color: 'text-blue-700', bg: 'bg-blue-50', dot: 'bg-blue-400' },
  '오류': { color: 'text-red-700', bg: 'bg-red-50', dot: 'bg-red-500' },
  '대기': { color: 'text-gray-700', bg: 'bg-gray-100', dot: 'bg-gray-400' },
};

const DISPLAY_STATUSES: (SyncDisplayStatus | '전체')[] = ['전체', '정상', '동기화 중', '오류', '대기'];

const PERIOD_OPTIONS = [
  { value: '1', label: '1일' },
  { value: '7', label: '7일' },
  { value: '30', label: '30일' },
];

// ─── 유틸 ───

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatRelativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function getDateRange(days: number): { fromDate: string; toDate: string } {
  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: now.toISOString().slice(0, 10),
  };
}

// ─── 상태 배지 ───

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as SyncDisplayStatus];
  if (!config) return <span className="text-xs text-gray-500">{status}</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {status}
    </span>
  );
}

// ─── 메인 컴포넌트 ───

export function SyncDashboardPage() {
  // 상태
  const [summary, setSummary] = useState<SyncQuerySummaryResponse | null>(null);
  const [listData, setListData] = useState<SyncQueryEventListResponse | null>(null);
  const [uploaders, setUploaders] = useState<SyncQueryUploader[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 필터
  const [statusFilter, setStatusFilter] = useState<SyncDisplayStatus | '전체'>('전체');
  const [searchFileName, setSearchFileName] = useState('');
  const [selectedUploader, setSelectedUploader] = useState('');
  const [periodDays, setPeriodDays] = useState('1');

  // 페이지네이션
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // 자동 갱신
  const [autoRefresh, setAutoRefresh] = useState(true);

  // ─── 데이터 로드 ───

  const dateRange = getDateRange(Number(periodDays));

  const loadSummary = useCallback(async () => {
    try {
      const data = await syncQueryApi.getSummary(dateRange);
      setSummary(data);
    } catch (err) {
      console.error('Summary load failed:', err);
    }
  }, [dateRange.fromDate, dateRange.toDate]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {
        ...dateRange,
        page,
        pageSize,
      };
      if (statusFilter !== '전체') params.status = statusFilter;
      if (searchFileName.trim()) params.fileName = searchFileName.trim();

      const data = await syncQueryApi.getList(params as any);
      setListData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '목록 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [dateRange.fromDate, dateRange.toDate, statusFilter, searchFileName, page, pageSize]);

  const loadUploaders = useCallback(async () => {
    try {
      const data = await syncQueryApi.getUploaders(dateRange);
      setUploaders(data.uploaders);
    } catch (err) {
      console.error('Uploaders load failed:', err);
    }
  }, [dateRange.fromDate, dateRange.toDate]);

  // 초기 로드
  useEffect(() => {
    loadSummary();
    loadList();
    loadUploaders();
  }, [loadSummary, loadList, loadUploaders]);

  // 자동 갱신 (10초)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadSummary();
      loadList();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadSummary, loadList]);

  // 필터 변경 시 페이지 리셋
  const handleStatusFilter = (s: SyncDisplayStatus | '전체') => {
    setStatusFilter(s);
    setPage(1);
  };

  const handleSearch = () => {
    setPage(1);
    loadList();
  };

  const handleRefresh = () => {
    loadSummary();
    loadList();
    loadUploaders();
  };

  // 업로더 필터링 (클라이언트 사이드)
  const filteredItems = listData?.items.filter((item) => {
    if (!selectedUploader) return true;
    return item.uploaderName === selectedUploader;
  }) ?? [];

  // ─── 렌더링 ───

  return (
    <div className="flex gap-0 h-full -m-6">
      {/* 좌측 사이드바 */}
      <div className="w-52 bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* 기간 선택 */}
        <div className="p-4 border-b border-gray-100">
          <select
            value={periodDays}
            onChange={(e) => { setPeriodDays(e.target.value); setPage(1); }}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* 상태 필터 */}
        <div className="p-3 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 mb-2">상태</h3>
          <nav className="space-y-0.5">
            {DISPLAY_STATUSES.map((s) => {
              const count = s === '전체'
                ? (summary?.total ?? 0)
                : (summary?.counts[s] ?? 0);
              const isActive = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => handleStatusFilter(s)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-sm rounded transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>{s}</span>
                  <span className={`min-w-[24px] h-5 flex items-center justify-center rounded-full text-xs font-medium px-1.5 ${
                    isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* 업로더 필터 */}
        <div className="p-3">
          <h3 className="text-xs font-semibold text-gray-500 mb-2">업로더</h3>
          <select
            value={selectedUploader}
            onChange={(e) => setSelectedUploader(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white"
          >
            <option value="">전체</option>
            {uploaders.map((u) => (
              <option key={u.userId} value={u.name}>{u.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* 상단 툴바 */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {/* 필터 표시 */}
            <button className="px-3 py-1.5 text-xs rounded border border-gray-200 text-gray-600">
              필터
            </button>

            {/* 파일명 검색 */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="파일명 검색..."
                value={searchFileName}
                onChange={(e) => setSearchFileName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
            </div>

            <div className="flex-1" />

            {/* 새로고침 */}
            <button
              onClick={handleRefresh}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              title="새로고침"
            >
              🔄
            </button>

            {/* 자동 갱신 토글 */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                autoRefresh
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              자동 갱신(10초)
              <span className={`w-8 h-4 rounded-full relative transition-colors ${autoRefresh ? 'bg-blue-500' : 'bg-gray-300'}`}>
                <span className={`absolute w-3 h-3 rounded-full bg-white top-0.5 transition-all ${autoRefresh ? 'left-4' : 'left-0.5'}`} />
              </span>
            </button>
          </div>
        </div>

        {/* 에러 */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
            <button onClick={handleRefresh} className="ml-2 text-red-600 font-medium">재시도</button>
          </div>
        )}

        {/* 테이블 */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-24">상태</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">파일명</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 w-20">크기</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-20">업로더</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-28 cursor-pointer">
                  업로드일 ↓
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-24">마지막 동기화</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && !listData ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-gray-500">불러오는 중...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-gray-400 text-sm">
                    동기화 이벤트가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <StatusBadge status={item.displayStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[280px]">{item.fileName}</span>
                        <span className="text-xs text-gray-400 truncate max-w-[280px]">{item.folderPath}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {formatFileSize(item.fileSize)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item.uploaderName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(item.uploadedAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatRelativeTime(item.uploadedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {item.remarks ? (
                        <span className="text-xs text-red-600" title={item.remarks}>
                          {item.remarks}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {listData && listData.totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between bg-white">
            <span className="text-sm text-gray-500">
              전체 {listData.total.toLocaleString()}건 표시 완료
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="px-2.5 py-1.5 text-xs rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                «
              </button>
              {Array.from({ length: Math.min(listData.totalPages, 7) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-2.5 py-1.5 text-xs rounded border transition-colors ${
                    p === page ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= listData.totalPages}
                className="px-2.5 py-1.5 text-xs rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
