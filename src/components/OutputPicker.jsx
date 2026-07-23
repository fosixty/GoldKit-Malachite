import { FolderIcon } from './Icons';

export default function OutputPicker({ outputDir, onBrowse, disabled }) {
  return (
    <div className="field-group destination-field">
      <label htmlFor="output-directory">Destination</label>
      <div className="destination-control">
        <input
          id="output-directory"
          type="text"
          readOnly
          value={outputDir}
          title={outputDir}
          aria-label="Download destination"
        />
        <button
          type="button"
          onClick={onBrowse}
          disabled={disabled}
          className="button button-secondary"
        >
          <FolderIcon />
          Choose…
        </button>
      </div>
    </div>
  );
}
