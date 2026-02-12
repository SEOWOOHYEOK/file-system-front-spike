/**
 * ReceivedRequestsView - 받은 요청 관리 뷰
 * 702.받은 요청 관리 - 좌측 목록 + 우측 상세 패널 (스플릿 뷰)
 */
import { useState, useEffect, useCallback } from 'react';
import { receivedRequestApi } from '../../api/fileShareApi';
import type { ShareRequestResponse, ShareRequestStatus } from '../../types/file-share.types';
import { ReceivedRequestDetail } from './ReceivedRequestDetail';

export interface ReceivedRequestsViewProps {
  /** Status filter from sidebar (PENDING, APPROVED, REJECTED) */
  statusFilter?: 'PENDING' | 'APPROVED' | 'REJECTED';
  /** Callback to update sidebar counts after approve/reject */
  onCountsChange?: () => void;
}

// YY.MM.DD 포맷
function formatDateYYMMDD(dateString: string): string {
  const d = new Date(dateString);
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

const STATUS_BADGES: Record<ShareRequestStatus, { label: string; color: string }> = {
  PENDING: { label: '대기중', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: '승인됨', color: 'bg-green-100 text-green-800' },
  REJECTED: { label: '반려', color: 'bg-red-100 text-red-800' },
  CANCELED: { label: '취소', color: 'bg-gray-100 text-gray-600' },
};

function getStatusBadge(status: ShareRequestStatus) {
  const config = STATUS_BADGES[status] ?? {
    label: status || '-',
    color: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded ${config.color}`}>
      {config.label}
    </span>
  );
}

function getPrimaryFileLabel(request: ShareRequestResponse): string {
  if (request.files && request.files.length > 0) {
    const first = request.files[0].name;
    const rest = request.files.length - 1;
    return rest > 0 ? `${first} 외 ${rest}건` : first;
  }
  return `${request.fileIds.length}개 파일`;
}

const DEFAULT_PAGE_SIZE = 20;

export function ReceivedRequestsView({
  statusFilter,
  onCountsChange,
}: ReceivedRequestsViewProps) {
  const [items, setItems] = useState<ShareRequestResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await receivedRequestApi.getList({
        status: statusFilter,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
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
  }, [statusFilter, page]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    setPage(1);
    setSelectedId(null);
  }, [statusFilter]);

  const selectedRequest = selectedId ? items.find((r) => r.id === selectedId) ?? null : null;

  const handleCardClick = (id: string) => {
    setSelectedId((prev) => (prev === id ? prev : id));
  };

  const handleApprovedOrRejected = useCallback(() => {
    fetchList();
    onCountsChange?.();
  }, [fetchList, onCountsChange]);

  return (
    <div className="flex h-full min-h-0">
      {/* Left panel - List (~35%) */}
      <div className="w-[35%] min-w-[280px] flex flex-col border-r border-gray-200 overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          {error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 mb-4">
              <p className="text-sm text-red-800">{error}</p>
              <button
                onClick={fetchList}
                className="mt-2 px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                다시 시도
              </button>
            </div>
          )}

          {loading && (
            <div className="py-12 text-center text-gray-500">로딩 중...</div>
          )}

          {!loading && items.length === 0 && (
            <div className="py-12 text-center text-gray-500">받은 요청이 없습니다.</div>
          )}

          {!loading && items.length > 0 && (
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleCardClick(item.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedId === item.id
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                        : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-gray-900 truncate">
                      {getPrimaryFileLabel(item)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {item.requesterDetail?.name ?? item.requesterId.slice(0, 8) + '...'}
                      {item.requesterDetail?.department && (
                        <span className="text-gray-500">
                          {' '}({item.requesterDetail.department})
                        </span>
                      )}
                      {' · 수신자 '}
                      {(item.targetDetails?.length ?? item.targets.length)}명
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500">
                        {formatDateYYMMDD(item.requestedAt)}
                      </span>
                      {getStatusBadge(item.status)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {totalPages > 1 && !loading && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {totalItems}건 · {page}/{totalPages}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                이전
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right panel - Detail (~65%) */}
      <div className="flex-1 min-w-0 flex flex-col bg-white">
        <div className="flex-1 overflow-auto p-6">
          {!selectedRequest ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              요청을 선택해주세요
            </div>
          ) : (
            <ReceivedRequestDetail
              request={selectedRequest}
              onApproved={handleApprovedOrRejected}
              onRejected={handleApprovedOrRejected}
            />
          )}
        </div>
      </div>
    </div>
  );
}
