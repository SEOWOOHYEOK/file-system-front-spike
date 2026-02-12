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
  SearchQuery,
  SearchResponse,
  SearchResultItem,
  SearchFileItem,
} from '../types/file.types';
import type {
  UserWithEmployee,
  Role,
  SyncResult,
  FavoriteResponse,
  FavoriteTargetType,
  RecentActivitiesResponse,
} from '../types/user.types';
import type { ApiLogEntry } from '../types/api.types';

type TabType = 'system' | 'file' | 'upload' | 'trash' | 'user' | 'role' | 'favorite';

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
    pauseUpload,
    resumeUpload,
    cancelUpload,
    cancelAll,
    clearCompleted,
    loadPendingSessions,
    getPendingSessions,
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

  // 이동 모달용 폴더 트리 상태
  interface FolderTreeNode {
    id: string;
    name: string;
    children: FolderTreeNode[] | null; // null = 아직 로드 안됨, [] = 하위 폴더 없음
    isExpanded: boolean;
    isLoading: boolean;
  }
  const [folderTree, setFolderTree] = useState<FolderTreeNode | null>(null);
  const [folderTreeLoading, setFolderTreeLoading] = useState(false);

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
  // 210.검색 상태
  // ============================================
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'file' | 'folder'>('all');
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);

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

  // ============================================
  // 310.즐겨찾기 상태
  // ============================================
  const [favorites, setFavorites] = useState<FavoriteResponse[]>([]);
  const [favoriteFilter, setFavoriteFilter] = useState<FavoriteTargetType | 'ALL'>('ALL');
  const [recentActivities, setRecentActivities] = useState<RecentActivitiesResponse | null>(null);

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
    search: false,
    favorites: false,
    activities: false,
  });

  // 미완료 세션 존재 여부
  const [hasPendingSessions, setHasPendingSessions] = useState(false);

  // 미완료 세션 확인
  useEffect(() => {
    const sessions = getPendingSessions();
    setHasPendingSessions(sessions.length > 0);
  }, [getPendingSessions]);

  // 미완료 세션 불러오기 핸들러
  const handleLoadPendingSessions = useCallback(async () => {
    if (!auth.token) return;
    await loadPendingSessions(auth.token);
    setHasPendingSessions(false);
  }, [auth.token, loadPendingSessions]);

  // 이어서 업로드 핸들러
  const handleResumeUpload = useCallback(async (id: string, file?: File) => {
    if (!auth.token) return;
    await resumeUpload(id, auth.token, file);
  }, [auth.token, resumeUpload]);

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
  // 210.검색 API 호출
  // ============================================
  const handleSearch = useCallback(async () => {
    if (!auth.token || !searchKeyword.trim() || searchKeyword.trim().length < 2) {
      alert('검색어는 최소 2자 이상 입력해주세요.');
      return;
    }
    setLoading((prev) => ({ ...prev, search: true }));
    try {
      const query: SearchQuery = {
        keyword: searchKeyword.trim(),
        type: searchType === 'all' ? undefined : searchType,
        pageSize: 50,
      };
      const response = await folderApi.search(auth.token, query);
      setSearchResults(response);
      setIsSearchMode(true);
    } catch (error) {
      console.error('Failed to search:', error);
      alert('검색에 실패했습니다.');
    } finally {
      setLoading((prev) => ({ ...prev, search: false }));
    }
  }, [auth.token, searchKeyword, searchType]);

  const clearSearch = useCallback(() => {
    setSearchKeyword('');
    setSearchResults(null);
    setIsSearchMode(false);
  }, []);

  const navigateToSearchResult = useCallback(async (item: SearchResultItem) => {
    if (!auth.token) return;
    // 검색 결과에서 해당 폴더로 이동
    if (item.type === 'folder') {
      await navigateToFolder(item.id);
    } else {
      // 파일인 경우 해당 파일이 속한 폴더로 이동
      await navigateToFolder(item.folderId);
    }
    clearSearch();
  }, [auth.token, navigateToFolder, clearSearch]);

  // ============================================
  // 이동 모달용 폴더 브라우저
  // ============================================
  // 폴더 트리 초기화 (루트 폴더 로드)
  const initFolderTree = useCallback(async () => {
    if (!auth.token) return;
    setFolderTreeLoading(true);
    try {
      const rootFolder = await folderApi.getRoot(auth.token);
      const contents = await folderApi.getContents(auth.token, rootFolder.id);
      const rootNode: FolderTreeNode = {
        id: rootFolder.id,
        name: 'root',
        children: contents.folders.map((f) => ({
          id: f.id,
          name: f.name,
          children: null,
          isExpanded: false,
          isLoading: false,
        })),
        isExpanded: true,
        isLoading: false,
      };
      setFolderTree(rootNode);
      setTargetFolderId(rootFolder.id);
    } catch (error) {
      console.error('Failed to init folder tree:', error);
    } finally {
      setFolderTreeLoading(false);
    }
  }, [auth.token]);

  // 트리에서 특정 노드 찾기 (재귀)
  const findNodeInTree = useCallback((node: FolderTreeNode, targetId: string): FolderTreeNode | null => {
    if (node.id === targetId) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNodeInTree(child, targetId);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // 트리 노드 업데이트 (재귀적으로 특정 노드 수정)
  const updateNodeInTree = useCallback((
    node: FolderTreeNode,
    targetId: string,
    updater: (n: FolderTreeNode) => FolderTreeNode
  ): FolderTreeNode => {
    if (node.id === targetId) {
      return updater(node);
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map((child) => updateNodeInTree(child, targetId, updater)),
      };
    }
    return node;
  }, []);

  // 폴더 확장/축소 토글
  const toggleFolderExpand = useCallback(async (folderId: string) => {
    if (!auth.token || !folderTree) return;

    const targetNode = findNodeInTree(folderTree, folderId);
    if (!targetNode) return;

    // 이미 확장된 경우 축소
    if (targetNode.isExpanded) {
      setFolderTree((prev) =>
        prev ? updateNodeInTree(prev, folderId, (n) => ({ ...n, isExpanded: false })) : null
      );
      return;
    }

    // 자식이 아직 로드되지 않은 경우 로드
    if (targetNode.children === null) {
      setFolderTree((prev) =>
        prev ? updateNodeInTree(prev, folderId, (n) => ({ ...n, isLoading: true })) : null
      );

      try {
        const contents = await folderApi.getContents(auth.token, folderId);
        const childNodes: FolderTreeNode[] = contents.folders.map((f) => ({
          id: f.id,
          name: f.name,
          children: null,
          isExpanded: false,
          isLoading: false,
        }));

        setFolderTree((prev) =>
          prev
            ? updateNodeInTree(prev, folderId, (n) => ({
                ...n,
                children: childNodes,
                isExpanded: true,
                isLoading: false,
              }))
            : null
        );
      } catch (error) {
        console.error('Failed to load folder children:', error);
        setFolderTree((prev) =>
          prev ? updateNodeInTree(prev, folderId, (n) => ({ ...n, isLoading: false })) : null
        );
      }
    } else {
      // 자식이 이미 로드된 경우 바로 확장
      setFolderTree((prev) =>
        prev ? updateNodeInTree(prev, folderId, (n) => ({ ...n, isExpanded: true })) : null
      );
    }
  }, [auth.token, folderTree, findNodeInTree, updateNodeInTree]);

  // 폴더 선택
  const selectTargetFolder = useCallback((folderId: string) => {
    setTargetFolderId(folderId);
  }, []);

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

  const handleFolderDelete = useCallback(async (folderId: string, folderName: string) => {
    if (!auth.token) return;
    if (!confirm(`"${folderName}" 폴더를 휴지통으로 이동하시겠습니까?`)) return;
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await folderApi.delete(auth.token, folderId);
      await refreshCurrentFolder();
    } catch (error) {
      console.error('Failed to delete folder:', error);
      // 서버 에러 메시지 추출
      let errorMessage = '폴더 삭제에 실패했습니다.';
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { message?: string; code?: string } } };
        if (axiosError.response?.data?.message) {
          errorMessage = axiosError.response.data.message;
        }
      }
      alert(errorMessage);
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  }, [auth.token, refreshCurrentFolder]);

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

  const handleRestoreExecute = useCallback(async (trashMetadataId: string, fileName: string) => {
    if (!auth.token) return;
    if (!confirm(`"${fileName}" 파일을 복원하시겠습니까?`)) return;
    try {
      const result = await trashApi.executeRestore(auth.token, {
        items: [{ trashMetadataId }],
      });
      if (result.queued > 0) {
        alert(`복원 요청 성공: ${result.queued}개 파일이 복원 대기열에 추가되었습니다.`);
      } else if (result.skipped > 0) {
        const skippedInfo = result.skippedItems.map(
          (item) => `${item.fileName}: ${item.reason === 'CONFLICT' ? '충돌' : '경로 없음'}`
        ).join('\n');
        alert(`복원 실패:\n${skippedInfo}`);
      }
      await fetchTrashList();
    } catch (error) {
      console.error('Failed to execute restore:', error);
      alert('복원 실행에 실패했습니다.');
    }
  }, [auth.token, fetchTrashList]);

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

  // ============================================
  // 310.즐겨찾기 API 호출
  // ============================================
  const fetchFavorites = useCallback(async () => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, favorites: true }));
    try {
      const query = favoriteFilter !== 'ALL' ? { type: favoriteFilter } : undefined;
      const response = await userApi.getFavorites(auth.token, query);
      setFavorites(response);
    } catch (error) {
      console.error('Failed to fetch favorites:', error);
    } finally {
      setLoading((prev) => ({ ...prev, favorites: false }));
    }
  }, [auth.token, favoriteFilter]);

  const handleAddFavorite = useCallback(async (targetType: FavoriteTargetType, targetId: string) => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await userApi.addFavorite(auth.token, { targetType, targetId });
      await fetchFavorites();
      alert('즐겨찾기에 추가되었습니다.');
    } catch (error) {
      console.error('Failed to add favorite:', error);
      let errorMessage = '즐겨찾기 추가에 실패했습니다.';
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { message?: string } } };
        if (axiosError.response?.data?.message) {
          errorMessage = axiosError.response.data.message;
        }
      }
      alert(errorMessage);
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  }, [auth.token, fetchFavorites]);

  const handleRemoveFavorite = useCallback(async (targetType: FavoriteTargetType, targetId: string) => {
    if (!auth.token) return;
    if (!confirm('즐겨찾기에서 제거하시겠습니까?')) return;
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await userApi.removeFavorite(auth.token, targetType, targetId);
      await fetchFavorites();
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      alert('즐겨찾기 제거에 실패했습니다.');
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  }, [auth.token, fetchFavorites]);

  const fetchRecentActivities = useCallback(async (limit?: number) => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, activities: true }));
    try {
      const response = await userApi.getRecentActivities(auth.token, { limit: limit || 20 });
      setRecentActivities(response);
    } catch (error) {
      console.error('Failed to fetch recent activities:', error);
    } finally {
      setLoading((prev) => ({ ...prev, activities: false }));
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
    // 폴더 트리 상태 초기화
    setFolderTree(null);
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
        {renderTabButton('favorite', '310.즐겨찾기')}
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

              {/* 검색 영역 */}
              <div className="bg-gray-50 rounded p-3 mb-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="파일/폴더 검색 (최소 2자)"
                    className="flex-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <select
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value as 'all' | 'file' | 'folder')}
                    className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="all">전체</option>
                    <option value="file">파일만</option>
                    <option value="folder">폴더만</option>
                  </select>
                  <button
                    onClick={handleSearch}
                    disabled={loading.search || !searchKeyword.trim()}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded disabled:opacity-50"
                  >
                    {loading.search ? '검색 중...' : '검색'}
                  </button>
                  {isSearchMode && (
                    <button
                      onClick={clearSearch}
                      className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded"
                    >
                      검색 취소
                    </button>
                  )}
                </div>
              </div>

              {/* 검색 결과 */}
              {isSearchMode && searchResults && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">
                      검색 결과: "{searchResults.keyword}" ({searchResults.pagination.totalItems}건)
                    </h4>
                  </div>
                  {searchResults.results.length > 0 ? (
                    <div className="space-y-1 max-h-96 overflow-y-auto border rounded p-2">
                      {searchResults.results.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => navigateToSearchResult(item)}
                          className="flex items-center p-2 rounded hover:bg-gray-100 cursor-pointer"
                        >
                          <span className={item.type === 'folder' ? 'text-yellow-500' : 'text-blue-500'} style={{ marginRight: '8px' }}>
                            {item.type === 'folder' ? '📁' : '📄'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{item.name}</div>
                            <div className="text-xs text-gray-500 truncate">
                              경로: {item.path}
                              {item.type === 'file' && (
                                <span className="ml-2">
                                  | 크기: {formatBytes((item as SearchFileItem).size)}
                                  | 타입: {(item as SearchFileItem).mimeType}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            item.type === 'folder' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {item.type === 'folder' ? '폴더' : '파일'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">검색 결과가 없습니다</p>
                  )}
                  {/* 페이지네이션 정보 */}
                  {searchResults.pagination.totalPages > 1 && (
                    <div className="mt-2 text-sm text-gray-500 text-center">
                      {searchResults.pagination.page} / {searchResults.pagination.totalPages} 페이지
                    </div>
                  )}
                </div>
              )}

              {/* Breadcrumbs - 검색 모드가 아닐 때만 표시 */}
              {!isSearchMode && folderContents && (
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

              {/* Current Folder Info & Actions - 검색 모드가 아닐 때만 표시 */}
              {!isSearchMode && currentFolder && (
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

              {/* Folder Contents - 검색 모드가 아닐 때만 표시 */}
              {!isSearchMode && folderContents ? (
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
                        <button
                          onClick={() => handleFolderDelete(folder.id, folder.name)}
                          className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 rounded"
                          title="삭제"
                        >
                          삭제
                        </button>
                        <button
                          onClick={() => handleAddFavorite('FOLDER', folder.id)}
                          className="px-2 py-1 text-xs bg-orange-100 hover:bg-orange-200 rounded"
                          title="즐겨찾기"
                        >
                          ⭐
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
                        <button
                          onClick={() => handleAddFavorite('FILE', file.id)}
                          className="px-2 py-1 text-xs bg-orange-100 hover:bg-orange-200 rounded"
                          title="즐겨찾기"
                        >
                          ⭐
                        </button>
                      </div>
                    </div>
                  ))}

                  {folderContents.folders.length === 0 && folderContents.files.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">빈 폴더입니다</p>
                  )}
                </div>
              ) : !isSearchMode ? (
                <p className="text-sm text-gray-400">루트 폴더 조회 버튼을 클릭하세요</p>
              ) : null}
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
                onPauseFile={pauseUpload}
                onResumeFile={handleResumeUpload}
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
                hasPendingSessions={hasPendingSessions}
                onLoadPendingSessions={handleLoadPendingSessions}
              />

              {/* 안내 */}
              <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
                <h4 className="font-medium mb-2">멀티파트 업로드 안내</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>100MB 이상의 파일은 자동으로 10MB 청크로 분할 업로드됩니다.</li>
                  <li>100MB 미만의 파일은 일반 업로드로 처리됩니다.</li>
                  <li>업로드 중 ⏸️ 버튼을 클릭하여 일시정지할 수 있습니다.</li>
                  <li>일시정지된 파일은 ▶️ 버튼을 클릭하여 이어서 업로드할 수 있습니다.</li>
                  <li>브라우저를 닫아도 세션이 24시간 동안 유지되며, 다시 접속 시 이어서 업로드할 수 있습니다.</li>
                  <li>새로고침 후 이어서 업로드하려면 같은 파일을 다시 선택해야 합니다.</li>
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
                                    className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                                  >
                                    미리보기
                                  </button>
                                  <button
                                    onClick={() => handleRestoreExecute(item.trashMetadataId, item.name)}
                                    className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 rounded"
                                  >
                                    복원
                                  </button>
                                  <button
                                    onClick={() => handlePurgeFile(item.trashMetadataId, item.name)}
                                    className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 rounded"
                                  >
                                    삭제
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
                <h3 className="font-medium text-gray-900">사용자 관리(810)</h3>
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

          {/* 310.즐겨찾기 탭 */}
          {activeTab === 'favorite' && (
            <div className="space-y-4">
              {/* 즐겨찾기 목록 */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">즐겨찾기 목록</h3>
                  <div className="flex items-center space-x-2">
                    <select
                      value={favoriteFilter}
                      onChange={(e) => setFavoriteFilter(e.target.value as FavoriteTargetType | 'ALL')}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="ALL">전체</option>
                      <option value="FILE">파일</option>
                      <option value="FOLDER">폴더</option>
                    </select>
                    <button
                      onClick={fetchFavorites}
                      disabled={loading.favorites}
                      className="text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50"
                    >
                      {loading.favorites ? '조회 중...' : '조회'}
                    </button>
                  </div>
                </div>

                {favorites.length > 0 ? (
                  <div className="space-y-2">
                    {favorites.map((fav) => (
                      <div
                        key={fav.id}
                        className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-3">
                          <span className={fav.targetType === 'FOLDER' ? 'text-yellow-500' : 'text-blue-500'}>
                            {fav.targetType === 'FOLDER' ? '📁' : '📄'}
                          </span>
                          <div>
                            <div className="font-medium text-sm">
                              {fav.targetType === 'FOLDER' ? '폴더' : '파일'}
                            </div>
                            <div className="text-xs text-gray-500">
                              ID: {fav.targetId.slice(0, 12)}...
                            </div>
                            <div className="text-xs text-gray-400">
                              추가일: {new Date(fav.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveFavorite(fav.targetType, fav.targetId)}
                          className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded"
                        >
                          해제
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">
                    즐겨찾기 목록이 비어있습니다. 조회 버튼을 클릭하세요.
                  </p>
                )}
              </div>

              {/* 최근 활동 */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">최근 활동</h3>
                  <button
                    onClick={() => fetchRecentActivities(30)}
                    disabled={loading.activities}
                    className="text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50"
                  >
                    {loading.activities ? '조회 중...' : '조회'}
                  </button>
                </div>

                {recentActivities ? (
                  <>
                    <div className="text-sm text-gray-500 mb-3">
                      총 {recentActivities.total}개의 활동
                    </div>
                    {recentActivities.activities.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-2">액션</th>
                              <th className="text-left py-2 px-2">대상</th>
                              <th className="text-left py-2 px-2">경로</th>
                              <th className="text-left py-2 px-2">결과</th>
                              <th className="text-left py-2 px-2">일시</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentActivities.activities.map((activity, idx) => (
                              <tr key={idx} className="border-b hover:bg-gray-50">
                                <td className="py-2 px-2">
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    activity.actionCategory === 'CREATE' ? 'bg-green-100 text-green-800' :
                                    activity.actionCategory === 'DELETE' ? 'bg-red-100 text-red-800' :
                                    activity.actionCategory === 'UPDATE' ? 'bg-yellow-100 text-yellow-800' :
                                    activity.actionCategory === 'READ' ? 'bg-blue-100 text-blue-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {activity.action}
                                  </span>
                                </td>
                                <td className="py-2 px-2">
                                  <div className="flex items-center space-x-1">
                                    <span className={activity.targetType === 'FOLDER' ? 'text-yellow-500' : 'text-blue-500'}>
                                      {activity.targetType === 'FOLDER' ? '📁' : activity.targetType === 'FILE' ? '📄' : '📋'}
                                    </span>
                                    <span className="truncate max-w-[150px]" title={activity.targetName}>
                                      {activity.targetName || activity.targetId.slice(0, 8)}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2 px-2">
                                  <span className="text-xs text-gray-500 truncate max-w-[150px] block" title={activity.targetPath}>
                                    {activity.targetPath || '-'}
                                  </span>
                                </td>
                                <td className="py-2 px-2">
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    activity.result === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                                    activity.result === 'FAILURE' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {activity.result}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-xs text-gray-500">
                                  {new Date(activity.createdAt).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-4">활동 내역이 없습니다</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">조회 버튼을 클릭하세요</p>
                )}
              </div>

              {/* 안내 */}
              <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
                <h4 className="font-medium mb-2">즐겨찾기 사용 안내</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>파일/폴더 탭에서 파일이나 폴더를 즐겨찾기에 추가할 수 있습니다.</li>
                  <li>즐겨찾기 목록에서 해제 버튼을 클릭하여 제거할 수 있습니다.</li>
                  <li>최근 활동에서 파일 관련 작업 히스토리를 확인할 수 있습니다.</li>
                </ul>
              </div>
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
                <p className="text-sm text-gray-500 mb-2">이동할 폴더: <span className="font-medium text-gray-700">{selectedFolder.name}</span></p>
                
                {/* 폴더 트리 */}
                <div className="border rounded mb-4">
                  {/* 불러오기 버튼 */}
                  {!folderTree && (
                    <div className="p-4 text-center">
                      <button
                        onClick={initFolderTree}
                        disabled={folderTreeLoading}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50"
                      >
                        {folderTreeLoading ? '불러오는 중...' : '폴더 목록 불러오기'}
                      </button>
                    </div>
                  )}
                  
                  {/* 트리 뷰 */}
                  {folderTree && (
                    <div className="max-h-72 overflow-y-auto p-2 font-mono text-sm">
                      {/* 트리 노드 렌더링 함수 */}
                      {(function renderTreeNode(node: FolderTreeNode, depth: number = 0, excludeId?: string): React.ReactNode {
                        // 자기 자신 제외
                        if (node.id === excludeId) return null;
                        
                        const indent = depth * 20;
                        const hasChildren = node.children && node.children.length > 0;
                        const isSelected = targetFolderId === node.id;
                        
                        return (
                          <div key={node.id}>
                            <div
                              className={`flex items-center py-1 cursor-pointer hover:bg-gray-100 rounded ${
                                isSelected ? 'bg-blue-100' : ''
                              }`}
                              style={{ paddingLeft: `${indent}px` }}
                            >
                              {/* 확장/축소 버튼 */}
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (node.children === null || (node.children && node.children.filter(c => c.id !== excludeId).length > 0)) {
                                    toggleFolderExpand(node.id);
                                  }
                                }}
                                className="w-5 text-center text-gray-600 select-none"
                              >
                                {node.isLoading ? (
                                  <span className="text-xs">...</span>
                                ) : node.children === null ? (
                                  <span className="text-gray-400">+</span>
                                ) : hasChildren && node.children.filter(c => c.id !== excludeId).length > 0 ? (
                                  node.isExpanded ? '-' : '+'
                                ) : (
                                  <span className="text-gray-300">·</span>
                                )}
                              </span>
                              
                              {/* 폴더 아이콘 및 이름 */}
                              <span
                                onClick={() => selectTargetFolder(node.id)}
                                className="flex items-center flex-1"
                              >
                                <span className="mr-1">📁</span>
                                <span className={isSelected ? 'font-bold text-blue-600' : ''}>
                                  {node.name}
                                </span>
                              </span>
                            </div>
                            
                            {/* 자식 노드 렌더링 */}
                            {node.isExpanded && node.children && (
                              <div>
                                {node.children
                                  .filter(child => child.id !== excludeId)
                                  .map(child => renderTreeNode(child, depth + 1, excludeId))}
                              </div>
                            )}
                          </div>
                        );
                      })(folderTree, 0, selectedFolder.id)}
                    </div>
                  )}
                </div>
                
                {/* 선택된 대상 폴더 표시 */}
                {targetFolderId && folderTree && (
                  <p className="text-sm text-blue-600 mb-4">
                    선택된 폴더: <span className="font-bold">
                      {(function findName(node: FolderTreeNode): string {
                        if (node.id === targetFolderId) return node.name;
                        if (node.children) {
                          for (const child of node.children) {
                            const found = findName(child);
                            if (found) return found;
                          }
                        }
                        return '';
                      })(folderTree)}
                    </span>
                  </p>
                )}
                
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
                <p className="text-sm text-gray-500 mb-2">이동할 파일: <span className="font-medium text-gray-700">{selectedFile.name}</span></p>
                
                {/* 폴더 트리 */}
                <div className="border rounded mb-4">
                  {/* 불러오기 버튼 */}
                  {!folderTree && (
                    <div className="p-4 text-center">
                      <button
                        onClick={initFolderTree}
                        disabled={folderTreeLoading}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50"
                      >
                        {folderTreeLoading ? '불러오는 중...' : '폴더 목록 불러오기'}
                      </button>
                    </div>
                  )}
                  
                  {/* 트리 뷰 */}
                  {folderTree && (
                    <div className="max-h-72 overflow-y-auto p-2 font-mono text-sm">
                      {/* 트리 노드 렌더링 함수 */}
                      {(function renderTreeNode(node: FolderTreeNode, depth: number = 0): React.ReactNode {
                        const indent = depth * 20;
                        const hasChildren = node.children && node.children.length > 0;
                        const isSelected = targetFolderId === node.id;
                        
                        return (
                          <div key={node.id}>
                            <div
                              className={`flex items-center py-1 cursor-pointer hover:bg-gray-100 rounded ${
                                isSelected ? 'bg-blue-100' : ''
                              }`}
                              style={{ paddingLeft: `${indent}px` }}
                            >
                              {/* 확장/축소 버튼 */}
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (node.children === null || hasChildren) {
                                    toggleFolderExpand(node.id);
                                  }
                                }}
                                className="w-5 text-center text-gray-600 select-none"
                              >
                                {node.isLoading ? (
                                  <span className="text-xs">...</span>
                                ) : node.children === null ? (
                                  <span className="text-gray-400">+</span>
                                ) : hasChildren ? (
                                  node.isExpanded ? '-' : '+'
                                ) : (
                                  <span className="text-gray-300">·</span>
                                )}
                              </span>
                              
                              {/* 폴더 아이콘 및 이름 */}
                              <span
                                onClick={() => selectTargetFolder(node.id)}
                                className="flex items-center flex-1"
                              >
                                <span className="mr-1">📁</span>
                                <span className={isSelected ? 'font-bold text-blue-600' : ''}>
                                  {node.name}
                                </span>
                              </span>
                            </div>
                            
                            {/* 자식 노드 렌더링 */}
                            {node.isExpanded && node.children && (
                              <div>
                                {node.children.map(child => renderTreeNode(child, depth + 1))}
                              </div>
                            )}
                          </div>
                        );
                      })(folderTree, 0)}
                    </div>
                  )}
                </div>
                
                {/* 선택된 대상 폴더 표시 */}
                {targetFolderId && folderTree && (
                  <p className="text-sm text-blue-600 mb-4">
                    선택된 폴더: <span className="font-bold">
                      {(function findName(node: FolderTreeNode): string {
                        if (node.id === targetFolderId) return node.name;
                        if (node.children) {
                          for (const child of node.children) {
                            const found = findName(child);
                            if (found) return found;
                          }
                        }
                        return '';
                      })(folderTree)}
                    </span>
                  </p>
                )}
                
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
