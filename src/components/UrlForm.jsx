import { useState } from 'react';
import FormatSelect from './FormatSelect';
import OutputPicker from './OutputPicker';
import { DownloadIcon } from './Icons';

function droppedUrl(dataTransfer) {
  const uri = dataTransfer.getData('text/uri-list').split(/\r?\n/).find((line) => line && !line.startsWith('#'));
  return (uri || dataTransfer.getData('text/plain')).trim();
}

export default function UrlForm({
  url,
  onUrlChange,
  onDownload,
  format,
  onFormatChange,
  outputDir,
  onBrowse,
  isDownloading,
  errorMessage,
  inputRef,
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isDownloading) {
      onDownload();
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const nextUrl = droppedUrl(event.dataTransfer);
    if (nextUrl) {
      onUrlChange(nextUrl);
      inputRef.current?.focus();
    }
  };

  return (
    <section
      className={isDragging ? 'download-composer is-dragging' : 'download-composer'}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
      <div className="section-heading composer-heading">
        <div>
          <h2>New download</h2>
          <p>Paste or drop a media URL, then choose how to save it.</p>
        </div>
        <kbd>Ctrl/⌘ V</kbd>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="field-group url-field">
          <label htmlFor="url">Media URL</label>
          <input
            ref={inputRef}
            id="url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck="false"
            placeholder="https://www.youtube.com/watch?v=…"
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            disabled={isDownloading}
          />
        </div>

        <div className="composer-options">
          <FormatSelect value={format} onChange={onFormatChange} disabled={isDownloading} />
          <OutputPicker outputDir={outputDir} onBrowse={onBrowse} disabled={isDownloading} />
        </div>

        {errorMessage && (
          <div className="inline-error" role="alert">
            <strong>Couldn’t download.</strong>
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="composer-actions">
          <span>Enter starts the download</span>
          <button
            type="submit"
            disabled={isDownloading || !url.trim() || !outputDir}
            className="button button-primary"
          >
            <DownloadIcon />
            {isDownloading ? 'Download in progress' : 'Download'}
          </button>
        </div>
      </form>

      {isDragging && (
        <div className="drop-overlay" aria-hidden="true">
          Drop URL to add it
        </div>
      )}
    </section>
  );
}
