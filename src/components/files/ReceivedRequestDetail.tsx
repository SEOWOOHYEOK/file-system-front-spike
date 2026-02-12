/**
 * ReceivedRequestDetail - 받은 요청 상세 패널
 * 702.받은 요청 관리 - 우측 상세 패널 (승인/반려 포함)
 */
import { useState } from 'react';
import { receivedRequestApi } from '../../api/fileShareApi';
import type {
  ShareRequestResponse,
  SharePermissionType,
  UserDetail,
} from '../../types/file-share.types';
import { formatDate, getFileIcon } from './FileItem';

interface ReceivedRequestDetailProps {
  request: ShareRequestResponse;
  onApproved?: () => void;
  onRejected?: () => void;
}

// YY.MM.DD 포맷
function formatDateYYMMDD(dateString: string): string {
  const d = new Date(dateString);
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function getRemainingDays(endAt: string): number {
  return Math.ceil((new Date(endAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getAvatarInitial(name?: string, fallback?: string): string {
  if (name?.trim()) return name.trim()[0].toUpperCase();
  if (fallback?.trim()) return fallback.trim()[0].toUpperCase();
  return '?';
}

function getPermissionLabel(permission: { type: SharePermissionType; maxDownloads?: number }): string {
  if (permission.type === 'DOWNLOAD') {
    return permission.maxDownloads != null
      ? `다운로드 ${permission.maxDownloads}회`
      : '다운로드';
  }
  return '보기';
}

function getUserDisplayInfo(user: UserDetail): { name: string; sub: string; label?: string } {
  const name = user.name || user.userId.slice(0, 8) + '...';
  if (user.type === 'INTERNAL_USER') {
    return {
      name,
      sub: user.department || user.email || '-',
      label: '내부',
    };
  }
  return {
    name,
    sub: user.company || user.department || user.email || '-',
    label: '외부',
  };
}

export function ReceivedRequestDetail({
  request,
  onApproved,
  onRejected,
}: ReceivedRequestDetailProps) {
  const [approveComment, setApproveComment] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = request.status === 'PENDING';

  const requesterName = request.requesterDetail?.name || request.requesterId.slice(0, 8) + '...';
  const requesterDept = request.requesterDetail?.department;
  const requesterInitial = getAvatarInitial(
    request.requesterDetail?.name,
    request.requesterDetail?.email,
  );

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      await receivedRequestApi.approve(request.id, {
        comment: approveComment.trim() || undefined,
      });
      setShowApproveForm(false);
      setApproveComment('');
      onApproved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '승인 처리에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    const comment = rejectComment.trim();
    if (!comment) return;

    setLoading(true);
    setError(null);
    try {
      await receivedRequestApi.reject(request.id, { comment });
      setShowRejectForm(false);
      setRejectComment('');
      onRejected?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '반려 처리에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelForms = () => {
    setShowApproveForm(false);
    setShowRejectForm(false);
    setApproveComment('');
    setRejectComment('');
    setError(null);
  };

  return (
    <div className="h-full flex flex-col overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-semibold text-sm">
            {requesterInitial}
          </div>
          <div>
            <p className="font-medium text-gray-900">
              {requesterName}
              {requesterDept && (
                <span className="text-gray-500 font-normal ml-1">({requesterDept})</span>
              )}
            </p>
            <p className="text-sm text-gray-500">{formatDateYYMMDD(request.requestedAt)}</p>
          </div>
        </div>
        {isPending && !showApproveForm && !showRejectForm && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setShowApproveForm(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
            >
              승인
            </button>
            <button
              onClick={() => setShowRejectForm(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
            >
              반려
            </button>
          </div>
        )}
      </div>

      {/* Reason quote block */}
      {request.reason && (
        <div className="mt-4 p-4 bg-gray-100 rounded-lg border-l-4 border-gray-400">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.reason}</p>
        </div>
      )}

      {/* 파일 목록 */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          파일 목록 ({request.files?.length ?? request.fileIds.length}건)
        </h3>
        <ul className="space-y-2">
          {request.files && request.files.length > 0 ? (
            request.files.map((file) => (
              <li key={file.id} className="flex items-center gap-2 text-sm">
                <span className="text-base">{getFileIcon(file.mimeType)}</span>
                <span className="text-gray-900">{file.name}</span>
              </li>
            ))
          ) : (
            <li className="text-sm text-gray-500">
              {request.fileIds.length}개 파일 (상세 정보 없음)
            </li>
          )}
        </ul>
      </div>

      {/* 공유 대상 */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          공유 대상 ({request.targetDetails?.length ?? request.targets.length}명)
        </h3>
        <ul className="space-y-3">
          {request.targetDetails && request.targetDetails.length > 0 ? (
            request.targetDetails.map((t, idx) => {
              const { name, sub, label } = t.userDetail
                ? getUserDisplayInfo(t.userDetail)
                : {
                    name: t.userId.slice(0, 8) + '...',
                    sub: '-',
                    label: t.type === 'INTERNAL_USER' ? '내부' : '외부',
                  };
              const initial = t.userDetail ? getAvatarInitial(t.userDetail.name, t.userDetail.email) : '?';
              return (
                <li key={t.userId + idx} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-medium shrink-0">
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{name}</span>
                      {label && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {label}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{t.userDetail?.email ?? sub}</p>
                  </div>
                </li>
              );
            })
          ) : (
            <li className="text-sm text-gray-500">
              {request.targets.length}명 (상세 정보 없음)
            </li>
          )}
        </ul>
      </div>

      {/* 요청 권한 */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">요청 권한</h3>
        <div className="space-y-2 text-sm">
          <p className="text-gray-700">
            <span className="font-medium">권한:</span>{' '}
            {getPermissionLabel(request.permission)}
          </p>
          <p className="text-gray-700">
            <span className="font-medium">기간:</span> {formatDate(request.startAt)} ~{' '}
            {formatDate(request.endAt)}
            {request.status === 'PENDING' && (
              <span className="ml-2 text-gray-500">
                (잔여 {getRemainingDays(request.endAt)}일)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Approve/Reject forms */}
      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {isPending && (
        <div className="mt-6 pt-4 border-t border-gray-200 space-y-4">
          {showApproveForm && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                승인 코멘트 (선택)
              </label>
              <textarea
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
                placeholder="승인 코멘트를 입력하세요 (선택)"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                >
                  {loading ? '처리 중...' : '승인하기'}
                </button>
                <button
                  onClick={handleCancelForms}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {showRejectForm && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                반려 사유 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="반려 사유를 입력하세요 (필수)"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={loading || !rejectComment.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '처리 중...' : '반려하기'}
                </button>
                <button
                  onClick={handleCancelForms}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Decision info for APPROVED/REJECTED */}
      {!isPending && request.approverDetail && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">결정 정보</h3>
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <span className="font-medium">처리자:</span>{' '}
              {request.approverDetail.name}
              {request.approverDetail.department && (
                <span className="text-gray-500"> ({request.approverDetail.department})</span>
              )}
            </p>
            {request.decidedAt && (
              <p>
                <span className="font-medium">처리일:</span> {formatDate(request.decidedAt)}
              </p>
            )}
            {request.decisionComment && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-700 mb-1">코멘트</p>
                <p className="text-gray-600 whitespace-pre-wrap">{request.decisionComment}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
