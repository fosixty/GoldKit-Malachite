import { MusicIcon, RetryIcon, VideoIcon } from './Icons';
import { formatLabel } from './ProgressPanel';

function formatTime(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

function sourceLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Media download';
  }
}

const STATUS_LABELS = {
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export default function HistoryList({ items, hasActiveDownload, onRetry }) {
  if (items.length === 0 && !hasActiveDownload) {
    return (
      <div className="empty-queue">
        <strong>No downloads yet</strong>
        <span>Paste a media URL above to begin.</span>
      </div>
    );
  }

  return (
    <div className="history-list">
      {items.map((item) => {
        const isAudio = item.format === 'audio';
        const title = item.title || sourceLabel(item.url);

        return (
          <article className="download-row" key={item.id}>
            <div className="media-thumbnail" aria-hidden="true">
              {isAudio ? <MusicIcon /> : <VideoIcon />}
            </div>

            <div className="download-details">
              <div className="download-title-line">
                <div className="download-title-wrap">
                  <h3 title={title}>{title}</h3>
                  <span>{formatTime(item.finishedAt || item.startedAt)}</span>
                </div>
                <span className={`status-badge status-${item.status}`}>
                  {STATUS_LABELS[item.status] || item.status}
                </span>
              </div>

              <div className="download-metadata">
                <span>{formatLabel(item.format)}</span>
                <span className="metadata-separator">·</span>
                <span className="truncate" title={item.destinationName || ''}>
                  {item.destinationName || 'Destination unavailable'}
                </span>
              </div>

              <div className={`history-progress status-${item.status}`} aria-hidden="true">
                <span />
              </div>
            </div>

            {item.status === 'failed' && item.url && (
              <button
                type="button"
                className="icon-button"
                onClick={() => onRetry(item)}
                aria-label={`Retry ${title}`}
                title="Retry download"
              >
                <RetryIcon />
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
