# Echo Ledger: Burrow Protocol — v2

**A community project for Squeekchain Genesis. Not officially affiliated. Built by 0xRicher.**

An original, English-only canvas adventure about a mouse courier carrying ledger memories beneath Squeektoshi's real hamster wheel. Recorded movement becomes looping physical echoes. Cooperation with your past selves—not running speed, pet care, a dashboard or a multiplayer boss raid—is the central mechanic.

## Play

Serve this directory as a static site, keeping these files together at the root:

- `index.html`
- `style.css`
- `game.js`
- `telemetry.js`

For local play: `python3 -m http.server 8766` and open `http://localhost:8766`.
No build step, backend, accounts, wallet, credentials, tokens or external artwork is required. Public network reads enhance the game but are not required to play. Audio is synthesized locally and starts muted.

## The courier loop

1. Find a cyan relay. Record with **R / Space**, stand inside it briefly, then release. A stationary recording is useful: only your echo powers the ring.
2. You begin with **two simultaneous echo slots**. Normal relays latch. Later sectors introduce paired seals: two **different** echoes must occupy both rings together for two seconds.
3. Recover unlocked amber memories, collect fictional **game SQK fragments**, and reach the green uplink.
4. Buy upgrades at the safe-burrow workbench and deliver the next contract.
5. Every fifth sector, face **the Auditor General**. Hold two seals with separate echoes. Each 2.4-second sync breaks one of three armor plates. A single echo cannot win.

Three vivid biomes rotate in two-sector chapters: **Wheel Core**, **Mempool Tunnels** and **Settlement Vaults**. Endless contracts scale the opposition, with bosses at 5, 10, 15 and beyond.

### Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | WASD / arrows | Left movement pad |
| Record / release | R / Space | REC / RELEASE |
| Dash | Shift | DASH |
| Area purge | E | PURGE |
| Pause | P / Esc | Header pause |
| Codex | C | Codex |
| Mute / unmute | M | Sound |

Recording costs 6 energy upfront and 6 per second, up to 10 seconds. Base echoes last 32 seconds. Dash grants brief protection. A purge stuns nearby enemies and clears hostile packets. Losing focus automatically pauses the run.

## Squeekchain is part of the game

All requests go directly to the documented public API at `https://api.squeekchain.com`. No proxy, private endpoint or chain write is used.

| Endpoint / fields | Gameplay and visible treatment |
| --- | --- |
| `/v1/status`: `measurement.coreStatus`, `rpmMilli` | ACTIVE wheel work raises echo regeneration from 4.5/s idle reserve to `7 + min(RPM,150) × 0.12`/s before upgrades. RPM is `rpmMilli / 1000`. Visible regeneration and status explain the effect. |
| `/v1/status`: `measurement.cumulativeWorkUnits` | Newly observed hardware work gives a small, capped energy pulse during play. |
| `/v1/status`: `builder.anchor.blockHeight` | Explicitly labeled **SETTLED**. Tunes pulsing vent timing; a newly observed settled height adds 8 energy. Optional Shared Block mode freezes this height into its map seed at run start. |
| `/v1/status`: `builder.projected.blockHeight` | Explicitly labeled **PROJECTED**, optimistic—not a confirmed height. Never causes a confirmed Surge. |
| `/v1/status`: `measurement.distanceMm` | Real cumulative meters unlock five distance-based lore chapters, plus a vault-score bonus of 2% per whole kilometer, capped at 25%. Simulation never awards these unlocks. |
| `/v1/settlements`: `recentSettlements` | The Ledger Feed shows real work, round, height, safety status and transaction links. A newly observed safe/confirmed/finalized record triggers a **12-second Settlement Surge**: full energy, extra game SQK drops, enemy stun, and longer active echoes. Initial history is a baseline, not a new event; transaction/log IDs are deduplicated. |
| `/v1/economy/state`: `asset`, `supply.liveSupplyBaseUnits` | SQK supply context in the telemetry strip. Base-unit conversion uses 18 decimals for the current deployment. No game points are redeemable for SQK. |

Status and settlements poll every **10 seconds**; economy polls every **30 seconds**. Requests time out after 7 seconds. Hardware must report online and an observation inside its declared freshness window; losing contact switches to simulation. A 22-second heartbeat check also prevents a stuck LIVE label. Failed ledger reads retain receipts only with a **CACHED** label.

### Live versus simulated

