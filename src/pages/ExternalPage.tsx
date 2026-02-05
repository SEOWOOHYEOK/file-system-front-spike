/**
 * External Share API Tester
 * 700.외부인증 & 710.외부접근 API 테스트 도구
 */
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useExternalDownload } from '../hooks/useExternalDownload';
import { externalShareApi, setLogCallback } from '../api/externalShareApi';
import { LoginPanel } from '../components/LoginPanel';
import { ShareListPanel } from '../components/ShareListPanel';
import { ShareDetailPanel } from '../components/ShareDetailPanel';
import { ResultLog } from '../components/ResultLog';
import { TestRunner, initializeScenarioSteps } from '../components/TestRunner';
import { FileViewer } from '../components/FileViewer';
import { FileDownloadManager } from '../components/FileDownloadManager';
import type { 
  PublicShare, 
  ShareDetailResponse, 
  ApiLogEntry,
  ScenarioStep,
} from '../types/api.types';

export function ExternalPage() {
  // 인증 상태
  const { auth, login, logout, refresh } = useAuth();
  
  // 다운로드 훅
  const {
    downloadFiles,
    startDownload,
    cancelDownload,
    clearCompleted: clearCompletedDownloads,
    isDownloading,
  } = useExternalDownload();
  
  // 공유 데이터
  const [shares, setShares] = useState<PublicShare[]>([]);
  const [selectedShare, setSelectedShare] = useState<PublicShare | null>(null);
  const [shareDetail, setShareDetail] = useState<ShareDetailResponse | null>(null);
  
  // 로딩 상태
  const [loadingShares, setLoadingShares] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // API 로그
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  
  // 파일 뷰어 상태
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFileUrl, setViewerFileUrl] = useState<string | null>(null);
  const [viewerFileName, setViewerFileName] = useState('');
  const [viewerMimeType, setViewerMimeType] = useState<string | undefined>(undefined);
  
  // 시나리오 실행 상태
  const [scenarioSteps, setScenarioSteps] = useState<ScenarioStep[]>(initializeScenarioSteps());
  const [isRunningScenario, setIsRunningScenario] = useState(false);

  // API 로그 콜백 설정
  useEffect(() => {
    setLogCallback((log) => {
      setLogs((prev) => [log, ...prev].slice(0, 100)); // 최대 100개 유지
    });
    return () => setLogCallback(null);
  }, []);

  // 공유 목록 조회
  const fetchShares = useCallback(async () => {
    if (!auth.accessToken) return;
    
    setLoadingShares(true);
    try {
      const response = await externalShareApi.getMyShares(auth.accessToken);
      setShares(response.items);
    } catch (error) {
      console.error('Failed to fetch shares:', error);
    } finally {
      setLoadingShares(false);
    }
  }, [auth.accessToken]);

  // 로그인 후 자동으로 공유 목록 조회
  useEffect(() => {
    if (auth.isAuthenticated) {
      fetchShares();
    } else {
      setShares([]);
      setSelectedShare(null);
      setShareDetail(null);
    }
  }, [auth.isAuthenticated, fetchShares]);

  // 공유 선택 시 상세 조회
  const handleSelectShare = async (share: PublicShare) => {
    setSelectedShare(share);
    
    if (!auth.accessToken) return;
    
    setLoadingDetail(true);
    try {
      const detail = await externalShareApi.getShareDetail(auth.accessToken, share.id);
      setShareDetail(detail);
    } catch (error) {
      console.error('Failed to fetch share detail:', error);
      setShareDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  // 파일 뷰어 (View)
  const handleView = async () => {
    if (!auth.accessToken || !selectedShare || !shareDetail) return;
    
    try {
      const blob = await externalShareApi.getContent(
        auth.accessToken,
        selectedShare.id,
        shareDetail.contentToken,
      );
      
      // 뷰어 열기
      const url = URL.createObjectURL(blob);
      setViewerFileUrl(url);
      setViewerFileName(selectedShare.fileName || 'unknown');
      setViewerMimeType(selectedShare.mimeType);
      setViewerOpen(true);
      
      // 상세 정보 갱신 (카운트 업데이트)
      await handleSelectShare(selectedShare);
    } catch (error) {
      console.error('Failed to view file:', error);
    }
  };

  // 파일 다운로드
  const handleDownload = async () => {
    if (!auth.accessToken || !selectedShare || !shareDetail) return;
    
    // 파일 크기를 알 수 있으면 새로운 다운로드 훅 사용 (진행률 추적, 체크섬 검증)
    if (selectedShare.fileSize && selectedShare.fileSize > 0) {
      startDownload(
        auth.accessToken,
        selectedShare.id,
        shareDetail.contentToken,
        selectedShare.fileName || 'download',
        selectedShare.fileSize
      );
      
      // 상세 정보 갱신 (카운트 업데이트)
      await handleSelectShare(selectedShare);
    } else {
      // 파일 크기를 모르면 기존 방식으로 다운로드
      try {
        const { blob, filename } = await externalShareApi.downloadFile(
          auth.accessToken,
          selectedShare.id,
          shareDetail.contentToken,
        );
        
        // 다운로드 트리거
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // 상세 정보 갱신 (카운트 업데이트)
        await handleSelectShare(selectedShare);
      } catch (error) {
        console.error('Failed to download file:', error);
      }
    }
  };

  // 시나리오 자동 실행
  const runScenario = async () => {
    setIsRunningScenario(true);
    const steps = initializeScenarioSteps();
    setScenarioSteps(steps);

    const updateStep = (id: string, updates: Partial<ScenarioStep>) => {
      setScenarioSteps((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
      );
    };

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    let accessToken: string | null = null;
    let currentShareId: string | null = null;

    try {
      // SC-001: 로그인
      updateStep('SC-001', { status: 'running' });
      try {
        const loginResult = await externalShareApi.login({
          username: 'external_user_001',
          password: 'password123',
        });
        accessToken = loginResult.accessToken;
        updateStep('SC-001', { status: 'success', result: loginResult });
      } catch (error: unknown) {
        updateStep('SC-001', { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Login failed' 
        });
        throw error;
      }
      await delay(500);

      // SC-010: 공유 목록 조회
      updateStep('SC-010', { status: 'running' });
      try {
        const sharesResult = await externalShareApi.getMyShares(accessToken);
        if (sharesResult.items.length === 0) {
          throw new Error('공유된 파일이 없습니다.');
        }
        currentShareId = sharesResult.items[0].id;
        updateStep('SC-010', { status: 'success', result: sharesResult });
      } catch (error: unknown) {
        updateStep('SC-010', { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Failed to fetch shares' 
        });
        throw error;
      }
      await delay(500);

      // SC-011: 공유 상세 조회
      updateStep('SC-011', { status: 'running' });
      try {
        const detailResult = await externalShareApi.getShareDetail(accessToken, currentShareId!);
        updateStep('SC-011', { status: 'success', result: detailResult });
      } catch (error: unknown) {
        updateStep('SC-011', { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Failed to fetch detail' 
        });
        throw error;
      }
      await delay(500);

      // SC-012: 파일 뷰어 접근
      updateStep('SC-012', { status: 'running' });
      try {
        // 뷰어 접근을 위해 새 토큰 필요
        const newDetail = await externalShareApi.getShareDetail(accessToken, currentShareId!);
        await externalShareApi.getContent(accessToken, currentShareId!, newDetail.contentToken);
        updateStep('SC-012', { status: 'success', result: 'Blob received' });
      } catch (error: unknown) {
        updateStep('SC-012', { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Failed to view content' 
        });
        // 뷰어 실패해도 계속 진행
      }
      await delay(500);

      // SC-013: 파일 다운로드
      updateStep('SC-013', { status: 'running' });
      try {
        // 다운로드를 위해 새 토큰 필요
        const newDetail = await externalShareApi.getShareDetail(accessToken, currentShareId!);
        await externalShareApi.downloadFile(accessToken, currentShareId!, newDetail.contentToken);
        updateStep('SC-013', { status: 'success', result: 'Blob received' });
      } catch (error: unknown) {
        updateStep('SC-013', { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Failed to download' 
        });
        // 다운로드 실패해도 계속 진행
      }
      await delay(500);

      // SC-003: 로그아웃
      updateStep('SC-003', { status: 'running' });
      try {
        await externalShareApi.logout(accessToken);
        updateStep('SC-003', { status: 'success' });
      } catch (error: unknown) {
        updateStep('SC-003', { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Logout failed' 
        });
      }

    } catch {
      // 중간에 실패한 경우 나머지 단계는 pending으로 유지
    } finally {
      setIsRunningScenario(false);
    }
  };

  // 로그 클리어
  const clearLogs = () => setLogs([]);

  // 뷰어 닫기
  const handleCloseViewer = () => {
    setViewerOpen(false);
    if (viewerFileUrl) {
      URL.revokeObjectURL(viewerFileUrl);
      setViewerFileUrl(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-900">700.외부인증 & 710.외부접근</h2>
        <p className="text-sm text-gray-500">외부 사용자 인증 및 파일 접근 테스트</p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Left Column: Auth + Share List */}
        <div className="col-span-3 space-y-4">
          <LoginPanel
            auth={auth}
            onLogin={login}
            onLogout={logout}
            onRefresh={refresh}
            disabled={isRunningScenario}
          />
          
          <ShareListPanel
            shares={shares}
            selectedShareId={selectedShare?.id || null}
            onSelectShare={handleSelectShare}
            loading={loadingShares}
            disabled={isRunningScenario}
          />
        </div>

        {/* Middle Column: Share Detail + Test Runner */}
        <div className="col-span-5 space-y-4">
          <ShareDetailPanel
            detail={shareDetail}
            onView={handleView}
            onDownload={handleDownload}
            loading={loadingDetail}
            disabled={isRunningScenario}
          />
          
          <TestRunner
            onRunScenario={runScenario}
            steps={scenarioSteps}
            isRunning={isRunningScenario}
          />
        </div>

        {/* Right Column: Result Log */}
        <div className="col-span-4">
          <div className="h-[calc(100vh-280px)]">
            <ResultLog
              logs={logs}
              onClear={clearLogs}
            />
          </div>
        </div>
      </div>

      {/* Download Manager */}
      {downloadFiles.length > 0 && (
        <div className="fixed bottom-4 right-4 w-96 max-h-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-40">
          <FileDownloadManager
            downloads={downloadFiles}
            onPause={() => {}} // 외부 공유는 일시정지 미지원
            onResume={() => {}} // 외부 공유는 이어받기 미지원
            onCancel={cancelDownload}
            onClearCompleted={clearCompletedDownloads}
            isDownloading={isDownloading}
          />
        </div>
      )}

      {/* File Viewer Modal */}
      <FileViewer 
        isOpen={viewerOpen}
        onClose={handleCloseViewer}
        fileUrl={viewerFileUrl}
        fileName={viewerFileName}
        mimeType={viewerMimeType}
      />
    </div>
  );
}
