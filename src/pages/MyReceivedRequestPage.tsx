/**
 * MyReceivedRequestPage - 내가 받은 공유 요청 관리 (702)
 * 승인자(designatedApproverId)로 지정된 사용자가
 * 자신에게 할당된 공유 요청을 조회/승인/반려하는 페이지
 */
import { useState, useCallback, useEffect } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import {
  myReceivedRequestApi,
  type ShareRequestResponse,
  type ShareRequestStatus,
  type ReceivedRequestQuery,
} from '../api/myReceivedRequestApi';

// ─── 상수 ───

const STATUS_OPTIONS: { value: ShareRequestStatus | ''; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'PENDING', label: '승인 대기' },
  { value: 'APPROVED', label: '승인 완료' },
  { value: 'REJECTED', label: '반려' },
  { value: 'CANCELED', label: '요청 취소' },
];

const STATUS_BADGE: Record<ShareRequestStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '승인 대기' },
  APPROVED: { bg: 'bg-green-100', text: 'text-green-800', label: '승인 완료' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-800', label: '반려' },
  CANCELED: { bg: 'bg-gray-100', text: 'text-gray-800', label: '요청 취소' },
};

const PERMISSION_LABEL: Record<string, string> = {
  VIEW: '열람',
  DOWNLOAD: '다운로드',
};

// ─── 유틸 ───

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return '-';
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ─── 상세 모달 ───

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ShareRequestResponse | null;
  loading: boolean;
  onApprove: (id: string, comment?: string) => Promise<void>;
  onReject: (id: string, comment: string) => Promise<void>;
}

