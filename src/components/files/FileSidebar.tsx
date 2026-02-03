/**
 * FileSidebar - 파일 관리 사이드바
 * 네이버 MYBOX 스타일의 좌측 네비게이션
 */

interface StorageInfo {
  used: number;
  total: number;
}

interface FileSidebarProps {
  currentView: 'all' | 'recent' | 'favorites' | 'trash';
  onViewChange: (view: 'all' | 'recent' | 'favorites' | 'trash') => void;
  storageInfo?: StorageInfo | null;
}

const menuItems = [
  { id: 'all' as const, label: '모든 파일', icon: '📁' },
  { id: 'recent' as const, label: '최근', icon: '🕐' },
  { id: 'favorites' as const, label: '즐겨찾기', icon: '⭐' },
  { id: 'trash' as const, label: '휴지통', icon: '🗑️' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function FileSidebar({ currentView, onViewChange, storageInfo }: FileSidebarProps) {
  const usagePercent = storageInfo 
    ? Math.min((storageInfo.used / storageInfo.total) * 100, 100) 
    : 0;

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
      {/* 로고/제목 */}
      <div className="p-4 border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">내 파일</h1>
        <p className="text-xs text-gray-500">클라우드 스토리지</p>
      </div>

      {/* 네비게이션 메뉴 */}
      <nav className="flex-1 py-2">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center px-4 py-2.5 text-sm transition-colors ${
                  currentView === item.id
                    ? 'bg-blue-50 text-blue-600 font-medium border-r-2 border-blue-500'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* 스토리지 용량 표시 */}
      {storageInfo && (
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">저장 용량</span>
            <span className="text-xs text-gray-700">
              {formatBytes(storageInfo.used)} / {formatBytes(storageInfo.total)}
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                usagePercent > 90 ? 'bg-red-500' :
                usagePercent > 70 ? 'bg-yellow-500' :
                'bg-blue-500'
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 mt-1 text-right">
            {usagePercent.toFixed(1)}% 사용
          </div>
        </div>
      )}
    </aside>
  );
}
