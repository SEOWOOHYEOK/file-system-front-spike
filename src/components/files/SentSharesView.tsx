/**
 * SentSharesView - 내가 공유한 파일 목록 뷰
 * 701.보낸 공유 관리 - 테이블 및 필터, 취소/철회
 */
import { useState, useEffect, useCallback } from 'react';
import { mySentShareApi } from '../../api/fileShareApi';
import type { MySentShareItem } from '../../types/file-share.types';
import { formatDate } from './FileItem';
import { SentShareDetail } from './SentShareDetail';

// ─── 상태 배지 설정 ───
const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: '승인대기', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: '승인됨', color: 'bg-green-100 text-green-800' },
  REJECTED: { label: '반려', color: 'bg-red-100 text-red-800' },
  CANCELED: { label: '취소', color: 'bg-gray-100 text-gray-600' },
  ACTIVE: { label: '활성', color: 'bg-blue-100 text-blue-800' },
  REVOKED: { label: '비활성', color: 'bg-gray-100 text-gray-600' },
  EXPIRED: { label: '만료', color: 'bg-gray-100 text-gray-600' },
};

function getStatusBadge(status: string) {
  const config = statusConfig[status] ?? {
    label: status || '-',
    color: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded ${config.color}`}>
      {config.label}
    </span>
  );
}

// ─── 상태 필터 탭 ───
const STATUS_TABS: { value: string; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'PENDING', label: '승인대기' },
  { value: 'APPROVED', label: '승인됨' },
  { value: 'REJECTED', label: '반려' },
  { value: 'CANCELED', label: '취소' },
  { value: 'ACTIVE', label: '공유중' },
  { value: 'REVOKED', label: '철회' },
];

const DEFAULT_PAGE_SIZE = 10;

export function SentSharesView() {
  const [items, setItems] = useState<MySentShareItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [detailShareId, setDetailShareId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await mySentShareApi.getList({
        status: statusFilter || undefined,
        page,
        pageSize,
      });
      setItems(resp.items);
      setTotalItems(resp.totalItems);
      setTotalPages(resp.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : '목록을 불러오지 못했습니다.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, pageSize]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // status filter 변경 시 페이지 1로
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const handleRowClick = (item: MySentShareItem) => {
    if (item.source === 'PUBLIC_SHARE') {
      setDetailShareId(item.id);
    }
  };

  const handleCancelOrRevoke = async (e: React.MouseEvent, item: MySentShareItem) => {
    e.stopPropagation();

    const isPending = item.status === 'PENDING';
    const isActive = item.status === 'ACTIVE';
    if (!isPending && !isActive) return;

    const actionLabel = isPending ? '취소' : '철회';
    if (!window.confirm(`이 공유를 ${actionLabel}하시겠습니까?`)) return;

    setActionLoading(item.id);
    try {
      await mySentShareApi.cancel(item.id);
      fetchList();
    } catch (err) {
      alert(err instanceof Error ? err.message : `${actionLabel}에 실패했습니다.`);
    } finally {
      setActionLoading(null);
    }
  };

  const canShowAction = (item: MySentShareItem) => {
    return item.status === 'PENDING' || item.status === 'ACTIVE';
  };

  const isClickable = (item: MySentShareItem) => item.source === 'PUBLIC_SHARE';

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">내가 공유한 파일</h2>
        <p className="text-sm text-gray-500 mt-0.5">공유 요청 및 직접 공유 목록</p>
      </div>

      {/* 상태 필터 탭 */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value || 'all'}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
              statusFilter === tab.value
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
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
          <div className="py-12 text-center text-gray-500">공유 항목이 없습니다.</div>
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
                  출처
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  생성일
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => handleRowClick(item)}
                  className={`hover:bg-gray-50 ${
                    isClickable(item) ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <td className="px-4 py-3">{getStatusBadge(item.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {item.fileIds?.length ?? 0}개 파일
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.source === 'SHARE_REQUEST' ? '공유 요청' : '직접 공유'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(item.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {canShowAction(item) ? (
                      <button
                        onClick={(e) => handleCancelOrRevoke(e, item)}
                        disabled={!!actionLoading}
                        className={`px-3 py-1 text-xs rounded ${
                          item.status === 'PENDING'
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-red-50 text-red-700 hover:bg-red-100'
                        } disabled:opacity-50`}
                      >
                        {actionLoading === item.id
                          ? '처리 중...'
                          : item.status === 'PENDING'
                            ? '취소'
                            : '철회'}
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

      {/* 상세 모달 */}
      <SentShareDetail
        isOpen={!!detailShareId}
        onClose={() => setDetailShareId(null)}
        shareId={detailShareId ?? ''}
        onRevoked={fetchList}
      />
    </div>
  );
}
