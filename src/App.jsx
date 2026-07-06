import { useCallback, useEffect, useState } from 'react';
import UrlForm from './components/UrlForm';
import FormatSelect from './components/FormatSelect';
import OutputPicker from './components/OutputPicker';
import ProgressPanel from './components/ProgressPanel';
import TerminalLog from './components/TerminalLog';
import HistoryList from './components/HistoryList';

export default function App() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('audio');
  const [outputDir, setOutputDir] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(null);
  const [logLines, setLogLines] = useState([]);
  const [history, setHistory] = useState([]);

  const refreshHistory = useCallback(async () => {
    const items = await window.api.getHistory();
    setHistory(items);
  }, []);

  useEffect(() => {
    window.api.getDefaultOutputDir().then(setOutputDir);
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    const unsubLog = window.api.onLog((data) => {
      setLogLines((prev) => [...prev, data]);
    });

    const unsubProgress = window.api.onProgress((data) => {
      setProgress(data);
      if (data.status) {
        setStatus(data.status);
      }
    });

    const unsubDone = window.api.onDone(() => {
      setIsDownloading(false);
      setStatus('completed');
      setProgress((prev) => ({ ...prev, percent: 100 }));
      refreshHistory();
    });

    const unsubError = window.api.onError(() => {
      setIsDownloading(false);
      setStatus('failed');
      refreshHistory();
    });

    return () => {
      unsubLog();
      unsubProgress();
      unsubDone();
      unsubError();
    };
  }, [refreshHistory]);

  const handleBrowse = async () => {
    const dir = await window.api.selectDirectory();
    if (dir) {
      setOutputDir(dir);
    }
  };

  const handleDownload = async () => {
    if (!url.trim() || !outputDir) return;

    setIsDownloading(true);
    setStatus('downloading');
    setProgress({ percent: 0, speed: null, eta: null });
    setLogLines([]);

    try {
      await window.api.startDownload({ url: url.trim(), outputDir, format });
      refreshHistory();
    } catch (err) {
      setIsDownloading(false);
      setStatus('failed');
      setLogLines((prev) => [
        ...prev,
        { line: `Error: ${err.message}`, stream: 'stderr' },
      ]);
    }
  };

  const handleCancel = async () => {
    await window.api.cancelDownload();
    setIsDownloading(false);
    setStatus('cancelled');
    refreshHistory();
  };

  const handleClearHistory = async () => {
    await window.api.clearHistory();
    refreshHistory();
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-xl font-semibold text-zinc-100">Malachite</h1>
        <p className="text-sm text-zinc-500">Download audio and video for studio use</p>
      </header>

      <UrlForm
        url={url}
        onUrlChange={setUrl}
        onDownload={handleDownload}
        onCancel={handleCancel}
        isDownloading={isDownloading}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormatSelect value={format} onChange={setFormat} disabled={isDownloading} />
        <OutputPicker outputDir={outputDir} onBrowse={handleBrowse} disabled={isDownloading} />
      </div>

      <ProgressPanel progress={progress} status={status} />
      <TerminalLog lines={logLines} />
      <HistoryList items={history} onClear={handleClearHistory} />
    </div>
  );
}
