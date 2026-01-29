/**
 * AdminPage - 관리자 대시보드
 * 100.인증, 200.파일, 210.폴더, 220.휴지통, 300.사용자, 310.역할, 500.관리자
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useInternalAuth } from '../hooks/useInternalAuth';
import { useMultipartUpload } from '../hooks/useMultipartUpload';
import { adminSystemApi, setAdminLogCallback } from '../api/adminApi';
import { fileApi, setFileLogCallback } from '../api/fileApi';
import { folderApi, setFolderLogCallback } from '../api/folderApi';
import { trashApi, setTrashLogCallback } from '../api/trashApi';
import { userApi, setUserLogCallback } from '../api/userApi';
import { roleApi, setRoleLogCallback } from '../api/roleApi';
import { ResultLog } from '../components/ResultLog';
import { FileUploadManager } from '../components/FileUploadManager';
import type {
  CacheHealthResponse,
  NasHealthResponse,
  StorageConsistencyResponse,
  SyncEvent,
  AdminApiLogEntry,
} from '../types/admin.types';
import type {
  FolderInfoResponse,
  FolderContentsResponse,
  TrashListResponse,
  FileListItemInFolder,
  FolderListItem,
} from '../types/file.types';
import type {
  UserWithEmployee,
  Role,
  SyncResult,
} from '../types/user.types';
import type { ApiLogEntry } from '../types/api.types';

type TabType = 'system' | 'file' | 'upload' | 'trash' | 'user' | 'role';

// 모달 타입
type ModalType = 
  | 'none'
  | 'createFolder'
  | 'renameFolder'
  | 'moveFolder'
  | 'renameFile'
  | 'moveFile'
  | 'fileInfo';

export function AdminPage() {
  const { auth } = useInternalAuth();
  const [activeTab, setActiveTab] = useState<TabType>('system');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  // ============================================
  // 멀티파트 업로드 훅
  // ============================================
  const {
    uploadFiles,
    addFiles,
    removeFile,
    startUpload,
    cancelUpload,
    cancelAll,
    clearCompleted,
    isUploading,
  } = useMultipartUpload();

  // ============================================
  // 모달 상태
  // ============================================
  const [modalType, setModalType] = useState<ModalType>('none');
  const [modalInput, setModalInput] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<FolderListItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileListItemInFolder | null>(null);
  const [targetFolderId, setTargetFolderId] = useState('');

  // ============================================
  // 500.관리자 (System) 상태
  // ============================================
  const [cacheHealth, setCacheHealth] = useState<CacheHealthResponse | null>(null);
  const [nasHealth, setNasHealth] = useState<NasHealthResponse | null>(null);
  const [storageConsistency, setStorageConsistency] = useState<StorageConsistencyResponse | null>(null);
  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>([]);

  // ============================================
  // 200.파일 & 210.폴더 상태
  // ============================================
  const [currentFolder, setCurrentFolder] = useState<FolderInfoResponse | null>(null);
  const [folderContents, setFolderContents] = useState<FolderContentsResponse | null>(null);

  // ============================================
  // 220.휴지통 상태
  // ============================================
  const [trashList, setTrashList] = useState<TrashListResponse | null>(null);

  // ============================================
  // 300.사용자 상태
  // ============================================
  const [users, setUsers] = useState<UserWithEmployee[]>([]);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // ============================================
  // 310.역할 상태
  // ============================================
  const [roles, setRoles] = useState<Role[]>([]);

  // 로딩 상태
  const [loading, setLoading] = useState({
    cache: false,
    nas: false,
    storage: false,
    sync: false,
    folder: false,
    trash: false,
    users: false,
    roles: false,
    userSync: false,
    upload: false,
    action: false,
  });

  // API 로그
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);

  // 로그 콜백 핸들러
  const handleLogCallback = useCallback((log: AdminApiLogEntry) => {
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
  }, []);

  // 로그 콜백 설정
  useEffect(() => {
    setAdminLogCallback(handleLogCallback);
    setFileLogCallback(handleLogCallback);
    setFolderLogCallback(handleLogCallback);
    setTrashLogCallback(handleLogCallback);
    setUserLogCallback(handleLogCallback);
    setRoleLogCallback(handleLogCallback);
    return () => {
      setAdminLogCallback(null);
      setFileLogCallback(null);
      setFolderLogCallback(null);
      setTrashLogCallback(null);
      setUserLogCallback(null);
      setRoleLogCallback(null);
    };
  }, [handleLogCallback]);

  // ============================================
  // 500.관리자 API 호출
  // ============================================
  const fetchCacheHealth = useCallback(async () => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, cache: true }));
    try {
      const response = await adminSystemApi.getCacheHealth(auth.token);
      setCacheHealth(response);
    } catch (error) {
      console.error('Failed to fetch cache health:', error);
      setCacheHealth({ status: 'unhealthy', connected: false, error: 'Failed to fetch' });
    } finally {
      setLoading((prev) => ({ ...prev, cache: false }));
    }
  }, [auth.token]);

  const fetchNasHealth = useCallback(async () => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, nas: true }));
    try {
      const response = await adminSystemApi.getNasHealth(auth.token);
      setNasHealth(response);
    } catch (error) {
      console.error('Failed to fetch NAS health:', error);
      setNasHealth({ status: 'unhealthy', connected: false, error: 'Failed to fetch' });
    } finally {
      setLoading((prev) => ({ ...prev, nas: false }));
    }
  }, [auth.token]);

  const fetchStorageConsistency = useCallback(async () => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, storage: true }));
    try {
      const response = await adminSystemApi.getStorageConsistency(auth.token);
      setStorageConsistency(response);
    } catch (error) {
      console.error('Failed to fetch storage consistency:', error);
    } finally {
      setLoading((prev) => ({ ...prev, storage: false }));
    }
  }, [auth.token]);

  const fetchSyncEvents = useCallback(async () => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, sync: true }));
    try {
      const response = await adminSystemApi.getSyncEvents(auth.token);
      setSyncEvents(response.items);
    } catch (error) {
      console.error('Failed to fetch sync events:', error);
    } finally {
      setLoading((prev) => ({ ...prev, sync: false }));
    }
  }, [auth.token]);

  // ============================================
  // 210.폴더 API 호출
  // ============================================
  const fetchRootFolder = useCallback(async () => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, folder: true }));
    try {
      const rootFolder = await folderApi.getRoot(auth.token);
      setCurrentFolder(rootFolder);
      const contents = await folderApi.getContents(auth.token, rootFolder.id);
      setFolderContents(contents);
    } catch (error) {
      console.error('Failed to fetch root folder:', error);
    } finally {
      setLoading((prev) => ({ ...prev, folder: false }));
    }
  }, [auth.token]);

  const navigateToFolder = useCallback(async (folderId: string) => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, folder: true }));
    try {
      const folderInfo = await folderApi.getInfo(auth.token, folderId);
      setCurrentFolder(folderInfo);
      const contents = await folderApi.getContents(auth.token, folderId);
      setFolderContents(contents);
    } catch (error) {
      console.error('Failed to navigate to folder:', error);
    } finally {
      setLoading((prev) => ({ ...prev, folder: false }));
    }
  }, [auth.token]);

  const refreshCurrentFolder = useCallback(async () => {
    if (!auth.token || !currentFolder) return;
    await navigateToFolder(currentFolder.id);
  }, [auth.token, currentFolder, navigateToFolder]);

  // ============================================
  // 200.파일 API 호출
  // ============================================
  const handleFileUpload = useCallback(async (files: FileList) => {
    if (!auth.token || !currentFolder) return;
    setLoading((prev) => ({ ...prev, upload: true }));
    try {
      if (files.length === 1) {
        await fileApi.upload(auth.token, files[0], currentFolder.id);
      } else {
        await fileApi.uploadMany(auth.token, Array.from(files), currentFolder.id);
      }
      await refreshCurrentFolder();
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('파일 업로드에 실패했습니다.');
    } finally {
      setLoading((prev) => ({ ...prev, upload: false }));
    }
  }, [auth.token, currentFolder, refreshCurrentFolder]);

  const handleFileDownload = useCallback(async (fileId: string, fileName: string) => {
    if (!auth.token) return;
    try {
      const { blob, filename } = await fileApi.download(auth.token, fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download file:', error);
      alert('파일 다운로드에 실패했습니다.');
    }
  }, [auth.token]);

  const handleFileRename = useCallback(async () => {
    if (!auth.token || !selectedFile || !modalInput.trim()) return;
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await fileApi.rename(auth.token, selectedFile.id, { newName: modalInput.trim() });
      setModalType('none');
      setSelectedFile(null);
      setModalInput('');
      await refreshCurrentFolder();
    } catch (error) {
      console.error('Failed to rename file:', error);
      alert('파일 이름 변경에 실패했습니다.');
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  }, [auth.token, selectedFile, modalInput, refreshCurrentFolder]);

  const handleFileMove = useCallback(async () => {
    if (!auth.token || !selectedFile || !targetFolderId.trim()) return;
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await fileApi.move(auth.token, selectedFile.id, { targetFolderId: targetFolderId.trim() });
      setModalType('none');
      setSelectedFile(null);
      setTargetFolderId('');
      await refreshCurrentFolder();
    } catch (error) {
      console.error('Failed to move file:', error);
      alert('파일 이동에 실패했습니다.');
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  }, [auth.token, selectedFile, targetFolderId, refreshCurrentFolder]);

  const handleFileDelete = useCallback(async (fileId: string, fileName: string) => {
    if (!auth.token) return;
    if (!confirm(`"${fileName}" 파일을 휴지통으로 이동하시겠습니까?`)) return;
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await fileApi.delete(auth.token, fileId);
      await refreshCurrentFolder();
    } catch (error) {
      console.error('Failed to delete file:', error);
      alert('파일 삭제에 실패했습니다.');
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  }, [auth.token, refreshCurrentFolder]);

  const handleGetFileInfo = useCallback(async (fileId: string) => {
    if (!auth.token) return;
    try {
      const info = await fileApi.getInfo(auth.token, fileId);
      alert(JSON.stringify(info, null, 2));
    } catch (error) {
      console.error('Failed to get file info:', error);
    }
  }, [auth.token]);

  // ============================================
  // 210.폴더 생성/수정 API 호출
  // ============================================
  const handleCreateFolder = useCallback(async () => {
    if (!auth.token || !currentFolder || !modalInput.trim()) return;
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await folderApi.create(auth.token, {
        name: modalInput.trim(),
        parentId: currentFolder.id,
      });
      setModalType('none');
      setModalInput('');
      await refreshCurrentFolder();
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('폴더 생성에 실패했습니다.');
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  }, [auth.token, currentFolder, modalInput, refreshCurrentFolder]);

  const handleFolderRename = useCallback(async () => {
    if (!auth.token || !selectedFolder || !modalInput.trim()) return;
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await folderApi.rename(auth.token, selectedFolder.id, { newName: modalInput.trim() });
      setModalType('none');
      setSelectedFolder(null);
      setModalInput('');
      await refreshCurrentFolder();
    } catch (error) {
      console.error('Failed to rename folder:', error);
      alert('폴더 이름 변경에 실패했습니다.');
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  }, [auth.token, selectedFolder, modalInput, refreshCurrentFolder]);

  const handleFolderMove = useCallback(async () => {
    if (!auth.token || !selectedFolder || !targetFolderId.trim()) return;
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await folderApi.move(auth.token, selectedFolder.id, { targetParentId: targetFolderId.trim() });
      setModalType('none');
      setSelectedFolder(null);
      setTargetFolderId('');
      await refreshCurrentFolder();
    } catch (error) {
      console.error('Failed to move folder:', error);
      alert('폴더 이동에 실패했습니다.');
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  }, [auth.token, selectedFolder, targetFolderId, refreshCurrentFolder]);

  // ============================================
  // 220.휴지통 API 호출
  // ============================================
  const fetchTrashList = useCallback(async () => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, trash: true }));
    try {
      const response = await trashApi.getList(auth.token);
      setTrashList(response);
    } catch (error) {
      console.error('Failed to fetch trash list:', error);
    } finally {
      setLoading((prev) => ({ ...prev, trash: false }));
    }
  }, [auth.token]);

  const handleEmptyTrash = useCallback(async () => {
    if (!auth.token) return;
    if (!confirm('휴지통을 비우시겠습니까? 모든 파일이 영구 삭제됩니다.')) return;
    try {
      await trashApi.emptyTrash(auth.token);
      await fetchTrashList();
    } catch (error) {
      console.error('Failed to empty trash:', error);
    }
  }, [auth.token, fetchTrashList]);

  const handlePurgeFile = useCallback(async (trashMetadataId: string, fileName: string) => {
    if (!auth.token) return;
    if (!confirm(`"${fileName}" 파일을 영구 삭제하시겠습니까?`)) return;
    try {
      await trashApi.purgeFile(auth.token, trashMetadataId);
      await fetchTrashList();
    } catch (error) {
      console.error('Failed to purge file:', error);
    }
  }, [auth.token, fetchTrashList]);

  const handleRestorePreview = useCallback(async (trashMetadataIds: string[]) => {
    if (!auth.token) return;
    try {
      const preview = await trashApi.previewRestore(auth.token, { trashMetadataIds });
      alert(JSON.stringify(preview, null, 2));
    } catch (error) {
      console.error('Failed to preview restore:', error);
    }
  }, [auth.token]);

  // ============================================
  // 300.사용자 API 호출
  // ============================================
  const fetchUsers = useCallback(async () => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, users: true }));
    try {
      const response = await userApi.getAll(auth.token);
      setUsers(response);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading((prev) => ({ ...prev, users: false }));
    }
  }, [auth.token]);

  const handleUserSync = useCallback(async () => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, userSync: true }));
    try {
      const result = await userApi.sync(auth.token);
      setSyncResult(result);
      await fetchUsers();
    } catch (error) {
      console.error('Failed to sync users:', error);
    } finally {
      setLoading((prev) => ({ ...prev, userSync: false }));
    }
  }, [auth.token, fetchUsers]);

  // ============================================
  // 310.역할 API 호출
  // ============================================
  const fetchRoles = useCallback(async () => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, roles: true }));
    try {
      const response = await roleApi.getAll(auth.token);
      setRoles(response);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    } finally {
      setLoading((prev) => ({ ...prev, roles: false }));
    }
  }, [auth.token]);

  // 바이트를 GB로 변환
  const formatBytes = (bytes?: number) => {
    if (bytes === undefined) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // 모달 닫기
  const closeModal = () => {
    setModalType('none');
    setModalInput('');
    setSelectedFolder(null);
    setSelectedFile(null);
    setTargetFolderId('');
  };

  if (!auth.isAuthenticated) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <p className="text-yellow-800">상단 헤더에서 SSO 로그인이 필요합니다.</p>
      </div>
    );
  }

  // 탭 버튼 렌더링
  const renderTabButton = (tab: TabType, label: string) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
        activeTab === tab
          ? 'bg-white text-blue-600 border-t border-l border-r border-gray-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">관리자 대시보드</h2>
          <p className="text-sm text-gray-500">시스템 상태 및 관리 기능</p>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex space-x-1 border-b border-gray-200">
        {renderTabButton('system', '500.시스템')}
        {renderTabButton('file', '200.파일/210.폴더')}
        {renderTabButton('upload', '201.대용량 업로드')}
        {renderTabButton('trash', '220.휴지통')}
        {renderTabButton('user', '300.사용자')}
        {renderTabButton('role', '310.역할')}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Left: Content */}
        <div className="col-span-8 space-y-4">
          {/* 500.시스템 탭 */}
          {activeTab === 'system' && (
            <>
              {/* Cache Health */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">캐시 스토리지 상태</h3>
                  <button
                    onClick={fetchCacheHealth}
                    disabled={loading.cache}
                    className="text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50"
                  >
                    {loading.cache ? '조회 중...' : '조회'}
                  </button>
                </div>
                {cacheHealth ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className={`w-3 h-3 rounded-full ${cacheHealth.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm">{cacheHealth.status === 'healthy' ? '정상' : '오류'}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      연결: {cacheHealth.connected ? '연결됨' : '연결 안됨'}
                      {cacheHealth.latencyMs !== undefined && ` | 지연: ${cacheHealth.latencyMs}ms`}
                    </div>
                    {cacheHealth.error && <div className="text-sm text-red-500">{cacheHealth.error}</div>}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">조회 버튼을 클릭하세요</p>
                )}
              </div>

              {/* NAS Health */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">NAS 스토리지 상태</h3>
                  <button
                    onClick={fetchNasHealth}
                    disabled={loading.nas}
                    className="text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50"
                  >
                    {loading.nas ? '조회 중...' : '조회'}
                  </button>
                </div>
                {nasHealth ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className={`w-3 h-3 rounded-full ${nasHealth.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm">{nasHealth.status === 'healthy' ? '정상' : '오류'}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      연결: {nasHealth.connected ? '연결됨' : '연결 안됨'}
                    </div>
                    {nasHealth.totalSpace !== undefined && (
                      <div className="text-sm text-gray-500">
                        전체: {formatBytes(nasHealth.totalSpace)} |
                        사용: {formatBytes(nasHealth.usedSpace)} |
                        여유: {formatBytes(nasHealth.freeSpace)} |
                        사용률: {nasHealth.usagePercent?.toFixed(1)}%
                      </div>
                    )}
                    {nasHealth.error && <div className="text-sm text-red-500">{nasHealth.error}</div>}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">조회 버튼을 클릭하세요</p>
                )}
              </div>

              {/* Storage Consistency */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">스토리지 일관성</h3>
                  <button
                    onClick={fetchStorageConsistency}
                    disabled={loading.storage}
                    className="text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50"
                  >
                    {loading.storage ? '검증 중...' : '검증'}
                  </button>
                </div>
                {storageConsistency ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className={`w-3 h-3 rounded-full ${storageConsistency.consistent ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      <span className="text-sm">{storageConsistency.consistent ? '일관성 유지됨' : '불일치 발견'}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      전체 파일: {storageConsistency.totalFiles}개 |
                      NAS 누락: {storageConsistency.missingInNas}개 |
                      DB 누락: {storageConsistency.missingInDb}개
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">검증 버튼을 클릭하세요</p>
                )}
              </div>

              {/* Sync Events */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">동기화 이벤트</h3>
                  <button
                    onClick={fetchSyncEvents}
                    disabled={loading.sync}
                    className="text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50"
                  >
                    {loading.sync ? '조회 중...' : '조회'}
                  </button>
                </div>
                {syncEvents.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">ID</th>
                          <th className="text-left py-2 px-2">타입</th>
                          <th className="text-left py-2 px-2">상태</th>
                          <th className="text-left py-2 px-2">생성일</th>
                        </tr>
                      </thead>
                      <tbody>
                        {syncEvents.slice(0, 10).map((event) => (
                          <tr key={event.id} className="border-b hover:bg-gray-50">
                            <td className="py-2 px-2 font-mono text-xs">{event.id.slice(0, 8)}...</td>
                            <td className="py-2 px-2">{event.type}</td>
                            <td className="py-2 px-2">
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                event.status === 'completed' ? 'bg-green-100 text-green-800' :
                                event.status === 'failed' ? 'bg-red-100 text-red-800' :
                                event.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {event.status}
                              </span>
                            </td>
                            <td className="py-2 px-2">{new Date(event.createdAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">조회 버튼을 클릭하세요</p>
                )}
              </div>
            </>
          )}

          {/* 200.파일/210.폴더 탭 */}
          {activeTab === 'file' && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">파일 탐색기</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={fetchRootFolder}
                    disabled={loading.folder}
                    className="text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50"
                  >
                    {loading.folder ? '로딩 중...' : '루트 폴더 조회'}
                  </button>
                </div>
              </div>

              {/* Breadcrumbs */}
              {folderContents && (
                <div className="flex items-center space-x-2 mb-4 text-sm">
                  {folderContents.breadcrumbs.map((crumb, idx) => (
                    <span key={crumb.id} className="flex items-center">
                      {idx > 0 && <span className="mx-2 text-gray-400">/</span>}
                      <button
                        onClick={() => navigateToFolder(crumb.id)}
                        className="text-blue-500 hover:text-blue-600"
                      >
                        {crumb.name || 'Root'}
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Current Folder Info & Actions */}
              {currentFolder && (
                <div className="bg-gray-50 rounded p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <div className="font-medium">{currentFolder.name || 'Root'}</div>
                      <div className="text-gray-500">
                        경로: {currentFolder.path} |
                        폴더: {currentFolder.folderCount}개 |
                        파일: {currentFolder.fileCount}개 |
                        크기: {formatBytes(currentFolder.totalSize)}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      {/* 폴더 생성 */}
                      <button
                        onClick={() => {
                          setModalType('createFolder');
                          setModalInput('');
                        }}
                        className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded"
                      >
                        새 폴더
                      </button>
                      {/* 파일 업로드 */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading.upload}
                        className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded disabled:opacity-50"
                      >
                        {loading.upload ? '업로드 중...' : '파일 업로드'}
                      </button>
                      <button
                        onClick={() => multiFileInputRef.current?.click()}
                        disabled={loading.upload}
                        className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded disabled:opacity-50"
                      >
                        다중 업로드
                      </button>
                    </div>
                  </div>
                  {/* Hidden file inputs */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                  />
                  <input
                    ref={multiFileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                  />
                </div>
              )}

              {/* Folder Contents */}
              {folderContents ? (
                <div className="space-y-1">
                  {/* Folders */}
                  {folderContents.folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center p-2 rounded hover:bg-gray-50 group"
                    >
                      <span
                        className="flex items-center flex-1 cursor-pointer"
                        onClick={() => navigateToFolder(folder.id)}
                      >
                        <span className="text-yellow-500 mr-2">📁</span>
                        <span className="flex-1">{folder.name}</span>
                        <span className="text-sm text-gray-500 mr-4">
                          {folder.folderCount}폴더, {folder.fileCount}파일
                        </span>
                      </span>
                      {/* 폴더 액션 버튼 */}
                      <div className="hidden group-hover:flex space-x-1">
                        <button
                          onClick={() => {
                            setSelectedFolder(folder);
                            setModalInput(folder.name);
                            setModalType('renameFolder');
                          }}
                          className="px-2 py-1 text-xs bg-yellow-100 hover:bg-yellow-200 rounded"
                          title="이름 변경"
                        >
                          이름변경
                        </button>
                        <button
                          onClick={() => {
                            setSelectedFolder(folder);
                            setTargetFolderId('');
                            setModalType('moveFolder');
                          }}
                          className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded"
                          title="이동"
                        >
                          이동
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Files */}
                  {folderContents.files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center p-2 rounded hover:bg-gray-50 group"
                    >
                      <span className="text-blue-500 mr-2">📄</span>
                      <span className="flex-1">{file.name}</span>
                      <span className="text-sm text-gray-500 mr-4">{formatBytes(file.size)}</span>
                      {/* 파일 액션 버튼 */}
                      <div className="hidden group-hover:flex space-x-1">
                        <button
                          onClick={() => handleGetFileInfo(file.id)}
                          className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                          title="정보"
                        >
                          정보
                        </button>
                        <button
                          onClick={() => handleFileDownload(file.id, file.name)}
                          className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 rounded"
                          title="다운로드"
                        >
                          다운로드
                        </button>
                        <button
                          onClick={() => {
                            setSelectedFile(file);
                            setModalInput(file.name);
                            setModalType('renameFile');
                          }}
                          className="px-2 py-1 text-xs bg-yellow-100 hover:bg-yellow-200 rounded"
                          title="이름 변경"
                        >
                          이름변경
                        </button>
                        <button
                          onClick={() => {
                            setSelectedFile(file);
                            setTargetFolderId('');
                            setModalType('moveFile');
                          }}
                          className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded"
                          title="이동"
                        >
                          이동
                        </button>
                        <button
                          onClick={() => handleFileDelete(file.id, file.name)}
                          className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 rounded"
                          title="삭제"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}

                  {folderContents.folders.length === 0 && folderContents.files.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">빈 폴더입니다</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">루트 폴더 조회 버튼을 클릭하세요</p>
              )}
            </div>
          )}

          {/* 201.대용량 업로드 탭 */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              {/* 폴더 선택 */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">업로드 대상 폴더</h3>
                  <button
                    onClick={fetchRootFolder}
                    disabled={loading.folder}
                    className="text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50"
                  >
                    {loading.folder ? '로딩 중...' : '폴더 불러오기'}
                  </button>
                </div>
                
                {currentFolder ? (
                  <div className="bg-gray-50 rounded p-3">
                    <div className="flex items-center">
                      <span className="text-yellow-500 mr-2">📁</span>
                      <span className="font-medium">{currentFolder.name || 'Root'}</span>
                      <span className="text-sm text-gray-500 ml-2">({currentFolder.path})</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      폴더 ID: {currentFolder.id}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    "폴더 불러오기" 버튼을 클릭하여 업로드 대상 폴더를 선택하세요.
                  </p>
                )}
              </div>

              {/* 파일 업로드 매니저 */}
              <FileUploadManager
                uploadFiles={uploadFiles}
                onAddFiles={addFiles}
                onRemoveFile={removeFile}
                onCancelFile={(id) => auth.token && cancelUpload(id, auth.token)}
                onStartUpload={() => {
                  if (auth.token && currentFolder) {
                    startUpload(auth.token, currentFolder.id);
                  } else {
                    alert('로그인과 폴더 선택이 필요합니다.');
                  }
                }}
                onCancelAll={() => auth.token && cancelAll(auth.token)}
                onClearCompleted={clearCompleted}
                isUploading={isUploading}
                disabled={!auth.token || !currentFolder}
              />

              {/* 안내 */}
              <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
                <h4 className="font-medium mb-2">멀티파트 업로드 안내</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>100MB 이상의 파일은 자동으로 10MB 청크로 분할 업로드됩니다.</li>
                  <li>100MB 미만의 파일은 일반 업로드로 처리됩니다.</li>
                  <li>업로드 중 취소하거나 브라우저를 닫으면 세션이 만료됩니다 (24시간).</li>
                  <li>NAS 동기화는 업로드 완료 후 비동기로 진행됩니다.</li>
                </ul>
              </div>
            </div>
          )}

          {/* 220.휴지통 탭 */}
          {activeTab === 'trash' && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">휴지통</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={fetchTrashList}
                    disabled={loading.trash}
                    className="text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50"
                  >
                    {loading.trash ? '조회 중...' : '조회'}
                  </button>
                  {trashList && trashList.items.length > 0 && (
                    <button
                      onClick={handleEmptyTrash}
                      className="text-sm text-red-500 hover:text-red-600"
                    >
                      휴지통 비우기
                    </button>
                  )}
                </div>
              </div>

              {trashList ? (
                <>
                  <div className="bg-gray-50 rounded p-3 mb-4 text-sm">
                    <span>총 {trashList.totalCount}개 항목</span>
                    <span className="mx-2">|</span>
                    <span>총 크기: {formatBytes(trashList.totalSizeBytes)}</span>
                  </div>

                  {trashList.items.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2">파일명</th>
                            <th className="text-left py-2 px-2">크기</th>
                            <th className="text-left py-2 px-2">삭제일</th>
                            <th className="text-left py-2 px-2">만료일</th>
                            <th className="text-left py-2 px-2">상태</th>
                            <th className="text-left py-2 px-2">액션</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trashList.items.map((item) => (
                            <tr key={item.id} className="border-b hover:bg-gray-50">
                              <td className="py-2 px-2">{item.name}</td>
                              <td className="py-2 px-2">{formatBytes(item.sizeBytes)}</td>
                              <td className="py-2 px-2">{new Date(item.deletedAt).toLocaleDateString()}</td>
                              <td className="py-2 px-2">
                                {new Date(item.expiresAt).toLocaleDateString()}
                                <span className="text-xs text-gray-500 ml-1">
                                  ({item.daysUntilExpiry}일 남음)
                                </span>
                              </td>
                              <td className="py-2 px-2">
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  item.restoreInfo.pathStatus === 'AVAILABLE'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {item.restoreInfo.pathStatus === 'AVAILABLE' ? '복원 가능' : '경로 없음'}
                                </span>
                              </td>
                              <td className="py-2 px-2">
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() => handleRestorePreview([item.trashMetadataId])}
                                    className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 rounded"
                                  >
                                    복원 미리보기
                                  </button>
                                  <button
                                    onClick={() => handlePurgeFile(item.trashMetadataId, item.name)}
                                    className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 rounded"
                                  >
                                    영구삭제
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">휴지통이 비어있습니다</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400">조회 버튼을 클릭하세요</p>
              )}
            </div>
          )}

          {/* 300.사용자 탭 */}
          {activeTab === 'user' && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">사용자 관리</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={fetchUsers}
                    disabled={loading.users}
                    className="text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50"
                  >
                    {loading.users ? '조회 중...' : '조회'}
                  </button>
                  <button
                    onClick={handleUserSync}
                    disabled={loading.userSync}
                    className="text-sm text-green-500 hover:text-green-600 disabled:opacity-50"
                  >
                    {loading.userSync ? '동기화 중...' : 'Employee 동기화'}
                  </button>
                </div>
              </div>

              {/* Sync Result */}
              {syncResult && (
                <div className="bg-blue-50 rounded p-3 mb-4 text-sm">
                  <span className="font-medium">동기화 완료!</span>
                  <span className="mx-2">|</span>
                  <span>생성: {syncResult.created}</span>
                  <span className="mx-2">|</span>
                  <span>활성화: {syncResult.activated}</span>
                  <span className="mx-2">|</span>
                  <span>비활성화: {syncResult.deactivated}</span>
                  <span className="mx-2">|</span>
                  <span>처리시간: {syncResult.processingTimeMs}ms</span>
                </div>
              )}

              {users.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">사번</th>
                        <th className="text-left py-2 px-2">이름</th>
                        <th className="text-left py-2 px-2">이메일</th>
                        <th className="text-left py-2 px-2">상태</th>
                        <th className="text-left py-2 px-2">활성</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-2">{user.employee?.employeeNumber || '-'}</td>
                          <td className="py-2 px-2">{user.employee?.name || '-'}</td>
                          <td className="py-2 px-2">{user.employee?.email || '-'}</td>
                          <td className="py-2 px-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              user.employee?.status === '재직중' ? 'bg-green-100 text-green-800' :
                              user.employee?.status === '휴직' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {user.employee?.status || '-'}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            <span className={`w-2 h-2 rounded-full inline-block ${user.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-400">조회 버튼을 클릭하세요</p>
              )}
            </div>
          )}

          {/* 310.역할 탭 */}
          {activeTab === 'role' && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">역할 관리</h3>
                <button
                  onClick={fetchRoles}
                  disabled={loading.roles}
                  className="text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50"
                >
                  {loading.roles ? '조회 중...' : '조회'}
                </button>
              </div>

              {roles.length > 0 ? (
                <div className="space-y-3">
                  {roles.map((role) => (
                    <div key={role.id} className="border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{role.name}</span>
                        <span className="text-xs text-gray-500">ID: {role.id.slice(0, 8)}...</span>
                      </div>
                      {role.description && (
                        <p className="text-sm text-gray-500 mb-2">{role.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.map((perm) => (
                          <span
                            key={perm.code}
                            className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs"
                          >
                            {perm.code}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">조회 버튼을 클릭하세요</p>
              )}
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

      {/* 모달 */}
      {modalType !== 'none' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            {/* 폴더 생성 */}
            {modalType === 'createFolder' && (
              <>
                <h3 className="text-lg font-semibold mb-4">새 폴더 만들기</h3>
                <input
                  type="text"
                  value={modalInput}
                  onChange={(e) => setModalInput(e.target.value)}
                  placeholder="폴더 이름"
                  className="w-full border rounded px-3 py-2 mb-4"
                  autoFocus
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleCreateFolder}
                    disabled={loading.action || !modalInput.trim()}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-50"
                  >
                    {loading.action ? '생성 중...' : '생성'}
                  </button>
                </div>
              </>
            )}

            {/* 폴더 이름 변경 */}
            {modalType === 'renameFolder' && selectedFolder && (
              <>
                <h3 className="text-lg font-semibold mb-4">폴더 이름 변경</h3>
                <p className="text-sm text-gray-500 mb-2">현재: {selectedFolder.name}</p>
                <input
                  type="text"
                  value={modalInput}
                  onChange={(e) => setModalInput(e.target.value)}
                  placeholder="새 폴더 이름"
                  className="w-full border rounded px-3 py-2 mb-4"
                  autoFocus
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleFolderRename}
                    disabled={loading.action || !modalInput.trim()}
                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded disabled:opacity-50"
                  >
                    {loading.action ? '변경 중...' : '변경'}
                  </button>
                </div>
              </>
            )}

            {/* 폴더 이동 */}
            {modalType === 'moveFolder' && selectedFolder && (
              <>
                <h3 className="text-lg font-semibold mb-4">폴더 이동</h3>
                <p className="text-sm text-gray-500 mb-2">이동할 폴더: {selectedFolder.name}</p>
                <input
                  type="text"
                  value={targetFolderId}
                  onChange={(e) => setTargetFolderId(e.target.value)}
                  placeholder="대상 폴더 ID"
                  className="w-full border rounded px-3 py-2 mb-4"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mb-4">
                  폴더 ID는 폴더 탐색 시 API 로그에서 확인할 수 있습니다.
                </p>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleFolderMove}
                    disabled={loading.action || !targetFolderId.trim()}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50"
                  >
                    {loading.action ? '이동 중...' : '이동'}
                  </button>
                </div>
              </>
            )}

            {/* 파일 이름 변경 */}
            {modalType === 'renameFile' && selectedFile && (
              <>
                <h3 className="text-lg font-semibold mb-4">파일 이름 변경</h3>
                <p className="text-sm text-gray-500 mb-2">현재: {selectedFile.name}</p>
                <input
                  type="text"
                  value={modalInput}
                  onChange={(e) => setModalInput(e.target.value)}
                  placeholder="새 파일 이름"
                  className="w-full border rounded px-3 py-2 mb-4"
                  autoFocus
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleFileRename}
                    disabled={loading.action || !modalInput.trim()}
                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded disabled:opacity-50"
                  >
                    {loading.action ? '변경 중...' : '변경'}
                  </button>
                </div>
              </>
            )}

            {/* 파일 이동 */}
            {modalType === 'moveFile' && selectedFile && (
              <>
                <h3 className="text-lg font-semibold mb-4">파일 이동</h3>
                <p className="text-sm text-gray-500 mb-2">이동할 파일: {selectedFile.name}</p>
                <input
                  type="text"
                  value={targetFolderId}
                  onChange={(e) => setTargetFolderId(e.target.value)}
                  placeholder="대상 폴더 ID"
                  className="w-full border rounded px-3 py-2 mb-4"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mb-4">
                  폴더 ID는 폴더 탐색 시 API 로그에서 확인할 수 있습니다.
                </p>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleFileMove}
                    disabled={loading.action || !targetFolderId.trim()}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50"
                  >
                    {loading.action ? '이동 중...' : '이동'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
