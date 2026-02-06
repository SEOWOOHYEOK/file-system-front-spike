/**
 * FileList - 파일/폴더 리스트 뷰
 * 테이블 형식의 목록 레이아웃
 */
import { FileItemList } from './FileItem';

interface FolderItem {
  id: string;
  name: string;
  path: string;
  storageStatus: { nas: string | null };
  fileCount: number;
  folderCount: number;
  updatedAt: string;
}

interface FileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  storageStatus: { cache: string | null; nas: string | null };
  /** 파일 생성자 (업로더) ID */
  createdBy?: string;
  updatedAt: string;
}

interface SelectedItem {
  id: string;
  type: 'file' | 'folder';
  name: string;
}

interface FileListProps {
  folders: FolderItem[];
  files: FileItem[];
  onFolderClick: (folderId: string) => void;
  onFileClick: (fileId: string) => void;
  onContextMenu: (item: SelectedItem, x: number, y: number) => void;
  selectedItems: string[];
  onSelectionChange: (ids: string[]) => void;
  isFavorite: (id: string) => boolean;
}

export function FileList({
  folders,
  files,
  onFolderClick,
  onFileClick,
  onContextMenu,
  selectedItems,
  onSelectionChange,
  isFavorite,
}: FileListProps) {
  // O(1) 조회를 위한 Set 변환 (js-set-map-lookups 규칙)
  const selectedSet = new Set(selectedItems);

  const handleItemClick = (id: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd + 클릭: 선택 토글
      if (selectedSet.has(id)) {
        onSelectionChange(selectedItems.filter(i => i !== id));
      } else {
        onSelectionChange([...selectedItems, id]);
      }
    } else if (e.shiftKey && selectedItems.length > 0) {
      // Shift + 클릭: 범위 선택
      onSelectionChange([...selectedItems, id]);
    } else {
      // 일반 클릭: 단일 선택
      onSelectionChange([id]);
    }
  };

  const handleContextMenu = (
    item: { id: string; name: string },
    type: 'file' | 'folder',
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu({ id: item.id, type, name: item.name }, e.clientX, e.clientY);
  };

  const handleSelectAll = () => {
    const allIds = [...folders.map(f => f.id), ...files.map(f => f.id)];
    if (selectedItems.length === allIds.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(allIds);
    }
  };

  const isEmpty = folders.length === 0 && files.length === 0;
  const allSelected = selectedItems.length === folders.length + files.length && selectedItems.length > 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <span className="text-6xl mb-4">📂</span>
        <p>폴더가 비어있습니다</p>
        <p className="text-sm mt-1">파일을 업로드하거나 새 폴더를 만들어보세요</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left">
              <div className="flex items-center">
                <div
                  onClick={handleSelectAll}
                  className={`w-5 h-5 mr-3 rounded border flex items-center justify-center cursor-pointer ${
                    allSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {allSelected && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">이름</span>
              </div>
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              파일 유형
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              크기
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              등록자
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              수정일
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {/* 폴더 */}
          {folders.map((folder) => (
            <FileItemList
              key={folder.id}
              id={folder.id}
              name={folder.name}
              type="folder"
              updatedAt={folder.updatedAt}
              folderCount={folder.folderCount}
              fileCount={folder.fileCount}
              isSelected={selectedSet.has(folder.id)}
              isFavorite={isFavorite(folder.id)}
              onClick={(e) => handleItemClick(folder.id, e)}
              onDoubleClick={() => onFolderClick(folder.id)}
              onContextMenu={(e) => handleContextMenu(folder, 'folder', e)}
            />
          ))}

          {/* 파일 */}
          {files.map((file) => (
            <FileItemList
              key={file.id}
              id={file.id}
              name={file.name}
              type="file"
              mimeType={file.mimeType}
              size={file.size}
              createdBy={file.createdBy}
              updatedAt={file.updatedAt}
              isSelected={selectedSet.has(file.id)}
              isFavorite={isFavorite(file.id)}
              onClick={(e) => handleItemClick(file.id, e)}
              onDoubleClick={() => onFileClick(file.id)}
              onContextMenu={(e) => handleContextMenu(file, 'file', e)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
