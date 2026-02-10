/**
 * SyncDashboardPage - 동기화 대시보드
 * 동기화 이벤트 상태 요약 + 이벤트 목록 테이블 (필터, 검색, 페이지네이션)
 */
import { useState, useEffect, useCallback } from 'react';
import { useInternalAuth } from '../hooks/useInternalAuth';
import { syncDashboardApi } from '../api/syncDashboardApi';
import type {
  SyncDashboardSummaryResponse,
  SyncDashboardEventsResponse,
  SyncDashboardEventItem,
  SyncDashboardEventsQuery,
  SyncEventStatus,
  SyncEventType,
  SyncEventTargetType,
} from '../types/sync-dashboard';

// ─── 상수 & 매핑 ───

const STATUS_CONFIG: Record<SyncEventStatus, { label: string; color: string; bg: string; dot: string }> = {
  PENDING: { label: '대기', color: 'text-gray-700', bg: 'bg-gray-100', dot: 'bg-gray-400' },
  QUEUED: { label: '큐 대기', color: 'text-blue-700', bg: 'bg-blue-50', dot: 'bg-blue-400' },
  PROCESSING: { label: '진행중', color: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-400' },
  RETRYING: { label: '재시도', color: 'text-orange-700', bg: 'bg-orange-50', dot: 'bg-orange-400' },
  DONE: { label: '완료', color: 'text-green-700', bg: 'bg-green-50', dot: 'bg-green-400' },
  FAILED: { label: '실패', color: 'text-red-700', bg: 'bg-red-50', dot: 'bg-red-500' },
};

const EVENT_TYPE_CONFIG: Record<SyncEventType, { label: string; color: string; bg: string }> = {
  CREATE: { label: '업로드', color: 'text-blue-700', bg: 'bg-blue-50' },
  MOVE: { label: '이동', color: 'text-purple-700', bg: 'bg-purple-50' },
  DELETE: { label: '삭제', color: 'text-red-700', bg: 'bg-red-50' },
  RENAME: { label: '이름변경', color: 'text-cyan-700', bg: 'bg-cyan-50' },
  TRASH: { label: '휴지통', color: 'text-gray-700', bg: 'bg-gray-100' },
  RESTORE: { label: '복구', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  PURGE: { label: '완전삭제', color: 'text-rose-700', bg: 'bg-rose-50' },
};

const TARGET_TYPE_CONFIG: Record<SyncEventTargetType, { label: string; icon: string }> = {
  FILE: { label: '파일', icon: '📄' },
  FOLDER: { label: '폴더', icon: '📁' },
};

type StatusFilter = SyncEventStatus | 'ALL';

const STATUS_FILTER_ITEMS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'PENDING', label: '대기' },
  { key: 'QUEUED', label: '큐 대기' },
  { key: 'PROCESSING', label: '진행중' },
  { key: 'RETRYING', label: '재시도' },
  { key: 'DONE', label: '완료' },
  { key: 'FAILED', label: '실패' },
];

