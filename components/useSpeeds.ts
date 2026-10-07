'use client';
import { useEffect, useState } from 'react';
import type { Speeds } from '../lib/clock';
import { speedValue } from '../lib/speeds';

export type SpeedInputs = Record<keyof Speeds, string>;
const KEY = 'speeds';
const FIELDS = ['attack', 'casting', 'movement'] as const;
const asInputs = (s: Speeds): SpeedInputs => ({
  attack: String(s.attack), casting: String(s.casting), movement: String(s.movement),
});

/** The attack / casting / movement % the page times at, remembered in
 * this browser. Pages render at the defaults first (the class's, from
 * lib/speeds.ts defaultSpeeds); Reset returns to them. */
export function useSpeeds(defaults: Speeds) {
  const [raw, setRaw] = useState<SpeedInputs>(asInputs(defaults));
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && typeof s === 'object') {
        const out = { ...asInputs(defaults) };
        for (const k of FIELDS) if (k in s) out[k] = String(speedValue(s[k]));
        setRaw(out);
      }
    } catch {
      // nothing stored, or storage unavailable
    }
  }, [defaults]);
  const set = (next: SpeedInputs) => {
    setRaw(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(speedsOf(next)));
    } catch {
      // storage unavailable
    }
  };
  /** shows the value in use once the field is left */
  const settle = () => set(asInputs(speedsOf(raw)));
  return { raw, set, settle, speeds: speedsOf(raw), reset: () => set(asInputs(defaults)) };
}

export const speedsOf = (r: SpeedInputs): Speeds => ({
  attack: speedValue(r.attack), casting: speedValue(r.casting), movement: speedValue(r.movement),
});
