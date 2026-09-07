import { useEffect, useRef } from 'react';
import { ChevronIcon } from './Icons';

export default function TerminalLog({ lines }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <details className="activity-log">
      <summary>
        <span className="activity-log-label">
          <ChevronIcon />
          Activity log
        </span>
        <span>{lines.length} {lines.length === 1 ? 'line' : 'lines'}</span>
      </summary>
      <div ref={containerRef} className="log-output">
        {lines.length === 0 ? (
          <span className="log-placeholder">Process details will appear here.</span>
        ) : (
          lines.map((entry, index) => {
            const className = entry.stream === 'stderr' ? 'log-stderr' : '';
            if (entry.raw) {
              return (
                <pre key={`${index}-raw-stderr`} className={`${className} log-raw`}>
                  {entry.line}
                </pre>
              );
            }
            return (
              <div key={`${index}-${entry.line.slice(0, 40)}`} className={className}>
                {entry.line}
              </div>
            );
          })
        )}
      </div>
    </details>
  );
}
