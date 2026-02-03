/**
 * FileModals - 파일/폴더 관련 모달들
 * 새 폴더 생성, 이름 변경, 이동, 삭제 확인 모달
 */
import { useState, useEffect, useCallback } from 'react';
import { folderApi } from '../../api/folderApi';

type ModalType = 'none' | 'createFolder' | 'rename' | 'move' | 'delete';

interface SelectedItem {
  id: string;
  type: 'file' | 'folder';
  name: string;
}

interface FolderTreeNode {
  id: string;
  name: string;
  children: FolderTreeNode[] | null;
  isExpanded: boolean;
  isLoading: boolean;
}

interface FileModalsProps {
  activeModal: ModalType;
  modalInput: string;
  onModalInputChange: (value: string) => void;
  onClose: () => void;
  onCreateFolder: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  targetItem: SelectedItem | null;
  loading: boolean;
  // 이동 모달용
  currentFolderId: string | null;
  moveTargetFolderId: string;
  onMoveTargetChange: (folderId: string) => void;
  token: string;
}

export function FileModals({
  activeModal,
  modalInput,
  onModalInputChange,
  onClose,
  onCreateFolder,
  onRename,
  onMove,
  onDelete,
  targetItem,
  loading,
  currentFolderId,
  moveTargetFolderId,
  onMoveTargetChange,
  token,
}: FileModalsProps) {
  // 폴더 트리 상태 (이동 모달용)
  const [folderTree, setFolderTree] = useState<FolderTreeNode | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);

  // 폴더 트리 초기화
  const initFolderTree = useCallback(async () => {
    if (!token) return;
    setTreeLoading(true);
    try {
      const rootFolder = await folderApi.getRoot(token);
      const contents = await folderApi.getContents(token, rootFolder.id);
      const rootNode: FolderTreeNode = {
        id: rootFolder.id,
        name: '내 파일',
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
      onMoveTargetChange(rootFolder.id);
    } catch (error) {
      console.error('Failed to init folder tree:', error);
    } finally {
      setTreeLoading(false);
    }
  }, [token, onMoveTargetChange]);

  // 이동 모달 열릴 때 트리 초기화
  useEffect(() => {
    if (activeModal === 'move' && !folderTree) {
      initFolderTree();
    }
  }, [activeModal, folderTree, initFolderTree]);

  // 모달 닫힐 때 트리 초기화
  useEffect(() => {
    if (activeModal === 'none') {
      setFolderTree(null);
    }
  }, [activeModal]);

  // 트리 노드 업데이트
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

  // 폴더 확장/축소
  const toggleFolderExpand = useCallback(async (folderId: string) => {
    if (!token || !folderTree) return;

    const findNode = (node: FolderTreeNode, id: string): FolderTreeNode | null => {
      if (node.id === id) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findNode(child, id);
          if (found) return found;
        }
      }
      return null;
    };

    const targetNode = findNode(folderTree, folderId);
    if (!targetNode) return;

    if (targetNode.isExpanded) {
      setFolderTree((prev) =>
        prev ? updateNodeInTree(prev, folderId, (n) => ({ ...n, isExpanded: false })) : null
      );
      return;
    }

    if (targetNode.children === null) {
      setFolderTree((prev) =>
        prev ? updateNodeInTree(prev, folderId, (n) => ({ ...n, isLoading: true })) : null
      );

      try {
        const contents = await folderApi.getContents(token, folderId);
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
      setFolderTree((prev) =>
        prev ? updateNodeInTree(prev, folderId, (n) => ({ ...n, isExpanded: true })) : null
      );
    }
  }, [token, folderTree, updateNodeInTree]);

  // 트리 노드 렌더링
  const renderTreeNode = (node: FolderTreeNode, depth: number = 0, excludeId?: string): React.ReactNode => {
    if (node.id === excludeId) return null;

    const indent = depth * 20;
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = moveTargetFolderId === node.id;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center py-1.5 cursor-pointer hover:bg-gray-100 rounded ${
            isSelected ? 'bg-blue-100' : ''
          }`}
          style={{ paddingLeft: `${indent + 8}px` }}
        >
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (node.children === null || (hasChildren && node.children.filter(c => c.id !== excludeId).length > 0)) {
                toggleFolderExpand(node.id);
              }
            }}
            className="w-5 text-center text-gray-600 select-none"
          >
            {node.isLoading ? (
              <span className="text-xs animate-spin">⏳</span>
            ) : node.children === null ? (
              <span className="text-gray-400">▶</span>
            ) : hasChildren && node.children.filter(c => c.id !== excludeId).length > 0 ? (
              node.isExpanded ? '▼' : '▶'
            ) : (
              <span className="text-gray-300">•</span>
            )}
          </span>

          <span
            onClick={() => onMoveTargetChange(node.id)}
            className="flex items-center flex-1 ml-1"
          >
            <span className="mr-2">📁</span>
            <span className={isSelected ? 'font-medium text-blue-600' : ''}>
              {node.name}
            </span>
          </span>
        </div>

        {node.isExpanded && node.children && (
          <div>
            {node.children
              .filter(child => child.id !== excludeId)
              .map(child => renderTreeNode(child, depth + 1, excludeId))}
          </div>
        )}
      </div>
    );
  };

  // 선택된 폴더 이름 찾기
  const findFolderName = (node: FolderTreeNode | null, id: string): string => {
    if (!node) return '';
    if (node.id === id) return node.name;
    if (node.children) {
      for (const child of node.children) {
        const found = findFolderName(child, id);
        if (found) return found;
      }
    }
    return '';
  };

  if (activeModal === 'none') return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* 새 폴더 생성 */}
        {activeModal === 'createFolder' && (
          <>
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">새 폴더 만들기</h3>
            </div>
            <div className="px-6 py-4">
              <input
                type="text"
                value={modalInput}
                onChange={(e) => onModalInputChange(e.target.value)}
                placeholder="폴더 이름을 입력하세요"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && modalInput.trim()) {
                    onCreateFolder();
                  }
                }}
              />
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={onCreateFolder}
                disabled={loading || !modalInput.trim()}
                className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-lg disabled:opacity-50"
              >
                {loading ? '생성 중...' : '생성'}
              </button>
            </div>
          </>
        )}

        {/* 이름 변경 */}
        {activeModal === 'rename' && targetItem && (
          <>
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">이름 변경</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-500 mb-3">
                {targetItem.type === 'folder' ? '폴더' : '파일'}: {targetItem.name}
              </p>
              <input
                type="text"
                value={modalInput}
                onChange={(e) => onModalInputChange(e.target.value)}
                placeholder="새 이름을 입력하세요"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && modalInput.trim()) {
                    onRename();
                  }
                }}
              />
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={onRename}
                disabled={loading || !modalInput.trim()}
                className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-lg disabled:opacity-50"
              >
                {loading ? '변경 중...' : '변경'}
              </button>
            </div>
          </>
        )}

        {/* 이동 */}
        {activeModal === 'move' && targetItem && (
          <>
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">이동</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-500 mb-3">
                이동할 {targetItem.type === 'folder' ? '폴더' : '파일'}: <span className="font-medium text-gray-700">{targetItem.name}</span>
              </p>

              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {treeLoading ? (
                  <div className="p-4 text-center text-gray-500">
                    폴더 목록 불러오는 중...
                  </div>
                ) : folderTree ? (
                  <div className="py-2">
                    {renderTreeNode(folderTree, 0, targetItem.type === 'folder' ? targetItem.id : undefined)}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    폴더 목록을 불러올 수 없습니다
                  </div>
                )}
              </div>

              {moveTargetFolderId && folderTree && (
                <p className="text-sm text-blue-600 mt-3">
                  선택된 폴더: <span className="font-medium">{findFolderName(folderTree, moveTargetFolderId)}</span>
                </p>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={onMove}
                disabled={loading || !moveTargetFolderId}
                className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-lg disabled:opacity-50"
              >
                {loading ? '이동 중...' : '이동'}
              </button>
            </div>
          </>
        )}

        {/* 삭제 확인 */}
        {activeModal === 'delete' && targetItem && (
          <>
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">삭제 확인</h3>
            </div>
            <div className="px-6 py-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-xl">🗑️</span>
                </div>
                <div>
                  <p className="text-gray-900">
                    "<span className="font-medium">{targetItem.name}</span>"을(를) 삭제하시겠습니까?
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {targetItem.type === 'folder' 
                      ? '폴더와 하위 항목이 휴지통으로 이동됩니다.' 
                      : '파일이 휴지통으로 이동됩니다.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={onDelete}
                disabled={loading}
                className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-lg disabled:opacity-50"
              >
                {loading ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
