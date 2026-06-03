import './ChipSelector.css';

const CHIP_PRESETS = [20, 50, 100, 200, 500, 1000];
const SLIDER_STEP = 50;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toSliderValue(value, min, max) {
  const rounded = Math.round(value / SLIDER_STEP) * SLIDER_STEP;
  return clamp(rounded, min, max);
}

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
  const sliderMin = Math.min(Math.max(SLIDER_STEP, Math.ceil(safeMin / SLIDER_STEP) * SLIDER_STEP), Math.max(SLIDER_STEP, safeMax));
  const sliderMax = Math.max(sliderMin, Math.floor(safeMax / SLIDER_STEP) * SLIDER_STEP);
  const sliderValue = toSliderValue(value, sliderMin, sliderMax);
  const isAllInRaise = safeMax > 0 && value >= safeMax;
  const canUseSlider = safeMax >= SLIDER_STEP;

  return (
    <div className={`chip-selector ${disabled ? 'chip-selector--disabled' : ''}`}>
      <span className="chip-selector__label">{label ?? 'Scommessa (raise)'}</span>
      <div className="chip-selector__presets" aria-label="Chip rapide">
        {CHIP_PRESETS.map((chip) => (
          <button
            key={chip}
            type="button"
            className={`chip-selector__preset ${value === chip ? 'chip-selector__preset--active' : ''}`}
            onClick={() => onSelect(clamp(chip, safeMin, Math.max(safeMin, safeMax)))}
            disabled={disabled || chip > safeMax}
          >
            {chip.toLocaleString()}
          </button>
        ))}
      </div>
      <div className="chip-selector__slider-row">
        <input
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={SLIDER_STEP}
          value={sliderValue}
          onChange={(event) => onSelect(Number(event.target.value))}
          disabled={disabled || !canUseSlider}
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
