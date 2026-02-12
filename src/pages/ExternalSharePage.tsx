/**
 * ExternalSharePage - 외부 사용자 공유 파일함 (710)
 * 외부 사용자가 공유받은 파일 목록 확인 및 조회/다운로드
 */
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { externalShareApi } from '../api/externalShareApi';
import { LoginPanel } from '../components/LoginPanel';
import { FileViewer } from '../components/FileViewer';
import type { PublicShare, ShareDetailResponse } from '../types/api.types';
import axios from 'axios';

const TOKEN_EXPIRED_ERROR_CODES = [2112, 2113];

function formatExpiryDate(isoDate?: string): string {
  if (!isoDate) return '-';
  try {
    const d = new Date(isoDate);
    return `~${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return '-';
  }
}

function formatFileSize(bytes?: number): string {
  if (bytes == null || bytes === 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  share: PublicShare | null;
  detail: ShareDetailResponse | null;
  loading: boolean;
  accessToken: string | null;
  onRefreshDetail: () => void;
}

function FileDetailModal({
  isOpen,
  onClose,
  share,
  detail,
  loading,
  accessToken,
  onRefreshDetail,
}: FileDetailModalProps) {
  const [viewLoading, setViewLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFileUrl, setViewerFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchContentWithRetry = useCallback(
    async (retryCount = 0): Promise<Blob> => {
      if (!accessToken || !share || !detail) throw new Error('Missing auth or share');
      try {
        return await externalShareApi.getContent(
          accessToken,
          share.id,
          detail.contentToken,
        );
      } catch (err) {
        if (retryCount < 1 && axios.isAxiosError(err)) {
          const errData = err.response?.data as { errorCode?: number } | undefined;
          if (errData?.errorCode && TOKEN_EXPIRED_ERROR_CODES.includes(errData.errorCode)) {
            const newDetail = await externalShareApi.getShareDetail(accessToken, share.id);
            return externalShareApi.getContent(accessToken, share.id, newDetail.contentToken);
          }
        }
        throw err;
      }
    },
    [accessToken, share, detail, onRefreshDetail],
  );

  const fetchDownloadWithRetry = useCallback(
    async (retryCount = 0): Promise<{ blob: Blob; filename: string }> => {
      if (!accessToken || !share || !detail) throw new Error('Missing auth or share');
      try {
        return await externalShareApi.downloadFile(
          accessToken,
          share.id,
          detail.contentToken,
        );
      } catch (err) {
        if (retryCount < 1 && axios.isAxiosError(err)) {
          const errData = err.response?.data as { errorCode?: number } | undefined;
          if (errData?.errorCode && TOKEN_EXPIRED_ERROR_CODES.includes(errData.errorCode)) {
            const newDetail = await externalShareApi.getShareDetail(accessToken, share.id);
            return externalShareApi.downloadFile(accessToken, share.id, newDetail.contentToken);
          }
        }
        throw err;
      }
    },
    [accessToken, share, detail, onRefreshDetail],
  );

  const handleView = async () => {
    if (!share || !detail) return;
    setError(null);
    setViewLoading(true);
    try {
      const blob = await fetchContentWithRetry();
      const url = URL.createObjectURL(blob);
      setViewerFileUrl(url);
      setViewerOpen(true);
      onRefreshDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 미리보기에 실패했습니다.');
    } finally {
      setViewLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!share || !detail) return;
    setError(null);
    setDownloadLoading(true);
    try {
      const { blob, filename } = await fetchDownloadWithRetry();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onRefreshDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 다운로드에 실패했습니다.');
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleCloseViewer = () => {
    setViewerOpen(false);
    if (viewerFileUrl) {
      URL.revokeObjectURL(viewerFileUrl);
      setViewerFileUrl(null);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setViewerOpen(false);
      if (viewerFileUrl) {
        URL.revokeObjectURL(viewerFileUrl);
        setViewerFileUrl(null);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const s = detail?.share ?? share;
  const fileName = s?.fileName ?? 'unknown';
  const hasView = s?.permissions?.includes('VIEW') ?? false;
  const hasDownload = s?.permissions?.includes('DOWNLOAD') ?? false;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">파일 상세</h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : s ? (
              <>
                <div>
                  <div className="text-sm text-gray-500">파일명</div>
                  <div className="font-medium text-gray-900 truncate">{fileName}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">크기</div>
                    <div className="font-medium">{formatFileSize(s.fileSize)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">유형</div>
                    <div className="font-medium truncate">{s.mimeType || '-'}</div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">권한</div>
                  <div className="flex gap-2 mt-1">
                    {s.permissions?.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">조회/다운로드 횟수</div>
                  <div className="text-sm">
                    조회 {s.currentViewCount ?? 0}
                    {s.maxViewCount != null ? `/${s.maxViewCount}` : ''}회, 다운로드{' '}
                    {s.currentDownloadCount ?? 0}
                    {s.maxDownloadCount != null ? `/${s.maxDownloadCount}` : ''}회
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">만료일</div>
                  <div className="font-medium">{formatExpiryDate(s.expiresAt)}</div>
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>
                )}

                <div className="flex gap-3 pt-2">
                  {hasView && (
                    <button
                      onClick={handleView}
                      disabled={viewLoading}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                    >
                      {viewLoading ? '로딩...' : '보기'}
                    </button>
                  )}
                  {hasDownload && (
                    <button
                      onClick={handleDownload}
                      disabled={downloadLoading}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                    >
                      {downloadLoading ? '로딩...' : '다운로드'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-gray-500">정보를 불러올 수 없습니다.</div>
            )}
          </div>
        </div>
      </div>

      <FileViewer
        isOpen={viewerOpen}
        onClose={handleCloseViewer}
        fileUrl={viewerFileUrl}
        fileName={fileName}
        mimeType={s?.mimeType}
      />
    </>
  );
}

export function ExternalSharePage() {
  const { auth, login, logout, refresh } = useAuth();
  const [shares, setShares] = useState<PublicShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [selectedShare, setSelectedShare] = useState<PublicShare | null>(null);
  const [shareDetail, setShareDetail] = useState<ShareDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchShares = useCallback(async () => {
    if (!auth.accessToken) return;
    setLoadingShares(true);
    try {
      const res = await externalShareApi.getMyShares(auth.accessToken);
      setShares(res.items);
    } catch (err) {
      console.error('Failed to fetch shares:', err);
    } finally {
      setLoadingShares(false);
    }
  }, [auth.accessToken]);

  const fetchDetail = useCallback(async () => {
    if (!auth.accessToken || !selectedShare) return;
    setLoadingDetail(true);
    try {
      const detail = await externalShareApi.getShareDetail(auth.accessToken, selectedShare.id);
      setShareDetail(detail);
    } catch (err) {
      console.error('Failed to fetch detail:', err);
      setShareDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [auth.accessToken, selectedShare]);

  useEffect(() => {
    if (auth.isAuthenticated) {
      fetchShares();
    } else {
      setShares([]);
      setSelectedShare(null);
      setShareDetail(null);
    }
  }, [auth.isAuthenticated, fetchShares]);

  useEffect(() => {
    if (selectedShare && auth.accessToken) {
      fetchDetail();
    } else {
      setShareDetail(null);
    }
  }, [selectedShare, auth.accessToken, fetchDetail]);

  const handleSelectShare = (share: PublicShare) => {
    setSelectedShare(share);
  };

  const handleCloseModal = () => {
    setSelectedShare(null);
    setShareDetail(null);
  };

  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">공유 파일함</h1>
            <p className="text-gray-500 mt-1">로그인하여 공유된 파일을 확인하세요</p>
          </div>
          <LoginPanel
            auth={auth}
            onLogin={login}
            onLogout={logout}
            onRefresh={refresh}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">공유 파일함</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{auth.user?.name ?? auth.user?.username}</span>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto p-6">
        {loadingShares ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : shares.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">공유된 파일이 없습니다</h3>
            <p className="text-gray-500">현재 공유받은 파일이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {shares.map((share) => (
              <button
                key={share.id}
                onClick={() => handleSelectShare(share)}
                className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 truncate">
                      {share.fileName ?? 'unknown'}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {share.permissions?.map((p) => (
                        <span
                          key={p}
                          className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatExpiryDate(share.expiresAt)}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <FileDetailModal
        isOpen={!!selectedShare}
        onClose={handleCloseModal}
        share={selectedShare}
        detail={shareDetail}
        loading={loadingDetail}
        accessToken={auth.accessToken}
        onRefreshDetail={fetchDetail}
      />
    </div>
  );
}
