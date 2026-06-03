import './ChipSelector.css';

export default function ChipSelector({
  selected,
  onSelect,
  disabled,
  label,
  min = 20,
  max = 500,
  toCall = 0,
}) {
  const safeMax = Math.max(0, Math.floor(max));
  const safeMin = Math.min(Math.max(1, Math.floor(min)), Math.max(1, safeMax));
  const value = Math.min(Math.max(selected, safeMin), Math.max(safeMin, safeMax));
  const isAllInRaise = safeMax > 0 && value >= safeMax;

  return (
    <div className={`chip-selector ${disabled ? 'chip-selector--disabled' : ''}`}>
      <span className="chip-selector__label">{label ?? 'Scommessa (raise)'}</span>
      <div className="chip-selector__slider-row">
        <input
          type="range"
          min={safeMin}
          max={Math.max(safeMin, safeMax)}
          step="1"
          value={value}
          onChange={(event) => onSelect(Number(event.target.value))}
          disabled={disabled || safeMax <= 0}
        />
        <output>{value.toLocaleString()}</output>
      </div>
      <p className="chip-selector__hint">
        Raise aggiunge <strong>{value.toLocaleString()}</strong> chips oltre il call
        {toCall > 0 && <span> ({toCall.toLocaleString()} da chiamare)</span>}
        {isAllInRaise && <em> All-in</em>}
      </p>
    </div>
  );
}