function DetailModal({ isOpen, onClose, request, loading, onApprove, onReject }: DetailModalProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setComment('');
      setActionError(null);
    }
  }, [isOpen]);

  if (!isOpen || !request) return null;

  const isPending = request.status === 'PENDING';
  const badge = STATUS_BADGE[request.status];

  const handleApprove = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await onApprove(request.id, comment || undefined);
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '승인 처리에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!comment.trim()) {
      setActionError('반려 코멘트는 필수입니다.');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await onReject(request.id, comment);
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '반려 처리에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 sticky top-0">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">공유 요청 상세</h3>
            <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* 요청자 정보 */}
              <section>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">요청자 정보</h4>
                <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500">이름</div>
                    <div className="text-sm font-medium">{request.requesterDetail?.name ?? request.requesterId}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">이메일</div>
                    <div className="text-sm">{request.requesterDetail?.email ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">부서</div>
                    <div className="text-sm">{request.requesterDetail?.department ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">직급</div>
                    <div className="text-sm">{request.requesterDetail?.position ?? '-'}</div>
                  </div>
                </div>
              </section>

              {/* 파일 목록 */}
              <section>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  공유 파일 ({request.files?.length ?? request.fileIds.length}건)
                </h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {request.files && request.files.length > 0 ? (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">파일명</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">유형</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">크기</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {request.files.map((f) => (
                          <tr key={f.id}>
                            <td className="px-4 py-2 text-sm text-gray-900">{f.name}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{f.mimeType}</td>
                            <td className="px-4 py-2 text-sm text-gray-500 text-right">{formatFileSize(f.sizeBytes)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-4 text-sm text-gray-500">
                      파일 ID: {request.fileIds.join(', ')}
                    </div>
                  )}
                </div>
              </section>

              {/* 공유 대상 */}
              <section>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">공유 대상</h4>
                <div className="space-y-2">
                  {request.targetDetails && request.targetDetails.length > 0 ? (
                    request.targetDetails.map((t, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3 flex items-center gap-4">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          t.type === 'INTERNAL_USER' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {t.type === 'INTERNAL_USER' ? '내부' : '외부'}
                        </span>
                        <div>
                          <span className="text-sm font-medium">{t.userDetail?.name ?? t.userId}</span>
                          {t.userDetail && (
                            <span className="text-xs text-gray-500 ml-2">
                              {t.userDetail.department} · {t.userDetail.email}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    request.targets.map((t, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                        {t.type === 'INTERNAL_USER' ? '내부' : '외부'} 사용자: {t.userId}
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* 권한 & 기간 */}
              <section>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">권한 및 기간</h4>
                <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500">권한</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        request.permission.type === 'VIEW' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {PERMISSION_LABEL[request.permission.type] || request.permission.type}
                      </span>
                      {request.permission.maxDownloads != null && (
                        <span className="text-xs text-gray-500">
                          (최대 {request.permission.maxDownloads}회)
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">요청일시</div>
                    <div className="text-sm mt-1">{formatDate(request.requestedAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">공유 시작일</div>
                    <div className="text-sm mt-1">{formatDateShort(request.startAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">공유 종료일</div>
                    <div className="text-sm mt-1">{formatDateShort(request.endAt)}</div>
                  </div>
                </div>
              </section>

              {/* 요청 사유 */}
              <section>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">요청 사유</h4>
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700">
                  {request.reason || '-'}
                </div>
              </section>

              {/* 처리 결과 (승인/반려 완료 시) */}
              {request.decidedAt && (
                <section>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">처리 결과</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-gray-500">처리자</div>
                        <div className="text-sm">{request.approverDetail?.name ?? request.approverId ?? '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">처리일시</div>
                        <div className="text-sm">{formatDate(request.decidedAt)}</div>
                      </div>
                    </div>
                    {request.decisionComment && (
                      <div>
                        <div className="text-xs text-gray-500">코멘트</div>
                        <div className="text-sm mt-1">{request.decisionComment}</div>
                      </div>
                    )}
                    {request.isAutoApproved && (
                      <div className="text-xs text-blue-600 font-medium">자동 승인됨</div>
                    )}
                    {request.publicShareIds.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500">생성된 공유 ID</div>
                        <div className="text-xs text-gray-600 mt-1 break-all">
                          {request.publicShareIds.join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* 승인/반려 코멘트 입력 (PENDING 상태일 때만) */}
              {isPending && (
                <section>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">코멘트</h4>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="코멘트를 입력하세요 (반려 시 필수)"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </section>
              )}

              {/* 에러 */}
              {actionError && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{actionError}</div>
              )}

              {/* 액션 버튼 (PENDING 상태일 때만) */}
              {isPending && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {actionLoading ? '처리 중...' : '승인'}
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {actionLoading ? '처리 중...' : '반려'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ───

export function MyReceivedRequestPage() {
  const { auth } = useAuthContext();
  const token = auth.accessToken ?? '';

  // 목록 상태
  const [requests, setRequests] = useState<ShareRequestResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 필터
  const [statusFilter, setStatusFilter] = useState<ShareRequestStatus | ''>('PENDING');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 페이지네이션
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 20;

  // 상세 모달
  const [selectedRequest, setSelectedRequest] = useState<ShareRequestResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 성공 메시지
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ─── 목록 조회 ───
  const fetchList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const query: ReceivedRequestQuery = {
        page,
        pageSize,
        sortBy: 'requestedAt',
        sortOrder,
      };
      if (statusFilter) {
        query.status = statusFilter;
      }
      const res = await myReceivedRequestApi.getList(token, query);
      setRequests(res.items);
      setTotalPages(res.totalPages);
      setTotalItems(res.totalItems);
    } catch (err) {
      console.error('Failed to fetch received requests:', err);
      setError(err instanceof Error ? err.message : '받은 공유 요청 목록을 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, page, pageSize, sortOrder, statusFilter]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // 필터 변경 시 페이지 1로 리셋
  useEffect(() => {
    setPage(1);
  }, [statusFilter, sortOrder]);

  // ─── 상세 조회 ───
  const handleSelectRequest = async (req: ShareRequestResponse) => {
    setSelectedRequest(req);
    setDetailLoading(true);
    try {
      const detail = await myReceivedRequestApi.getDetail(token, req.id);
      setSelectedRequest(detail);
    } catch (err) {
      console.error('Failed to fetch detail:', err);
      // 기본 정보라도 표시
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── 승인 ───
  const handleApprove = async (id: string, comment?: string) => {
    await myReceivedRequestApi.approve(token, id, comment ? { comment } : undefined);
    setSuccessMessage('공유 요청이 승인되었습니다.');
    setTimeout(() => setSuccessMessage(null), 3000);
    fetchList();
  };

  // ─── 반려 ───
  const handleReject = async (id: string, comment: string) => {
    await myReceivedRequestApi.reject(token, id, { comment });
    setSuccessMessage('공유 요청이 반려되었습니다.');
    setTimeout(() => setSuccessMessage(null), 3000);
    fetchList();
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">내가 받은 공유 요청</h1>
            <p className="text-sm text-gray-500 mt-1">
              나에게 지정된 공유 요청을 확인하고 승인/반려할 수 있습니다.
              {totalItems > 0 && (
                <span className="ml-2 text-blue-600 font-medium">총 {totalItems}건</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* 정렬 */}
            <button
              onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              {sortOrder === 'desc' ? '최신순' : '오래된순'}
            </button>
            {/* 새로고침 */}
            <button
              onClick={fetchList}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              새로고침
            </button>
          </div>
        </div>

        {/* 상태 필터 탭 */}
        <div className="flex gap-1 mt-4">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value as ShareRequestStatus | '')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 성공 메시지 */}
      {successMessage && (
        <div className="mx-6 mt-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-green-800">{successMessage}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* 에러 */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* 로딩 */}
        {loading && requests.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 mt-4">요청 목록을 불러오는 중...</p>
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && !error && requests.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">받은 공유 요청이 없습니다</h3>
            <p className="text-gray-500">
              {statusFilter
                ? `${STATUS_BADGE[statusFilter as ShareRequestStatus]?.label ?? statusFilter} 상태의 요청이 없습니다.`
                : '현재 나에게 할당된 공유 요청이 없습니다.'}
            </p>
          </div>
        )}

        {/* 요청 테이블 */}
        {requests.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">요청자</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">파일</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">대상</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">권한</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">공유 기간</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">요청일시</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">액션</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((req) => {
                  const badge = STATUS_BADGE[req.status];
                  const firstTarget = req.targetDetails?.[0]?.userDetail ?? null;
                  const targetCount = req.targets.length;
                  const fileCount = req.files?.length ?? req.fileIds.length;
                  const firstFile = req.files?.[0];

                  return (
                    <tr
                      key={req.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleSelectRequest(req)}
                    >
                      {/* 상태 */}
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </td>
                      {/* 요청자 */}
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {req.requesterDetail?.name ?? '-'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {req.requesterDetail?.department ?? ''}
                        </div>
                      </td>
                      {/* 파일 */}
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900 truncate max-w-[180px]">
                          {firstFile?.name ?? `파일 ${fileCount}건`}
                        </div>
                        {fileCount > 1 && (
                          <div className="text-xs text-gray-500">외 {fileCount - 1}건</div>
                        )}
                      </td>
                      {/* 대상 */}
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900">
                          {firstTarget?.name ?? (req.targets[0]?.userId?.slice(0, 8) + '...' ?? '-')}
                        </div>
                        {targetCount > 1 && (
                          <div className="text-xs text-gray-500">외 {targetCount - 1}명</div>
                        )}
                      </td>
                      {/* 권한 */}
                      <td className="px-4 py-4">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          req.permission.type === 'VIEW' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {PERMISSION_LABEL[req.permission.type] || req.permission.type}
                        </span>
                      </td>
                      {/* 공유 기간 */}
                      <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {formatDateShort(req.startAt)} ~ {formatDateShort(req.endAt)}
                      </td>
                      {/* 요청일시 */}
                      <td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {formatDate(req.requestedAt)}
                      </td>
                      {/* 액션 */}
                      <td className="px-4 py-4 text-right">
                        {req.status === 'PENDING' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectRequest(req);
                              }}
                              className="inline-flex items-center px-3 py-1.5 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg font-medium transition-colors"
                            >
                              처리하기
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectRequest(req);
                            }}
                            className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                          >
                            상세보기
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
                <div className="text-sm text-gray-500">
                  {totalItems}건 중 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalItems)}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    이전
                  </button>
                  <span className="text-sm text-gray-600 px-2">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      <DetailModal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        request={selectedRequest}
        loading={detailLoading}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}
