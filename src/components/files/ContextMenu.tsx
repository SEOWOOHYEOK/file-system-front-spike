/**
 * ContextMenu - 우클릭 컨텍스트 메뉴
 * 파일/폴더 작업 메뉴
 */
import { useEffect, useRef } from "react";

interface ContextMenuProps {
  x: number;
  y: number;
  itemType: "file" | "folder";
  isFavorite: boolean;
  onAction: (action: string) => void;
  onClose: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  separator?: boolean;
  danger?: boolean;
}

export function ContextMenu({
  x,
  y,
  itemType,
  isFavorite,
  onAction,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 메뉴가 화면 밖으로 나가지 않도록 위치 조정
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const adjustedX = x + rect.width > window.innerWidth ? x - rect.width : x;
      const adjustedY =
        y + rect.height > window.innerHeight ? y - rect.height : y;
      menuRef.current.style.left = `${adjustedX}px`;
      menuRef.current.style.top = `${adjustedY}px`;
    }
  }, [x, y]);

  // Escape 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const fileMenuItems: MenuItem[] = [
    { id: "preview", label: "미리보기", icon: "👁️" },
    { id: "download", label: "다운로드", icon: "📥" },
    { id: "share", label: "공유", icon: "📨" },
    { id: "rename", label: "이름 변경", icon: "✏️" },
    { id: "move", label: "이동", icon: "📂" },
    {
      id: "favorite",
      label: isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가",
      icon: isFavorite ? "⭐" : "☆",
    },
    { id: "delete", label: "삭제", icon: "🗑️", separator: true, danger: true },
    { id: "moveRequest", label: "이동 요청", icon: "📋", separator: true },
    { id: "deleteRequest", label: "삭제 요청", icon: "📝", danger: true },
  ];

  const folderMenuItems: MenuItem[] = [
    { id: "open", label: "열기", icon: "📁" },
    { id: "rename", label: "이름 변경", icon: "✏️" },
    { id: "move", label: "이동", icon: "📂" },
    {
      id: "favorite",
      label: isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가",
      icon: isFavorite ? "⭐" : "☆",
    },
    { id: "delete", label: "삭제", icon: "🗑️", separator: true, danger: true },
    {
      id: "folderMoveRequest",
      label: "폴더 이동 요청",
      icon: "📋",
      separator: true,
    },
  ];

  const menuItems = itemType === "folder" ? folderMenuItems : fileMenuItems;

  return (
    <div
      ref={menuRef}
      className='fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[180px]'
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item, index) => (
        <div key={item.id}>
          {item.separator && index > 0 && (
            <div className='my-1 border-t border-gray-200' />
          )}
          <button
            onClick={() => onAction(item.id)}
            className={`w-full flex items-center px-4 py-2 text-sm transition-colors ${
              item.danger
                ? "text-red-600 hover:bg-red-50"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <span className='mr-3'>{item.icon}</span>
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}
