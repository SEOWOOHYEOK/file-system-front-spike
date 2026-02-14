/**
 * MyActionRequestsView - 내 작업 요청 (파일/폴더)
 * 사용자의 파일·폴더 작업 요청을 조회, 상세 확인, 취소하는 뷰
 */
import { useState, useEffect, useCallback } from 'react';
import { fileActionRequestApi } from '../../api/fileActionRequestApi';
import { folderActionRequestApi } from '../../api/folderActionRequestApi';
import type {
  FileActionRequestResponse,
  FolderActionRequestResponse,
  ActionRequestItem,
  FileActionRequestStatus,
  FileActionType,
  TargetType,
  MyRequestRole,
} from '../../types/file-action-request.types';
import { STATUS_DISPLAY, TYPE_DISPLAY } from '../../types/file-action-request.types';

// ─── Props ───

interface MyActionRequestsViewProps {
  token: string;
}

// ─── Constants ───

const PAGE_SIZE = 20;

const ROLE_OPTIONS: { value: MyRequestRole | ''; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'REQUESTED', label: '내가 요청' },
  { value: 'PROCESSED', label: '내가 처리' },
];

const STATUS_OPTIONS: { value: FileActionRequestStatus | ''; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'PENDING', label: '승인 대기' },
  { value: 'APPROVED', label: '승인됨' },
  { value: 'REJECTED', label: '반려됨' },
  { value: 'CANCELED', label: '취소됨' },
  { value: 'EXECUTED', label: '실행 완료' },
  { value: 'INVALIDATED', label: '무효화' },
  { value: 'FAILED', label: '실행 실패' },
];

const TYPE_OPTIONS: { value: FileActionType | ''; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'MOVE', label: '이동 요청' },
  { value: 'DELETE', label: '삭제 요청' },
];

// ─── Helpers ───

function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

// ─── Detail Modal ───

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ActionRequestItem | null;
}

