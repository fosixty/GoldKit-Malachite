export default function OutputPicker({ outputDir, onBrowse, disabled }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-zinc-400">Output directory</label>
      <div className="flex gap-2">
        <input
          type="text"
          readOnly
          value={outputDir}
          className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 outline-none"
        />
        <button
          type="button"
          onClick={onBrowse}
          disabled={disabled}
          className="shrink-0 rounded-md border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
        >
          Browse
        </button>
      </div>
    </div>
  );
}
