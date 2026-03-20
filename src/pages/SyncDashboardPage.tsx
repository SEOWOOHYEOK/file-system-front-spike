/**
 * SyncDashboardPage - 문서 동기화 모니터링
 * API: /v1/admin/sync-query (summary, list, uploaders)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { syncQueryApi } from '../api/syncQueryApi';
import type {
  SyncDisplayStatus,
  SyncQuerySummaryResponse,
  SyncQueryEventListResponse,
  SyncQueryUploader,
} from '../types/sync-query.types';

/* ─── 상수 ─── */

const STATUS_STYLES: Record<SyncDisplayStatus, { badge: string; dot: string }> = {
  정상: { badge: 'bg-green-50 text-green-700', dot: 'bg-green-400' },
  '동기화 중': { badge: 'bg-blue-50 text-blue-700', dot: 'bg-blue-400' },
  오류: { badge: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
  대기: { badge: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
};

const ALL_STATUSES: (SyncDisplayStatus | '전체')[] = ['전체', '정상', '동기화 중', '오류', '대기'];

const PERIODS = [
  { value: 1, label: '오늘' },
  { value: 7, label: '7일' },
  { value: 30, label: '30일' },
];

/* ─── 유틸 ─── */

function dateRange(days: number) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  };
}

function fmtSize(b: number | null) {
  if (b == null) return '-';
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(1)} MB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

function fmtAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return '방금 전';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

/* ─── 상태 뱃지 ─── */

function Badge({ status }: { status: string }) {
  const s = STATUS_STYLES[status as SyncDisplayStatus];
  if (!s) return <span className="text-xs text-gray-500">{status}</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

/* ─── 메인 ─── */

export function SyncDashboardPage() {
  /* state */
  const [summary, setSummary] = useState<SyncQuerySummaryResponse | null>(null);
  const [list, setList] = useState<SyncQueryEventListResponse | null>(null);
  const [uploaders, setUploaders] = useState<SyncQueryUploader[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [period, setPeriod] = useState(1);
  const [status, setStatus] = useState<SyncDisplayStatus | '전체'>('전체');
  const [fileName, setFileName] = useState('');
  const [uploader, setUploader] = useState('');
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const range = useMemo(() => dateRange(period), [period]);

  /* data loaders */
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, unknown> = { ...range, page, pageSize: 20 };
      if (status !== '전체') params.status = status;
      if (fileName.trim()) params.fileName = fileName.trim();

      const [summaryRes, listRes, uploadersRes] = await Promise.all([
        syncQueryApi.getSummary(range).catch(() => null),
        syncQueryApi.getList(params as any),
        syncQueryApi.getUploaders(range).catch(() => ({ uploaders: [] })),
      ]);

      if (summaryRes) setSummary(summaryRes);
      setList(listRes);
      setUploaders(uploadersRes.uploaders);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [range, status, fileName, page]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(loadAll, 10_000);
    return () => clearInterval(id);
  }, [autoRefresh, loadAll]);

  /* derived */
  const items = useMemo(() => {
    const all = list?.items ?? [];
    if (!uploader) return all;
    return all.filter((i) => i.uploaderName === uploader);
  }, [list, uploader]);

  const totalPages = list?.totalPages ?? 1;

  /* handlers */
  const onStatusClick = (s: typeof status) => { setStatus(s); setPage(1); };
  const onSearch = () => { setPage(1); loadAll(); };

  /* ─── render ─── */
  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">문서 동기화 모니터링</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={loadAll}
            className="px-3 py-1.5 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            새로고침
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              autoRefresh
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            자동 갱신
            <span className={`inline-block w-7 h-3.5 rounded-full relative ${autoRefresh ? 'bg-blue-500' : 'bg-gray-300'}`}>
              <span className={`absolute w-2.5 h-2.5 rounded-full bg-white top-0.5 transition-all ${autoRefresh ? 'left-3.5' : 'left-0.5'}`} />
            </span>
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-5 gap-3">
        {ALL_STATUSES.map((s) => {
          const cnt = s === '전체' ? (summary?.total ?? 0) : (summary?.counts[s] ?? 0);
          const active = status === s;
          return (
            <button
              key={s}
              onClick={() => onStatusClick(s)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                active ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200' : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="text-xs text-gray-500 mb-1">{s}</div>
              <div className={`text-xl font-bold ${active ? 'text-blue-700' : 'text-gray-900'}`}>
                {cnt.toLocaleString()}
              </div>
            </button>
          );
        })}
      </div>

      {/* 필터 바 */}
      <div className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3">
        {/* 기간 */}
        <select
          value={period}
          onChange={(e) => { setPeriod(Number(e.target.value)); setPage(1); }}
          className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white"
        >
          {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        {/* 업로더 */}
        <select
          value={uploader}
          onChange={(e) => setUploader(e.target.value)}
          className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white"
        >
          <option value="">업로더 전체</option>
          {uploaders.map((u) => <option key={u.userId} value={u.name}>{u.name}</option>)}
        </select>

        {/* 파일명 검색 */}
        <div className="flex-1 max-w-sm">
          <input
            type="text"
            placeholder="파일명 검색..."
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button onClick={onSearch} className="px-3 py-1.5 text-xs rounded bg-blue-500 text-white hover:bg-blue-600">
          검색
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          {error}
          <button onClick={loadAll} className="text-red-600 font-medium text-xs">재시도</button>
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-24">상태</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">파일명</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 w-20">크기</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-20">업로더</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-28">업로드일</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-24">경과</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">비고</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && !list ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="w-7 h-7 mx-auto border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <div className="mt-2 text-sm text-gray-400">불러오는 중...</div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-gray-400 text-sm">
                  동기화 이벤트가 없습니다.
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5"><Badge status={it.displayStatus} /></td>
                  <td className="px-4 py-2.5">
                    <div className="text-sm font-medium text-gray-900 truncate max-w-[300px]">{it.fileName}</div>
                    <div className="text-xs text-gray-400 truncate max-w-[300px]">{it.folderPath}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm text-gray-600">{fmtSize(it.fileSize)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700">{it.uploaderName}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{fmtDate(it.uploadedAt)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-500">{fmtAgo(it.uploadedAt)}</td>
                  <td className="px-4 py-2.5">
                    {it.remarks
                      ? <span className="text-xs text-red-600" title={it.remarks}>{it.remarks}</span>
                      : <span className="text-xs text-gray-300">-</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {list?.totalItems?.toLocaleString() ?? 0}건 중 {page} / {totalPages} 페이지
            </span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                이전
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-2 py-1 text-xs rounded border ${
                    p === page ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
