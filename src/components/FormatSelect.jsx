import { MusicIcon, VideoIcon } from './Icons';

const VIDEO_QUALITIES = [
  { value: '720p', label: '720p', detail: 'Compatible MP4' },
  { value: '1080p', label: '1080p', detail: 'Compatible MP4' },
  { value: 'best', label: 'Best available', detail: 'Original quality' },
];

export default function FormatSelect({ value, onChange, disabled }) {
  const isAudio = value === 'audio';

  return (
    <div className="format-fields">
      <fieldset className="field-group">
        <legend>Media type</legend>
        <div className="segmented-control" aria-label="Media type">
          <button
            type="button"
            className={isAudio ? 'segment is-selected' : 'segment'}
            aria-pressed={isAudio}
            onClick={() => onChange('audio')}
            disabled={disabled}
          >
            <MusicIcon />
            Audio
          </button>
          <button
            type="button"
            className={!isAudio ? 'segment is-selected' : 'segment'}
            aria-pressed={!isAudio}
            onClick={() => onChange(isAudio ? '1080p' : value)}
            disabled={disabled}
          >
            <VideoIcon />
            Video
          </button>
        </div>
      </fieldset>

      <div className="field-group">
        <label htmlFor="quality">Quality</label>
        <select
          id="quality"
          className={isAudio ? 'is-fixed' : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || isAudio}
        >
          {isAudio ? (
            <option value="audio">MP3 audio</option>
          ) : (
            VIDEO_QUALITIES.map((quality) => (
              <option key={quality.value} value={quality.value}>
                {quality.label} · {quality.detail}
              </option>
            ))
          )}
        </select>
      </div>
    </div>
  );
}
