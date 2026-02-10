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
  ShareRequestModal,
} from '../components/files';
import type {
  FolderContentsResponse,
  BreadcrumbItem,
  FolderListItem,
  FileListItemInFolder,
  TrashListResponse,
  SearchResponse,
  SearchHistoryItem,
} from '../types/file.types';
import type {
  FavoriteResponse,
  FavoriteTargetType,
  RecentActivityItem,
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
  // 검색 내역 상태
  // ============================================
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [searchHistoryLoading, setSearchHistoryLoading] = useState(false);

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
  // 최근 활동 상태 (무한 스크롤 + 필터)
  // ============================================
  const [recentActivities, setRecentActivities] = useState<RecentActivityItem[]>([]);
  const [recentHasNext, setRecentHasNext] = useState(true);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentTotalItems, setRecentTotalItems] = useState(0);
  const recentPageRef = useRef(1);
  const recentObserverRef = useRef<HTMLDivElement>(null);
  type RecentFilterTab = 'all' | 'view' | 'upload' | 'download';
  const [recentFilter, setRecentFilter] = useState<RecentFilterTab>('all');

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
  // 공유 요청 모달 상태
  // ============================================
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareFiles, setShareFiles] = useState<Array<{ id: string; name: string }>>([]);

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
  // 검색 내역 API
  // ============================================
  const fetchSearchHistory = useCallback(async () => {
    if (!auth.token) return;
    setSearchHistoryLoading(true);
    try {
      const response = await folderApi.getSearchHistory(auth.token, { pageSize: 20 });
      setSearchHistory(response.items);
    } catch (error) {
      console.error('Failed to fetch search history:', error);
    } finally {
      setSearchHistoryLoading(false);
    }
  }, [auth.token]);

  const deleteSearchHistoryItem = useCallback(async (historyId: string) => {
    if (!auth.token) return;
    try {
      await folderApi.deleteSearchHistory(auth.token, historyId);
      setSearchHistory((prev) => prev.filter((item) => item.id !== historyId));
    } catch (error) {
      console.error('Failed to delete search history item:', error);
    }
  }, [auth.token]);

  const deleteAllSearchHistory = useCallback(async () => {
    if (!auth.token) return;
    try {
      await folderApi.deleteAllSearchHistory(auth.token);
      setSearchHistory([]);
    } catch (error) {
      console.error('Failed to delete all search history:', error);
    }
  }, [auth.token]);

  const selectSearchHistory = useCallback((keyword: string) => {
    setSearchKeyword(keyword);
    handleSearch(keyword);
  }, [handleSearch]);

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
  // 최근 활동 (무한 스크롤)
  // ============================================

  // 필터 탭 → actions 파라미터 매핑
  const getActionsParam = useCallback((filter: RecentFilterTab): string | undefined => {
    switch (filter) {
      case 'view': return 'FILE_VIEW';
      case 'upload': return 'FILE_UPLOAD';
      case 'download': return 'FILE_DOWNLOAD';
      default: return undefined;
    }
  }, []);

  // 데이터 로드 (append mode)
  const loadRecentActivities = useCallback(async (page: number, append: boolean = false) => {
    if (!auth.token || recentLoading) return;
    setRecentLoading(true);
    try {
      const actions = getActionsParam(recentFilter);
      const response = await userApi.getRecentActivities(auth.token, {
        page,
        pageSize: 20,
        ...(actions ? { actions } : {}),
      });
      if (append) {
        setRecentActivities((prev) => [...prev, ...response.items]);
      } else {
        setRecentActivities(response.items);
      }
      setRecentHasNext(response.hasNext);
      setRecentTotalItems(response.totalItems);
      recentPageRef.current = page;
    } catch (error) {
      console.error('Failed to fetch recent activities:', error);
    } finally {
      setRecentLoading(false);
    }
  }, [auth.token, recentFilter, recentLoading, getActionsParam]);

  // 더 불러오기
  const loadMoreRecentActivities = useCallback(() => {
    if (recentLoading || !recentHasNext) return;
    loadRecentActivities(recentPageRef.current + 1, true);
  }, [recentLoading, recentHasNext, loadRecentActivities]);

  // 초기 로드 / 필터 변경 시 리셋
  const fetchRecentActivities = useCallback(async () => {
    recentPageRef.current = 1;
    setRecentActivities([]);
    setRecentHasNext(true);
    setRecentTotalItems(0);
    // loadRecentActivities는 recentFilter에 의존하므로 직접 호출
    if (!auth.token) return;
    setRecentLoading(true);
    try {
      const actions = getActionsParam(recentFilter);
      const response = await userApi.getRecentActivities(auth.token, {
        page: 1,
        pageSize: 20,
        ...(actions ? { actions } : {}),
      });
      setRecentActivities(response.items);
      setRecentHasNext(response.hasNext);
      setRecentTotalItems(response.totalItems);
      recentPageRef.current = 1;
    } catch (error) {
      console.error('Failed to fetch recent activities:', error);
    } finally {
      setRecentLoading(false);
    }
  }, [auth.token, recentFilter, getActionsParam]);

  // 필터 변경 시 리셋 & 재조회
  useEffect(() => {
    if (currentView === 'recent') {
      fetchRecentActivities();
    }
  }, [recentFilter]);

  // Intersection Observer (무한 스크롤)
  useEffect(() => {
    if (currentView !== 'recent') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && recentHasNext && !recentLoading) {
          loadMoreRecentActivities();
        }
      },
      { threshold: 0.1 },
    );
    const el = recentObserverRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [currentView, recentHasNext, recentLoading, loadMoreRecentActivities]);

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
      case 'share':
        if (item.type === 'file') {
          setShareFiles([{ id: item.id, name: item.name }]);
          setIsShareModalOpen(true);
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
          searchHistory={searchHistory}
          searchHistoryLoading={searchHistoryLoading}
          onFetchSearchHistory={fetchSearchHistory}
          onDeleteSearchHistory={deleteSearchHistoryItem}
          onDeleteAllSearchHistory={deleteAllSearchHistory}
          onSelectSearchHistory={selectSearchHistory}
        />

        {/* 선택된 파일 액션 바 */}
        {selectedItems.length > 0 && selectedItems.some(s => s.type === 'file') && currentView === 'all' && (
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-2 flex items-center justify-between">
            <span className="text-sm text-blue-800">
              {selectedItems.filter(s => s.type === 'file').length}개 파일 선택됨
            </span>
            <button
              onClick={() => {
                const fileItems = selectedItems
                  .filter(s => s.type === 'file')
                  .map(s => ({ id: s.id, name: s.name }));
                if (fileItems.length > 0) {
                  setShareFiles(fileItems);
                  setIsShareModalOpen(true);
                }
              }}
              className="flex items-center px-3 py-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-lg"
            >
              <span className="mr-1.5">📨</span>
              공유 요청
            </button>
          </div>
        )}

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
              {/* 헤더 + 총 건수 */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">최근 활동</h2>
                {recentTotalItems > 0 && (
                  <span className="text-sm text-gray-500">총 {recentTotalItems.toLocaleString()}건</span>
                )}
              </div>

              {/* 필터 탭 */}
              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 w-fit">
                {([
                  { key: 'all' as RecentFilterTab, label: '전체' },
                  { key: 'view' as RecentFilterTab, label: '열람' },
                  { key: 'upload' as RecentFilterTab, label: '업로드' },
                  { key: 'download' as RecentFilterTab, label: '다운로드' },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setRecentFilter(tab.key)}
                    className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                      recentFilter === tab.key
                        ? 'bg-white text-gray-900 shadow-sm font-medium'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 활동 목록 테이블 */}
              {recentActivities.length > 0 ? (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">활동</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">유형</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">대상</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">경로</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">결과</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">일시</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {recentActivities.map((activity, idx) => {
                        // 액션별 스타일 매핑
                        const actionStyleMap: Record<string, { bg: string; text: string; label: string }> = {
                          FILE_VIEW:       { bg: 'bg-blue-100', text: 'text-blue-800', label: '조회' },
                          FILE_DOWNLOAD:   { bg: 'bg-indigo-100', text: 'text-indigo-800', label: '다운로드' },
                          FILE_UPLOAD:     { bg: 'bg-green-100', text: 'text-green-800', label: '업로드' },
                          FILE_RENAME:     { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '이름변경' },
                          FILE_MOVE:       { bg: 'bg-orange-100', text: 'text-orange-800', label: '이동' },
                          FILE_DELETE:     { bg: 'bg-red-100', text: 'text-red-800', label: '삭제' },
                          FILE_RESTORE:    { bg: 'bg-emerald-100', text: 'text-emerald-800', label: '복원' },
                          FILE_PURGE:      { bg: 'bg-red-200', text: 'text-red-900', label: '영구삭제' },
                          FOLDER_CREATE:   { bg: 'bg-teal-100', text: 'text-teal-800', label: '폴더생성' },
                          FOLDER_VIEW:     { bg: 'bg-blue-100', text: 'text-blue-800', label: '폴더조회' },
                          FOLDER_RENAME:   { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '폴더이름변경' },
                          FOLDER_MOVE:     { bg: 'bg-orange-100', text: 'text-orange-800', label: '폴더이동' },
                          FOLDER_DELETE:   { bg: 'bg-red-100', text: 'text-red-800', label: '폴더삭제' },
                        };
                        const style = actionStyleMap[activity.action] || { bg: 'bg-gray-100', text: 'text-gray-800', label: activity.action };

                        return (
                          <tr key={`${activity.targetId}-${idx}`} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                                {style.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className="text-gray-600">
                                {activity.targetType === 'FOLDER' ? '📁 폴더' : '📄 파일'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {activity.targetName || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-xs" title={activity.targetPath || ''}>
                              {activity.targetPath || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {activity.result === 'SUCCESS' ? (
                                <span className="inline-flex items-center text-green-600">
                                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  성공
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-red-600">
                                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                  </svg>
                                  실패
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                              {new Date(activity.createdAt).toLocaleString('ko-KR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* 무한 스크롤 로딩 인디케이터 */}
                  {recentLoading && (
                    <div className="flex items-center justify-center py-4 border-t">
                      <svg className="animate-spin h-5 w-5 text-blue-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-sm text-gray-500">불러오는 중...</span>
                    </div>
                  )}

                  {/* 더 이상 데이터 없음 */}
                  {!recentHasNext && recentActivities.length > 0 && (
                    <div className="text-center py-3 border-t text-sm text-gray-400">
                      모든 활동 내역을 불러왔습니다
                    </div>
                  )}
                </div>
              ) : !recentLoading ? (
                <div className="text-center text-gray-500 py-12">
                  <div className="text-4xl mb-3">📋</div>
                  <p>최근 활동이 없습니다</p>
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin h-6 w-6 text-blue-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-gray-500">활동 내역을 불러오는 중...</span>
                </div>
              )}

              {/* Intersection Observer 감지용 엘리먼트 */}
              <div ref={recentObserverRef} style={{ height: 1 }} />
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

      {/* 공유 요청 모달 */}
      <ShareRequestModal
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          setShareFiles([]);
        }}
        token={auth.token || ''}
        files={shareFiles}
      />
    </div>
  );
}
