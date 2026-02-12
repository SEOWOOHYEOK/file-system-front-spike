/**
 * SentShareRequestsView - 내가 보낸 결제 요청 관리 뷰
 * 701-A. 보낸 결제 요청 - 테이블 + 상태 필터 + 취소
 *
 * API: /v1/file-shares-requests/my-sent-requests
 * 상태: PENDING(대기) | APPROVED(승인) | REJECTED(거부) | CANCELED(취소)
 */
import { useState, useEffect, useCallback } from 'react';
import { mySentShareRequestApi } from '../../api/fileShareApi';
import type {
  MySentShareRequestItem,
  ShareRequestStatus,
} from '../../types/file-share.types';
import { formatDate } from './FileItem';

// ─── Props ───

export interface SentShareRequestsViewProps {
  /** 사이드바에서 전달하는 상태 필터 */
  statusFilter?: ShareRequestStatus;
  /** 카운트 변경 시 콜백 (취소 후 사이드바 카운트 갱신) */
  onCountsChange?: () => void;
}

// ─── 상태 배지 설정 ───

const STATUS_CONFIG: Record<ShareRequestStatus, { label: string; color: string }> = {
  PENDING: { label: '승인 대기', color: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: '승인 완료', color: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { label: '거부됨', color: 'bg-red-100 text-red-800' },
  CANCELED: { label: '취소됨', color: 'bg-gray-100 text-gray-600' },
};

function getStatusBadge(status: ShareRequestStatus) {
  const config = STATUS_CONFIG[status] ?? {
    label: status || '-',
    color: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded ${config.color}`}>
      {config.label}
    </span>
  );
}

// ─── 상수 ───

const DEFAULT_PAGE_SIZE = 10;

const STATUS_LABELS: Record<ShareRequestStatus, string> = {
  PENDING: '승인 대기',
  APPROVED: '승인 완료',
  REJECTED: '거부됨',
  CANCELED: '취소됨',
};

// ─── 메인 컴포넌트 ───

export function SentShareRequestsView({
  statusFilter,
  onCountsChange,
}: SentShareRequestsViewProps) {
  const [items, setItems] = useState<MySentShareRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── 목록 조회 ──

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await mySentShareRequestApi.getList({
        status: statusFilter || undefined,
        page,
        pageSize,
      });
      setItems(resp.items);
      setTotalItems(resp.totalItems);
      setTotalPages(resp.totalPages);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '목록을 불러오지 못했습니다.',
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, pageSize]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // statusFilter 변경 시 페이지 1로 리셋
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // ── 결제 요청 취소 ──

  const handleCancel = async (e: React.MouseEvent, item: MySentShareRequestItem) => {
    e.stopPropagation();

    if (item.status !== 'PENDING') return;
    if (
      !window.confirm(
        '이 결제 요청을 취소하시겠습니까?\n취소 후에는 되돌릴 수 없습니다.',
      )
    )
      return;

    setActionLoading(item.id);
    try {
      await mySentShareRequestApi.cancel(item.id);
      fetchList();
      onCountsChange?.();
    } catch (err) {
      // 에러 처리 (701-A 가이드 기반)
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { status?: number } };
        switch (axiosErr.response?.status) {
          case 400:
            alert('이미 처리된 요청입니다. 목록을 새로고침합니다.');
            fetchList();
            break;
          case 403:
            alert('본인이 요청한 결제만 취소할 수 있습니다.');
            break;
          case 404:
            alert('요청을 찾을 수 없습니다.');
            fetchList();
            break;
          default:
            alert(
              err instanceof Error ? err.message : '취소에 실패했습니다.',
            );
        }
      } else {
        alert(err instanceof Error ? err.message : '취소에 실패했습니다.');
      }
    } finally {
      setActionLoading(null);
    }
  };

  // ── 뷰 제목 ──

  const viewTitle = statusFilter
    ? `보낸 결제 요청 · ${STATUS_LABELS[statusFilter]}`
    : '보낸 결제 요청';

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{viewTitle}</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          내가 보낸 공유 결제 요청 목록을 확인하고 관리합니다.
        </p>
      </div>

      {/* 에러 */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-800">{error}</p>
          <button
            onClick={fetchList}
            className="mt-2 px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-500">로딩 중...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <div className="text-4xl mb-3">📋</div>
            <p>결제 요청이 없습니다.</p>
          </div>
        ) : (
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  파일
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  요청일
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  요청 ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {getStatusBadge(item.status)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {item.fileIds?.length ?? 0}개 파일
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(item.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400 font-mono">
                    {item.id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3">
                    {item.status === 'PENDING' ? (
                      <button
                        onClick={(e) => handleCancel(e, item)}
                        disabled={!!actionLoading}
                        className="px-3 py-1 text-xs rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        {actionLoading === item.id ? '처리 중...' : '취소'}
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            총 {totalItems}건 · {page} / {totalPages} 페이지
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              이전
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
