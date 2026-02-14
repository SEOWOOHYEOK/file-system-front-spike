/**
 * FileSidebar - 파일 관리 사이드바
 * api-guide-file-share.md 기반 네비게이션
 *
 * 701-A. 파일 공유 결제 (내가 보낸 결제 요청: PENDING / APPROVED / REJECTED / CANCELED)
 * 701-B. 내 공유 관리 (보낸 공유 통합 목록)
 * 702. 받은 공유 요청 관리 (PENDING / APPROVED / REJECTED)
 */

import { useState } from "react";

// ─── 타입 ───

interface StorageInfo {
  used: number;
  total: number;
}

export type ViewType =
  | "all"
  | "recent"
  | "favorites"
  | "trash"
  | "sentShares"
  | "sentRequestPending"
  | "sentRequestApproved"
  | "sentRequestRejected"
  | "sentRequestCanceled"
  | "receivedPending"
  | "receivedApproved"
  | "receivedRejected"
  | "myActionRequests";

interface FileSidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  storageInfo?: StorageInfo | null;
  sentShareCount?: number;
  sentRequestCounts?: {
    pending: number;
    approved: number;
    rejected: number;
    canceled: number;
  };
  receivedCounts?: {
    pending: number;
    approved: number;
    rejected: number;
  };
}

// ─── SVG 아이콘 컴포넌트 ───

function IconFolder({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill='none'
      viewBox='0 0 24 24'
      strokeWidth={1.5}
      stroke='currentColor'
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z'
      />
    </svg>
  );
}

function IconClock({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill='none'
      viewBox='0 0 24 24'
      strokeWidth={1.5}
      stroke='currentColor'
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'
      />
    </svg>
  );
}

function IconStar({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill='none'
      viewBox='0 0 24 24'
      strokeWidth={1.5}
      stroke='currentColor'
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z'
      />
    </svg>
  );
}

function IconTrash({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill='none'
      viewBox='0 0 24 24'
      strokeWidth={1.5}
      stroke='currentColor'
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0'
      />
    </svg>
  );
}

function IconShare({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill='none'
      viewBox='0 0 24 24'
      strokeWidth={1.5}
      stroke='currentColor'
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z'
      />
    </svg>
  );
}

function IconPaperAirplane({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill='none'
      viewBox='0 0 24 24'
      strokeWidth={1.5}
      stroke='currentColor'
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5'
      />
    </svg>
  );
}

// NOTE: IconInboxArrowDown 는 702 "받은 공유 요청" 부활 시 함께 복원
// function IconInboxArrowDown({ className = 'w-5 h-5' }: { className?: string }) {
//   return (
//     <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
//       <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75H6.912a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859M12 3v8.25m0 0-3-3m3 3 3-3" />
//     </svg>
//   );
// }

function IconClockPending({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill='none'
      viewBox='0 0 24 24'
      strokeWidth={1.5}
      stroke='currentColor'
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'
      />
    </svg>
  );
}

function IconCheckCircle({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill='none'
      viewBox='0 0 24 24'
      strokeWidth={1.5}
      stroke='currentColor'
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'
      />
    </svg>
  );
}

function IconXCircle({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill='none'
      viewBox='0 0 24 24'
      strokeWidth={1.5}
      stroke='currentColor'
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'
      />
    </svg>
  );
}

function IconNoSymbol({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill='none'
      viewBox='0 0 24 24'
      strokeWidth={1.5}
      stroke='currentColor'
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636'
      />
    </svg>
  );
}

function IconDocumentText({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill='none'
      viewBox='0 0 24 24'
      strokeWidth={1.5}
      stroke='currentColor'
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z'
      />
    </svg>
  );
}

function IconChevronDown({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill='none'
      viewBox='0 0 24 24'
      strokeWidth={2}
      stroke='currentColor'
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='m19.5 8.25-7.5 7.5-7.5-7.5'
      />
    </svg>
  );
}

function IconChevronRight({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill='none'
      viewBox='0 0 24 24'
      strokeWidth={2}
      stroke='currentColor'
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='m8.25 4.5 7.5 7.5-7.5 7.5'
      />
    </svg>
  );
}

