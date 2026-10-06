# Codex

A static website of Black Desert skill timings: for each class and spec,
every skill's damage presets, the time each takes, the skills that can
follow it and the damage per second each follow-up gives, at the attack,
casting and movement speeds you choose.

## Run it

Node 20.9 or newer.

```
npm install
npm run dev      # http://localhost:3000
npm test         # the clock and the page data checks
npm run build    # runs the tests, then writes the static site to out/
```

`npm run build` stops if the clock disagrees with any reference value in
the data. `npm run types` regenerates `lib/export-types.ts` from the
schema.

## Data

`data/<build>/` holds one game build: a file per class and spec
(`<class>.<spec>.json`), `manifest.json` and `golden.json` (reference
times the clock must reproduce). `data/schema/` holds the JSON schema of
those files. The site lists every class and spec it finds there, using
the newest build that has it.

## Code

- `lib/clock.ts`: the only place times are computed.
- `lib/view.ts`, `lib/data.ts`: shape the data at build time and cut the
  slice each page needs.
- `lib/present.ts`: names, inputs in plain words, damage totals,
  follow-up grouping.
- `app/`: the pages; `components/`: their parts.