// ─── 유틸리티 ───

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '-';
  if (seconds < 60) return `${seconds}초`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min < 60) return sec > 0 ? `${min}분 ${sec}초` : `${min}분`;
  const hr = Math.floor(min / 60);
  const remainMin = min % 60;
  return `${hr}시간 ${remainMin}분`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRelativeTime(iso: string): string {
  const now = new Date();
  const d = new Date(iso);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

// ─── 상태 배지 컴포넌트 ───

function StatusBadge({ status }: { status: SyncEventStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function EventTypeBadge({ eventType }: { eventType: SyncEventType }) {
  const config = EVENT_TYPE_CONFIG[eventType];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.color}`}>
      {config.label}
    </span>
  );
}

function TargetTypeBadge({ targetType }: { targetType: SyncEventTargetType }) {
  const config = TARGET_TYPE_CONFIG[targetType];
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-600">
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
}

// ─── 메인 페이지 컴포넌트 ───

export function SyncDashboardPage() {
  const { auth } = useInternalAuth();

  // 상태
  const [summary, setSummary] = useState<SyncDashboardSummaryResponse | null>(null);
  const [events, setEvents] = useState<SyncDashboardEventsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 필터
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [eventTypeFilter, setEventTypeFilter] = useState<SyncEventType | ''>('');
  const [targetTypeFilter, setTargetTypeFilter] = useState<SyncEventTargetType | ''>('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // 페이지네이션
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // 정렬
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 자동 새로고침
  const [autoRefresh, setAutoRefresh] = useState(false);

  // ─── 데이터 로드 ───

  const loadSummary = useCallback(async () => {
    if (!auth.token) return;
    try {
      const data = await syncDashboardApi.getSummary(auth.token);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  }, [auth.token]);

  const loadEvents = useCallback(async () => {
    if (!auth.token) return;
    setLoading(true);
    setError(null);

    try {
      const query: SyncDashboardEventsQuery = {
        page,
        pageSize,
        sortBy,
        sortOrder,
      };

      if (statusFilter !== 'ALL') query.status = statusFilter;
      if (eventTypeFilter) query.eventType = eventTypeFilter;
      if (targetTypeFilter) query.targetType = targetTypeFilter;
      if (fromDate) query.fromDate = fromDate;
      if (toDate) query.toDate = toDate;

      const data = await syncDashboardApi.getEvents(auth.token, query);
      setEvents(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '이벤트 목록을 불러오는데 실패했습니다.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [auth.token, page, pageSize, statusFilter, eventTypeFilter, targetTypeFilter, fromDate, toDate, sortBy, sortOrder]);

  // 초기 로드
  useEffect(() => {
    loadSummary();
    loadEvents();
  }, [loadSummary, loadEvents]);

  // 자동 새로고침 (30초)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadSummary();
      loadEvents();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadSummary, loadEvents]);

  // 필터 변경시 페이지 리셋
  const handleStatusFilter = (status: StatusFilter) => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleRefresh = () => {
    loadSummary();
    loadEvents();
  };

  // 검색 필터링 (클라이언트 사이드)
  const filteredItems = events?.items.filter((item) => {
    if (!searchKeyword) return true;
    const keyword = searchKeyword.toLowerCase();
    return (
      item.fileName.toLowerCase().includes(keyword) ||
      item.filePath.toLowerCase().includes(keyword) ||
      item.requester.name.toLowerCase().includes(keyword) ||
      (item.requester.department && item.requester.department.toLowerCase().includes(keyword))
    );
  }) ?? [];

  // ─── 미인증 ───

  if (!auth.isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">인증이 필요합니다</h2>
          <p className="text-gray-500">우측 상단에서 로그인해 주세요.</p>
        </div>
      </div>
    );
  }

  // ─── 요약 카운트 계산 ───

  const getStatusCount = (key: StatusFilter): number => {
    if (!summary) return 0;
    if (key === 'ALL') return summary.total;
    const map: Record<string, number> = {
      PENDING: summary.pending,
      QUEUED: summary.queued,
      PROCESSING: summary.processing,
      RETRYING: summary.retrying,
      DONE: summary.done,
      FAILED: summary.failed,
    };
    return map[key] ?? 0;
  };

  return (
    <div className="flex gap-0 h-full -m-6">
      {/* ─── 좌측 사이드바: 상태 필터 ─── */}
      <div className="w-48 bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">동기화 상태</h2>
        </div>

        {/* 필터 목록 */}
        <nav className="flex-1 py-2">
          {STATUS_FILTER_ITEMS.map((item) => {
            const count = getStatusCount(item.key);
            const isActive = statusFilter === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleStatusFilter(item.key)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-500'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>{item.label}</span>
                <span
                  className={`min-w-[24px] h-5 flex items-center justify-center rounded-full text-xs font-medium ${
                    item.key === 'FAILED' && count > 0
                      ? 'bg-red-100 text-red-700'
                      : isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-500'
                  } px-1.5`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Stuck 경고 */}
        {summary && summary.stuckCount > 0 && (
          <div className="p-3 mx-3 mb-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-amber-500">⚠️</span>
              <div>
                <p className="text-xs font-medium text-amber-800">Stuck 감지</p>
                <p className="text-xs text-amber-600">{summary.stuckCount}건이 지연됨</p>
              </div>
            </div>
          </div>
        )}

        {/* 마지막 체크 시각 */}
        {summary && (
          <div className="p-3 border-t border-gray-100 text-xs text-gray-400">
            마지막 확인: {formatRelativeTime(summary.checkedAt)}
          </div>
        )}
      </div>

      {/* ─── 메인 콘텐츠 ─── */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* 상단 헤더 & 도구 */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-gray-900">File Sync</h1>
              {summary && (
                <span className="text-sm text-gray-500">
                  총 {summary.total.toLocaleString()}건
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* 자동 새로고침 토글 */}
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  autoRefresh
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
                title={autoRefresh ? '자동 새로고침 켜짐 (30초)' : '자동 새로고침 끔'}
              >
                <span className={autoRefresh ? 'animate-spin' : ''}>🔄</span>
                자동
              </button>
              {/* 새로고침 */}
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                새로고침
              </button>
            </div>
          </div>

          {/* 검색 & 필터 */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* 검색 */}
            <div className="relative flex-1 min-w-[280px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input
                type="text"
                placeholder="파일명, 경로, 사용자명으로 검색..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 이벤트 타입 필터 */}
            <select
              value={eventTypeFilter}
              onChange={(e) => {
                setEventTypeFilter(e.target.value as SyncEventType | '');
                setPage(1);
              }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">이벤트 전체</option>
              {Object.entries(EVENT_TYPE_CONFIG).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>

            {/* 대상 타입 필터 */}
            <select
              value={targetTypeFilter}
              onChange={(e) => {
                setTargetTypeFilter(e.target.value as SyncEventTargetType | '');
                setPage(1);
              }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">구분 전체</option>
              <option value="FILE">📄 파일</option>
              <option value="FOLDER">📁 폴더</option>
            </select>

            {/* 날짜 필터 */}
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="시작일"
            />
            <span className="text-gray-400 text-sm">~</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="종료일"
            />

            {/* 필터 초기화 */}
            {(eventTypeFilter || targetTypeFilter || fromDate || toDate || searchKeyword) && (
              <button
                onClick={() => {
                  setEventTypeFilter('');
                  setTargetTypeFilter('');
                  setFromDate('');
                  setToDate('');
                  setSearchKeyword('');
                  setPage(1);
                }}
                className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ✕ 초기화
              </button>
            )}
          </div>
        </div>

        {/* 에러 표시 */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <span>⚠️</span>
            {error}
            <button onClick={handleRefresh} className="ml-auto text-red-600 hover:text-red-800 font-medium">
              재시도
            </button>
          </div>
        )}

        {/* 테이블 */}
        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">
                  이벤트
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">
                  구분
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  파일명
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  경로
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                  사용자
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-20 cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort('createdAt')}
                >
                  크기
                  {sortBy === 'createdAt' && (
                    <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">
                  소요
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">
                  재시도
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[200px]">
                  비고
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && !events ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-gray-500">불러오는 중...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <span className="text-3xl">📭</span>
                      <span className="text-sm">동기화 이벤트가 없습니다.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <EventRow key={item.id} item={item} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {events && events.totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between bg-white">
            <span className="text-sm text-gray-500">
              총 {events.totalItems.toLocaleString()}건 중 {((events.page - 1) * events.pageSize) + 1}
              -{Math.min(events.page * events.pageSize, events.totalItems)}건
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={!events.hasPrev}
                className="px-2.5 py-1.5 text-xs rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ««
              </button>
              <button
                onClick={() => setPage(page - 1)}
                disabled={!events.hasPrev}
                className="px-2.5 py-1.5 text-xs rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                «
              </button>
              {generatePageNumbers(events.page, events.totalPages).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-2.5 py-1.5 text-xs rounded border transition-colors ${
                    p === events.page
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(page + 1)}
                disabled={!events.hasNext}
                className="px-2.5 py-1.5 text-xs rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                »
              </button>
              <button
                onClick={() => setPage(events.totalPages)}
                disabled={!events.hasNext}
                className="px-2.5 py-1.5 text-xs rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                »»
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 이벤트 행 컴포넌트 ───

function EventRow({ item }: { item: SyncDashboardEventItem }) {
  const isError = item.status === 'FAILED';
  const isStuck = item.isStuck;

  return (
    <tr
      className={`hover:bg-gray-50 transition-colors ${
        isError ? 'bg-red-50/40' : isStuck ? 'bg-amber-50/40' : ''
      }`}
    >
      {/* 상태 */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <StatusBadge status={item.status} />
          {isStuck && (
            <span className="text-amber-500 text-xs" title="Stuck: 장시간 지연">⚠</span>
          )}
        </div>
      </td>

      {/* 이벤트 타입 */}
      <td className="px-4 py-3">
        <EventTypeBadge eventType={item.eventType} />
      </td>

      {/* 구분 */}
      <td className="px-4 py-3">
        <TargetTypeBadge targetType={item.targetType} />
      </td>

      {/* 파일명 */}
      <td className="px-4 py-3">
        <span className="text-sm font-medium text-gray-900 truncate block max-w-[200px]" title={item.fileName}>
          {item.fileName}
        </span>
      </td>

      {/* 경로 */}
      <td className="px-4 py-3">
        <span className="text-xs text-gray-500 truncate block max-w-[250px]" title={item.filePath}>
          {item.filePath}
        </span>
      </td>

      {/* 사용자 */}
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm text-gray-900">{item.requester.name}</span>
          {item.requester.department && (
            <span className="text-xs text-gray-400">{item.requester.department}</span>
          )}
        </div>
      </td>

      {/* 크기 */}
      <td className="px-4 py-3 text-right">
        <span className="text-sm text-gray-600">
          {item.fileSizeFormatted ?? (item.targetType === 'FOLDER' ? '-' : '0 B')}
        </span>
      </td>

      {/* 소요 */}
      <td className="px-4 py-3 text-right">
        <span className="text-sm text-gray-600">{formatDuration(item.duration)}</span>
      </td>

      {/* 재시도 */}
      <td className="px-4 py-3 text-center">
        {item.retryCount > 0 ? (
          <span className={`text-sm font-medium ${item.retryCount >= item.maxRetries ? 'text-red-600' : 'text-amber-600'}`}>
            {item.retryCount}/{item.maxRetries}
          </span>
        ) : (
          <span className="text-sm text-gray-300">-</span>
        )}
      </td>

      {/* 비고 */}
      <td className="px-4 py-3">
        {item.errorMessage ? (
          <div className="flex items-start gap-1.5">
            <span className="text-red-500 mt-0.5 shrink-0">⚠️</span>
            <span className="text-xs text-red-600 line-clamp-2" title={item.errorMessage}>
              {item.errorMessage}
            </span>
          </div>
        ) : item.completedAt ? (
          <span className="text-xs text-gray-400" title={formatDateTime(item.completedAt)}>
            {formatRelativeTime(item.completedAt)}
          </span>
        ) : (
          <span className="text-xs text-gray-300">-</span>
        )}
      </td>
    </tr>
  );
}

// ─── 페이지 번호 생성 ───

function generatePageNumbers(current: number, total: number): number[] {
  const pages: number[] = [];
  const maxVisible = 7;

  if (total <= maxVisible) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, current - half);
    const end = Math.min(total, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) pages.push(i);
  }

  return pages;
}
