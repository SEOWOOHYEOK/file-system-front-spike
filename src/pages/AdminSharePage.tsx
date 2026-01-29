/**
 * AdminSharePage - 510.관리자-공유 관리
 */
import { useState, useEffect, useCallback } from 'react';
import { useInternalAuth } from '../hooks/useInternalAuth';
import { adminShareApi, setAdminLogCallback } from '../api/adminApi';
import { ResultLog } from '../components/ResultLog';
import type {
  AdminShare,
  AdminShareDetailResponse,
  SharedFile,
  AdminApiLogEntry,
} from '../types/admin.types';
import type { ApiLogEntry } from '../types/api.types';

type ViewMode = 'shares' | 'files';

export function AdminSharePage() {
  const { auth } = useInternalAuth();
  
  // 뷰 모드
  const [viewMode, setViewMode] = useState<ViewMode>('shares');
  
  // 공유 목록/상세
  const [shares, setShares] = useState<AdminShare[]>([]);
  const [selectedShare, setSelectedShare] = useState<AdminShare | null>(null);
  const [shareDetail, setShareDetail] = useState<AdminShareDetailResponse | null>(null);
  
  // 파일별 공유
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<SharedFile | null>(null);
  const [fileShares, setFileShares] = useState<AdminShare[]>([]);
  
  // 로딩 상태
  const [loading, setLoading] = useState({
    shares: false,
    detail: false,
    files: false,
    fileShares: false,
    action: false,
  });

  // API 로그
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);

  // 로그 콜백 설정
  useEffect(() => {
    setAdminLogCallback((log: AdminApiLogEntry) => {
      const convertedLog: ApiLogEntry = {
        id: log.id,
        timestamp: log.timestamp,
        method: log.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        url: log.url,
        status: log.status,
        duration: log.duration,
        request: log.request,
        response: log.response,
        error: log.error,
      };
      setLogs((prev) => [convertedLog, ...prev].slice(0, 100));
    });
    return () => setAdminLogCallback(null);
  }, []);

  // 전체 공유 목록 조회
  const fetchShares = useCallback(async () => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, shares: true }));
    try {
      const response = await adminShareApi.getShares(auth.token);
      setShares(response.items);
    } catch (error) {
      console.error('Failed to fetch shares:', error);
    } finally {
      setLoading((prev) => ({ ...prev, shares: false }));
    }
  }, [auth.token]);

  // 공유 상세 조회
  const fetchShareDetail = useCallback(async (share: AdminShare) => {
    if (!auth.token) return;
    setSelectedShare(share);
    setLoading((prev) => ({ ...prev, detail: true }));
    try {
      const response = await adminShareApi.getShareDetail(auth.token, share.id);
      setShareDetail(response);
    } catch (error) {
      console.error('Failed to fetch share detail:', error);
      setShareDetail(null);
    } finally {
      setLoading((prev) => ({ ...prev, detail: false }));
    }
  }, [auth.token]);

  // 공유된 파일 목록 조회
  const fetchSharedFiles = useCallback(async () => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, files: true }));
    try {
      const response = await adminShareApi.getSharedFiles(auth.token);
      setSharedFiles(response.items);
    } catch (error) {
      console.error('Failed to fetch shared files:', error);
    } finally {
      setLoading((prev) => ({ ...prev, files: false }));
    }
  }, [auth.token]);

  // 특정 파일의 공유 목록 조회
  const fetchFileShares = useCallback(async (file: SharedFile) => {
    if (!auth.token) return;
    setSelectedFile(file);
    setLoading((prev) => ({ ...prev, fileShares: true }));
    try {
      const response = await adminShareApi.getFileShares(auth.token, file.fileId);
      setFileShares(response.items);
    } catch (error) {
      console.error('Failed to fetch file shares:', error);
      setFileShares([]);
    } finally {
      setLoading((prev) => ({ ...prev, fileShares: false }));
    }
  }, [auth.token]);

  // 공유 차단
  const handleBlockShare = async (shareId: string) => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await adminShareApi.blockShare(auth.token, shareId);
      // 목록 새로고침
      if (viewMode === 'shares') {
        fetchShares();
      } else if (selectedFile) {
        fetchFileShares(selectedFile);
      }
    } catch (error) {
      console.error('Failed to block share:', error);
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  // 차단 해제
  const handleUnblockShare = async (shareId: string) => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await adminShareApi.unblockShare(auth.token, shareId);
      // 목록 새로고침
      if (viewMode === 'shares') {
        fetchShares();
      } else if (selectedFile) {
        fetchFileShares(selectedFile);
      }
    } catch (error) {
      console.error('Failed to unblock share:', error);
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  // 파일의 모든 공유 일괄 차단
  const handleBlockAllFileShares = async (fileId: string) => {
    if (!auth.token) return;
    if (!confirm('이 파일의 모든 공유를 차단하시겠습니까?')) return;
    
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await adminShareApi.blockAllFileShares(auth.token, fileId);
      fetchSharedFiles();
      if (selectedFile?.fileId === fileId) {
        fetchFileShares(selectedFile);
      }
    } catch (error) {
      console.error('Failed to block all file shares:', error);
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  if (!auth.isAuthenticated) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <p className="text-yellow-800">상단 헤더에서 SSO 로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">510.관리자-공유</h2>
          <p className="text-sm text-gray-500">공유 목록 관리 및 차단/해제</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => { setViewMode('shares'); fetchShares(); }}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              viewMode === 'shares' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            공유 목록
          </button>
          <button
            onClick={() => { setViewMode('files'); fetchSharedFiles(); }}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              viewMode === 'files' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            파일별 보기
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Left: List */}
        <div className="col-span-4 space-y-4">
          {viewMode === 'shares' ? (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">전체 공유 목록</h3>
                <button
                  onClick={fetchShares}
                  disabled={loading.shares}
                  className="text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50"
                >
                  {loading.shares ? '조회 중...' : '새로고침'}
                </button>
              </div>
              <div className="max-h-[calc(100vh-380px)] overflow-y-auto space-y-2">
                {shares.length > 0 ? shares.map((share) => (
                  <div
                    key={share.id}
                    onClick={() => fetchShareDetail(share)}
                    className={`p-3 rounded border cursor-pointer transition-colors ${
                      selectedShare?.id === share.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate">{share.fileName}</span>
                      {share.isBlocked && (
                        <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">차단</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {share.externalUserName} | 조회 {share.viewCount} | 다운로드 {share.downloadCount}
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-gray-400 text-center py-4">
                    {loading.shares ? '로딩 중...' : '새로고침을 클릭하세요'}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">공유된 파일 목록</h3>
                <button
                  onClick={fetchSharedFiles}
                  disabled={loading.files}
                  className="text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50"
                >
                  {loading.files ? '조회 중...' : '새로고침'}
                </button>
              </div>
              <div className="max-h-[calc(100vh-380px)] overflow-y-auto space-y-2">
                {sharedFiles.length > 0 ? sharedFiles.map((file) => (
                  <div
                    key={file.fileId}
                    onClick={() => fetchFileShares(file)}
                    className={`p-3 rounded border cursor-pointer transition-colors ${
                      selectedFile?.fileId === file.fileId
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-sm truncate">{file.fileName}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      총 {file.shareCount}개 공유 | 활성 {file.activeShareCount} | 차단 {file.blockedShareCount}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleBlockAllFileShares(file.fileId); }}
                      disabled={loading.action}
                      className="mt-2 text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
                    >
                      전체 차단
                    </button>
                  </div>
                )) : (
                  <p className="text-sm text-gray-400 text-center py-4">
                    {loading.files ? '로딩 중...' : '새로고침을 클릭하세요'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Middle: Detail */}
        <div className="col-span-4">
          {viewMode === 'shares' && shareDetail ? (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-medium text-gray-900 mb-3">공유 상세</h3>
              {loading.detail ? (
                <p className="text-sm text-gray-400">로딩 중...</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">파일명</label>
                    <p className="text-sm font-medium">{shareDetail.fileName}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">생성자</label>
                    <p className="text-sm">{shareDetail.creatorName}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">외부 사용자</label>
                    <p className="text-sm">{shareDetail.externalUserName}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">권한</label>
                    <p className="text-sm">{shareDetail.permissions.join(', ')}</p>
                  </div>
                  <div className="flex space-x-4">
                    <div>
                      <label className="text-xs text-gray-500">조회</label>
                      <p className="text-sm">{shareDetail.viewCount}회</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">다운로드</label>
                      <p className="text-sm">{shareDetail.downloadCount}회</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">만료일</label>
                    <p className="text-sm">{shareDetail.expiresAt ? new Date(shareDetail.expiresAt).toLocaleString() : '없음'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">상태</label>
                    <p className="text-sm">
                      {shareDetail.isBlocked ? (
                        <span className="text-red-600">차단됨</span>
                      ) : (
                        <span className="text-green-600">활성</span>
                      )}
                    </p>
                  </div>
                  <div className="pt-3 border-t">
                    {shareDetail.isBlocked ? (
                      <button
                        onClick={() => handleUnblockShare(shareDetail.id)}
                        disabled={loading.action}
                        className="px-3 py-1.5 text-sm bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-50"
                      >
                        차단 해제
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBlockShare(shareDetail.id)}
                        disabled={loading.action}
                        className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-50"
                      >
                        차단
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : viewMode === 'files' && selectedFile ? (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-medium text-gray-900 mb-3">{selectedFile.fileName}의 공유</h3>
              {loading.fileShares ? (
                <p className="text-sm text-gray-400">로딩 중...</p>
              ) : (
                <div className="max-h-[calc(100vh-380px)] overflow-y-auto space-y-2">
                  {fileShares.map((share) => (
                    <div key={share.id} className="p-3 border border-gray-200 rounded">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{share.externalUserName}</span>
                        {share.isBlocked ? (
                          <button
                            onClick={() => handleUnblockShare(share.id)}
                            disabled={loading.action}
                            className="text-xs text-green-500 hover:text-green-600 disabled:opacity-50"
                          >
                            해제
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBlockShare(share.id)}
                            disabled={loading.action}
                            className="text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
                          >
                            차단
                          </button>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {share.permissions.join(', ')} | 조회 {share.viewCount} | 다운로드 {share.downloadCount}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-400 text-center">항목을 선택하세요</p>
            </div>
          )}
        </div>

        {/* Right: API Log */}
        <div className="col-span-4">
          <div className="h-[calc(100vh-280px)]">
            <ResultLog logs={logs} onClear={() => setLogs([])} />
          </div>
        </div>
      </div>
    </div>
  );
}
