/**
 * AdminShareRequestPage - 520.관리자-공유요청 관리
 * 공유 요청 승인/반려, 상태 조회, 일괄 처리
 */
import { useState, useEffect, useCallback } from 'react';
import { useInternalAuth } from '../hooks/useInternalAuth';
import { adminShareRequestApi } from '../api/shareRequestApi';
import type {
  ShareRequestStatus,
  ShareRequestSummary,
  ShareRequestResponse,
  ShareRequestAdminDetail,
  PaginatedResponse,
} from '../types/share-request.types';

// 상태별 UI 매핑
const STATUS_MAP: Record<ShareRequestStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: '대기 중', color: 'text-yellow-800', bg: 'bg-yellow-100' },
  APPROVED: { label: '승인', color: 'text-green-800', bg: 'bg-green-100' },
  REJECTED: { label: '반려', color: 'text-red-800', bg: 'bg-red-100' },
  CANCELED: { label: '취소', color: 'text-gray-800', bg: 'bg-gray-100' },
};

export function AdminShareRequestPage() {
  const { auth } = useInternalAuth();

  // 상태
  const [summary, setSummary] = useState<ShareRequestSummary | null>(null);
  const [currentStatus, setCurrentStatus] = useState<ShareRequestStatus>('PENDING');
  const [listData, setListData] = useState<PaginatedResponse<ShareRequestResponse> | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailData, setDetailData] = useState<ShareRequestAdminDetail | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // 승인/반려 모달
  const [actionModal, setActionModal] = useState<'approve' | 'reject' | 'bulkApprove' | 'bulkReject' | null>(null);
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [actionComment, setActionComment] = useState('');

  // 검색/필터
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // 로딩
  const [loading, setLoading] = useState({ summary: false, list: false, detail: false, action: false });

  // 요약 카운트 조회
  const fetchSummary = useCallback(async () => {
    if (!auth.token) return;
    setLoading(prev => ({ ...prev, summary: true }));
    try {
      const data = await adminShareRequestApi.getSummary(auth.token);
      setSummary(data);
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    } finally {
      setLoading(prev => ({ ...prev, summary: false }));
    }
  }, [auth.token]);

  // 목록 조회
  const fetchList = useCallback(async () => {
    if (!auth.token) return;
    setLoading(prev => ({ ...prev, list: true }));
    try {
      const data = await adminShareRequestApi.getList(auth.token, {
        status: currentStatus,
        q: searchQuery || undefined,
        page,
        pageSize: 20,
        sort: 'requestedAt,desc',
      });
      setListData(data);
    } catch (error) {
      console.error('Failed to fetch list:', error);
    } finally {
      setLoading(prev => ({ ...prev, list: false }));
    }
  }, [auth.token, currentStatus, searchQuery, page]);

  // 상세 조회
  const fetchDetail = useCallback(async (id: string) => {
    if (!auth.token) return;
    setLoading(prev => ({ ...prev, detail: true }));
    try {
      const data = await adminShareRequestApi.getDetail(auth.token, id);
      setDetailData(data);
      setShowDetail(true);
    } catch (error) {
      console.error('Failed to fetch detail:', error);
    } finally {
      setLoading(prev => ({ ...prev, detail: false }));
    }
  }, [auth.token]);

  // 단건 승인
  const handleApprove = useCallback(async () => {
    if (!auth.token || !actionTargetId) return;
    setLoading(prev => ({ ...prev, action: true }));
    try {
      await adminShareRequestApi.approve(auth.token, actionTargetId, {
        comment: actionComment || undefined,
      });
      setActionModal(null);
      setActionComment('');
      setActionTargetId(null);
      await fetchList();
      await fetchSummary();
    } catch (error) {
      alert(error instanceof Error ? error.message : '승인에 실패했습니다.');
    } finally {
      setLoading(prev => ({ ...prev, action: false }));
    }
  }, [auth.token, actionTargetId, actionComment, fetchList, fetchSummary]);

  // 단건 반려
  const handleReject = useCallback(async () => {
    if (!auth.token || !actionTargetId || !actionComment.trim()) return;
    setLoading(prev => ({ ...prev, action: true }));
    try {
      await adminShareRequestApi.reject(auth.token, actionTargetId, {
        comment: actionComment,
      });
      setActionModal(null);
      setActionComment('');
      setActionTargetId(null);
      await fetchList();
      await fetchSummary();
    } catch (error) {
      alert(error instanceof Error ? error.message : '반려에 실패했습니다.');
    } finally {
      setLoading(prev => ({ ...prev, action: false }));
    }
  }, [auth.token, actionTargetId, actionComment, fetchList, fetchSummary]);

  // 일괄 승인
  const handleBulkApprove = useCallback(async () => {
    if (!auth.token || selectedIds.length === 0) return;
    setLoading(prev => ({ ...prev, action: true }));
    try {
      const result = await adminShareRequestApi.bulkApprove(auth.token, {
        ids: selectedIds,
        comment: actionComment || undefined,
      });
      const failed = result.items.filter(item => !item.success);
      if (failed.length > 0) {
        alert(`${result.processedCount - failed.length}건 승인 완료, ${failed.length}건 실패`);
      }
      setActionModal(null);
      setActionComment('');
      setSelectedIds([]);
      await fetchList();
      await fetchSummary();
    } catch (error) {
      alert(error instanceof Error ? error.message : '일괄 승인에 실패했습니다.');
    } finally {
      setLoading(prev => ({ ...prev, action: false }));
    }
  }, [auth.token, selectedIds, actionComment, fetchList, fetchSummary]);

  // 일괄 반려
  const handleBulkReject = useCallback(async () => {
    if (!auth.token || selectedIds.length === 0 || !actionComment.trim()) return;
    setLoading(prev => ({ ...prev, action: true }));
    try {
      const result = await adminShareRequestApi.bulkReject(auth.token, {
        ids: selectedIds,
        comment: actionComment,
      });
      const failed = result.items.filter(item => !item.success);
      if (failed.length > 0) {
        alert(`${result.processedCount - failed.length}건 반려 완료, ${failed.length}건 실패`);
      }
      setActionModal(null);
      setActionComment('');
      setSelectedIds([]);
      await fetchList();
      await fetchSummary();
    } catch (error) {
      alert(error instanceof Error ? error.message : '일괄 반려에 실패했습니다.');
    } finally {
      setLoading(prev => ({ ...prev, action: false }));
    }
  }, [auth.token, selectedIds, actionComment, fetchList, fetchSummary]);

  // 체크박스 토글
  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (!listData) return;
    if (selectedIds.length === listData.items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(listData.items.map(item => item.id));
    }
  };

  // 상태 탭 변경
  const handleStatusChange = (status: ShareRequestStatus) => {
    setCurrentStatus(status);
    setPage(1);
    setSelectedIds([]);
    setShowDetail(false);
  };

  // 초기 로드
  useEffect(() => {
    if (auth.isAuthenticated) {
      fetchSummary();
    }
  }, [auth.isAuthenticated, fetchSummary]);

  useEffect(() => {
    if (auth.isAuthenticated) {
      fetchList();
    }
  }, [auth.isAuthenticated, fetchList]);

  if (!auth.isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">상단 헤더에서 SSO 로그인이 필요합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">공유 요청 관리</h1>
        <p className="text-sm text-gray-500 mt-1">공유 요청을 조회하고 승인/반려할 수 있습니다.</p>
      </div>

      {/* 요약 카드 */}
      <div className="bg-white border-b px-6 py-4">
        <div className="grid grid-cols-4 gap-4">
          {(Object.entries(STATUS_MAP) as [ShareRequestStatus, typeof STATUS_MAP[ShareRequestStatus]][]).map(
            ([status, config]) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  currentStatus === status
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="text-sm text-gray-500">{config.label}</div>
                <div className="text-2xl font-bold mt-1">
                  {loading.summary ? '...' : summary?.[status] ?? '-'}
                </div>
              </button>
            )
          )}
        </div>
      </div>

      {/* 검색 + 일괄 액션 */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* 검색 */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchList()}
              placeholder="파일명, 요청자명, 대상자명 검색"
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            onClick={fetchList}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            검색
          </button>
        </div>

        {/* 일괄 액션 (PENDING 상태에서만) */}
        {currentStatus === 'PENDING' && selectedIds.length > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">{selectedIds.length}건 선택</span>
            <button
              onClick={() => {
                setActionComment('');
                setActionModal('bulkApprove');
              }}
              className="px-3 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              일괄 승인
            </button>
            <button
              onClick={() => {
                setActionComment('');
                setActionModal('bulkReject');
              }}
              className="px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              일괄 반려
            </button>
          </div>
        )}
      </div>

      {/* 목록 + 상세 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 목록 */}
        <div className={`flex-1 overflow-auto ${showDetail ? 'border-r' : ''}`}>
          {loading.list ? (
            <div className="flex items-center justify-center h-full text-gray-500">로딩 중...</div>
          ) : listData && listData.items.length > 0 ? (
            <>
              <table className="min-w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {currentStatus === 'PENDING' && (
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === listData.items.length}
                          onChange={toggleSelectAll}
                          className="rounded"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">파일</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">대상</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">권한</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">공유 기간</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">요청일</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {listData.items.map(item => {
                    const statusInfo = STATUS_MAP[item.status];
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => fetchDetail(item.id)}
                      >
                        {currentStatus === 'PENDING' && (
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(item.id)}
                              onChange={() => toggleSelect(item.id)}
                              className="rounded"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${statusInfo.bg} ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {item.fileIds.length}개 파일
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {item.targets.map(t => (
                            <span key={t.userId} className={`inline-flex items-center px-2 py-0.5 text-xs rounded mr-1 ${
                              t.type === 'INTERNAL_USER' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                            }`}>
                              {t.type === 'INTERNAL_USER' ? '내부' : '외부'}
                            </span>
                          ))}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            item.permission.type === 'VIEW' ? 'bg-gray-100 text-gray-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {item.permission.type === 'VIEW' ? '열람' : '다운로드'}
                            {item.permission.maxDownloads ? ` (${item.permission.maxDownloads}회)` : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(item.startAt).toLocaleDateString()} ~ {new Date(item.endAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(item.requestedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          {item.status === 'PENDING' && (
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => {
                                  setActionTargetId(item.id);
                                  setActionComment('');
                                  setActionModal('approve');
                                }}
                                className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                              >
                                승인
                              </button>
                              <button
                                onClick={() => {
                                  setActionTargetId(item.id);
                                  setActionComment('');
                                  setActionModal('reject');
                                }}
                                className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                              >
                                반려
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* 페이지네이션 */}
              <div className="flex items-center justify-between px-6 py-3 border-t bg-white">
                <div className="text-sm text-gray-500">
                  총 {listData.totalItems}건 중 {(page - 1) * 20 + 1}-{Math.min(page * 20, listData.totalItems)}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={!listData.hasPrev}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
                  >
                    이전
                  </button>
                  <span className="text-sm text-gray-700">
                    {page} / {listData.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={!listData.hasNext}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
                  >
                    다음
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              {STATUS_MAP[currentStatus].label} 상태의 공유 요청이 없습니다.
            </div>
          )}
        </div>

        {/* 상세 패널 */}
        {showDetail && detailData && (
          <div className="w-[420px] bg-white overflow-auto">
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">요청 상세</h3>
              <button
                onClick={() => { setShowDetail(false); setDetailData(null); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* 상태 */}
              <div>
                <label className="text-xs text-gray-500 uppercase">상태</label>
                <div className="mt-1">
                  <span className={`inline-flex px-2 py-1 text-xs rounded-full ${STATUS_MAP[detailData.status].bg} ${STATUS_MAP[detailData.status].color}`}>
                    {STATUS_MAP[detailData.status].label}
                  </span>
                  {detailData.isAutoApproved && (
                    <span className="ml-2 px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">자동 승인</span>
                  )}
                </div>
              </div>

              {/* 요청자 */}
              {detailData.requester && (
                <div>
                  <label className="text-xs text-gray-500 uppercase">요청자</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="font-medium">{detailData.requester.name}</div>
                    <div className="text-gray-500">{detailData.requester.email}</div>
                    <div className="text-gray-500">{detailData.requester.department} {detailData.requester.position}</div>
                  </div>
                </div>
              )}

              {/* 대상자 */}
              <div>
                <label className="text-xs text-gray-500 uppercase">공유 대상 ({detailData.targets.length}명)</label>
                <div className="mt-1 space-y-2">
                  {detailData.targets.map((target, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          target.type === 'INTERNAL_USER' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {target.type === 'INTERNAL_USER' ? '내부' : '외부'}
                        </span>
                        {target.userDetail ? (
                          <span className="font-medium">{target.userDetail.name}</span>
                        ) : (
                          <span className="text-gray-400">{target.userId.slice(0, 8)}...</span>
                        )}
                      </div>
                      {target.userDetail && (
                        <div className="mt-1 text-gray-500">{target.userDetail.email}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 파일 */}
              <div>
                <label className="text-xs text-gray-500 uppercase">파일 ({detailData.fileIds.length}개)</label>
                <div className="mt-1 space-y-1">
                  {detailData.fileIds.map(fileId => (
                    <div key={fileId} className="p-2 bg-gray-50 rounded text-sm text-gray-600 truncate">
                      {fileId}
                    </div>
                  ))}
                </div>
              </div>

              {/* 권한 */}
              <div>
                <label className="text-xs text-gray-500 uppercase">권한</label>
                <div className="mt-1 text-sm">
                  <span className={`px-2 py-1 rounded ${
                    detailData.permission.type === 'VIEW' ? 'bg-gray-100 text-gray-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {detailData.permission.type === 'VIEW' ? '열람' : '다운로드'}
                    {detailData.permission.maxDownloads ? ` (최대 ${detailData.permission.maxDownloads}회)` : ''}
                  </span>
                </div>
              </div>

              {/* 공유 기간 */}
              <div>
                <label className="text-xs text-gray-500 uppercase">공유 기간</label>
                <div className="mt-1 text-sm text-gray-700">
                  {new Date(detailData.startAt).toLocaleString()} ~ {new Date(detailData.endAt).toLocaleString()}
                </div>
              </div>

              {/* 사유 */}
              <div>
                <label className="text-xs text-gray-500 uppercase">요청 사유</label>
                <div className="mt-1 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                  {detailData.reason}
                </div>
              </div>

              {/* 결정 정보 */}
              {detailData.decidedAt && (
                <div>
                  <label className="text-xs text-gray-500 uppercase">결정 정보</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg text-sm">
                    {detailData.approver && (
                      <div>승인자: {detailData.approver.name} ({detailData.approver.department})</div>
                    )}
                    <div className="text-gray-500">결정일: {new Date(detailData.decidedAt).toLocaleString()}</div>
                    {detailData.decisionComment && (
                      <div className="mt-2 p-2 bg-white rounded border text-gray-700">
                        {detailData.decisionComment}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 요청일 */}
              <div>
                <label className="text-xs text-gray-500 uppercase">요청일시</label>
                <div className="mt-1 text-sm text-gray-700">
                  {new Date(detailData.requestedAt).toLocaleString()}
                </div>
              </div>

              {/* 승인/반려 버튼 */}
              {detailData.status === 'PENDING' && (
                <div className="flex items-center space-x-2 pt-4 border-t">
                  <button
                    onClick={() => {
                      setActionTargetId(detailData.id);
                      setActionComment('');
                      setActionModal('approve');
                    }}
                    className="flex-1 px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    승인
                  </button>
                  <button
                    onClick={() => {
                      setActionTargetId(detailData.id);
                      setActionComment('');
                      setActionModal('reject');
                    }}
                    className="flex-1 px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    반려
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 승인/반려 모달 */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">
                {actionModal === 'approve' && '공유 요청 승인'}
                {actionModal === 'reject' && '공유 요청 반려'}
                {actionModal === 'bulkApprove' && `일괄 승인 (${selectedIds.length}건)`}
                {actionModal === 'bulkReject' && `일괄 반려 (${selectedIds.length}건)`}
              </h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                코멘트 {(actionModal === 'reject' || actionModal === 'bulkReject') && (
                  <span className="text-red-500">*</span>
                )}
              </label>
              <textarea
                value={actionComment}
                onChange={e => setActionComment(e.target.value)}
                placeholder={
                  actionModal === 'reject' || actionModal === 'bulkReject'
                    ? '반려 사유를 입력해주세요 (필수)'
                    : '코멘트를 입력해주세요 (선택)'
                }
                className="w-full border border-gray-300 rounded-lg p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="px-6 py-4 border-t flex items-center justify-end space-x-2">
              <button
                onClick={() => { setActionModal(null); setActionComment(''); }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (actionModal === 'approve') handleApprove();
                  else if (actionModal === 'reject') handleReject();
                  else if (actionModal === 'bulkApprove') handleBulkApprove();
                  else if (actionModal === 'bulkReject') handleBulkReject();
                }}
                disabled={
                  loading.action ||
                  ((actionModal === 'reject' || actionModal === 'bulkReject') && !actionComment.trim())
                }
                className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 ${
                  actionModal === 'approve' || actionModal === 'bulkApprove'
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {loading.action ? '처리 중...' : (
                  actionModal === 'approve' || actionModal === 'bulkApprove' ? '승인' : '반려'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
