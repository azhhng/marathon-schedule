# Marathon schedule

A personal training companion for the October 17, 2027 Toronto Waterfront Marathon.

## Website

The GitHub Pages website is served from `docs/` on the `master` branch. It uses plain HTML, CSS, and JavaScript; no build or installation is required.

- `docs/index.html`: page structure
- `docs/style.css`: responsive styling
- `docs/app.js`: training schedule and browser-local run logs
- `docs/fueling.js`: fueling guidance and carbohydrate packing calculator

Run logs stay in the current browser and do not sync between devices or website addresses.

The separate local `toronto-2027/` checkout and deployment archive are ignored here; they are not required for GitHub Pages.

## Higher-volume training route

The beginner run/walk and consistency phases stay unchanged. The base phase builds toward 38–40 km across four runs before marathon preparation. Five runs begin June 28, 2027 with a short Saturday run introduced in a cutback week, conditional on handling four days and the base volume comfortably. Monday and Friday are non-running days through the five-day build and the first two taper weeks; race week includes an optional 2 km Friday shakeout.

The marathon build includes repeated 50–60 km weeks and a 70 km peak in Week 48 (September 20–26): Tuesday 9 km, Wednesday 14 km, Thursday 8 km, Saturday 4 km, Sunday up to 35 km. Recovery weeks and a three-week taper remain. The three optional pace sessions now fall in lower-volume weeks. Race week retains 9 km of easy running before the marathon.

Later targets require normal recovery and sufficient training time. Hold or reduce volume when needed; missed runs are not made up. The 35 km long run remains provisional and depends on duration and recovery.

## Consistency and maintenance

See [PROGRAM_REVIEW.md](PROGRAM_REVIEW.md) for the full 51-week audit, current targets, unit definitions, and remaining readiness decisions.

Optional strength is attached to Tuesday/Thursday easy runs, phased in gradually, reduced in the taper, and omitted in race week. Recovery-day walking remains optional. Race week summaries display 9 km training plus the marathon separately.

After editing files in `docs/`:

1. Run `python3 scripts/prepare-site.py` to refresh asset versions and the available local preview mirror.
2. Run `node --test tests/program.test.cjs` to check calendar, progression, checkpoints, taper, session guidance, fueling, and asset consistency.
3. Commit and push the changes on `master` to publish through GitHub Pages.

Local preview: `python3 -m http.server 4173 --directory docs` from the repository root.
