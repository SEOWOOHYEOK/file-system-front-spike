# 파일 다운로드 프론트엔드 구현 가이드

> 일반 다운로드, 이어받기, 병렬 다운로드의 완전한 구현 가이드

## 목차

1. [개요](#1-개요)
2. [API 엔드포인트](#2-api-엔드포인트)
3. [응답 헤더 설명](#3-응답-헤더-설명)
4. [다운로드 방식별 구현](#4-다운로드-방식별-구현)
5. [병렬 다운로드 (완전 구현)](#5-병렬-다운로드-완전-구현)
6. [체크섬 검증](#6-체크섬-검증)
7. [외부 공유 다운로드](#7-외부-공유-다운로드)
8. [에러 처리](#8-에러-처리)
9. [완전한 다운로드 매니저 구현](#9-완전한-다운로드-매니저-구현)

---

## 1. 개요

서버는 **HTTP Range Request (RFC 7233)** 를 지원합니다.

### 지원 기능

| 기능 | 설명 | 권장 상황 |
|------|------|----------|
| 일반 다운로드 | 전체 파일 한 번에 | 소용량 파일 (< 50MB) |
| 이어받기 | 중단 지점부터 재개 | 네트워크 불안정 환경 |
| 병렬 다운로드 | 여러 청크 동시 요청 | 대용량 파일 (> 100MB) |

---

## 2. API 엔드포인트

### 일반 파일 다운로드

```
GET /v1/files/:fileId/download
Authorization: Bearer {JWT_TOKEN}
```

### 파일 정보 조회 (다운로드 전 필수)

```
GET /v1/files/:fileId/info
Authorization: Bearer {JWT_TOKEN}
```

**응답 예시:**
```json
{
  "id": "file-uuid",
  "name": "document.pdf",
  "size": 314572800,
  "mimeType": "application/pdf",
  "checksum": "a1b2c3d4e5f6..."
}
```

### 외부 공유 다운로드

```
GET /v1/ext/shares/:shareId/download?token={contentToken}
Authorization: Bearer {EXT_TOKEN}
```

---

## 3. 응답 헤더 설명

### 전체 파일 다운로드 (200 OK)

```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Length: 314572800
Accept-Ranges: bytes
ETag: "a1b2c3d4e5f6..."
Last-Modified: Thu, 05 Feb 2026 10:30:00 GMT
X-Checksum-SHA256: a1b2c3d4e5f6...
```

### 부분 다운로드 (206 Partial Content)

```http
HTTP/1.1 206 Partial Content
Content-Type: application/pdf
Content-Length: 52428800
Content-Range: bytes 0-52428799/314572800
Accept-Ranges: bytes
ETag: "a1b2c3d4e5f6..."
```

### 헤더 상세 설명

| 헤더 | 설명 | 중요도 |
|------|------|--------|
| `Content-Length` | 현재 응답의 바이트 수 (전체 파일 크기가 아님!) | 필수 확인 |
| `Content-Range` | `bytes {시작}-{끝}/{전체크기}` | 전체 크기 파싱용 |
| `ETag` | 파일 고유 식별자 (SHA-256) | 이어받기/검증용 |
| `X-Checksum-SHA256` | 전체 파일 체크섬 (전체 다운로드 시에만) | 무결성 검증용 |
| `Accept-Ranges` | `bytes` → Range 지원 표시 | 병렬 다운로드 가능 여부 |

---

## 4. 다운로드 방식별 구현

### 4.1 일반 다운로드 (단순)

```typescript
async function simpleDownload(fileId: string, token: string): Promise<Blob> {
  const response = await fetch(`/v1/files/${fileId}/download`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }

  // 메타데이터 저장
  const metadata = {
    etag: response.headers.get('ETag'),
    checksum: response.headers.get('X-Checksum-SHA256'),
    contentLength: parseInt(response.headers.get('Content-Length') || '0'),
  };

  const blob = await response.blob();
  
  // 크기 검증
  if (blob.size !== metadata.contentLength) {
    throw new Error(`Size mismatch: expected=${metadata.contentLength}, actual=${blob.size}`);
  }

  return blob;
}
```

### 4.2 이어받기 다운로드

```typescript
interface ResumeState {
  fileId: string;
  etag: string;
  totalSize: number;
  downloadedBytes: number;
  chunks: Blob[];
}

async function resumeDownload(state: ResumeState, token: string): Promise<Blob> {
  const headers: HeadersInit = {
    'Authorization': `Bearer ${token}`,
    'Range': `bytes=${state.downloadedBytes}-`,
  };

  // If-Range: ETag 일치 시에만 이어받기
  if (state.etag) {
    headers['If-Range'] = state.etag;
  }

  const response = await fetch(`/v1/files/${state.fileId}/download`, { headers });

  // 200 OK = 파일이 변경됨 → 처음부터 다시
  if (response.status === 200) {
    console.warn('File changed, restarting from beginning');
    state.downloadedBytes = 0;
    state.chunks = [];
    state.etag = response.headers.get('ETag') || '';
    state.totalSize = parseInt(response.headers.get('Content-Length') || '0');
    return await response.blob();
  }

  // 206 Partial Content = 이어받기 성공
  if (response.status === 206) {
    const chunk = await response.blob();
    state.chunks.push(chunk);
    state.downloadedBytes += chunk.size;

    // 완료 시 병합
    if (state.downloadedBytes >= state.totalSize) {
      return new Blob(state.chunks);
    }

    // 아직 남음 → 재귀 호출 또는 반복
    return resumeDownload(state, token);
  }

  // 416 = 범위 오류
  if (response.status === 416) {
    throw new Error('Range not satisfiable - file may have changed');
  }

  throw new Error(`Unexpected status: ${response.status}`);
}
```

---

## 5. 병렬 다운로드 (완전 구현)

대용량 파일을 여러 청크로 나누어 동시에 다운로드합니다.

### 5.1 핵심 원칙

1. **다운로드 전 파일 정보 조회** → 전체 크기, 체크섬 확보
2. **청크 분할** → 적절한 크기로 분할 (권장: 10~50MB)
3. **병렬 요청** → 동시에 4~8개 청크 요청
4. **순서대로 병합** → 청크 순서 유지
5. **무결성 검증** → 전체 크기 및 체크섬 확인

### 5.2 완전한 병렬 다운로드 구현

```typescript
interface ParallelDownloadOptions {
  fileId: string;
  token: string;
  chunkSize?: number;      // 청크 크기 (기본: 50MB)
  maxConcurrent?: number;  // 동시 요청 수 (기본: 4)
  onProgress?: (progress: DownloadProgress) => void;
}

interface DownloadProgress {
  totalBytes: number;
  downloadedBytes: number;
  percent: number;
  chunksCompleted: number;
  totalChunks: number;
}

interface ChunkResult {
  index: number;
  data: ArrayBuffer;
  size: number;
}

async function parallelDownload(options: ParallelDownloadOptions): Promise<Blob> {
  const {
    fileId,
    token,
    chunkSize = 50 * 1024 * 1024, // 50MB
    maxConcurrent = 4,
    onProgress,
  } = options;

  // 1. 파일 정보 조회 (크기, 체크섬 확보)
  const fileInfo = await getFileInfo(fileId, token);
  const { size: totalSize, checksum: expectedChecksum } = fileInfo;

  // 2. 청크 계획 생성
  const chunks = createChunkPlan(totalSize, chunkSize);
  const totalChunks = chunks.length;

  console.log(`[ParallelDownload] Starting: ${totalChunks} chunks, ${formatBytes(totalSize)}`);

  // 3. 진행률 추적
  let downloadedBytes = 0;
  let completedChunks = 0;
  const results: ChunkResult[] = new Array(totalChunks);

  // 4. 청크 다운로드 함수
  const downloadChunk = async (chunk: ChunkPlan): Promise<ChunkResult> => {
    const { index, start, end } = chunk;
    const expectedSize = end - start + 1;

    const response = await fetch(`/v1/files/${fileId}/download`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Range': `bytes=${start}-${end}`,
      },
    });

    if (response.status !== 206) {
      throw new Error(`Chunk ${index} failed: status=${response.status}`);
    }

    // Content-Length 검증
    const contentLength = parseInt(response.headers.get('Content-Length') || '0');
    if (contentLength !== expectedSize) {
      console.warn(`Chunk ${index}: Content-Length mismatch (expected=${expectedSize}, header=${contentLength})`);
    }

    const data = await response.arrayBuffer();

    // 실제 받은 바이트 검증
    if (data.byteLength !== expectedSize) {
      throw new Error(
        `Chunk ${index} size mismatch: expected=${expectedSize}, actual=${data.byteLength}`
      );
    }

    // 진행률 업데이트
    downloadedBytes += data.byteLength;
    completedChunks++;

    if (onProgress) {
      onProgress({
        totalBytes: totalSize,
        downloadedBytes,
        percent: Math.round((downloadedBytes / totalSize) * 100),
        chunksCompleted: completedChunks,
        totalChunks,
      });
    }

    return { index, data, size: data.byteLength };
  };

  // 5. 동시성 제한 병렬 실행
  await processWithConcurrency(chunks, downloadChunk, maxConcurrent, results);

  // 6. 순서대로 병합
  const orderedBuffers = results
    .sort((a, b) => a.index - b.index)
    .map(r => r.data);

  const finalBlob = new Blob(orderedBuffers);

  // 7. 최종 크기 검증
  if (finalBlob.size !== totalSize) {
    throw new Error(
      `Final size mismatch: expected=${totalSize}, actual=${finalBlob.size}`
    );
  }

  // 8. 체크섬 검증 (선택적)
  if (expectedChecksum) {
    const actualChecksum = await calculateSHA256(finalBlob);
    if (actualChecksum !== expectedChecksum) {
      throw new Error(
        `Checksum mismatch: expected=${expectedChecksum}, actual=${actualChecksum}`
      );
    }
    console.log('[ParallelDownload] Checksum verified ✓');
  }

  console.log(`[ParallelDownload] Complete: ${formatBytes(finalBlob.size)}`);
  return finalBlob;
}

// 청크 계획 생성
interface ChunkPlan {
  index: number;
  start: number;
  end: number;
}

function createChunkPlan(totalSize: number, chunkSize: number): ChunkPlan[] {
  const chunks: ChunkPlan[] = [];
  let index = 0;

  for (let start = 0; start < totalSize; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, totalSize - 1);
    chunks.push({ index, start, end });
    index++;
  }

  return chunks;
}

// 동시성 제한 실행
async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  maxConcurrent: number,
  results: R[]
): Promise<void> {
  const queue = [...items];
  const executing: Promise<void>[] = [];

  while (queue.length > 0 || executing.length > 0) {
    // 큐에 아이템이 있고, 동시 실행 수가 여유 있으면 추가
    while (queue.length > 0 && executing.length < maxConcurrent) {
      const item = queue.shift()!;
      const promise = processor(item)
        .then(result => {
          results[(item as any).index] = result;
        })
        .finally(() => {
          const idx = executing.indexOf(promise as any);
          if (idx > -1) executing.splice(idx, 1);
        });
      executing.push(promise as any);
    }

    // 하나라도 완료될 때까지 대기
    if (executing.length > 0) {
      await Promise.race(executing);
    }
  }
}

// 파일 정보 조회
async function getFileInfo(fileId: string, token: string): Promise<{
  size: number;
  checksum: string | null;
  name: string;
}> {
  const response = await fetch(`/v1/files/${fileId}/info`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to get file info: ${response.status}`);
  }

  const data = await response.json();
  return {
    size: data.size || data.sizeBytes,
    checksum: data.checksum || null,
    name: data.name,
  };
}

// 바이트 포맷
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
```

---

## 6. 체크섬 검증

### 6.1 SHA-256 계산 (Web Crypto API)

```typescript
async function calculateSHA256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### 6.2 대용량 파일 스트리밍 해시 (메모리 효율)

```typescript
async function calculateSHA256Streaming(blob: Blob): Promise<string> {
  // 청크 단위로 읽어서 해시 계산 (메모리 효율적)
  const CHUNK_SIZE = 64 * 1024 * 1024; // 64MB
  
  // Web Crypto는 스트리밍을 직접 지원하지 않음
  // 대용량 파일은 Worker나 라이브러리 사용 권장
  
  // 간단한 버전: 전체 로드 (메모리 주의)
  return calculateSHA256(blob);
}
```

### 6.3 검증 흐름

```typescript
async function verifyDownload(
  blob: Blob,
  expectedSize: number,
  expectedChecksum?: string
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // 1. 크기 검증
  if (blob.size !== expectedSize) {
    errors.push(`Size mismatch: expected=${expectedSize}, actual=${blob.size}`);
  }

  // 2. 체크섬 검증 (있는 경우)
  if (expectedChecksum) {
    try {
      const actualChecksum = await calculateSHA256(blob);
      if (actualChecksum !== expectedChecksum) {
        errors.push(`Checksum mismatch: expected=${expectedChecksum}, actual=${actualChecksum}`);
      }
    } catch (e) {
      errors.push(`Checksum calculation failed: ${e}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

---

## 7. 외부 공유 다운로드

### 7.1 주의사항

> **`contentToken`은 일회용입니다!**
> 
> - 한 번 사용하면 무효화됨
> - 이어받기/병렬 다운로드 시 **새 토큰 발급 필요**
> - 병렬 다운로드 불가 (토큰 제약)

### 7.2 외부 공유 단순 다운로드

```typescript
async function downloadSharedFile(
  shareId: string,
  contentToken: string,
  extToken: string
): Promise<Blob> {
  const url = `/v1/ext/shares/${shareId}/download?token=${contentToken}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${extToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }

  return await response.blob();
}
```

### 7.3 외부 공유 이어받기

```typescript
interface ExternalResumeState {
  shareId: string;
  extToken: string;
  etag: string;
  totalSize: number;
  downloadedBytes: number;
  chunks: Blob[];
}

async function resumeExternalDownload(
  state: ExternalResumeState,
  getNewContentToken: () => Promise<string> // 토큰 재발급 함수
): Promise<Blob> {
  // 매번 새 토큰 발급 필요
  const contentToken = await getNewContentToken();
  const url = `/v1/ext/shares/${state.shareId}/download?token=${contentToken}`;

  const headers: HeadersInit = {
    'Authorization': `Bearer ${state.extToken}`,
    'Range': `bytes=${state.downloadedBytes}-`,
  };

  if (state.etag) {
    headers['If-Range'] = state.etag;
  }

  const response = await fetch(url, { headers });

  if (response.status === 200) {
    // 파일 변경됨
    state.downloadedBytes = 0;
    state.chunks = [];
    state.etag = response.headers.get('ETag') || '';
    return await response.blob();
  }

  if (response.status === 206) {
    const chunk = await response.blob();
    state.chunks.push(chunk);
    state.downloadedBytes += chunk.size;

    if (state.downloadedBytes >= state.totalSize) {
      return new Blob(state.chunks);
    }

    // 다음 청크
    return resumeExternalDownload(state, getNewContentToken);
  }

  throw new Error(`Failed: ${response.status}`);
}
```

---

## 8. 에러 처리

### 8.1 HTTP 상태 코드

| 코드 | 의미 | 처리 방법 |
|------|------|----------|
| `200 OK` | 전체 파일 | 정상 처리 |
| `206 Partial Content` | 부분 파일 | Range 응답 처리 |
| `401 Unauthorized` | 인증 실패 | 토큰 갱신 후 재시도 |
| `403 Forbidden` | 권한 없음 | 사용자에게 알림 |
| `404 Not Found` | 파일 없음 | 사용자에게 알림 |
| `416 Range Not Satisfiable` | 잘못된 범위 | 처음부터 다시 |

### 8.2 재시도 로직

```typescript
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // 재시도 가능한 에러
      if (response.status >= 500 && attempt < maxRetries) {
        console.warn(`Attempt ${attempt} failed with ${response.status}, retrying...`);
        await sleep(delayMs * attempt); // 지수 백오프
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        await sleep(delayMs * attempt);
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 8.3 청크 실패 복구

```typescript
async function downloadChunkWithRetry(
  fileId: string,
  token: string,
  chunk: ChunkPlan,
  maxRetries: number = 3
): Promise<ArrayBuffer> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`/v1/files/${fileId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Range': `bytes=${chunk.start}-${chunk.end}`,
        },
      });

      if (response.status !== 206) {
        throw new Error(`Unexpected status: ${response.status}`);
      }

      const data = await response.arrayBuffer();
      const expectedSize = chunk.end - chunk.start + 1;

      if (data.byteLength !== expectedSize) {
        throw new Error(`Size mismatch: expected=${expectedSize}, actual=${data.byteLength}`);
      }

      return data;
    } catch (error) {
      console.warn(`Chunk ${chunk.index} attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        throw new Error(`Chunk ${chunk.index} failed after ${maxRetries} attempts`);
      }
      
      await sleep(1000 * attempt);
    }
  }

  throw new Error('Unreachable');
}
```

---

## 9. 완전한 다운로드 매니저 구현

### 9.1 다운로드 매니저 클래스

```typescript
type DownloadStatus = 'idle' | 'downloading' | 'paused' | 'completed' | 'error';

interface DownloadTask {
  id: string;
  fileId: string;
  fileName: string;
  totalSize: number;
  downloadedSize: number;
  status: DownloadStatus;
  error?: string;
  etag?: string;
  checksum?: string;
  chunks: ArrayBuffer[];
  startTime?: number;
}

class DownloadManager {
  private tasks = new Map<string, DownloadTask>();
  private token: string;
  private onUpdate?: (task: DownloadTask) => void;

  constructor(token: string, onUpdate?: (task: DownloadTask) => void) {
    this.token = token;
    this.onUpdate = onUpdate;
  }

  // 다운로드 시작
  async start(fileId: string): Promise<string> {
    // 파일 정보 조회
    const fileInfo = await getFileInfo(fileId, this.token);
    
    const taskId = `download_${Date.now()}`;
    const task: DownloadTask = {
      id: taskId,
      fileId,
      fileName: fileInfo.name,
      totalSize: fileInfo.size,
      downloadedSize: 0,
      status: 'idle',
      checksum: fileInfo.checksum || undefined,
      chunks: [],
      startTime: Date.now(),
    };

    this.tasks.set(taskId, task);
    this.notifyUpdate(task);

    // 파일 크기에 따라 전략 선택
    if (fileInfo.size > 100 * 1024 * 1024) {
      // 100MB 이상: 병렬 다운로드
      await this.parallelDownload(task);
    } else {
      // 소용량: 단순 다운로드
      await this.simpleDownload(task);
    }

    return taskId;
  }

  // 단순 다운로드
  private async simpleDownload(task: DownloadTask): Promise<void> {
    task.status = 'downloading';
    this.notifyUpdate(task);

    try {
      const response = await fetch(`/v1/files/${task.fileId}/download`, {
        headers: { 'Authorization': `Bearer ${this.token}` },
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      task.etag = response.headers.get('ETag') || undefined;
      
      const reader = response.body!.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        task.downloadedSize += value.length;
        this.notifyUpdate(task);
      }

      const blob = new Blob(chunks);
      await this.finalize(task, blob);
    } catch (error) {
      task.status = 'error';
      task.error = (error as Error).message;
      this.notifyUpdate(task);
    }
  }

  // 병렬 다운로드
  private async parallelDownload(task: DownloadTask): Promise<void> {
    task.status = 'downloading';
    this.notifyUpdate(task);

    const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB
    const MAX_CONCURRENT = 4;

    try {
      const chunkPlans = createChunkPlan(task.totalSize, CHUNK_SIZE);
      const results: ArrayBuffer[] = new Array(chunkPlans.length);

      const downloadChunk = async (plan: ChunkPlan): Promise<void> => {
        const data = await downloadChunkWithRetry(
          task.fileId,
          this.token,
          plan,
          3
        );
        results[plan.index] = data;
        task.downloadedSize += data.byteLength;
        this.notifyUpdate(task);
      };

      // 동시성 제한 실행
      const queue = [...chunkPlans];
      const executing: Promise<void>[] = [];

      while (queue.length > 0 || executing.length > 0) {
        while (queue.length > 0 && executing.length < MAX_CONCURRENT) {
          const plan = queue.shift()!;
          const promise = downloadChunk(plan).finally(() => {
            const idx = executing.indexOf(promise);
            if (idx > -1) executing.splice(idx, 1);
          });
          executing.push(promise);
        }

        if (executing.length > 0) {
          await Promise.race(executing);
        }
      }

      // 병합
      const blob = new Blob(results);
      await this.finalize(task, blob);
    } catch (error) {
      task.status = 'error';
      task.error = (error as Error).message;
      this.notifyUpdate(task);
    }
  }

  // 최종 검증 및 완료
  private async finalize(task: DownloadTask, blob: Blob): Promise<void> {
    // 크기 검증
    if (blob.size !== task.totalSize) {
      throw new Error(`Final size mismatch: expected=${task.totalSize}, actual=${blob.size}`);
    }

    // 체크섬 검증
    if (task.checksum) {
      const actualChecksum = await calculateSHA256(blob);
      if (actualChecksum !== task.checksum) {
        throw new Error(`Checksum mismatch`);
      }
    }

    // 파일 저장
    this.saveFile(blob, task.fileName);
    
    task.status = 'completed';
    this.notifyUpdate(task);
  }

  // 파일 저장 (브라우저 다운로드)
  private saveFile(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // 상태 업데이트 알림
  private notifyUpdate(task: DownloadTask): void {
    if (this.onUpdate) {
      this.onUpdate({ ...task });
    }
  }

  // 진행률 조회
  getProgress(taskId: string): number {
    const task = this.tasks.get(taskId);
    if (!task) return 0;
    return Math.round((task.downloadedSize / task.totalSize) * 100);
  }

  // 상태 조회
  getTask(taskId: string): DownloadTask | undefined {
    return this.tasks.get(taskId);
  }
}
```

### 9.2 사용 예시

```typescript
// 다운로드 매니저 생성
const manager = new DownloadManager(authToken, (task) => {
  console.log(`[${task.fileName}] ${task.status} - ${Math.round((task.downloadedSize / task.totalSize) * 100)}%`);
  
  // UI 업데이트
  updateProgressBar(task.id, task.downloadedSize, task.totalSize);
});

// 다운로드 시작
const taskId = await manager.start(fileId);

// 진행률 모니터링
const progress = manager.getProgress(taskId);
console.log(`Progress: ${progress}%`);
```

---

## 10. 체크리스트

### 구현 전 확인

- [ ] 파일 정보 API (`/v1/files/:fileId/info`) 호출 가능?
- [ ] 인증 토큰 관리 방법 결정?
- [ ] 대용량 파일 기준 (병렬 vs 단순) 결정?

### 구현 중 확인

- [ ] Range 요청 시 `206` 응답 확인?
- [ ] Content-Length와 실제 바이트 일치 검증?
- [ ] 청크 병합 시 순서 유지?

### 구현 후 확인

- [ ] 전체 크기 검증 통과?
- [ ] 체크섬 검증 통과 (있는 경우)?
- [ ] 네트워크 끊김 시 이어받기 동작?
- [ ] 에러 발생 시 사용자 알림?

---

## 11. 문제 해결 (Troubleshooting)

### "검증 안됨" 오류

**원인**: 최종 파일 크기 또는 체크섬 불일치

**해결**:
1. 각 청크의 Content-Length 확인
2. 실제 받은 바이트와 비교
3. 청크 병합 순서 확인
4. 서버 로그에서 `[BYTE_MISMATCH]` 확인

### 용량 부족

**원인**: 일부 청크가 완전히 다운로드되지 않음

**해결**:
1. 네트워크 연결 확인
2. 청크별 재시도 로직 추가
3. 각 청크 완료 시 크기 검증

### 병렬 다운로드 느림

**원인**: 동시 요청 수 부족 또는 청크 크기 부적절

**해결**:
1. `maxConcurrent`를 4~8로 조정
2. `chunkSize`를 10~100MB로 조정
3. 네트워크 대역폭 확인
