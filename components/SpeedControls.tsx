'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import type { Speeds } from '../lib/clock';
import { SPEED_MAX, SPEED_MIN, speedValue } from '../lib/speeds';
import type { SpeedInputs } from './useSpeeds';

const FIELDS: [keyof SpeedInputs, string][] = [
  ['attack', 'Attack speed %'], ['casting', 'Casting speed %'], ['movement', 'Movement speed %'],
];

export default function SpeedControls({ raw, set, settle, reset, defaults }: {
  raw: SpeedInputs; set: (s: SpeedInputs) => void; settle: () => void; reset: () => void; defaults: Speeds;
}) {
  return (
    <div className="my-2 grid grid-cols-1 gap-x-5 gap-y-2 rounded-xl border bg-card px-3 py-2 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
      {FIELDS.map(([k, label]) => (
        <div key={k} className="flex flex-col gap-1">
          <label htmlFor={`speed-${k}`} className="text-xs text-muted-foreground">{label}</label>
          <div className="flex items-center gap-3">
            <Input
              id={`speed-${k}`}
              type="number" min={SPEED_MIN} max={SPEED_MAX} step={1} value={raw[k]}
              onChange={(e) => set({ ...raw, [k]: e.target.value })}
              onBlur={settle}
              className="h-8 w-20 shrink-0 tabular-nums"
            />
            <Slider
              aria-label={label}
              min={SPEED_MIN} max={SPEED_MAX} step={1}
              value={[speedValue(raw[k])]}
              onValueChange={(v) => set({ ...raw, [k]: String(v[0]) })}
              className="min-w-0 flex-1"
            />
          </div>
        </div>
      ))}
      <div className="flex items-end">
        <Button
          type="button" variant="outline" size="sm" onClick={reset}
          aria-label={`Reset speeds to ${defaults.attack} / ${defaults.casting} / ${defaults.movement}`}
          title={`${defaults.attack} / ${defaults.casting} / ${defaults.movement}`}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
