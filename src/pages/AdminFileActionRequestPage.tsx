/**
 * AdminFileActionRequestPage - 작업 요청 관리 (승인/반려)
 * 관리자가 파일/폴더 이동·삭제 요청을 확인하고 승인/반려하는 페이지
 */
import { useState, useEffect, useCallback } from 'react';
import { useInternalAuth } from '../hooks/useInternalAuth';
import { fileActionRequestAdminApi } from '../api/fileActionRequestApi';
import { folderActionRequestAdminApi } from '../api/folderActionRequestApi';
import type {
  ActionRequestItem,
  FileActionRequestStatus,
  FileActionType,
  FolderAdminRequestsQuery,
  StatusSummary,
  AdminRequestsQuery,
} from '../types/file-action-request.types';
import { STATUS_DISPLAY, TYPE_DISPLAY } from '../types/file-action-request.types';

// 탭 타입
type ViewTab = 'my-pending' | 'all';
type TargetTab = 'file' | 'folder';

export function AdminFileActionRequestPage() {
  const { auth } = useInternalAuth();

  // ============================================
  // 탭 상태
  // ============================================
  const [targetTab, setTargetTab] = useState<TargetTab>('file');
  const [activeTab, setActiveTab] = useState<ViewTab>('my-pending');

  // ============================================
  // 목록 상태
  // ============================================
  const [requests, setRequests] = useState<ActionRequestItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);

  // ============================================
  // 필터 상태
  // ============================================
  const [filterStatus, setFilterStatus] = useState<FileActionRequestStatus | ''>('');
  const [filterType, setFilterType] = useState<FileActionType | ''>('');

  // ============================================
  // 요약 상태
  // ============================================
  const [summary, setSummary] = useState<StatusSummary | null>(null);

  // ============================================
  // 선택 상태 (일괄 처리)
  // ============================================
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // ============================================
  // 상세 모달 상태
  // ============================================
  const [detailRequest, setDetailRequest] = useState<ActionRequestItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // ============================================
  // 승인/반려 모달 상태
  // ============================================
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approveComment, setApproveComment] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ============================================
  // 일괄 처리 모달 상태
  // ============================================
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
  const [bulkComment, setBulkComment] = useState('');

  // ============================================
  // 데이터 로드
  // ============================================
  const fetchSummary = useCallback(async () => {
    if (!auth.token) return;
    try {
      const data =
        targetTab === 'folder'
          ? await folderActionRequestAdminApi.getSummary(auth.token)
          : await fileActionRequestAdminApi.getSummary(auth.token);
      setSummary(data);
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    }
  }, [auth.token, targetTab]);

  const fetchRequests = useCallback(async () => {
    if (!auth.token) return;
    setLoading(true);
    try {
      let data;
      if (targetTab === 'folder') {
        if (activeTab === 'my-pending') {
          data = await folderActionRequestAdminApi.getMyPendingApprovals(auth.token, page, pageSize);
        } else {
          const query: FolderAdminRequestsQuery = { page, pageSize };
          if (filterStatus) query.status = filterStatus;
          data = await folderActionRequestAdminApi.getAllRequests(auth.token, query);
        }
      } else {
        if (activeTab === 'my-pending') {
          data = await fileActionRequestAdminApi.getMyPendingApprovals(auth.token, page, pageSize);
        } else {
          const query: AdminRequestsQuery = { page, pageSize };
          if (filterStatus) query.status = filterStatus;
          if (filterType) query.type = filterType;
          data = await fileActionRequestAdminApi.getAllRequests(auth.token, query);
        }
      }
      setRequests(data.items);
      setTotalItems(data.totalItems);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  }, [auth.token, targetTab, activeTab, page, pageSize, filterStatus, filterType]);

  // 초기 로드
  useEffect(() => {
    if (auth.isAuthenticated) {
      fetchSummary();
    }
  }, [auth.isAuthenticated, fetchSummary]);

  useEffect(() => {
    if (auth.isAuthenticated) {
      setPage(1);
      setSelectedIds([]);
    }
  }, [auth.isAuthenticated, activeTab, filterStatus, filterType]);

  useEffect(() => {
    if (auth.isAuthenticated) {
      fetchRequests();
    }
  }, [auth.isAuthenticated, fetchRequests]);

  // ============================================
  // 상세 조회
  // ============================================
  const handleViewDetail = useCallback(async (id: string) => {
    if (!auth.token) return;
    try {
      const detail =
        targetTab === 'folder'
          ? await folderActionRequestAdminApi.getRequestDetail(auth.token, id)
          : await fileActionRequestAdminApi.getRequestDetail(auth.token, id);
      if (detail) {
        setDetailRequest(detail);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch detail:', error);
    }
  }, [auth.token, targetTab]);

  // ============================================
  // 단건 승인
  // ============================================
  const handleApprove = useCallback(async () => {
    if (!auth.token || !actionTargetId) return;
    setActionLoading(true);
    try {
      const result =
        targetTab === 'folder'
          ? await folderActionRequestAdminApi.approveRequest(auth.token, actionTargetId, {
              comment: approveComment || undefined,
            })
          : await fileActionRequestAdminApi.approveRequest(auth.token, actionTargetId, {
              comment: approveComment || undefined,
            });

      if (result.status === 'EXECUTED') {
        alert(
          targetTab === 'folder'
            ? '승인 완료 - 폴더 작업이 성공적으로 실행되었습니다.'
            : '승인 완료 - 파일 작업이 성공적으로 실행되었습니다.',
        );
      } else if (result.status === 'INVALIDATED') {
        alert(
          `무효화됨 - ${result.executionNote || (targetTab === 'folder' ? '폴더' : '파일')} 상태가 변경되어 실행할 수 없습니다.`,
        );
      } else if (result.status === 'FAILED') {
        alert(`실행 실패 - ${result.executionNote || '기술적 오류가 발생했습니다.'}`);
      }

      setShowApproveModal(false);
      setApproveComment('');
      setActionTargetId(null);
      fetchRequests();
      fetchSummary();
    } catch (error) {
      console.error('Failed to approve:', error);
      alert('승인에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  }, [auth.token, targetTab, actionTargetId, approveComment, fetchRequests, fetchSummary]);

  // ============================================
  // 단건 반려
  // ============================================
  const handleReject = useCallback(async () => {
    if (!auth.token || !actionTargetId || !rejectComment.trim()) return;
    setActionLoading(true);
    try {
      if (targetTab === 'folder') {
        await folderActionRequestAdminApi.rejectRequest(auth.token, actionTargetId, {
          comment: rejectComment.trim(),
        });
      } else {
        await fileActionRequestAdminApi.rejectRequest(auth.token, actionTargetId, {
          comment: rejectComment.trim(),
        });
      }
      alert('반려 처리가 완료되었습니다.');
      setShowRejectModal(false);
      setRejectComment('');
      setActionTargetId(null);
      fetchRequests();
      fetchSummary();
    } catch (error) {
      console.error('Failed to reject:', error);
      alert('반려에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  }, [auth.token, targetTab, actionTargetId, rejectComment, fetchRequests, fetchSummary]);

  // ============================================
  // 일괄 승인
  // ============================================
  const handleBulkApprove = useCallback(async () => {
    if (!auth.token || selectedIds.length === 0) return;
    setActionLoading(true);
    try {
      const results =
        targetTab === 'folder'
          ? await folderActionRequestAdminApi.bulkApprove(auth.token, {
              ids: selectedIds,
              comment: bulkComment || undefined,
            })
          : await fileActionRequestAdminApi.bulkApprove(auth.token, {
              ids: selectedIds,
              comment: bulkComment || undefined,
            });

      const executed = results.filter(r => r.status === 'EXECUTED').length;
      const invalidated = results.filter(r => r.status === 'INVALIDATED').length;
      const failed = results.filter(r => r.status === 'FAILED').length;

      alert(`일괄 승인 완료\n- 실행 완료: ${executed}건\n- 무효화: ${invalidated}건\n- 실패: ${failed}건`);

      setShowBulkApproveModal(false);
      setBulkComment('');
      setSelectedIds([]);
      fetchRequests();
      fetchSummary();
    } catch (error) {
      console.error('Failed to bulk approve:', error);
      alert('일괄 승인에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  }, [auth.token, targetTab, selectedIds, bulkComment, fetchRequests, fetchSummary]);

  // ============================================
  // 일괄 반려
  // ============================================
  const handleBulkReject = useCallback(async () => {
    if (!auth.token || selectedIds.length === 0 || !bulkComment.trim()) return;
    setActionLoading(true);
    try {
      if (targetTab === 'folder') {
        await folderActionRequestAdminApi.bulkReject(auth.token, {
          ids: selectedIds,
          comment: bulkComment.trim(),
        });
      } else {
        await fileActionRequestAdminApi.bulkReject(auth.token, {
          ids: selectedIds,
          comment: bulkComment.trim(),
        });
      }

      alert(`${selectedIds.length}건이 일괄 반려되었습니다.`);

      setShowBulkRejectModal(false);
      setBulkComment('');
      setSelectedIds([]);
      fetchRequests();
      fetchSummary();
    } catch (error) {
      console.error('Failed to bulk reject:', error);
      alert('일괄 반려에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  }, [auth.token, targetTab, selectedIds, bulkComment, fetchRequests, fetchSummary]);

  // ============================================
  // 선택 핸들러
  // ============================================
  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    const pendingIds = requests.filter(r => r.status === 'PENDING').map(r => r.id);
    if (selectedIds.length === pendingIds.length && pendingIds.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingIds);
    }
  };

  // ============================================
  // 날짜 포맷
  // ============================================
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ============================================
  // 인증 체크
  // ============================================
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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">작업 요청 관리 (관리자)</h1>
        <p className="text-sm text-gray-500 mt-1">
          파일/폴더 이동·삭제 요청을 확인하고 승인/반려합니다.
        </p>
      </div>

      {/* 상태 요약 카드 */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {(Object.entries(summary) as [FileActionRequestStatus, number][]).map(([status, count]) => {
            const display = STATUS_DISPLAY[status];
            return (
              <div
                key={status}
                className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                  filterStatus === status ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => {
                  setActiveTab('all');
                  setFilterStatus(filterStatus === status ? '' : status);
                }}
              >
                <div className="text-2xl font-bold text-gray-900">{count}</div>
                <div className={`text-xs font-medium ${display.textColor}`}>
                  {display.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 대상 유형 탭 (파일 / 폴더) */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => {
            setTargetTab('file');
            setPage(1);
            setSelectedIds([]);
            setFilterStatus('');
            setFilterType('');
          }}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            targetTab === 'file'
              ? 'bg-white text-gray-900 shadow-sm font-medium'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          파일 요청
        </button>
        <button
          onClick={() => {
            setTargetTab('folder');
            setPage(1);
            setSelectedIds([]);
            setFilterStatus('');
            setFilterType('');
          }}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            targetTab === 'folder'
              ? 'bg-white text-gray-900 shadow-sm font-medium'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          폴더 요청
        </button>
      </div>

      {/* 탭 + 필터 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* 탭 */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('my-pending')}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              activeTab === 'my-pending'
                ? 'bg-white text-gray-900 shadow-sm font-medium'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            내 승인 대기
            {summary && summary.PENDING > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {summary.PENDING}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              activeTab === 'all'
                ? 'bg-white text-gray-900 shadow-sm font-medium'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            전체 요청
          </button>
        </div>

        {/* 필터 (전체 요청 탭에서만, 파일 탭에서만 유형 필터 표시) */}
        {activeTab === 'all' && (
          <div className="flex items-center space-x-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FileActionRequestStatus | '')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">모든 상태</option>
              <option value="PENDING">승인 대기</option>
              <option value="EXECUTED">실행 완료</option>
              <option value="REJECTED">반려됨</option>
              <option value="CANCELED">취소됨</option>
              <option value="INVALIDATED">무효화</option>
              <option value="FAILED">실행 실패</option>
            </select>
            {targetTab === 'file' && (
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FileActionType | '')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">모든 유형</option>
                <option value="MOVE">이동 요청</option>
                <option value="DELETE">삭제 요청</option>
              </select>
            )}
            <button
              onClick={() => { fetchRequests(); fetchSummary(); }}
              className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              새로고침
            </button>
          </div>
        )}
      </div>

      {/* 일괄 처리 바 */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-blue-800 font-medium">
            {selectedIds.length}건 선택됨
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => { setBulkComment(''); setShowBulkApproveModal(true); }}
              className="px-4 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              일괄 승인
            </button>
            <button
              onClick={() => { setBulkComment(''); setShowBulkRejectModal(true); }}
              className="px-4 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              일괄 반려
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              선택 해제
            </button>
          </div>
        </div>
      )}

      {/* 요청 목록 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-gray-500">불러오는 중...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="text-4xl mb-3">📋</span>
            <p className="text-gray-500">
              {activeTab === 'my-pending' ? '승인 대기 중인 요청이 없습니다.' : '요청이 없습니다.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          requests.filter(r => r.status === 'PENDING').length > 0 &&
                          selectedIds.length === requests.filter(r => r.status === 'PENDING').length
                        }
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">유형</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {targetTab === 'folder' ? '폴더명' : '파일명'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사유</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">요청일</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">처리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {requests.map((req) => {
                    const statusInfo = STATUS_DISPLAY[req.status];
                    const typeInfo = TYPE_DISPLAY[req.type];
                    const itemName = 'fileName' in req ? req.fileName : req.folderName;

                    return (
                      <tr
                        key={req.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          {req.status === 'PENDING' ? (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(req.id)}
                              onChange={() => toggleSelect(req.id)}
                              className="rounded"
                            />
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="inline-flex items-center">
                            <span className="mr-1">{typeInfo.icon}</span>
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.textColor}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[200px] truncate" title={itemName}>
                          {itemName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate" title={req.reason}>
                          {req.reason}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {formatDate(req.requestedAt)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleViewDetail(req.id)}
                              className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                            >
                              상세
                            </button>
                            {req.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => {
                                    setActionTargetId(req.id);
                                    setApproveComment('');
                                    setShowApproveModal(true);
                                  }}
                                  className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded font-medium"
                                >
                                  승인
                                </button>
                                <button
                                  onClick={() => {
                                    setActionTargetId(req.id);
                                    setRejectComment('');
                                    setShowRejectModal(true);
                                  }}
                                  className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded font-medium"
                                >
                                  반려
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            <div className="px-4 py-3 bg-gray-50 flex items-center justify-between border-t">
              <div className="text-sm text-gray-500">
                총 {totalItems}건 / {totalPages}페이지 중 {page}페이지
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
                >
                  이전
                </button>
                <span className="text-sm text-gray-700">{page}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ============================================ */}
      {/* 상세 모달 */}
      {/* ============================================ */}
      {showDetailModal && detailRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">요청 상세</h3>
              <button
                onClick={() => { setShowDetailModal(false); setDetailRequest(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">요청 유형</div>
                  <span className="inline-flex items-center">
                    <span className="mr-1">{TYPE_DISPLAY[detailRequest.type].icon}</span>
                    {TYPE_DISPLAY[detailRequest.type].label}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">상태</div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_DISPLAY[detailRequest.status].bgColor} ${STATUS_DISPLAY[detailRequest.status].textColor}`}>
                    {STATUS_DISPLAY[detailRequest.status].label}
                  </span>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">
                  {'fileName' in detailRequest ? '파일명' : '폴더명'}
                </div>
                <div className="text-sm font-medium">
                  {'fileName' in detailRequest ? detailRequest.fileName : detailRequest.folderName}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">요청 사유</div>
                <div className="text-sm bg-gray-50 rounded-lg p-3">{detailRequest.reason}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">요청자 ID</div>
                  <div className="text-sm text-gray-700 truncate" title={detailRequest.requesterId}>
                    {detailRequest.requesterId.slice(0, 8)}...
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">지정 승인자 ID</div>
                  <div className="text-sm text-gray-700 truncate" title={detailRequest.designatedApproverId}>
                    {detailRequest.designatedApproverId.slice(0, 8)}...
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">요청일</div>
                  <div className="text-sm">{formatDate(detailRequest.requestedAt)}</div>
                </div>
                {detailRequest.decidedAt && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">결정일</div>
                    <div className="text-sm">{formatDate(detailRequest.decidedAt)}</div>
                  </div>
                )}
              </div>

              {detailRequest.decisionComment && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">결정 코멘트</div>
                  <div className="text-sm bg-gray-50 rounded-lg p-3">{detailRequest.decisionComment}</div>
                </div>
              )}

              {detailRequest.executionNote && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">실행 메모</div>
                  <div className="text-sm bg-orange-50 text-orange-800 rounded-lg p-3">{detailRequest.executionNote}</div>
                </div>
              )}

              {'targetFolderId' in detailRequest &&
                detailRequest.type === 'MOVE' &&
                detailRequest.targetFolderId && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">이동 대상 폴더 ID</div>
                    <div className="text-sm text-gray-700 truncate" title={detailRequest.targetFolderId}>
                      {detailRequest.targetFolderId}
                    </div>
                  </div>
                )}

              {'sourceParentFolderPath' in detailRequest &&
                (detailRequest.sourceParentFolderPath || detailRequest.targetParentFolderPath) && (
                  <>
                    {detailRequest.sourceParentFolderPath && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">현재 위치 (부모 경로)</div>
                        <div className="text-sm text-gray-700 truncate" title={detailRequest.sourceParentFolderPath}>
                          {detailRequest.sourceParentFolderPath}
                        </div>
                      </div>
                    )}
                    {detailRequest.targetParentFolderPath && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">이동 대상 (부모 경로)</div>
                        <div className="text-sm text-gray-700 truncate" title={detailRequest.targetParentFolderPath}>
                          {detailRequest.targetParentFolderPath}
                        </div>
                      </div>
                    )}
                  </>
                )}
            </div>

            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-2">
              {detailRequest.status === 'PENDING' && (
                <>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setActionTargetId(detailRequest.id);
                      setRejectComment('');
                      setShowRejectModal(true);
                    }}
                    className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    반려
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setActionTargetId(detailRequest.id);
                      setApproveComment('');
                      setShowApproveModal(true);
                    }}
                    className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    승인
                  </button>
                </>
              )}
              <button
                onClick={() => { setShowDetailModal(false); setDetailRequest(null); }}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* 승인 모달 */}
      {/* ============================================ */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">요청 승인</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-gray-600">
                이 요청을 승인하시겠습니까? 승인 시 파일 작업이 즉시 실행됩니다.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  코멘트 (선택)
                </label>
                <textarea
                  value={approveComment}
                  onChange={(e) => setApproveComment(e.target.value)}
                  placeholder="승인 코멘트를 입력하세요 (선택)"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-2">
              <button
                onClick={() => { setShowApproveModal(false); setActionTargetId(null); }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-500 text-white hover:bg-green-600 rounded-lg disabled:opacity-50"
              >
                {actionLoading ? '처리 중...' : '승인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* 반려 모달 */}
      {/* ============================================ */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">요청 반려</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-gray-600">
                이 요청을 반려하시겠습니까? 반려 사유는 필수입니다.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  반려 사유 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="반려 사유를 입력하세요 (필수)"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-2">
              <button
                onClick={() => { setShowRejectModal(false); setActionTargetId(null); }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectComment.trim()}
                className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-lg disabled:opacity-50"
              >
                {actionLoading ? '처리 중...' : '반려'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* 일괄 승인 모달 */}
      {/* ============================================ */}
      {showBulkApproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">일괄 승인</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-gray-600">
                선택한 <span className="font-bold text-blue-600">{selectedIds.length}건</span>의 요청을
                일괄 승인하시겠습니까?
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  코멘트 (선택)
                </label>
                <textarea
                  value={bulkComment}
                  onChange={(e) => setBulkComment(e.target.value)}
                  placeholder="일괄 승인 코멘트를 입력하세요 (선택)"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-2">
              <button
                onClick={() => setShowBulkApproveModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleBulkApprove}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-500 text-white hover:bg-green-600 rounded-lg disabled:opacity-50"
              >
                {actionLoading ? '처리 중...' : `${selectedIds.length}건 일괄 승인`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* 일괄 반려 모달 */}
      {/* ============================================ */}
      {showBulkRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">일괄 반려</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-gray-600">
                선택한 <span className="font-bold text-red-600">{selectedIds.length}건</span>의 요청을
                일괄 반려하시겠습니까?
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  반려 사유 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={bulkComment}
                  onChange={(e) => setBulkComment(e.target.value)}
                  placeholder="일괄 반려 사유를 입력하세요 (필수)"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-2">
              <button
                onClick={() => setShowBulkRejectModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleBulkReject}
                disabled={actionLoading || !bulkComment.trim()}
                className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-lg disabled:opacity-50"
              >
                {actionLoading ? '처리 중...' : `${selectedIds.length}건 일괄 반려`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
