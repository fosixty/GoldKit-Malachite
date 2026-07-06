const FORMATS = [
  { value: 'audio', label: 'Audio (MP3)' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
  { value: 'best', label: 'Best quality' },
];

export default function FormatSelect({ value, onChange, disabled }) {
  return (
    <div>
      <label htmlFor="format" className="mb-1.5 block text-sm text-zinc-400">
        Format
      </label>
      <select
        id="format"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-600 disabled:opacity-50"
      >
        {FORMATS.map((fmt) => (
          <option key={fmt.value} value={fmt.value}>
            {fmt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
