const STATUS_LABELS = {
  idle: 'Ready',
  downloading: 'Downloading',
  extracting: 'Extracting audio',
  merging: 'Merging',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export default function ProgressPanel({ progress, status }) {
  const percent = progress?.percent ?? 0;
  const label = STATUS_LABELS[status] || status;

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-zinc-300">{label}</span>
        {progress?.percent != null && (
          <span className="font-mono text-emerald-400">{percent.toFixed(1)}%</span>
        )}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-emerald-600 transition-all duration-300"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      {(progress?.speed || progress?.eta) && (
        <div className="mt-2 flex gap-4 font-mono text-xs text-zinc-500">
          {progress.speed && <span>{progress.speed}</span>}
          {progress.eta && <span>ETA {progress.eta}</span>}
        </div>
      )}
    </div>
  );
}