The **LIVE / SIMULATED** badge is always above the arena. Unreachable, invalid or stale hardware enables an explicitly labeled practice wheel. Simulated Surges arrive every 45 seconds and are labeled as simulated. Simulated receipts never get fake transaction links. Real settlement links use **https://sepolia.etherscan.io/tx/** because the current public deployment is Sepolia (`chainId 11155111`), not Ethereum mainnet. Receipt times are displayed in **JST**.

Public header probes during this build returned HTTP 200 and `Access-Control-Allow-Origin: *` for all three endpoints. **Browser CORS verification has not been performed**; permissive response headers are not proof of a successful browser fetch. See verification notes below.

### Shared Block mode

A side challenge, not the game's main premise: the settled height plus the **Asia/Tokyo calendar date** seeds a deterministic map. The height is frozen when a run begins; layout is identical across screen sizes. No live server, multiplayer sync or global leaderboard is implied. If hardware is unavailable, the UI labels the seed **SIM SHARED BLOCK**.

## Content and progression

- Five distinct threats: echo-distracted **Auditors**, zigzagging **Fork Rats**, energy-draining **Gas Leeches**, echo-grounded **Stale Data Wraiths** and projectile-firing **Checksum Turrets**.
- Auditor General encounters with armor phases and radial packet volleys, solved by parallel echo occupancy rather than clicking damage.
- Six pickup types: game SQK, repair, energy battery, one-hit shield, overclock and purge charge.
- Eight upgrade branches, each with three ranks: parallel spools, echo duration, capacity, wheel coupling, movement/dash, pickup range, integrity and purge radius.
- Nine illustrated-text codex chapters: wheel work, real distance, settled/projected data, settlements, SQK and the courier's fictional story. Six threat entries and twelve persistent achievements.
- Persistent local scores, lore and achievements; run summaries show time, vaults, echoes, relays, surges, bosses, SQK and live-play time.
- Distinct copper/amber, violet/blue and jade/gold palettes; locally drawn mouse, hamster wheel, particles, route trails, shields, map effects, mobile minimap and synth audio.
- No wallet connection, signing, fees, real rewards, backend or trackers.

## Verification and diagnostics

`node --check game.js` and `node --check telemetry.js` pass.

`node tests/logic-test.cjs` passes using Node's VM, a minimal fake DOM/canvas and public-schema fixtures. It verifies regeneration mapping, baseline/deduplicated confirmed settlements, relay and paired-seal puzzles, the boss's two-echo requirement and victory, delivery/shop/upgrades, run summary, codex, achievement persistence, simulated Surges, network failure, shared layout, five enemy types, mobile touch movement/recording, and renderer execution.

**This is not a Chromium test or visual verification.** Browser automation was unavailable to the build worker. No screenshots or browser console/CORS result have been fabricated.

A prepared, **unexecuted** Playwright release test is in `tests/browser-test.cjs`. A browser-capable agent can run it against the local server with Playwright/Chromium installed. It checks desktop/mobile console errors, actual browser CORS results, gameplay, the two-echo boss and offline practice, and writes these intended files:

- `screenshots/title.png`
- `screenshots/gameplay.png` (telemetry badge and ledger included)
- `screenshots/boss.png`
- `screenshots/mobile.png`
- `screenshots/browser-report.json`

These files do **not** exist until that test is run. Review screenshots and finish browser verification before redeployment.

### Test URLs

- `?sector=5`: start a boss practice run from the title. Practice does not enter scores or earn achievements.
- `?offline=1`: deterministic, clearly labeled offline practice; skips network requests.
- `?test=1`: test-only helpers under `window.echoLedger.debug`, for teleport, protection, clearing threats, adding test fragments and triggering a simulated Surge. These runs are not ranked. Helpers are absent otherwise.
- `window.echoLedger.snapshot()` and `window.squeekFeed.snapshot()` provide read-only diagnostic copies on every page.

## Sources and attribution

- https://squeekchain.com — real hamster-powered blockchain premise.
- https://squeekchain.com/genesis/code — community projects and submission requirements.
- https://api.squeekchain.com/v1/status
- https://api.squeekchain.com/v1/settlements
- https://api.squeekchain.com/v1/economy/state

The Genesis board already includes Hamster Tower (round-seeded floors), Wheel Run, companion and boss-raid concepts. Echo Ledger remains an original route-replay spatial cooperation game, with optional block seeding rather than another tower clone. The burrow narrative is community fiction, not official Squeekchain lore.

**Built by 0xRicher.** All game currency and rewards are fictional. Public research fixtures contain no user credentials.
