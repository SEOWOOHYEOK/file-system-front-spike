/**
 * SentShareDetail - 내가 공유한 파일 상세 모달
 * PublicShare 상세 정보 표시 및 철회 기능
 */
import { useState, useEffect, useCallback } from 'react';
import { mySentShareApi } from '../../api/fileShareApi';
import type { PublicShareResponse } from '../../types/file-share.types';
import { formatDate } from './FileItem';

interface SentShareDetailProps {
  isOpen: boolean;
  onClose: () => void;
  shareId: string;
  /** 상세 조회 후 목록 새로고침 콜백 (철회 시 호출) */
  onRevoked?: () => void;
}

const PERMISSION_LABELS: Record<string, string> = {
  VIEW: '열람',
  DOWNLOAD: '다운로드',
};

export function SentShareDetail({
  isOpen,
  onClose,
  shareId,
  onRevoked,
}: SentShareDetailProps) {
  const [detail, setDetail] = useState<PublicShareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!shareId) return;
    setLoading(true);
    setError(null);
    setDetail(null);
    try {
      const data = await mySentShareApi.getDetail(shareId);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '상세 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [shareId]);

  useEffect(() => {
    if (isOpen && shareId) {
      fetchDetail();
    } else {
      setDetail(null);
      setError(null);
    }
  }, [isOpen, shareId, fetchDetail]);

  const handleRevoke = async () => {
    if (!shareId || !detail || detail.isRevoked || detail.isBlocked) return;
    if (!window.confirm('이 공유를 철회하시겠습니까?')) return;

    setRevoking(true);
    try {
      await mySentShareApi.cancel(shareId);
      onRevoked?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '철회 중 오류가 발생했습니다.');
    } finally {
      setRevoking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">공유 상세</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="py-12 text-center text-gray-500">로딩 중...</div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-800">{error}</p>
              <button
                onClick={onClose}
                className="mt-3 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                닫기
              </button>
            </div>
          )}

          {detail && !loading && (
            <div className="space-y-4">
              {/* 상태 배지 */}
              <div className="flex items-center gap-2">
                {detail.isRevoked && (
                  <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">비활성</span>
                )}
                {detail.isBlocked && (
                  <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800">차단됨</span>
                )}
                {!detail.isRevoked && !detail.isBlocked && (
                  <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">활성</span>
                )}
              </div>

              {/* 권한 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  권한
                </label>
                <div className="flex flex-wrap gap-2">
                  {detail.permissions.length > 0 ? (
                    detail.permissions.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-1 text-sm bg-gray-100 text-gray-800 rounded"
                      >
                        {PERMISSION_LABELS[p] ?? p}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
              </div>

              {/* 뷰/다운로드 횟수 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                    열람 횟수
                  </label>
                  <p className="text-sm text-gray-900">
                    {detail.currentViewCount}
                    {detail.maxViewCount != null ? ` / ${detail.maxViewCount}` : ''}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                    다운로드 횟수
                  </label>
                  <p className="text-sm text-gray-900">
                    {detail.currentDownloadCount}
                    {detail.maxDownloadCount != null ? ` / ${detail.maxDownloadCount}` : ''}
                  </p>
                </div>
              </div>

              {/* 만료일 */}
              {detail.expiresAt && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                    만료일
                  </label>
                  <p className="text-sm text-gray-900">{formatDate(detail.expiresAt)}</p>
                </div>
              )}

              {/* 생성/수정일 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                    생성일
                  </label>
                  <p className="text-sm text-gray-900">{formatDate(detail.createdAt)}</p>
                </div>
                {detail.updatedAt && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      수정일
                    </label>
                    <p className="text-sm text-gray-900">{formatDate(detail.updatedAt)}</p>
                  </div>
                )}
              </div>

              {/* 철회 버튼 */}
              {!detail.isRevoked && !detail.isBlocked && (
                <div className="pt-4 border-t">
                  <button
                    onClick={handleRevoke}
                    disabled={revoking}
                    className="px-4 py-2 text-sm text-red-700 bg-red-50 hover:bg-red-100 rounded-lg disabled:opacity-50"
                  >
                    {revoking ? '처리 중...' : '공유 철회'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
