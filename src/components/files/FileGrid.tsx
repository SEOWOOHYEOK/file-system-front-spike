/**
 * FileGrid - 파일/폴더 그리드 뷰
 * 네이버 MYBOX 스타일의 그리드 레이아웃
 */
import { FileItemGrid } from './FileItem';

/** 등록자 정보 */
interface CreatedByInfo {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
}

interface FolderItem {
  id: string;
  name: string;
  path: string;
  storageStatus: { nas: string | null };
  fileCount: number;
  folderCount: number;
  /** 폴더 등록자 정보 */
  createdBy?: CreatedByInfo | null;
  updatedAt: string;
}

interface FileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  storageStatus: { cache: string | null; nas: string | null };
  updatedAt: string;
}

interface SelectedItem {
  id: string;
  type: 'file' | 'folder';
  name: string;
}

interface FileGridProps {
  folders: FolderItem[];
  files: FileItem[];
  onFolderClick: (folderId: string) => void;
  onFileClick: (fileId: string) => void;
  onContextMenu: (item: SelectedItem, x: number, y: number) => void;
  selectedItems: string[];
  onSelectionChange: (ids: string[]) => void;
  isFavorite: (id: string) => boolean;
}

export function FileGrid({
  folders,
  files,
  onFolderClick,
  onFileClick,
  onContextMenu,
  selectedItems,
  onSelectionChange,
  isFavorite,
}: FileGridProps) {
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
      // Shift + 클릭: 범위 선택 (간단히 구현)
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

  const isEmpty = folders.length === 0 && files.length === 0;

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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {/* 폴더 */}
      {folders.map((folder) => (
        <FileItemGrid
          key={folder.id}
          id={folder.id}
          name={folder.name}
          type="folder"
          updatedAt={folder.updatedAt}
          isSelected={selectedSet.has(folder.id)}
          isFavorite={isFavorite(folder.id)}
          onClick={(e) => handleItemClick(folder.id, e)}
          onDoubleClick={() => onFolderClick(folder.id)}
          onContextMenu={(e) => handleContextMenu(folder, 'folder', e)}
        />
      ))}

      {/* 파일 */}
      {files.map((file) => (
        <FileItemGrid
          key={file.id}
          id={file.id}
          name={file.name}
          type="file"
          mimeType={file.mimeType}
          size={file.size}
          updatedAt={file.updatedAt}
          isSelected={selectedSet.has(file.id)}
          isFavorite={isFavorite(file.id)}
          onClick={(e) => handleItemClick(file.id, e)}
          onDoubleClick={() => onFileClick(file.id)}
          onContextMenu={(e) => handleContextMenu(file, 'file', e)}
        />
      ))}
    </div>
  );
}
