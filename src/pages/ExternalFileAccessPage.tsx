/**
 * ExternalFileAccessPage - 나에게 공유된 파일 접근 (710)
 * 내부 사용자가 외부 공유로 받은 파일 목록 확인, 상세 조회, 보기/다운로드
 */
import { useState, useCallback, useEffect } from 'react';
import { externalFileAccessApi } from '../api/externalFileAccessApi';
import { FileViewer } from '../components/FileViewer';
import type { MyShareListItem, ShareDetailResponse, ShareDetail } from '../types/file-share.types';
import axios from 'axios';

const TOKEN_EXPIRED_ERROR_CODES = [2112, 2113];

// ─── 유틸 ───

function formatExpiryDate(isoDate?: string): string {
  if (!isoDate) return '무기한';
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return '-';
  }
}

function formatFileSize(bytes?: number): string {
  if (bytes == null || bytes === 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleString('ko-KR', {
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

/** 미리보기 가능한 파일인지 판별 */
function isPreviewableFile(mimeType?: string, fileName?: string): boolean {
  if (!mimeType && !fileName) return false;
  // PDF
  if (mimeType === 'application/pdf' || fileName?.toLowerCase().endsWith('.pdf')) return true;
  // 이미지
  if (mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName ?? '')) return true;
  // 텍스트 계열
  if (mimeType?.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/javascript') return true;
  const textExtensions = [
    '.txt', '.md', '.json', '.js', '.ts', '.tsx', '.jsx', '.css', '.html',
    '.xml', '.yaml', '.yml', '.log', '.csv', '.ini', '.conf', '.sh', '.bat',
  ];
  if (fileName && textExtensions.some((ext) => fileName.toLowerCase().endsWith(ext))) return true;
  return false;
}

/** 공유가 사용 불가 상태인지 (만료 또는 다운로드 횟수 소진) */
function isShareBlocked(share: MyShareListItem, cached?: ShareDetail): { blocked: boolean; reason: string } {
  // 만료 체크
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return { blocked: true, reason: '공유 기간이 만료되었습니다.' };
  }
  // 다운로드 횟수 소진 체크
  if (cached && cached.maxDownloadCount != null && cached.currentDownloadCount >= cached.maxDownloadCount) {
    return { blocked: true, reason: '다운로드 횟수가 모두 소진되었습니다.' };
  }
  return { blocked: false, reason: '' };
}

// ─── 상세 모달 ───

interface FileDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  share: MyShareListItem | null;
  detail: ShareDetailResponse | null;
  loading: boolean;
  onRefreshDetail: () => void;
}

function FileDetailModal({
  isOpen,
  onClose,
  share,
  detail,
  loading,
  onRefreshDetail,
}: FileDetailModalProps) {
  const [viewLoading, setViewLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFileUrl, setViewerFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 콘텐츠 토큰 만료 시 재발급 후 재시도
  const fetchContentWithRetry = useCallback(
    async (retryCount = 0): Promise<Blob> => {
      if (!share || !detail) throw new Error('Missing share info');
      try {
        return await externalFileAccessApi.getContent(share.id, detail.contentToken);
      } catch (err) {
        if (retryCount < 1 && axios.isAxiosError(err)) {
          const errData = err.response?.data as { errorCode?: number } | undefined;
          if (errData?.errorCode && TOKEN_EXPIRED_ERROR_CODES.includes(errData.errorCode)) {
            const newDetail = await externalFileAccessApi.getShareDetail(share.id);
            return externalFileAccessApi.getContent(share.id, newDetail.contentToken);
          }
        }
        throw err;
      }
    },
    [share, detail],
  );

  const fetchDownloadWithRetry = useCallback(
    async (retryCount = 0): Promise<{ blob: Blob; filename: string }> => {
      if (!share || !detail) throw new Error('Missing share info');
      try {
        return await externalFileAccessApi.downloadFile(share.id, detail.contentToken);
      } catch (err) {
        if (retryCount < 1 && axios.isAxiosError(err)) {
          const errData = err.response?.data as { errorCode?: number } | undefined;
          if (errData?.errorCode && TOKEN_EXPIRED_ERROR_CODES.includes(errData.errorCode)) {
            const newDetail = await externalFileAccessApi.getShareDetail(share.id);
            return externalFileAccessApi.downloadFile(share.id, newDetail.contentToken);
          }
        }
        throw err;
      }
    },
    [share, detail],
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
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : err instanceof Error
          ? err.message
          : '파일 미리보기에 실패했습니다.';
      setError(msg);
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
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : err instanceof Error
          ? err.message
          : '파일 다운로드에 실패했습니다.';
      setError(msg);
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

  const s: ShareDetail | MyShareListItem | null = detail?.share ?? share;
  const fileName = s?.fileName ?? 'unknown';
  const hasView = s?.permissions?.includes('VIEW') ?? false;
  const hasDownload = s?.permissions?.includes('DOWNLOAD') ?? false;
  const mimeType = 'mimeType' in (s ?? {}) ? (s as ShareDetail).mimeType : undefined;
  const canPreview = isPreviewableFile(mimeType, fileName);
  const blockInfo = share ? isShareBlocked(share, detail?.share) : { blocked: false, reason: '' };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
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

          {/* Body */}
          <div className="p-6 space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : s ? (
              <>
                {/* 파일명 */}
                <div>
                  <div className="text-sm text-gray-500">파일명</div>
                  <div className="font-medium text-gray-900 truncate">{fileName}</div>
                </div>

                {/* 크기, MIME */}
                {'fileSize' in s && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-500">크기</div>
                      <div className="font-medium">{formatFileSize((s as ShareDetail).fileSize)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">유형</div>
                      <div className="font-medium truncate">{(s as ShareDetail).mimeType || '-'}</div>
                    </div>
                  </div>
                )}

                {/* 권한 */}
                <div>
                  <div className="text-sm text-gray-500">권한</div>
                  <div className="flex gap-2 mt-1">
                    {s.permissions?.map((p) => (
                      <span
                        key={p}
                        className={`px-2 py-0.5 text-xs font-medium rounded ${
                          p === 'VIEW'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {p === 'VIEW' ? '보기' : '다운로드'}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 다운로드 횟수 */}
                {'currentDownloadCount' in s && (
                  <div>
                    <div className="text-sm text-gray-500">다운로드 현황</div>
                    <div className="text-sm mt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">다운로드:</span>
                        <span className="font-medium">
                          {(s as ShareDetail).currentDownloadCount ?? 0}
                          {(s as ShareDetail).maxDownloadCount != null
                            ? ` / ${(s as ShareDetail).maxDownloadCount}`
                            : ''}
                          회
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 만료일 */}
                <div>
                  <div className="text-sm text-gray-500">만료일</div>
                  <div className="font-medium">{formatExpiryDate(s.expiresAt)}</div>
                </div>

                {/* 에러 */}
                {error && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>
                )}

                {/* 차단 안내 */}
                {blockInfo.blocked && (
                  <div className="text-sm text-orange-700 bg-orange-50 border border-orange-200 p-3 rounded-lg flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    {blockInfo.reason}
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex gap-3 pt-2">
                  {hasView && (
                    canPreview ? (
                      <button
                        onClick={handleView}
                        disabled={viewLoading || blockInfo.blocked}
                        className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                      >
                        {viewLoading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                        {viewLoading ? '로딩...' : '보기'}
                      </button>
                    ) : (
                      <div className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-500 rounded-lg font-medium flex items-center justify-center gap-2 text-sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
                        </svg>
                        해당 파일형식은 미리보기가 불가합니다
                      </div>
                    )
                  )}
                  {hasDownload && (
                    <button
                      onClick={handleDownload}
                      disabled={downloadLoading || blockInfo.blocked}
                      className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                    >
                      {downloadLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      )}
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

      {/* 파일 뷰어 */}
      <FileViewer
        isOpen={viewerOpen}
        onClose={handleCloseViewer}
        fileUrl={viewerFileUrl}
        fileName={fileName}
        mimeType={'mimeType' in (s ?? {}) ? (s as ShareDetail).mimeType : undefined}
      />
    </>
  );
}

// ─── 메인 페이지 ───

export function ExternalFileAccessPage() {
  const [shares, setShares] = useState<MyShareListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 페이지네이션
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 20;

  // 정렬
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 상세 모달
  const [selectedShare, setSelectedShare] = useState<MyShareListItem | null>(null);
  const [shareDetail, setShareDetail] = useState<ShareDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // 목록 상세 정보 캐시 (파일크기, 조회/다운로드 횟수 표시용)
  const [detailsCache, setDetailsCache] = useState<Record<string, ShareDetail>>({});
  const [loadingDetailsIds, setLoadingDetailsIds] = useState<Set<string>>(new Set());

  // 파일 뷰어 (목록에서 바로 미리보기)
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFileUrl, setViewerFileUrl] = useState<string | null>(null);
  const [viewerFileName, setViewerFileName] = useState('');
  const [viewerMimeType, setViewerMimeType] = useState<string | undefined>();
  const [viewerLoading, setViewerLoading] = useState<string | null>(null); // shareId being loaded

  // ─── 목록 조회 ───
  const fetchShares = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await externalFileAccessApi.getMyShares({
        page,
        pageSize,
        sortBy: 'createdAt',
        sortOrder,
      });
      setShares(res.items);
      setTotalPages(res.totalPages);
      setTotalItems(res.totalItems);
    } catch (err) {
      console.error('Failed to fetch shares:', err);
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          setError('인증이 만료되었습니다. 다시 로그인해주세요.');
        } else {
          setError(err.response?.data?.message || '공유 목록을 불러오는 데 실패했습니다.');
        }
      } else {
        setError('공유 목록을 불러오는 데 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortOrder]);

  // ─── 목록 아이템 상세 정보 일괄 조회 ───
  const fetchDetailsForShares = useCallback(async (items: MyShareListItem[]) => {
    const idsToFetch = items
      .map((item) => item.id)
      .filter((id) => !detailsCache[id]);
    if (idsToFetch.length === 0) return;

    setLoadingDetailsIds(new Set(idsToFetch));

    const results = await Promise.allSettled(
      idsToFetch.map((id) => externalFileAccessApi.getShareDetail(id)),
    );

    setDetailsCache((prev) => {
      const next = { ...prev };
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          next[idsToFetch[idx]] = result.value.share;
        }
      });
      return next;
    });
    setLoadingDetailsIds(new Set());
  }, [detailsCache]);

  // ─── 상세 조회 ───
  const fetchDetail = useCallback(async () => {
    if (!selectedShare) return;
    setLoadingDetail(true);
    try {
      const detail = await externalFileAccessApi.getShareDetail(selectedShare.id);
      setShareDetail(detail);
      // 캐시 업데이트
      setDetailsCache((prev) => ({ ...prev, [selectedShare.id]: detail.share }));
    } catch (err) {
      console.error('Failed to fetch detail:', err);
      setShareDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [selectedShare]);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  // 목록 로드 후 상세 정보 일괄 조회
  useEffect(() => {
    if (shares.length > 0) {
      fetchDetailsForShares(shares);
    }
  }, [shares]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedShare) {
      fetchDetail();
    } else {
      setShareDetail(null);
    }
  }, [selectedShare, fetchDetail]);

  const handleSelectShare = (share: MyShareListItem) => {
    setSelectedShare(share);
  };

  const handleCloseModal = () => {
    setSelectedShare(null);
    setShareDetail(null);
  };

  // ─── 목록에서 바로 미리보기 ───
  const handlePreviewFromList = async (e: React.MouseEvent, share: MyShareListItem) => {
    e.stopPropagation();
    if (!share.permissions?.includes('VIEW')) return;

    // 차단 체크 (만료 또는 다운로드 횟수 소진)
    const cached = detailsCache[share.id];
    const blockStatus = isShareBlocked(share, cached);
    if (blockStatus.blocked) {
      alert(blockStatus.reason);
      return;
    }

    setViewerLoading(share.id);
    try {
      // 1. 상세 조회로 contentToken 발급
      const detailRes = await externalFileAccessApi.getShareDetail(share.id);
      // 캐시 업데이트
      setDetailsCache((prev) => ({ ...prev, [share.id]: detailRes.share }));

      // 2. 콘텐츠 다운로드
      const blob = await externalFileAccessApi.getContent(share.id, detailRes.contentToken);
      const url = URL.createObjectURL(blob);

      setViewerFileName(share.fileName);
      setViewerMimeType(detailRes.share.mimeType);
      setViewerFileUrl(url);
      setViewerOpen(true);
    } catch (err) {
      console.error('Failed to preview file:', err);
      // 토큰 만료 시 재시도
      if (axios.isAxiosError(err)) {
        const errData = err.response?.data as { errorCode?: number } | undefined;
        if (errData?.errorCode && TOKEN_EXPIRED_ERROR_CODES.includes(errData.errorCode)) {
          try {
            const newDetail = await externalFileAccessApi.getShareDetail(share.id);
            const blob = await externalFileAccessApi.getContent(share.id, newDetail.contentToken);
            const url = URL.createObjectURL(blob);
            setViewerFileName(share.fileName);
            setViewerMimeType(newDetail.share.mimeType);
            setViewerFileUrl(url);
            setViewerOpen(true);
            return;
          } catch {
            // fall through
          }
        }
        alert(err.response?.data?.message || '파일 미리보기에 실패했습니다.');
      } else {
        alert('파일 미리보기에 실패했습니다.');
      }
    } finally {
      setViewerLoading(null);
    }
  };

  const handleCloseViewer = () => {
    setViewerOpen(false);
    if (viewerFileUrl) {
      URL.revokeObjectURL(viewerFileUrl);
      setViewerFileUrl(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">나에게 공유된 파일</h1>
            <p className="text-sm text-gray-500 mt-1">
              외부 공유를 통해 받은 파일 목록입니다.
              {totalItems > 0 && (
                <span className="ml-2 text-blue-600 font-medium">총 {totalItems}건</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* 정렬 토글 */}
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
              onClick={fetchShares}
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* 에러 */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* 로딩 */}
        {loading && shares.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 mt-4">공유된 파일을 불러오는 중...</p>
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && !error && shares.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">공유된 파일이 없습니다</h3>
            <p className="text-gray-500">현재 나에게 공유된 파일이 없습니다.</p>
          </div>
        )}

        {/* 파일 테이블 */}
        {shares.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    파일명
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    파일크기
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    권한
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    다운로드
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    만료일
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    공유일시
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {shares.map((share) => {
                  const isExpired =
                    share.expiresAt && new Date(share.expiresAt) < new Date();
                  const cached = detailsCache[share.id];
                  const isLoadingInfo = loadingDetailsIds.has(share.id);
                  const hasView = share.permissions?.includes('VIEW');
                  const blockStatus = isShareBlocked(share, cached);
                  const previewable = cached ? isPreviewableFile(cached.mimeType, share.fileName) : isPreviewableFile(undefined, share.fileName);
                  return (
                    <tr
                      key={share.id}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                        isExpired ? 'opacity-60' : ''
                      }`}
                      onClick={() => handleSelectShare(share)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                              {share.fileName}
                            </div>
                            <div className="text-xs text-gray-500">ID: {share.id.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      {/* 파일크기 */}
                      <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {isLoadingInfo ? (
                          <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                        ) : cached ? (
                          formatFileSize(cached.fileSize)
                        ) : '-'}
                      </td>
                      {/* 권한 */}
                      <td className="px-4 py-4">
                        <div className="flex gap-1.5">
                          {share.permissions?.map((p) => (
                            <span
                              key={p}
                              className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${
                                p === 'VIEW'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {p === 'VIEW' ? '보기' : '다운로드'}
                            </span>
                          ))}
                        </div>
                      </td>
                      {/* 다운로드 수 */}
                      <td className="px-4 py-4 text-center">
                        {isLoadingInfo ? (
                          <div className="flex justify-center">
                            <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : cached ? (
                          <span className="text-sm text-gray-700">
                            {cached.currentDownloadCount}
                            {cached.maxDownloadCount != null && (
                              <span className="text-gray-400">/{cached.maxDownloadCount}</span>
                            )}
                          </span>
                        ) : '-'}
                      </td>
                      {/* 만료일 */}
                      <td className="px-4 py-4">
                        <span
                          className={`text-sm ${
                            isExpired ? 'text-red-500 font-medium' : 'text-gray-600'
                          }`}
                        >
                          {isExpired ? '만료됨' : formatExpiryDate(share.expiresAt)}
                        </span>
                      </td>
                      {/* 공유일시 */}
                      <td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {formatDate(share.createdAt)}
                      </td>
                      {/* 액션 */}
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* 미리보기 버튼 */}
                          {hasView && (
                            previewable && !blockStatus.blocked ? (
                              <button
                                onClick={(e) => handlePreviewFromList(e, share)}
                                disabled={viewerLoading === share.id}
                                title="파일 미리보기"
                                className="inline-flex items-center p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {viewerLoading === share.id ? (
                                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                )}
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  alert(blockStatus.blocked ? blockStatus.reason : '해당 파일형식은 미리보기가 불가합니다.');
                                }}
                                title={blockStatus.blocked ? blockStatus.reason : '해당 파일형식은 미리보기가 불가합니다'}
                                className="inline-flex items-center p-1.5 text-gray-400 bg-gray-50 rounded-lg cursor-not-allowed"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                                </svg>
                              </button>
                            )
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectShare(share);
                            }}
                            className="inline-flex items-center px-3 py-1.5 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg font-medium transition-colors"
                          >
                            상세보기
                          </button>
                        </div>
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
      <FileDetailModal
        isOpen={!!selectedShare}
        onClose={handleCloseModal}
        share={selectedShare}
        detail={shareDetail}
        loading={loadingDetail}
        onRefreshDetail={fetchDetail}
      />

      {/* 목록에서 바로 미리보기 뷰어 */}
      <FileViewer
        isOpen={viewerOpen}
        onClose={handleCloseViewer}
        fileUrl={viewerFileUrl}
        fileName={viewerFileName}
        mimeType={viewerMimeType}
      />
    </div>
  );
}
