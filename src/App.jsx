import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import UrlForm from './components/UrlForm';
import ProgressPanel from './components/ProgressPanel';
import TerminalLog from './components/TerminalLog';
import HistoryList from './components/HistoryList';

function titleFromLog(line) {
  const destination = line.match(/\[download\]\s+Destination:\s+(.+)/)?.[1];
  if (!destination) return null;
  const fileName = destination.split(/[\\/]/).pop() || '';
  return fileName.replace(/\.[^.]+$/, '') || null;
}

function titleFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'Preparing media…';
  }
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function App() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('audio');
  const [outputDir, setOutputDir] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(null);
  const [activeTitle, setActiveTitle] = useState('');
  const [activeUrl, setActiveUrl] = useState('');
  const [activeFormat, setActiveFormat] = useState('audio');
  const [logLines, setLogLines] = useState([]);
  const [history, setHistory] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const urlInputRef = useRef(null);

  const refreshHistory = useCallback(async () => {
    if (!window.api) return;
    const items = await window.api.getHistory();
    setHistory(items);
  }, []);

  useEffect(() => {
    if (!window.api) {
      setOutputDir('Downloads');
      return;
    }
    window.api.getDefaultOutputDir().then(setOutputDir);
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    if (!window.api) return undefined;

    const unsubLog = window.api.onLog((data) => {
      setLogLines((previous) => [...previous.slice(-999), data]);
      const parsedTitle = titleFromLog(data.line);
      if (parsedTitle) setActiveTitle(parsedTitle);
    });

    const unsubProgress = window.api.onProgress((data) => {
      setProgress((previous) => ({
        ...previous,
        ...data,
        percent: data.percent ?? previous?.percent ?? 0,
      }));
      if (data.status) setStatus(data.status);
    });

    const unsubDone = window.api.onDone((data) => {
      setIsDownloading(false);
      setStatus(data?.cancelled ? 'cancelled' : 'completed');
      setProgress((previous) => ({ ...previous, percent: data?.cancelled ? previous?.percent : 100 }));
      if (data?.title) setActiveTitle(data.title);
      refreshHistory();
    });

    const unsubError = window.api.onError((data) => {
      setIsDownloading(false);
      setStatus('failed');
      setErrorMessage(data?.message || 'The download or media processing step failed.');
      if (data?.title) setActiveTitle(data.title);
      if (data?.message) {
        setLogLines((previous) => [
          ...previous,
          { line: `Error: ${data.message}`, stream: 'stderr' },
        ]);
      }
      refreshHistory();
    });

    return () => {
      unsubLog();
      unsubProgress();
      unsubDone();
      unsubError();
    };
  }, [refreshHistory]);

  useEffect(() => {
    const handlePaste = (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      const pasted = event.clipboardData?.getData('text/plain').trim();
      if (!pasted || !isHttpUrl(pasted) || isDownloading) return;
      event.preventDefault();
      setUrl(pasted);
      setErrorMessage('');
      urlInputRef.current?.focus();
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isDownloading]);

  const handleBrowse = async () => {
    if (!window.api) return;
    const directory = await window.api.selectDirectory();
    if (directory) setOutputDir(directory);
  };

  const startDownload = async ({ nextUrl = url, nextFormat = format } = {}) => {
    const cleanUrl = nextUrl.trim();
    if (!cleanUrl || !outputDir || isDownloading) return;

    setUrl(cleanUrl);
    setFormat(nextFormat);
    setActiveUrl(cleanUrl);
    setActiveFormat(nextFormat);
    setActiveTitle(titleFromUrl(cleanUrl));
    setIsDownloading(true);
    setStatus('downloading');
    setProgress({ percent: 0, speed: null, eta: null, downloadedSize: null, totalSize: null });
    setLogLines([]);
    setErrorMessage('');

    if (!window.api) return;

    try {
      await window.api.startDownload({ url: cleanUrl, outputDir, format: nextFormat });
      refreshHistory();
    } catch (error) {
      setIsDownloading(false);
      setStatus('failed');
      setErrorMessage(error.message || 'Malachite could not start the download.');
      setLogLines((previous) => [
        ...previous,
        { line: `Error: ${error.message}`, stream: 'stderr' },
      ]);
    }
  };

  const handleCancel = async () => {
    if (!window.api) {
      setIsDownloading(false);
      setStatus('cancelled');
      return;
    }
    const didCancel = await window.api.cancelDownload();
    if (didCancel) setStatus('cancelling');
  };

  const handleRetry = (item) => {
    setErrorMessage('');
    startDownload({ nextUrl: item.url, nextFormat: item.format });
  };

  const handleClearHistory = async () => {
    if (!window.api || isDownloading) return;
    await window.api.clearHistory();
    refreshHistory();
  };

  const visibleHistory = useMemo(
    () => history.filter((item) => item.status !== 'running'),
    [history]
  );
  const queueCount = visibleHistory.length + (isDownloading ? 1 : 0);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-identity">
          <h1>Malachite</h1>
          <span>Media downloader</span>
        </div>
        <div className="app-status">
          <span className={isDownloading ? 'status-dot is-active' : 'status-dot'} />
          {isDownloading ? 'Download active' : 'Ready'}
        </div>
      </header>

      <main className="workspace">
        <UrlForm
          url={url}
          onUrlChange={(nextUrl) => {
            setUrl(nextUrl);
            setErrorMessage('');
          }}
          onDownload={() => startDownload()}
          format={format}
          onFormatChange={setFormat}
          outputDir={outputDir}
          onBrowse={handleBrowse}
          isDownloading={isDownloading}
          errorMessage={errorMessage}
          inputRef={urlInputRef}
        />

        <section className="queue-panel">
          <div className="queue-heading">
            <div>
              <h2>Downloads</h2>
              <span>{queueCount} {queueCount === 1 ? 'item' : 'items'}</span>
            </div>
            {visibleHistory.length > 0 && (
              <button
                type="button"
                className="quiet-button"
                onClick={handleClearHistory}
                disabled={isDownloading}
              >
                Clear history
              </button>
            )}
          </div>

          <div className="queue-list">
            {isDownloading && (
              <ProgressPanel
                progress={progress}
                status={status}
                title={activeTitle}
                url={activeUrl}
                format={activeFormat}
                outputDir={outputDir}
                onCancel={handleCancel}
              />
            )}
            <HistoryList
              items={visibleHistory}
              hasActiveDownload={isDownloading}
              onRetry={handleRetry}
            />
          </div>

          <TerminalLog lines={logLines} />
        </section>
      </main>
    </div>
  );
}
