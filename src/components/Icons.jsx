const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export function DownloadIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export function FolderIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M3 6.5h6l2 2h10v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M3 9h18" />
    </svg>
  );
}

export function MusicIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M9 18V5l10-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </svg>
  );
}

export function VideoIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <rect x="3" y="5" width="14" height="14" rx="2" />
      <path d="m17 10 4-2v8l-4-2" />
    </svg>
  );
}

export function XIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  );
}

export function RetryIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M20 7v5h-5" />
      <path d="M18.5 15a7 7 0 1 1-1.2-7.8L20 10" />
    </svg>
  );
}

export function ChevronIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