// ─── 유틸 ───

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** 카운트 배지 */
function CountBadge({
  count,
  variant = "default",
}: {
  count: number;
  variant?: "default" | "warning" | "success" | "danger";
}) {
  if (count <= 0) return null;

  const colorMap = {
    default: "bg-gray-100 text-gray-600",
    warning: "bg-amber-100 text-amber-700",
    success: "bg-emerald-100 text-emerald-700",
    danger: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium rounded-full ${colorMap[variant]}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// NOTE: NotificationDot 는 702 "받은 공유 요청" 부활 시 함께 복원
// /** 알림 도트 (빨간 점) */
// function NotificationDot() {
//   return (
//     <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
//       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
//       <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
//     </span>
//   );
// }

// ─── 메인 컴포넌트 ───

export function FileSidebar({
  currentView,
  onViewChange,
  storageInfo,
  sentShareCount = 0,
  sentRequestCounts = { pending: 0, approved: 0, rejected: 0, canceled: 0 },
  // NOTE: receivedCounts 는 702 "받은 공유 요청" 부활 시 함께 복원
  receivedCounts: _receivedCounts = { pending: 0, approved: 0, rejected: 0 },
}: FileSidebarProps) {
  void _receivedCounts; // 추후 부활용 - lint 경고 방지
  const [sentShareExpanded, setSentShareExpanded] = useState(true);
  const [sentRequestExpanded, setSentRequestExpanded] = useState(true);
  // NOTE: receivedExpanded 는 702 "받은 공유 요청" 부활 시 함께 복원
  // const [receivedExpanded, setReceivedExpanded] = useState(true);

  const usagePercent = storageInfo
    ? Math.min((storageInfo.used / storageInfo.total) * 100, 100)
    : 0;

  // NOTE: totalReceivedCount 는 702 "받은 공유 요청" 부활 시 함께 복원
  // const totalReceivedCount =
  //   receivedCounts.pending + receivedCounts.approved + receivedCounts.rejected;

  // ── 네비게이션 버튼 스타일 ──
  const navButtonClass = (id: ViewType) =>
    `w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
      currentView === id
        ? "bg-blue-50 text-blue-700 font-medium"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  // ── 하위 메뉴 버튼 스타일 ──
  const subNavClass = (id: ViewType) =>
    `w-full flex items-center gap-2.5 pl-10 pr-3 py-1.5 text-sm rounded-lg transition-colors ${
      currentView === id
        ? "bg-blue-50 text-blue-700 font-medium"
        : "text-gray-600 hover:bg-gray-100"
    }`;

  // ── 섹션 토글 버튼 스타일 ──
  const sectionToggleClass = (isActive: boolean) =>
    `w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
      isActive ? "text-gray-900 font-medium" : "text-gray-700 hover:bg-gray-100"
    }`;

  const isSentShareActive = currentView === "sentShares";
  const isSentRequestActive =
    currentView === "sentRequestPending" ||
    currentView === "sentRequestApproved" ||
    currentView === "sentRequestRejected" ||
    currentView === "sentRequestCanceled";
  // NOTE: isReceivedActive 는 702 "받은 공유 요청" 부활 시 함께 복원
  // const isReceivedActive =
  //   currentView === 'receivedPending' ||
  //   currentView === 'receivedApproved' ||
  //   currentView === 'receivedRejected';

  return (
    <aside className='w-60 bg-white border-r border-gray-200 flex flex-col select-none'>
      {/* 로고/제목 */}
      <div className='px-4 py-4 border-b border-gray-100'>
        <h1 className='text-lg font-bold text-gray-900 tracking-tight'>
          내 파일
        </h1>
        <p className='text-xs text-gray-400 mt-0.5'>클라우드 스토리지</p>
      </div>

      {/* 네비게이션 메뉴 */}
      <nav className='flex-1 overflow-y-auto px-2 py-3'>
        {/* 파일 관리 섹션 */}
        <div className='space-y-0.5'>
          <button
            onClick={() => onViewChange("all")}
            className={navButtonClass("all")}
          >
            <IconFolder
              className={`w-5 h-5 flex-shrink-0 ${
                currentView === "all" ? "text-blue-600" : "text-gray-400"
              }`}
            />
            <span>모든 파일</span>
          </button>

          <button
            onClick={() => onViewChange("recent")}
            className={navButtonClass("recent")}
          >
            <IconClock
              className={`w-5 h-5 flex-shrink-0 ${
                currentView === "recent" ? "text-blue-600" : "text-gray-400"
              }`}
            />
            <span>최근</span>
          </button>

          <button
            onClick={() => onViewChange("favorites")}
            className={navButtonClass("favorites")}
          >
            <IconStar
              className={`w-5 h-5 flex-shrink-0 ${
                currentView === "favorites" ? "text-blue-600" : "text-gray-400"
              }`}
            />
            <span>즐겨찾기</span>
          </button>

          <button
            onClick={() => onViewChange("trash")}
            className={navButtonClass("trash")}
          >
            <IconTrash
              className={`w-5 h-5 flex-shrink-0 ${
                currentView === "trash" ? "text-blue-600" : "text-gray-400"
              }`}
            />
            <span>휴지통</span>
          </button>
        </div>

        {/* 구분선 + 섹션 라벨 */}
        <div className='mt-5 mb-2'>
          <div className='flex items-center gap-2 px-3'>
            <IconShare className='w-4 h-4 text-gray-400 flex-shrink-0' />
            <span className='text-xs font-semibold text-gray-400 uppercase tracking-wider'>
              파일 공유 관리
            </span>
          </div>
        </div>

        {/* ── 701. 내 공유 관리 (접기/펼치기) ── */}
        <div className='space-y-0.5'>
          <button
            onClick={() => {
              setSentShareExpanded((e) => !e);
              if (!sentShareExpanded) onViewChange("sentShares");
            }}
            className={sectionToggleClass(isSentShareActive)}
          >
            <IconPaperAirplane
              className={`w-5 h-5 flex-shrink-0 ${
                isSentShareActive ? "text-blue-600" : "text-gray-400"
              }`}
            />
            <span className='flex-1 text-left'>내 공유 관리(701-B)</span>
            {sentShareCount > 0 && <CountBadge count={sentShareCount} />}
            <span className='text-gray-400 ml-1 flex-shrink-0'>
              {sentShareExpanded ? (
                <IconChevronDown className='w-3.5 h-3.5' />
              ) : (
                <IconChevronRight className='w-3.5 h-3.5' />
              )}
            </span>
          </button>

          {sentShareExpanded && (
            <div className='space-y-0.5'>
              <button
                onClick={() => onViewChange("sentShares")}
                className={subNavClass("sentShares")}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    currentView === "sentShares" ? "bg-blue-500" : "bg-gray-300"
                  }`}
                />
                <span>공유 결과 전체</span>
                {sentShareCount > 0 && <CountBadge count={sentShareCount} />}
              </button>
            </div>
          )}
        </div>

        {/* ── 701-A. 파일 공유 결제 (보낸 결제 요청) (접기/펼치기) ── */}
        <div className='mt-0.5 space-y-0.5'>
          <button
            onClick={() => {
              setSentRequestExpanded((e) => !e);
              if (!sentRequestExpanded) onViewChange("sentRequestPending");
            }}
            className={sectionToggleClass(isSentRequestActive)}
          >
            <IconDocumentText
              className={`w-5 h-5 flex-shrink-0 ${
                isSentRequestActive ? "text-blue-600" : "text-gray-400"
              }`}
            />
            <span className='flex-1 text-left'>파일 공유 결제(701-A)</span>
            {sentRequestCounts.pending > 0 && (
              <CountBadge count={sentRequestCounts.pending} variant='warning' />
            )}
            <span className='text-gray-400 ml-1 flex-shrink-0'>
              {sentRequestExpanded ? (
                <IconChevronDown className='w-3.5 h-3.5' />
              ) : (
                <IconChevronRight className='w-3.5 h-3.5' />
              )}
            </span>
          </button>

          {sentRequestExpanded && (
            <div className='space-y-0.5'>
              {/* 승인 대기 (PENDING) */}
              <button
                onClick={() => onViewChange("sentRequestPending")}
                className={subNavClass("sentRequestPending")}
              >
                <IconClockPending
                  className={`w-4 h-4 flex-shrink-0 ${
                    currentView === "sentRequestPending"
                      ? "text-amber-600"
                      : "text-amber-400"
                  }`}
                />
                <span>승인 대기</span>
                <CountBadge
                  count={sentRequestCounts.pending}
                  variant='warning'
                />
              </button>

              {/* 승인 완료 (APPROVED) */}
              <button
                onClick={() => onViewChange("sentRequestApproved")}
                className={subNavClass("sentRequestApproved")}
              >
                <IconCheckCircle
                  className={`w-4 h-4 flex-shrink-0 ${
                    currentView === "sentRequestApproved"
                      ? "text-emerald-600"
                      : "text-emerald-400"
                  }`}
                />
                <span>승인 완료</span>
                <CountBadge
                  count={sentRequestCounts.approved}
                  variant='success'
                />
              </button>

              {/* 거부됨 (REJECTED) */}
              <button
                onClick={() => onViewChange("sentRequestRejected")}
                className={subNavClass("sentRequestRejected")}
              >
                <IconXCircle
                  className={`w-4 h-4 flex-shrink-0 ${
                    currentView === "sentRequestRejected"
                      ? "text-red-600"
                      : "text-red-400"
                  }`}
                />
                <span>거부됨</span>
                <CountBadge
                  count={sentRequestCounts.rejected}
                  variant='danger'
                />
              </button>

              {/* 취소됨 (CANCELED) */}
              <button
                onClick={() => onViewChange("sentRequestCanceled")}
                className={subNavClass("sentRequestCanceled")}
              >
                <IconNoSymbol
                  className={`w-4 h-4 flex-shrink-0 ${
                    currentView === "sentRequestCanceled"
                      ? "text-gray-600"
                      : "text-gray-400"
                  }`}
                />
                <span>취소됨</span>
                <CountBadge count={sentRequestCounts.canceled} />
              </button>
            </div>
          )}
        </div>

        {/* ── 702. 받은 공유 요청 — 현재 미사용, 추후 부활 가능 ──
        <div className="mt-0.5 space-y-0.5">
          <button
            onClick={() => {
              setReceivedExpanded((e) => !e);
              if (!receivedExpanded) onViewChange('receivedPending');
            }}
            className={sectionToggleClass(isReceivedActive)}
          >
            <span className="relative flex-shrink-0">
              <IconInboxArrowDown
                className={`w-5 h-5 ${
                  isReceivedActive ? 'text-blue-600' : 'text-gray-400'
                }`}
              />
              {receivedCounts.pending > 0 && <NotificationDot />}
            </span>
            <span className="flex-1 text-left">받은 공유 요청</span>
            {totalReceivedCount > 0 && (
              <CountBadge count={totalReceivedCount} />
            )}
            <span className="text-gray-400 ml-1 flex-shrink-0">
              {receivedExpanded ? (
                <IconChevronDown className="w-3.5 h-3.5" />
              ) : (
                <IconChevronRight className="w-3.5 h-3.5" />
              )}
            </span>
          </button>

          {receivedExpanded && (
            <div className="space-y-0.5">
              <button
                onClick={() => onViewChange('receivedPending')}
                className={subNavClass('receivedPending')}
              >
                <IconClockPending
                  className={`w-4 h-4 flex-shrink-0 ${
                    currentView === 'receivedPending'
                      ? 'text-amber-600'
                      : 'text-amber-400'
                  }`}
                />
                <span>대기 중</span>
                <CountBadge
                  count={receivedCounts.pending}
                  variant="warning"
                />
              </button>

              <button
                onClick={() => onViewChange('receivedApproved')}
                className={subNavClass('receivedApproved')}
              >
                <IconCheckCircle
                  className={`w-4 h-4 flex-shrink-0 ${
                    currentView === 'receivedApproved'
                      ? 'text-emerald-600'
                      : 'text-emerald-400'
                  }`}
                />
                <span>승인함</span>
                <CountBadge
                  count={receivedCounts.approved}
                  variant="success"
                />
              </button>

              <button
                onClick={() => onViewChange('receivedRejected')}
                className={subNavClass('receivedRejected')}
              >
                <IconXCircle
                  className={`w-4 h-4 flex-shrink-0 ${
                    currentView === 'receivedRejected'
                      ? 'text-red-600'
                      : 'text-red-400'
                  }`}
                />
                <span>반려함</span>
                <CountBadge
                  count={receivedCounts.rejected}
                  variant="danger"
                />
              </button>
            </div>
          )}
        </div>
        */}

        {/* ── 작업 요청 관리 섹션 ── */}
        <div className='mt-5 mb-2'>
          <div className='flex items-center gap-2 px-3'>
            <IconDocumentText className='w-4 h-4 text-gray-400 flex-shrink-0' />
            <span className='text-xs font-semibold text-gray-400 uppercase tracking-wider'>
              작업 요청 관리
            </span>
          </div>
        </div>

        <div className='space-y-0.5'>
          <button
            onClick={() => onViewChange("myActionRequests")}
            className={navButtonClass("myActionRequests")}
          >
            <IconDocumentText
              className={`w-5 h-5 flex-shrink-0 ${
                currentView === "myActionRequests"
                  ? "text-blue-600"
                  : "text-gray-400"
              }`}
            />
            <span>내 작업 요청</span>
          </button>
        </div>
      </nav>

      {/* 스토리지 용량 표시 */}
      {storageInfo && (
        <div className='px-4 py-3 border-t border-gray-100'>
          <div className='flex items-center justify-between mb-1.5'>
            <span className='text-xs font-medium text-gray-500'>저장 용량</span>
            <span className='text-xs text-gray-600'>
              {formatBytes(storageInfo.used)} / {formatBytes(storageInfo.total)}
            </span>
          </div>
          <div className='h-1.5 bg-gray-100 rounded-full overflow-hidden'>
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                usagePercent > 90
                  ? "bg-red-500"
                  : usagePercent > 70
                    ? "bg-amber-500"
                    : "bg-blue-500"
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <p className='text-[10px] text-gray-400 mt-1 text-right'>
            {usagePercent.toFixed(1)}% 사용
          </p>
        </div>
      )}
    </aside>
  );
}
