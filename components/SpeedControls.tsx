'use client';
import { SPEED_MAX, SPEED_MIN } from '../lib/speeds';
import type { SpeedInputs } from './useSpeeds';

const FIELDS: [keyof SpeedInputs, string][] = [
  ['attack', 'Attack speed %'], ['casting', 'Casting speed %'], ['movement', 'Movement speed %'],
];

export default function SpeedControls({ raw, set, settle, reset }: {
  raw: SpeedInputs; set: (s: SpeedInputs) => void; settle: () => void; reset: () => void;
}) {
  return (
    <div className="speeds">
      {FIELDS.map(([k, label]) => (
        <label key={k}>
          {label}
          <input
            type="number" min={SPEED_MIN} max={SPEED_MAX} step={1} value={raw[k]}
            onChange={(e) => set({ ...raw, [k]: e.target.value })}
            onBlur={settle}
          />
        </label>
      ))}
      <div className="reset">
        <button type="button" onClick={reset} aria-label="Reset speeds to 100 / 100 / 100">100 / 100 / 100</button>
      </div>
    </div>
  );
}
