/**
 * SharePage - 600.외부공유 파일 공유 생성
 */
import { useState, useEffect, useCallback } from 'react';
import { useInternalAuth } from '../hooks/useInternalAuth';
import { fileShareApi, setAdminLogCallback } from '../api/adminApi';
import { ResultLog } from '../components/ResultLog';
import type {
  FileShare,
  AvailableExternalUser,
  CreateFileShareDto,
  AdminApiLogEntry,
} from '../types/admin.types';
import type { ApiLogEntry } from '../types/api.types';

export function SharePage() {
  const { auth } = useInternalAuth();
  
  // 공유 목록
  const [shares, setShares] = useState<FileShare[]>([]);
  const [selectedShare, setSelectedShare] = useState<FileShare | null>(null);
  
  // 외부 사용자 목록
  const [externalUsers, setExternalUsers] = useState<AvailableExternalUser[]>([]);
  
  // 공유 생성 폼
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<CreateFileShareDto>({
    fileId: '',
    externalUserId: '',
    permissions: ['VIEW'],
    expiresAt: '',
    maxViewCount: undefined,
    maxDownloadCount: undefined,
  });
  
  // 로딩 상태
  const [loading, setLoading] = useState({
    shares: false,
    users: false,
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

  // 내 공유 목록 조회
  const fetchMyShares = useCallback(async () => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, shares: true }));
    try {
      const response = await fileShareApi.getMyShares(auth.token);
      setShares(response.items);
    } catch (error) {
      console.error('Failed to fetch shares:', error);
    } finally {
      setLoading((prev) => ({ ...prev, shares: false }));
    }
  }, [auth.token]);

  // 공유 가능한 외부 사용자 목록 조회
  const fetchExternalUsers = useCallback(async () => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, users: true }));
    try {
      const response = await fileShareApi.getAvailableExternalUsers(auth.token);
      setExternalUsers(response.items);
    } catch (error) {
      console.error('Failed to fetch external users:', error);
    } finally {
      setLoading((prev) => ({ ...prev, users: false }));
    }
  }, [auth.token]);

  // 공유 생성
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.token) return;
    
    const createData: CreateFileShareDto = {
      fileId: formData.fileId,
      externalUserId: formData.externalUserId,
      permissions: formData.permissions,
      expiresAt: formData.expiresAt || undefined,
      maxViewCount: formData.maxViewCount || undefined,
      maxDownloadCount: formData.maxDownloadCount || undefined,
    };
    
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await fileShareApi.create(auth.token, createData);
      setShowCreateForm(false);
      setFormData({
        fileId: '',
        externalUserId: '',
        permissions: ['VIEW'],
        expiresAt: '',
        maxViewCount: undefined,
        maxDownloadCount: undefined,
      });
      fetchMyShares();
    } catch (error) {
      console.error('Failed to create share:', error);
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  // 공유 취소
  const handleDelete = async (shareId: string) => {
    if (!auth.token) return;
    if (!confirm('이 공유를 취소하시겠습니까?')) return;
    
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await fileShareApi.delete(auth.token, shareId);
      if (selectedShare?.id === shareId) {
        setSelectedShare(null);
      }
      fetchMyShares();
    } catch (error) {
      console.error('Failed to delete share:', error);
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  // 권한 토글
  const togglePermission = (permission: 'VIEW' | 'DOWNLOAD') => {
    setFormData((prev) => {
      const permissions = prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission];
      return { ...prev, permissions: permissions as ('VIEW' | 'DOWNLOAD')[] };
    });
  };

  // 공유 생성 폼 열기
  const openCreateForm = () => {
    fetchExternalUsers();
    setShowCreateForm(true);
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
          <h2 className="text-lg font-semibold text-gray-900">600.외부공유</h2>
          <p className="text-sm text-gray-500">파일 외부 공유 생성 및 관리</p>
        </div>
        <button
          onClick={openCreateForm}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
        >
          + 새 공유 생성
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Left: Share List */}
        <div className="col-span-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">내가 생성한 공유</h3>
              <button
                onClick={fetchMyShares}
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
                  onClick={() => setSelectedShare(share)}
                  className={`p-3 rounded border cursor-pointer transition-colors ${
                    selectedShare?.id === share.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-sm truncate">{share.fileName}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {share.externalUserName} | {share.permissions.join(', ')}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    조회 {share.viewCount}{share.maxViewCount ? `/${share.maxViewCount}` : ''} |
                    다운로드 {share.downloadCount}{share.maxDownloadCount ? `/${share.maxDownloadCount}` : ''}
                  </div>
                </div>
              )) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  {loading.shares ? '로딩 중...' : '새로고침을 클릭하세요'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Middle: Detail or Form */}
        <div className="col-span-4">
          {showCreateForm ? (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-medium text-gray-900 mb-3">새 공유 생성</h3>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">파일 ID *</label>
                  <input
                    type="text"
                    value={formData.fileId}
                    onChange={(e) => setFormData({ ...formData, fileId: e.target.value })}
                    placeholder="공유할 파일의 UUID"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">외부 사용자 *</label>
                  <select
                    value={formData.externalUserId}
                    onChange={(e) => setFormData({ ...formData, externalUserId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  >
                    <option value="">선택하세요</option>
                    {externalUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} (@{user.username}) - {user.company || user.email}
                      </option>
                    ))}
                  </select>
                  {loading.users && <p className="text-xs text-gray-400 mt-1">사용자 목록 로딩 중...</p>}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">권한 *</label>
                  <div className="flex space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes('VIEW')}
                        onChange={() => togglePermission('VIEW')}
                        className="rounded"
                      />
                      <span className="text-sm">조회</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes('DOWNLOAD')}
                        onChange={() => togglePermission('DOWNLOAD')}
                        className="rounded"
                      />
                      <span className="text-sm">다운로드</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">만료일시</label>
                  <input
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">최대 조회 횟수</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.maxViewCount || ''}
                      onChange={(e) => setFormData({ ...formData, maxViewCount: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="무제한"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">최대 다운로드 횟수</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.maxDownloadCount || ''}
                      onChange={(e) => setFormData({ ...formData, maxDownloadCount: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="무제한"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex space-x-2 pt-2">
                  <button
                    type="submit"
                    disabled={loading.action || formData.permissions.length === 0}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm disabled:opacity-50"
                  >
                    {loading.action ? '생성 중...' : '공유 생성'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm"
                  >
                    취소
                  </button>
                </div>
              </form>
            </div>
          ) : selectedShare ? (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-medium text-gray-900 mb-3">공유 상세</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">파일명</label>
                  <p className="text-sm font-medium">{selectedShare.fileName}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">외부 사용자</label>
                  <p className="text-sm">{selectedShare.externalUserName}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">권한</label>
                  <p className="text-sm">{selectedShare.permissions.join(', ')}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">조회</label>
                    <p className="text-sm">
                      {selectedShare.viewCount}
                      {selectedShare.maxViewCount ? ` / ${selectedShare.maxViewCount}` : ''}회
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">다운로드</label>
                    <p className="text-sm">
                      {selectedShare.downloadCount}
                      {selectedShare.maxDownloadCount ? ` / ${selectedShare.maxDownloadCount}` : ''}회
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">만료일</label>
                  <p className="text-sm">
                    {selectedShare.expiresAt ? new Date(selectedShare.expiresAt).toLocaleString() : '없음'}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">생성일</label>
                  <p className="text-sm">{new Date(selectedShare.createdAt).toLocaleString()}</p>
                </div>
                <div className="pt-3 border-t">
                  <button
                    onClick={() => handleDelete(selectedShare.id)}
                    disabled={loading.action}
                    className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-50"
                  >
                    공유 취소
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-400 text-center">공유를 선택하거나 새 공유를 생성하세요</p>
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
