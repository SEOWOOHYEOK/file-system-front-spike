import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import Editor from '@monaco-editor/react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface FileViewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string | null;
  fileName: string;
  mimeType?: string;
}

export function FileViewer({ isOpen, onClose, fileUrl, fileName, mimeType }: FileViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [fileContent, setFileContent] = useState<string>('');

  useEffect(() => {
    if (isOpen && fileUrl && isTextFile(mimeType, fileName)) {
      fetch(fileUrl)
        .then((res) => res.text())
        .then((text) => setFileContent(text))
        .catch((err) => console.error('Failed to load text content:', err));
    }
  }, [isOpen, fileUrl, mimeType, fileName]);

  if (!isOpen || !fileUrl) return null;

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  console.log('mimeType', mimeType);
  console.log('fileName', fileName);
  const isPdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  const isImage = mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);
  const isText = isTextFile(mimeType, fileName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative w-full h-full max-w-6xl max-h-[90vh] bg-white rounded-lg shadow-xl flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <h3 className="text-lg font-medium text-gray-900 truncate pr-4">
            {fileName}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <span className="sr-only">Close</span>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4 flex justify-center">
          {isPdf && (
            <div className="flex flex-col items-center">
              <Document
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                className="shadow-lg"
              >
                <Page pageNumber={pageNumber} renderTextLayer={false} renderAnnotationLayer={false} />
              </Document>
              {numPages && numPages > 1 && (
                <div className="mt-4 flex items-center gap-4 bg-white px-4 py-2 rounded-full shadow">
                  <button
                    disabled={pageNumber <= 1}
                    onClick={() => setPageNumber(p => p - 1)}
                    className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm font-medium">
                    Page {pageNumber} of {numPages}
                  </span>
                  <button
                    disabled={pageNumber >= numPages}
                    onClick={() => setPageNumber(p => p + 1)}
                    className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          {isImage && (
            <div className="flex items-center justify-center h-full">
              <img
                src={fileUrl}
                alt={fileName}
                className="max-w-full max-h-full object-contain shadow-lg"
              />
            </div>
          )}

          {isText && (
            <div className="w-full h-full border border-gray-300 shadow-sm">
              <Editor
                height="100%"
                defaultLanguage={getLanguageFromFileName(fileName)}
                value={fileContent}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          )}

          {!isPdf && !isImage && !isText && (
            <div className="flex flex-col items-center justify-center text-gray-500">
              <p className="mb-4 text-lg">Preview not available for this file type.</p>
              <a
                href={fileUrl}
                download={fileName}
                className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                Download File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function isTextFile(mimeType?: string, fileName: string = ''): boolean {
  console.log('mimeType', mimeType);
  console.log('fileName', fileName);
  if (mimeType?.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/javascript') {
    return true;
  }
  const textExtensions = [
    '.txt', '.md', '.json', '.js', '.ts', '.tsx', '.jsx', '.css', '.html', 
    '.xml', '.yaml', '.yml', '.log', '.csv', '.ini', '.conf', '.sh', '.bat'
  ];
  return textExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
}

function getLanguageFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js': return 'javascript';
    case 'jsx': return 'javascript';
    case 'ts': return 'typescript';
    case 'tsx': return 'typescript';
    case 'json': return 'json';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'md': return 'markdown';
    case 'xml': return 'xml';
    case 'yaml': return 'yaml';
    case 'yml': return 'yaml';
    case 'sql': return 'sql';
    case 'py': return 'python';
    case 'java': return 'java';
    case 'c': return 'c';
    case 'cpp': return 'cpp';
    case 'go': return 'go';
    case 'rs': return 'rust';
    default: return 'plaintext';
  }
}
