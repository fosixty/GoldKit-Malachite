import { MusicIcon, VideoIcon, XIcon } from './Icons';

const STATUS_LABELS = {
  downloading: 'Downloading',
  extracting: 'Extracting audio',
  merging: 'Merging video and audio',
  processing: 'Processing media',
  retrying: 'Refreshing media request',
  cancelling: 'Cancelling',
};

export function formatLabel(format) {
  const labels = {
    audio: 'MP3 audio',
    '720p': 'MP4 · 720p',
    '1080p': 'MP4 · 1080p',
    best: 'Best available',
  };
  return labels[format] || format;
}

function sourceLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Media source';
  }
}

export default function ProgressPanel({
  progress,
  status,
  title,
  url,
  format,
  outputDir,
  onCancel,
}) {
  const percent = Math.max(0, Math.min(progress?.percent ?? 0, 100));
  const isAudio = format === 'audio';
  const isCancelling = status === 'cancelling';

  return (
    <article className="download-row active-download" aria-live="polite">
      <div className="media-thumbnail is-active" aria-hidden="true">
        {isAudio ? <MusicIcon /> : <VideoIcon />}
      </div>

      <div className="download-details">
        <div className="download-title-line">
          <div className="download-title-wrap">
            <h3 title={title || url}>{title || 'Preparing media…'}</h3>
            <span>{sourceLabel(url)}</span>
          </div>
          <span className="status-badge status-running">{STATUS_LABELS[status] || 'Working'}</span>
        </div>

        <div className="download-metadata">
          <span>{formatLabel(format)}</span>
          <span className="metadata-separator">·</span>
          <span className="truncate" title={outputDir}>{outputDir}</span>
        </div>

        <div
          className="progress-track"
          role="progressbar"
          aria-label="Download progress"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.round(percent)}
        >
          <div className="progress-value" style={{ width: `${percent}%` }} />
        </div>

        <div className="transfer-metrics">
          <span className="transfer-size">
            {progress?.downloadedSize && progress?.totalSize
              ? `${progress.downloadedSize} / ${progress.totalSize}`
              : `${percent.toFixed(1)}%`}
          </span>
          <span>{progress?.speed || '—'}</span>
          <span>{progress?.eta ? `ETA ${progress.eta}` : 'ETA —'}</span>
        </div>
      </div>

      <button
        type="button"
        className="icon-button cancel-button"
        onClick={onCancel}
        disabled={isCancelling}
        aria-label={isCancelling ? 'Cancelling download' : 'Cancel download'}
        title={isCancelling ? 'Cancelling…' : 'Cancel download'}
      >
        <XIcon />
      </button>
    </article>
  );
}
