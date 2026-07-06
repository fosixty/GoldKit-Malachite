import { useEffect, useRef } from 'react';

export default function TerminalLog({ lines }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="flex flex-col">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm text-zinc-400">Output</span>
        <span className="font-mono text-xs text-zinc-600">{lines.length} lines</span>
      </div>
      <div
        ref={containerRef}
        className="h-48 overflow-y-auto rounded-md border border-zinc-800 bg-black p-3 font-mono text-xs leading-relaxed text-emerald-500/90"
      >
        {lines.length === 0 ? (
          <span className="text-zinc-600">Waiting for output...</span>
        ) : (
          lines.map((entry, i) => (
            <div
              key={`${i}-${entry.line.slice(0, 40)}`}
              className={entry.stream === 'stderr' ? 'text-amber-500/80' : ''}
            >
              {entry.line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
