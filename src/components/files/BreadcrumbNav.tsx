/**
 * BreadcrumbNav - 브레드크럼 네비게이션
 * 현재 폴더 경로를 표시하고 클릭하여 이동
 */

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface BreadcrumbNavProps {
  breadcrumbs: BreadcrumbItem[];
  onNavigate: (folderId: string) => void;
}

export function BreadcrumbNav({ breadcrumbs, onNavigate }: BreadcrumbNavProps) {
  return (
    <nav className="bg-gray-50 border-b border-gray-200 px-6 py-2">
      <ol className="flex items-center space-x-2 text-sm">
        {breadcrumbs.map((item, index) => (
          <li key={item.id} className="flex items-center">
            {index > 0 && (
              <svg
                className="w-4 h-4 text-gray-400 mx-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {index === breadcrumbs.length - 1 ? (
              // 현재 위치 (마지막)
              <span className="text-gray-900 font-medium">
                {item.name || '내 파일'}
              </span>
            ) : (
              // 클릭 가능한 링크
              <button
                onClick={() => onNavigate(item.id)}
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                {item.name || '내 파일'}
              </button>
            )}
          </li>
        ))}
        {breadcrumbs.length === 0 && (
          <li className="text-gray-900 font-medium">내 파일</li>
        )}
      </ol>
    </nav>
  );
}
