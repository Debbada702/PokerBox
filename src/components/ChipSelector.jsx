import { CHIP_VALUES } from '../game/pokerEngine.js';
import './ChipSelector.css';

const CHIP_COLORS = {
  5: '#e8e8e8',
  10: '#3d9a52',
  25: '#2a6ab8',
  50: '#c96a30',
  100: '#1a1a1a',
  250: '#8a3535',
  500: '#6b2d8a',
};

export default function ChipSelector({ selected, onSelect, disabled, label }) {
  return (
    <div className={`chip-selector ${disabled ? 'chip-selector--disabled' : ''}`}>
      <span className="chip-selector__label">{label ?? 'Scommessa (raise)'}</span>
      <div className="chip-selector__row">
        {CHIP_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            className={`chip-selector__chip ${selected === value ? 'chip-selector__chip--active' : ''}`}
            style={{ '--chip-color': CHIP_COLORS[value] ?? '#888' }}
            onClick={() => onSelect(value)}
            disabled={disabled}
            title={`${value} chips`}
          >
            <span className="chip-selector__chip-inner">{value}</span>
          </button>
        ))}
      </div>
      <p className="chip-selector__hint">
        Raise aggiunge <strong>{selected}</strong> chips oltre il call
      </p>
    </div>
  );
}
