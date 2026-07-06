export default function UrlForm({ url, onUrlChange, onDownload, onCancel, isDownloading }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isDownloading) {
      onDownload();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="url" className="mb-1.5 block text-sm text-zinc-400">
          URL
        </label>
        <input
          id="url"
          type="url"
          placeholder="https://..."
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          disabled={isDownloading}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-emerald-600 disabled:opacity-50"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isDownloading || !url.trim()}
          className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Download
        </button>
        {isDownloading && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-zinc-600 bg-zinc-800 px-5 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