function DetailModal({ isOpen, onClose, item }: DetailModalProps) {
  if (!isOpen || !item) return null;

  const isFile = item.targetType === 'FILE';
  const name = isFile ? item.fileName : item.folderName;
  const sourcePath = isFile ? item.sourceFolderPath : item.sourceParentFolderPath;
  const targetPath = isFile ? item.targetFolderPath : item.targetParentFolderPath;
  const typeInfo = TYPE_DISPLAY[item.type];
  const statusInfo = STATUS_DISPLAY[item.status];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-lg font-semibold text-gray-900">요청 상세</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">요청 유형</div>
              <span className="inline-flex items-center">
                <span className="mr-1">{typeInfo.icon}</span>
                {typeInfo.label}
              </span>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">상태</div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.textColor}`}
              >
                {statusInfo.label}
              </span>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">{isFile ? '파일명' : '폴더명'}</div>
            <div className="text-sm font-medium">{name}</div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">경로</div>
            <div className="text-sm text-gray-700">
              {sourcePath || '-'} → {targetPath || '-'}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">요청 사유</div>
            <div className="text-sm bg-gray-50 rounded-lg p-3">{item.reason}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">요청자 ID</div>
              <div className="text-sm text-gray-700 truncate" title={item.requesterId}>
                {item.requesterId.slice(0, 8)}...
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">지정 승인자 ID</div>
              <div className="text-sm text-gray-700 truncate" title={item.designatedApproverId}>
                {item.designatedApproverId.slice(0, 8)}...
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">요청일</div>
              <div className="text-sm">{formatDate(item.requestedAt)}</div>
            </div>
            {item.decidedAt && (
              <div>
                <div className="text-xs text-gray-500 mb-1">결정일</div>
                <div className="text-sm">{formatDate(item.decidedAt)}</div>
              </div>
            )}
          </div>

          {item.executedAt && (
            <div>
              <div className="text-xs text-gray-500 mb-1">실행일</div>
              <div className="text-sm">{formatDate(item.executedAt)}</div>
            </div>
          )}

          {item.decisionComment && (
            <div>
              <div className="text-xs text-gray-500 mb-1">결정 코멘트</div>
              <div className="text-sm bg-gray-50 rounded-lg p-3">{item.decisionComment}</div>
            </div>
          )}

          {item.executionNote && (
            <div>
              <div className="text-xs text-gray-500 mb-1">실행 메모</div>
              <div className="text-sm bg-orange-50 text-orange-800 rounded-lg p-3">
                {item.executionNote}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───

export function MyActionRequestsView({ token }: MyActionRequestsViewProps) {
  const [targetType, setTargetType] = useState<TargetType>('FILE');
  const [filterRole, setFilterRole] = useState<MyRequestRole | ''>('');
  const [filterStatus, setFilterStatus] = useState<FileActionRequestStatus | ''>('');
  const [filterType, setFilterType] = useState<FileActionType | ''>('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ActionRequestItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailItem, setDetailItem] = useState<ActionRequestItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      if (targetType === 'FILE') {
        const data = await fileActionRequestApi.getMyRequests(token, {
          targetType: 'FILE',
          status: filterStatus || undefined,
          type: filterType || undefined,
          role: filterRole || undefined,
          page,
          pageSize: PAGE_SIZE,
        });
        setItems(data.items);
        setTotalItems(data.totalItems);
        setTotalPages(data.totalPages);
      } else {
        const data = await folderActionRequestApi.getMyRequests(token, {
          status: filterStatus || undefined,
          role: filterRole || undefined,
          page,
          pageSize: PAGE_SIZE,
        });
        setItems(data.items);
        setTotalItems(data.totalItems);
        setTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error('Failed to fetch requests:', err);
      setError('요청 목록을 불러오는데 실패했습니다.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, targetType, filterRole, filterStatus, filterType, page]);

  useEffect(() => {
    if (token) fetchRequests();
  }, [token, fetchRequests]);

  useEffect(() => {
    setPage(1);
  }, [targetType, filterRole, filterStatus, filterType]);

  const handleViewDetail = useCallback(async (id: string) => {
    if (!token) return;
    try {
      let detail: ActionRequestItem | null = null;
      if (targetType === 'FILE') {
        detail = await fileActionRequestApi.getRequestDetail(token, id);
      } else {
        detail = await folderActionRequestApi.getRequestDetail(token, id);
      }
      if (detail) {
        setDetailItem(detail);
        setShowDetailModal(true);
      }
    } catch (err) {
      console.error('Failed to fetch detail:', err);
      setError('상세 정보를 불러오는데 실패했습니다.');
    }
  }, [token, targetType]);

  const handleCancel = useCallback(async (id: string) => {
    if (!token) return;
    if (!window.confirm('이 요청을 취소하시겠습니까?')) return;

    setCancelLoading(id);
    try {
      if (targetType === 'FILE') {
        await fileActionRequestApi.cancelRequest(token, id);
      } else {
        await folderActionRequestApi.cancelRequest(token, id);
      }
      alert('요청이 취소되었습니다.');
      fetchRequests();
      if (detailItem?.id === id) {
        setShowDetailModal(false);
        setDetailItem(null);
      }
    } catch (err) {
      console.error('Failed to cancel:', err);
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      alert(msg || '취소에 실패했습니다.');
    } finally {
      setCancelLoading(null);
    }
  }, [token, targetType, detailItem?.id, fetchRequests]);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900">내 작업 요청</h2>
      </div>

      {/* Target type tabs */}
      <div className="px-6 py-3 border-b">
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setTargetType('FILE')}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              targetType === 'FILE'
                ? 'bg-white text-gray-900 shadow-sm font-medium'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            파일 요청
          </button>
          <button
            onClick={() => setTargetType('FOLDER')}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              targetType === 'FOLDER'
                ? 'bg-white text-gray-900 shadow-sm font-medium'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            폴더 요청
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b bg-gray-50 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">역할:</span>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as MyRequestRole | '')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">상태:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FileActionRequestStatus | '')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {targetType === 'FILE' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">타입:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FileActionType | '')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-gray-500">불러오는 중...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="text-4xl mb-3">📋</span>
            <p className="text-gray-500">작업 요청이 없습니다</p>
          </div>
        ) : (
          <>
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    유형
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {targetType === 'FILE' ? '파일명' : '폴더명'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    출발 경로
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    도착 경로
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    사유
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    요청일
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item) => {
                  const statusInfo = STATUS_DISPLAY[item.status];
                  const typeInfo = TYPE_DISPLAY[item.type];
                  const isFile = item.targetType === 'FILE';
                  const name = isFile ? item.fileName : item.folderName;
                  const sourcePath = isFile
                    ? (item as FileActionRequestResponse).sourceFolderPath
                    : (item as FolderActionRequestResponse).sourceParentFolderPath;
                  const targetPath = isFile
                    ? (item as FileActionRequestResponse).targetFolderPath
                    : (item as FolderActionRequestResponse).targetParentFolderPath;
                  const targetDisplay =
                    item.type === 'DELETE' ? '-' : (targetPath || '-');
                  const canCancel = item.status === 'PENDING';
                  const isCanceling = cancelLoading === item.id;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.textColor}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-flex items-center">
                          <span className="mr-1">{typeInfo.icon}</span>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[160px] truncate" title={name}>
                        {name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[140px] truncate" title={sourcePath || '-'}>
                        {sourcePath || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[140px] truncate" title={targetDisplay}>
                        {targetDisplay}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[120px] truncate" title={item.reason}>
                        {truncate(item.reason, 30)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {formatDate(item.requestedAt)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleViewDetail(item.id)}
                            className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                          >
                            상세
                          </button>
                          {canCancel && (
                            <button
                              onClick={() => handleCancel(item.id)}
                              disabled={isCanceling}
                              className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                            >
                              {isCanceling ? '취소 중...' : '취소'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="px-4 py-3 bg-gray-50 flex items-center justify-between border-t">
              <div className="text-sm text-gray-500">
                총 {totalItems}건 / {totalPages}페이지 중 {page}페이지
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
                >
                  ◀ 이전
                </button>
                <span className="text-sm text-gray-700">{page}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
                >
                  다음 ▶
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail Modal */}
      <DetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setDetailItem(null);
        }}
        item={detailItem}
      />
    </div>
  );
}
