/**
 * FileActionRequestModal - 파일/폴더 이동·삭제 요청 모달
 * 승인자 선택 + 사유 입력 → 요청 생성
 */
import { useState, useEffect, useCallback } from 'react';
import { fileActionRequestApi } from '../../api/fileActionRequestApi';
import { folderActionRequestApi } from '../../api/folderActionRequestApi';
import { folderApi } from '../../api/folderApi';
import type {
  FileActionType,
  ApproverUser,
  TargetType,
} from '../../types/file-action-request.types';

interface FileActionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  // File props (existing)
  fileId: string;
  fileName: string;
  requestType: FileActionType;
  onSuccess: () => void;
  // Folder props (optional)
  targetType?: TargetType;
  folderId?: string;
  folderName?: string;
}

interface FolderTreeNode {
  id: string;
  name: string;
  children: FolderTreeNode[] | null;
  isExpanded: boolean;
  isLoading: boolean;
}

export function FileActionRequestModal({
  isOpen,
  onClose,
  token,
  fileId,
  fileName,
  requestType,
  onSuccess,
  targetType = 'FILE',
  folderId,
  folderName,
}: FileActionRequestModalProps) {
  const isFolder = targetType === 'FOLDER';
  const [reason, setReason] = useState('');
  const [approvers, setApprovers] = useState<ApproverUser[]>([]);
  const [selectedApproverId, setSelectedApproverId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingApprovers, setLoadingApprovers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이동 요청용 상태
  const [targetFolderId, setTargetFolderId] = useState('');
  const [folderTree, setFolderTree] = useState<FolderTreeNode | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);

  // 승인자 목록 로드
  useEffect(() => {
    if (!isOpen || !token) return;
    setLoadingApprovers(true);
    setError(null);

    const loadApprovers = isFolder
      ? folderActionRequestApi.getApprovers(token)
      : fileActionRequestApi.getApprovers(token, requestType);

    loadApprovers
      .then((data) => {
        setApprovers(data);
        if (data.length > 0) {
          setSelectedApproverId(data[0].id);
        }
      })
      .catch((err) => {
        console.error('Failed to load approvers:', err);
        setError('승인자 목록을 불러올 수 없습니다.');
      })
      .finally(() => setLoadingApprovers(false));
  }, [isOpen, token, requestType, isFolder]);

  // 이동 요청일 때 폴더 트리 초기화
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
      setTargetFolderId(rootFolder.id);
    } catch (err) {
      console.error('Failed to init folder tree:', err);
    } finally {
      setTreeLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const shouldShowFolderTree = isFolder || requestType === 'MOVE';
    if (isOpen && shouldShowFolderTree && !folderTree) {
      initFolderTree();
    }
  }, [isOpen, requestType, isFolder, folderTree, initFolderTree]);

  // 모달 닫기 시 초기화
  useEffect(() => {
    if (!isOpen) {
      setReason('');
      setSelectedApproverId('');
      setTargetFolderId('');
      setFolderTree(null);
      setError(null);
    }
  }, [isOpen]);

  // 트리 노드 업데이트
  const updateNodeInTree = useCallback(
    (
      node: FolderTreeNode,
      targetId: string,
      updater: (n: FolderTreeNode) => FolderTreeNode,
    ): FolderTreeNode => {
      if (node.id === targetId) return updater(node);
      if (node.children) {
        return {
          ...node,
          children: node.children.map((child) =>
            updateNodeInTree(child, targetId, updater),
          ),
        };
      }
      return node;
    },
    [],
  );

  // 폴더 확장/축소
  const toggleFolderExpand = useCallback(
    async (folderId: string) => {
      if (!token || !folderTree) return;

      const findNode = (
        node: FolderTreeNode,
        id: string,
      ): FolderTreeNode | null => {
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
          prev
            ? updateNodeInTree(prev, folderId, (n) => ({
                ...n,
                isExpanded: false,
              }))
            : null,
        );
        return;
      }

      if (targetNode.children === null) {
        setFolderTree((prev) =>
          prev
            ? updateNodeInTree(prev, folderId, (n) => ({
                ...n,
                isLoading: true,
              }))
            : null,
        );

        try {
          const contents = await folderApi.getContents(token, folderId);
          setFolderTree((prev) =>
            prev
              ? updateNodeInTree(prev, folderId, (n) => ({
                  ...n,
                  children: contents.folders.map((f) => ({
                    id: f.id,
                    name: f.name,
                    children: null,
                    isExpanded: false,
                    isLoading: false,
                  })),
                  isExpanded: true,
                  isLoading: false,
                }))
              : null,
          );
        } catch {
          setFolderTree((prev) =>
            prev
              ? updateNodeInTree(prev, folderId, (n) => ({
                  ...n,
                  isLoading: false,
                }))
              : null,
          );
        }
      } else {
        setFolderTree((prev) =>
          prev
            ? updateNodeInTree(prev, folderId, (n) => ({
                ...n,
                isExpanded: true,
              }))
            : null,
        );
      }
    },
    [token, folderTree, updateNodeInTree],
  );

  // 폴더 트리 노드 렌더링
  const renderTreeNode = (
    node: FolderTreeNode,
    depth: number = 0,
  ): React.ReactNode => {
    const indent = depth * 20;
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = targetFolderId === node.id;

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
              if (node.children === null || hasChildren) {
                toggleFolderExpand(node.id);
              }
            }}
            className="w-5 text-center text-gray-600 select-none"
          >
            {node.isLoading ? (
              <span className="text-xs animate-spin">...</span>
            ) : node.children === null ? (
              <span className="text-gray-400">&#9654;</span>
            ) : hasChildren ? (
              node.isExpanded ? (
                '&#9660;'
              ) : (
                '&#9654;'
              )
            ) : (
              <span className="text-gray-300">-</span>
            )}
          </span>
          <span
            onClick={() => setTargetFolderId(node.id)}
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
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // 요청 제출
  const handleSubmit = async () => {
    if (!token || !reason.trim() || !selectedApproverId) return;
    const needsTargetFolder = isFolder || requestType === 'MOVE';
    if (needsTargetFolder && !targetFolderId) return;
    if (isFolder && !folderId) return;

    setLoading(true);
    setError(null);

    try {
      if (isFolder) {
        await folderActionRequestApi.createMoveRequest(token, {
          folderId: folderId!,
          targetParentFolderId: targetFolderId,
          reason: reason.trim(),
          designatedApproverId: selectedApproverId,
        });
      } else if (requestType === 'MOVE') {
        await fileActionRequestApi.createMoveRequest(token, {
          fileId,
          targetFolderId,
          reason: reason.trim(),
          designatedApproverId: selectedApproverId,
        });
      } else {
        await fileActionRequestApi.createDeleteRequest(token, {
          fileId,
          reason: reason.trim(),
          designatedApproverId: selectedApproverId,
        });
      }

      const successMessage = isFolder
        ? '폴더 이동 요청이 생성되었습니다.'
        : requestType === 'MOVE'
          ? '이동 요청이 생성되었습니다.'
          : '삭제 요청이 생성되었습니다.';
      alert(successMessage);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Failed to create request:', err);
      let errorMessage = '요청 생성에 실패했습니다.';
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string; code?: number } } };
        const code = axiosErr.response?.data?.code;
        if (code === 10002) {
          errorMessage = '이 파일에 대해 이미 진행 중인 요청이 있습니다.';
        } else if (code === 10102) {
          errorMessage = '이 폴더에 대해 이미 진행 중인 요청이 있습니다.';
        } else if (axiosErr.response?.data?.message) {
          errorMessage = axiosErr.response.data.message;
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            {isFolder
              ? '📁 폴더 이동 요청'
              : requestType === 'MOVE'
                ? '📂 파일 이동 요청'
                : '🗑️ 파일 삭제 요청'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {isFolder ? '폴더' : '파일'}:{' '}
            <span className="font-medium text-gray-700">
              {isFolder ? (folderName ?? '') : fileName}
            </span>
          </p>
        </div>

        {/* 본문 */}
        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* 이동 대상 폴더 선택 (MOVE 또는 FOLDER) */}
          {(isFolder || requestType === 'MOVE') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이동 대상 폴더
              </label>
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {treeLoading ? (
                  <div className="p-4 text-center text-gray-500">
                    폴더 목록 불러오는 중...
                  </div>
                ) : folderTree ? (
                  <div className="py-2">{renderTreeNode(folderTree, 0)}</div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    폴더 목록을 불러올 수 없습니다
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 승인자 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              승인자 지정
            </label>
            {loadingApprovers ? (
              <div className="text-sm text-gray-500">승인자 목록 불러오는 중...</div>
            ) : approvers.length > 0 ? (
              <select
                value={selectedApproverId}
                onChange={(e) => setSelectedApproverId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {approvers.map((approver) => (
                  <option key={approver.id} value={approver.id}>
                    {approver.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-sm text-red-500">
                승인 가능한 사용자가 없습니다.
              </div>
            )}
          </div>

          {/* 요청 사유 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              요청 사유
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="요청 사유를 입력하세요"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              loading ||
              !reason.trim() ||
              !selectedApproverId ||
              ((isFolder || requestType === 'MOVE') && !targetFolderId)
            }
            className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 ${
              isFolder || requestType === 'MOVE'
                ? 'bg-blue-500 hover:bg-blue-600'
                : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {loading ? '요청 중...' : '요청 생성'}
          </button>
        </div>
      </div>
    </div>
  );
}
