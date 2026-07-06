function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString();
}

function statusColor(status) {
  switch (status) {
    case 'completed':
      return 'text-emerald-400';
    case 'failed':
      return 'text-red-400';
    case 'cancelled':
      return 'text-amber-400';
    case 'running':
      return 'text-sky-400';
    default:
      return 'text-zinc-400';
  }
}

export default function HistoryList({ items, onClear }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm text-zinc-400">History</span>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Clear
          </button>
        )}
      </div>
      <div className="max-h-40 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900/30">
        {items.length === 0 ? (
          <p className="p-3 text-sm text-zinc-600">No downloads yet</p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {items.map((item) => (
              <li key={item.id} className="px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-zinc-200">
                      {item.title || item.url}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {item.format} · {formatTime(item.finishedAt || item.startedAt)}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs capitalize ${statusColor(item.status)}`}>
                    {item.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
