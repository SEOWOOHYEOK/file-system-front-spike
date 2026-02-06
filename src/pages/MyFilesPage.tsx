/**
 * MyFilesPage - SaaS 스타일 파일 관리 페이지
 * 네이버 MYBOX 스타일의 파일 탐색기
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useInternalAuth } from '../hooks/useInternalAuth';
import { useMultipartUpload } from '../hooks/useMultipartUpload';
import { useDownload } from '../hooks/useDownload';
import { folderApi } from '../api/folderApi';
import { fileApi } from '../api/fileApi';
import { trashApi } from '../api/trashApi';
import { userApi } from '../api/userApi';
import { adminSystemApi } from '../api/adminApi';
import { FileDownloadManager } from '../components/FileDownloadManager';
import { FileUploadModal } from '../components/FileUploadModal';
import {
  FileSidebar,
  FileToolbar,
  BreadcrumbNav,
  FileGrid,
  FileList,
  ContextMenu,
  UploadDropzone,
  FileModals,
  TrashView,
} from '../components/files';
import type {
  FolderContentsResponse,
  BreadcrumbItem,
  FolderListItem,
  FileListItemInFolder,
  TrashListResponse,
  SearchResponse,
} from '../types/file.types';
import type {
  FavoriteResponse,
  FavoriteTargetType,
  RecentActivitiesResponse,
} from '../types/user.types';

// 뷰 타입
type ViewType = 'all' | 'recent' | 'favorites' | 'trash';
type ViewMode = 'grid' | 'list';
type SortBy = 'name' | 'updatedAt' | 'size';
type SortOrder = 'asc' | 'desc';

// 모달 타입
type ModalType = 'none' | 'createFolder' | 'rename' | 'move' | 'delete';

// 선택된 아이템 타입
interface SelectedItem {
  id: string;
  type: 'file' | 'folder';
  name: string;
}

// 컨텍스트 메뉴 상태
interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  item: SelectedItem | null;
}

// 스토리지 정보
interface StorageInfo {
  used: number;
  total: number;
}

export function MyFilesPage() {
  const { auth } = useInternalAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============================================
  // 뷰 상태
  // ============================================
  const [currentView, setCurrentView] = useState<ViewType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // ============================================
  // 폴더 탐색 상태
  // ============================================
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [folderContents, setFolderContents] = useState<FolderContentsResponse | null>(null);

  // ============================================
  // 선택 상태
  // ============================================
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [targetItem, setTargetItem] = useState<SelectedItem | null>(null);

  // ============================================
  // 검색 상태
  // ============================================
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);

  // ============================================
  // 정렬 상태
  // ============================================
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // ============================================
  // 모달 상태
  // ============================================
  const [activeModal, setActiveModal] = useState<ModalType>('none');
  const [modalInput, setModalInput] = useState('');

  // ============================================
  // 컨텍스트 메뉴 상태
  // ============================================
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    item: null,
  });

  // ============================================
  // 휴지통 상태
  // ============================================
  const [trashList, setTrashList] = useState<TrashListResponse | null>(null);

  // ============================================
  // 즐겨찾기 상태
  // ============================================
  const [favorites, setFavorites] = useState<FavoriteResponse[]>([]);

  // ============================================
  // 최근 활동 상태
  // ============================================
  const [recentActivities, setRecentActivities] = useState<RecentActivitiesResponse | null>(null);

  // ============================================
  // 스토리지 정보
  // ============================================
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);

  // ============================================
  // 로딩 상태
  // ============================================
  const [loading, setLoading] = useState({
    folder: false,
    action: false,
    upload: false,
    trash: false,
    search: false,
  });

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
    clearCompleted: clearCompletedUploads,
    isUploading,
  } = useMultipartUpload();

  // ============================================
  // 다운로드 훅
  // ============================================
  const {
    downloadFiles,
    startDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    clearCompleted: clearCompletedDownloads,
    isDownloading,
  } = useDownload();

  // ============================================
  // 드래그 상태
  // ============================================
  const [isDragging, setIsDragging] = useState(false);

  // ============================================
  // 업로드 모달 상태
  // ============================================
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // ============================================
  // 폴더 API 호출
  // ============================================
  const fetchRootFolder = useCallback(async () => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, folder: true }));
    try {
      const rootFolder = await folderApi.getRoot(auth.token);
      setCurrentFolderId(rootFolder.id);
      const contents = await folderApi.getContents(auth.token, rootFolder.id, {
        sortBy,
        sortOrder,
      });
      setFolderContents(contents);
      setBreadcrumbs(contents.breadcrumbs);
    } catch (error) {
      console.error('Failed to fetch root folder:', error);
    } finally {
      setLoading((prev) => ({ ...prev, folder: false }));
    }
  }, [auth.token, sortBy, sortOrder]);

  const navigateToFolder = useCallback(async (folderId: string) => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, folder: true }));
    setIsSearchMode(false);
    setSearchKeyword('');
    setSearchResults(null);
    try {
      const contents = await folderApi.getContents(auth.token, folderId, {
        sortBy,
        sortOrder,
      });
      setCurrentFolderId(folderId);
      setFolderContents(contents);
      setBreadcrumbs(contents.breadcrumbs);
      setSelectedItems([]);
    } catch (error) {
      console.error('Failed to navigate to folder:', error);
    } finally {
      setLoading((prev) => ({ ...prev, folder: false }));
    }
  }, [auth.token, sortBy, sortOrder]);

  const refreshCurrentFolder = useCallback(async () => {
    if (!auth.token || !currentFolderId) return;
    await navigateToFolder(currentFolderId);
  }, [auth.token, currentFolderId, navigateToFolder]);

  // ============================================
  // 검색 API 호출
  // ============================================
  const handleSearch = useCallback(async (keyword: string) => {
    if (!auth.token || !keyword.trim() || keyword.trim().length < 2) return;
    setLoading((prev) => ({ ...prev, search: true }));
    try {
      const response = await folderApi.search(auth.token, {
        keyword: keyword.trim(),
        pageSize: 50,
        sortBy,
        sortOrder,
      });
      setSearchResults(response);
      setIsSearchMode(true);
    } catch (error) {
      console.error('Failed to search:', error);
    } finally {
      setLoading((prev) => ({ ...prev, search: false }));
    }
  }, [auth.token, sortBy, sortOrder]);

  const clearSearch = useCallback(() => {
    setSearchKeyword('');
    setSearchResults(null);
    setIsSearchMode(false);
  }, []);

  // ============================================
  // 폴더 생성
  // ============================================
  const handleCreateFolder = useCallback(async () => {
    if (!auth.token || !currentFolderId || !modalInput.trim()) return;
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await folderApi.create(auth.token, {
        name: modalInput.trim(),
        parentId: currentFolderId,
      });
      setActiveModal('none');
      setModalInput('');
      await refreshCurrentFolder();
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('폴더 생성에 실패했습니다.');
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  }, [auth.token, currentFolderId, modalInput, refreshCurrentFolder]);

  // ============================================
  // 이름 변경
  // ============================================
  const handleRename = useCallback(async () => {
    if (!auth.token || !targetItem || !modalInput.trim()) return;
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      if (targetItem.type === 'folder') {
        await folderApi.rename(auth.token, targetItem.id, { newName: modalInput.trim() });
      } else {
        await fileApi.rename(auth.token, targetItem.id, { newName: modalInput.trim() });
      }
      setActiveModal('none');
      setModalInput('');
      setTargetItem(null);
      await refreshCurrentFolder();
    } catch (error) {
      console.error('Failed to rename:', error);
      alert('이름 변경에 실패했습니다.');
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  }, [auth.token, targetItem, modalInput, refreshCurrentFolder]);

  // ============================================
  // 이동
  // ============================================
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string>('');

  const handleMove = useCallback(async () => {
    if (!auth.token || !targetItem || !moveTargetFolderId) return;
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      if (targetItem.type === 'folder') {
        await folderApi.move(auth.token, targetItem.id, { targetParentId: moveTargetFolderId });
      } else {
        await fileApi.move(auth.token, targetItem.id, { targetFolderId: moveTargetFolderId });
      }
      setActiveModal('none');
      setMoveTargetFolderId('');
      setTargetItem(null);
      await refreshCurrentFolder();
    } catch (error) {
      console.error('Failed to move:', error);
      alert('이동에 실패했습니다.');
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  }, [auth.token, targetItem, moveTargetFolderId, refreshCurrentFolder]);

  // ============================================
  // 삭제
  // ============================================
  const handleDelete = useCallback(async () => {
    if (!auth.token || !targetItem) return;
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      if (targetItem.type === 'folder') {
        await folderApi.delete(auth.token, targetItem.id);
      } else {
        await fileApi.delete(auth.token, targetItem.id);
      }
      setActiveModal('none');
      setTargetItem(null);
      await refreshCurrentFolder();
    } catch (error) {
      console.error('Failed to delete:', error);
      let errorMessage = '삭제에 실패했습니다.';
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
  }, [auth.token, targetItem, refreshCurrentFolder]);

  // ============================================
  // 파일 다운로드
  // ============================================
  const handleFileDownload = useCallback(async (fileId: string, fileName: string, fileSize?: number) => {
    if (!auth.token) return;
    
    // 파일 크기를 알 수 있으면 새로운 다운로드 훅 사용 (진행률 추적, 병렬 다운로드 등)
    if (fileSize && fileSize > 0) {
      startDownload(auth.token, fileId, fileName, fileSize);
    } else {
      // 파일 크기를 모르면 기존 방식으로 다운로드
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
    }
  }, [auth.token, startDownload]);

  // ============================================
  // 파일 업로드
  // ============================================
  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    if (!auth.token || !currentFolderId) return;
    const fileArray = Array.from(files);
    addFiles(fileArray);
    startUpload(auth.token, currentFolderId);
  }, [auth.token, currentFolderId, addFiles, startUpload]);

  // 업로드 완료 시 새로고침
  useEffect(() => {
    const completedFiles = uploadFiles.filter(f => f.status === 'completed');
    if (completedFiles.length > 0 && !isUploading) {
      refreshCurrentFolder();
    }
  }, [uploadFiles, isUploading, refreshCurrentFolder]);

  // ============================================
  // 즐겨찾기
  // ============================================
  const fetchFavorites = useCallback(async () => {
    if (!auth.token) return;
    try {
      const response = await userApi.getFavorites(auth.token);
      setFavorites(response);
    } catch (error) {
      console.error('Failed to fetch favorites:', error);
    }
  }, [auth.token]);

  const handleAddFavorite = useCallback(async (targetType: FavoriteTargetType, targetId: string) => {
    if (!auth.token) return;
    try {
      await userApi.addFavorite(auth.token, { targetType, targetId });
      await fetchFavorites();
    } catch (error) {
      console.error('Failed to add favorite:', error);
    }
  }, [auth.token, fetchFavorites]);

  const handleRemoveFavorite = useCallback(async (targetType: FavoriteTargetType, targetId: string) => {
    if (!auth.token) return;
    try {
      await userApi.removeFavorite(auth.token, targetType, targetId);
      await fetchFavorites();
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    }
  }, [auth.token, fetchFavorites]);

  const isFavorite = useCallback((id: string) => {
    return favorites.some(f => f.targetId === id);
  }, [favorites]);

  // ============================================
  // 휴지통
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

  const handleRestoreFromTrash = useCallback(async (trashMetadataId: string) => {
    if (!auth.token) return;
    try {
      await trashApi.executeRestore(auth.token, {
        items: [{ trashMetadataId }],
      });
      await fetchTrashList();
    } catch (error) {
      console.error('Failed to restore:', error);
      alert('복원에 실패했습니다.');
    }
  }, [auth.token, fetchTrashList]);

  const handlePermanentDelete = useCallback(async (trashMetadataId: string) => {
    if (!auth.token) return;
    if (!confirm('영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
      await trashApi.purgeFile(auth.token, trashMetadataId);
      await fetchTrashList();
    } catch (error) {
      console.error('Failed to permanent delete:', error);
      alert('영구 삭제에 실패했습니다.');
    }
  }, [auth.token, fetchTrashList]);

  const handleEmptyTrash = useCallback(async () => {
    if (!auth.token) return;
    if (!confirm('휴지통을 비우시겠습니까? 모든 파일이 영구 삭제됩니다.')) return;
    try {
      await trashApi.emptyTrash(auth.token);
      await fetchTrashList();
    } catch (error) {
      console.error('Failed to empty trash:', error);
      alert('휴지통 비우기에 실패했습니다.');
    }
  }, [auth.token, fetchTrashList]);

  // ============================================
  // 최근 활동
  // ============================================
  const fetchRecentActivities = useCallback(async () => {
    if (!auth.token) return;
    try {
      const response = await userApi.getRecentActivities(auth.token, { limit: 50 });
      setRecentActivities(response);
    } catch (error) {
      console.error('Failed to fetch recent activities:', error);
    }
  }, [auth.token]);

  // ============================================
  // 스토리지 정보
  // ============================================
  const fetchStorageInfo = useCallback(async () => {
    if (!auth.token) return;
    try {
      const nasHealth = await adminSystemApi.getNasHealth(auth.token);
      if (nasHealth.totalSpace && nasHealth.usedSpace) {
        setStorageInfo({
          total: nasHealth.totalSpace,
          used: nasHealth.usedSpace,
        });
      }
    } catch (error) {
      console.error('Failed to fetch storage info:', error);
    }
  }, [auth.token]);

  // ============================================
  // 컨텍스트 메뉴 핸들러
  // ============================================
  const handleContextMenu = useCallback((item: SelectedItem, x: number, y: number) => {
    setContextMenu({ visible: true, x, y, item });
  }, []);

  const handleContextMenuAction = useCallback((action: string) => {
    if (!contextMenu.item) return;
    const item = contextMenu.item;

    switch (action) {
      case 'open':
        if (item.type === 'folder') {
          navigateToFolder(item.id);
        }
        break;
      case 'download':
        if (item.type === 'file') {
          // 파일 크기 정보 가져오기
          const fileForDownload = folderContents?.files.find(f => f.id === item.id);
          handleFileDownload(item.id, item.name, fileForDownload?.size);
        }
        break;
      case 'rename':
        setTargetItem(item);
        setModalInput(item.name);
        setActiveModal('rename');
        break;
      case 'move':
        setTargetItem(item);
        setActiveModal('move');
        break;
      case 'favorite':
        if (isFavorite(item.id)) {
          handleRemoveFavorite(item.type === 'folder' ? 'FOLDER' : 'FILE', item.id);
        } else {
          handleAddFavorite(item.type === 'folder' ? 'FOLDER' : 'FILE', item.id);
        }
        break;
      case 'delete':
        setTargetItem(item);
        setActiveModal('delete');
        break;
    }
    setContextMenu({ visible: false, x: 0, y: 0, item: null });
  }, [contextMenu.item, navigateToFolder, handleFileDownload, isFavorite, handleRemoveFavorite, handleAddFavorite]);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0, item: null });
  }, []);

  // ============================================
  // 뷰 변경 핸들러
  // ============================================
  const handleViewChange = useCallback((view: ViewType) => {
    setCurrentView(view);
    setSelectedItems([]);
    setIsSearchMode(false);
    setSearchKeyword('');
    setSearchResults(null);

    if (view === 'all') {
      if (currentFolderId) {
        navigateToFolder(currentFolderId);
      } else {
        fetchRootFolder();
      }
    } else if (view === 'trash') {
      fetchTrashList();
    } else if (view === 'favorites') {
      fetchFavorites();
    } else if (view === 'recent') {
      fetchRecentActivities();
    }
  }, [currentFolderId, navigateToFolder, fetchRootFolder, fetchTrashList, fetchFavorites, fetchRecentActivities]);

  // ============================================
  // 정렬 변경
  // ============================================
  const handleSortChange = useCallback((newSortBy: SortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  }, [sortBy]);

  // 정렬 변경 시 새로고침
  useEffect(() => {
    if (currentView === 'all' && currentFolderId) {
      refreshCurrentFolder();
    }
  }, [sortBy, sortOrder]);

  // ============================================
  // 초기 로드
  // ============================================
  useEffect(() => {
    if (auth.isAuthenticated) {
      fetchRootFolder();
      fetchFavorites();
      fetchStorageInfo();
    }
  }, [auth.isAuthenticated]);

  // ============================================
  // 전역 클릭 이벤트 (컨텍스트 메뉴 닫기)
  // ============================================
  useEffect(() => {
    const handleClick = () => closeContextMenu();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [closeContextMenu]);

  // ============================================
  // 드래그 앤 드롭 핸들러
  // ============================================
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
      setIsUploadModalOpen(true);
    }
  }, [addFiles]);

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
    <div className="flex h-full bg-gray-50">
      {/* 사이드바 */}
      <FileSidebar
        currentView={currentView}
        onViewChange={handleViewChange}
        storageInfo={storageInfo}
      />

      {/* 메인 컨텐츠 */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 툴바 */}
        <FileToolbar
          searchKeyword={searchKeyword}
          onSearchChange={setSearchKeyword}
          onSearch={() => handleSearch(searchKeyword)}
          onClearSearch={clearSearch}
          isSearchMode={isSearchMode}
          onCreateFolder={() => {
            setModalInput('');
            setActiveModal('createFolder');
          }}
          onUpload={() => setIsUploadModalOpen(true)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          disabled={currentView !== 'all'}
        />

        {/* 브레드크럼 (파일 뷰에서만) */}
        {currentView === 'all' && !isSearchMode && (
          <BreadcrumbNav
            breadcrumbs={breadcrumbs}
            onNavigate={navigateToFolder}
          />
        )}

        {/* 검색 결과 헤더 */}
        {isSearchMode && searchResults && (
          <div className="px-6 py-2 bg-blue-50 border-b">
            <span className="text-sm text-blue-800">
              "{searchResults.keyword}" 검색 결과: {searchResults.pagination.totalItems}건
            </span>
          </div>
        )}

        {/* 메인 컨텐츠 영역 */}
        <div className="flex-1 overflow-auto p-6 relative">
          {/* 드래그 오버레이 */}
          {isDragging && currentView === 'all' && (
            <UploadDropzone />
          )}

          {/* 로딩 */}
          {(loading.folder || loading.trash) && (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">로딩 중...</div>
            </div>
          )}

          {/* 파일/폴더 뷰 */}
          {currentView === 'all' && !loading.folder && (
            <>
              {isSearchMode && searchResults ? (
                // 검색 결과
                viewMode === 'grid' ? (
                  <FileGrid
                    folders={searchResults.results.filter(r => r.type === 'folder').map(r => ({
                      id: r.id,
                      name: r.name,
                      path: r.path,
                      storageStatus: { nas: null },
                      fileCount: 0,
                      folderCount: 0,
                      updatedAt: r.updatedAt,
                    }))}
                    files={searchResults.results.filter(r => r.type === 'file').map(r => ({
                      id: r.id,
                      name: r.name,
                      size: 'size' in r ? r.size : 0,
                      mimeType: 'mimeType' in r ? r.mimeType : '',
                      storageStatus: { cache: null, nas: null },
                      updatedAt: r.updatedAt,
                    }))}
                    onFolderClick={navigateToFolder}
                    onFileClick={(id) => {
                      const file = searchResults.results.find(r => r.id === id);
                      if (file) handleFileDownload(id, file.name, 'size' in file ? file.size : undefined);
                    }}
                    onContextMenu={handleContextMenu}
                    selectedItems={selectedItems.map(s => s.id)}
                    onSelectionChange={(ids) => {
                      const items: SelectedItem[] = ids.map(id => {
                        const result = searchResults.results.find(r => r.id === id);
                        return {
                          id,
                          type: result?.type === 'folder' ? 'folder' : 'file',
                          name: result?.name || '',
                        };
                      });
                      setSelectedItems(items);
                    }}
                    isFavorite={isFavorite}
                  />
                ) : (
                  <FileList
                    folders={searchResults.results.filter(r => r.type === 'folder').map(r => ({
                      id: r.id,
                      name: r.name,
                      path: r.path,
                      storageStatus: { nas: null },
                      fileCount: 0,
                      folderCount: 0,
                      updatedAt: r.updatedAt,
                    }))}
                    files={searchResults.results.filter(r => r.type === 'file').map(r => ({
                      id: r.id,
                      name: r.name,
                      size: 'size' in r ? r.size : 0,
                      mimeType: 'mimeType' in r ? r.mimeType : '',
                      storageStatus: { cache: null, nas: null },
                      updatedAt: r.updatedAt,
                    }))}
                    onFolderClick={navigateToFolder}
                    onFileClick={(id) => {
                      const file = searchResults.results.find(r => r.id === id);
                      if (file) handleFileDownload(id, file.name, 'size' in file ? file.size : undefined);
                    }}
                    onContextMenu={handleContextMenu}
                    selectedItems={selectedItems.map(s => s.id)}
                    onSelectionChange={(ids) => {
                      const items: SelectedItem[] = ids.map(id => {
                        const result = searchResults.results.find(r => r.id === id);
                        return {
                          id,
                          type: result?.type === 'folder' ? 'folder' : 'file',
                          name: result?.name || '',
                        };
                      });
                      setSelectedItems(items);
                    }}
                    isFavorite={isFavorite}
                  />
                )
              ) : folderContents ? (
                // 폴더 내용
                viewMode === 'grid' ? (
                  <FileGrid
                    folders={folderContents.folders}
                    files={folderContents.files}
                    onFolderClick={navigateToFolder}
                    onFileClick={(id) => {
                      const file = folderContents.files.find(f => f.id === id);
                      if (file) handleFileDownload(id, file.name, file.size);
                    }}
                    onContextMenu={handleContextMenu}
                    selectedItems={selectedItems.map(s => s.id)}
                    onSelectionChange={(ids) => {
                      const items: SelectedItem[] = ids.map(id => {
                        const folder = folderContents.folders.find(f => f.id === id);
                        const file = folderContents.files.find(f => f.id === id);
                        return {
                          id,
                          type: folder ? 'folder' : 'file',
                          name: folder?.name || file?.name || '',
                        };
                      });
                      setSelectedItems(items);
                    }}
                    isFavorite={isFavorite}
                  />
                ) : (
                  <FileList
                    folders={folderContents.folders}
                    files={folderContents.files}
                    onFolderClick={navigateToFolder}
                    onFileClick={(id) => {
                      const file = folderContents.files.find(f => f.id === id);
                      if (file) handleFileDownload(id, file.name, file.size);
                    }}
                    onContextMenu={handleContextMenu}
                    selectedItems={selectedItems.map(s => s.id)}
                    onSelectionChange={(ids) => {
                      const items: SelectedItem[] = ids.map(id => {
                        const folder = folderContents.folders.find(f => f.id === id);
                        const file = folderContents.files.find(f => f.id === id);
                        return {
                          id,
                          type: folder ? 'folder' : 'file',
                          name: folder?.name || file?.name || '',
                        };
                      });
                      setSelectedItems(items);
                    }}
                    isFavorite={isFavorite}
                  />
                )
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  폴더를 불러오는 중...
                </div>
              )}
            </>
          )}

          {/* 휴지통 뷰 */}
          {currentView === 'trash' && !loading.trash && (
            <TrashView
              trashList={trashList}
              onRestore={handleRestoreFromTrash}
              onPermanentDelete={handlePermanentDelete}
              onEmptyTrash={handleEmptyTrash}
              onRefresh={fetchTrashList}
            />
          )}

          {/* 즐겨찾기 뷰 */}
          {currentView === 'favorites' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">즐겨찾기</h2>
              {favorites.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {favorites.map((fav) => (
                    <div
                      key={fav.id}
                      className="p-4 bg-white rounded-lg shadow hover:shadow-md cursor-pointer transition-shadow"
                      onClick={() => {
                        if (fav.targetType === 'FOLDER') {
                          setCurrentView('all');
                          navigateToFolder(fav.targetId);
                        }
                      }}
                    >
                      <div className="text-4xl mb-2">
                        {fav.targetType === 'FOLDER' ? '📁' : '📄'}
                      </div>
                      <div className="text-sm truncate">{fav.targetId.slice(0, 8)}...</div>
                      <div className="text-xs text-gray-500">
                        {new Date(fav.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  즐겨찾기가 없습니다
                </div>
              )}
            </div>
          )}

          {/* 최근 활동 뷰 */}
          {currentView === 'recent' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">최근 활동</h2>
              {recentActivities && recentActivities.activities.length > 0 ? (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">활동</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">대상</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">경로</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">일시</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {recentActivities.activities.map((activity, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${
                              activity.actionCategory === 'CREATE' ? 'bg-green-100 text-green-800' :
                              activity.actionCategory === 'DELETE' ? 'bg-red-100 text-red-800' :
                              activity.actionCategory === 'UPDATE' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {activity.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">{activity.targetName || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-xs">{activity.targetPath || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(activity.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  최근 활동이 없습니다
                </div>
              )}
            </div>
          )}
        </div>

        {/* 업로드 진행률 바 */}
        {uploadFiles.length > 0 && (
          <div className="border-t bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                업로드 중: {uploadFiles.filter(f => f.status === 'uploading').length}개
                {uploadFiles.filter(f => f.status === 'queued').length > 0 &&
                  ` · 대기열: ${uploadFiles.filter(f => f.status === 'queued').length}개`}
              </span>
              <button
                onClick={clearCompletedUploads}
                className="text-xs text-blue-500 hover:text-blue-600"
              >
                완료 항목 지우기
              </button>
            </div>
            <div className="space-y-2 max-h-32 overflow-auto">
              {uploadFiles.map((file) => (
                <div key={file.id} className="flex items-center space-x-2">
                  <span className="text-sm truncate flex-1">{file.file?.name || '파일'}</span>
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        file.status === 'completed' ? 'bg-green-500' :
                        file.status === 'error' ? 'bg-red-500' :
                        file.status === 'syncing' ? 'bg-orange-500' :
                        file.status === 'queued' ? 'bg-indigo-400 animate-pulse' :
                        'bg-blue-500'
                      }`}
                      style={{ width: `${
                        file.status === 'syncing' ? 100 :
                        file.status === 'queued' ? 100 :
                        file.uploadProgress
                      }%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-16">
                    {file.status === 'syncing' ? '동기화' :
                     file.status === 'queued' ? `대기열 ${file.queuePosition || ''}` :
                     `${file.uploadProgress}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 다운로드 매니저 */}
        <FileDownloadManager
          downloads={downloadFiles}
          onPause={pauseDownload}
          onResume={(id) => auth.token && resumeDownload(id, auth.token)}
          onCancel={cancelDownload}
          onClearCompleted={clearCompletedDownloads}
          isDownloading={isDownloading}
        />
      </div>

      {/* 컨텍스트 메뉴 */}
      {contextMenu.visible && contextMenu.item && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          itemType={contextMenu.item.type}
          isFavorite={isFavorite(contextMenu.item.id)}
          onAction={handleContextMenuAction}
          onClose={closeContextMenu}
        />
      )}

      {/* 모달들 */}
      <FileModals
        activeModal={activeModal}
        modalInput={modalInput}
        onModalInputChange={setModalInput}
        onClose={() => {
          setActiveModal('none');
          setModalInput('');
          setTargetItem(null);
          setMoveTargetFolderId('');
        }}
        onCreateFolder={handleCreateFolder}
        onRename={handleRename}
        onMove={handleMove}
        onDelete={handleDelete}
        targetItem={targetItem}
        loading={loading.action}
        // 이동 모달용
        currentFolderId={currentFolderId}
        moveTargetFolderId={moveTargetFolderId}
        onMoveTargetChange={setMoveTargetFolderId}
        token={auth.token || ''}
      />

      {/* 숨겨진 파일 입력 (드래그 앤 드롭용) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            addFiles(Array.from(e.target.files));
            setIsUploadModalOpen(true);
          }
        }}
      />

      {/* 업로드 모달 */}
      <FileUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        uploadFiles={uploadFiles}
        onAddFiles={(files) => addFiles(files)}
        onRemoveFile={removeFile}
        onCancelFile={(id) => {
          if (auth.token) {
            cancelUpload(id, auth.token);
          }
        }}
        onPauseFile={pauseUpload}
        onResumeFile={(id, file) => {
          if (auth.token) {
            resumeUpload(id, auth.token, file);
          }
        }}
        onStartUpload={() => {
          if (auth.token && currentFolderId) {
            startUpload(auth.token, currentFolderId);
          }
        }}
        onCancelAll={() => {
          if (auth.token) {
            cancelAll(auth.token);
          }
        }}
        onClearCompleted={clearCompletedUploads}
        isUploading={isUploading}
        disabled={!auth.token || !currentFolderId}
      />
    </div>
  );
}
