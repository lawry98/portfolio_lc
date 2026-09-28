# Byte Flips the Theme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking the nav theme toggle makes Byte do a "charge & release" gesture, and the new theme is revealed as a circle expanding from Byte's chest light.

**Architecture:**
- **Pure pieces** get their own tested modules:
  - the FSM `switching` state (`fsm.ts`)
  - gesture timelines and plan choice (`pet/themeGesture.ts`)
  - the page's View Transitions reveal (`lib/themeReveal.ts`)
- `createBytePet.ts` wires those pieces to the rig, stage and scene. Its new `performThemeSwitch(next, apply)` calls back into the page on the flip beat.
- The page (`main.ts`) owns the reveal, the theme write and the busy lock.
- The rig gains `chestWorld()`, backed by the new `ChestLight` node in `byte.glb`.

**Tech Stack:** Vite 8, vanilla TypeScript (strict, `noUnusedLocals`/`noUnusedParameters`), three 0.185, gsap 3.15, Vitest 4 (jsdom; `glbAsset.test.ts` runs in node), the View Transitions API.

**Spec:** `docs/superpowers/specs/2026-09-28-byte-theme-gesture-design.md`. Read it first. Its decision numbers (D1–D12) are cited below.

## Global Constraints

- Work only in the worktree `/Volumes/SD500/Documents/personal/portfolio_lc/.claude/worktrees/byte-theme-gesture` on branch `feat/byte-theme-gesture`.
- **Node:** mise has no global node. Prefix every npm/npx command with `mise exec node@22 --`. Dependencies are already installed; if `node_modules` is missing, run `mise exec node@22 -- npm ci --offline`.
- **Baseline:** 23 test files, 370 tests, all passing. Every task must leave `npx vitest run`, `npx tsc --noEmit`, `npm run lint` and `npm run format:check` green.
- `fsm.ts` stays pure: no `gsap`, `three`, wall clock or `Math.random`.
- `themeGesture.ts` may import `gsap` but not `three`, and it must not touch the DOM.
- No new runtime dependencies. `package.json` is unchanged.
- Byte's position has exactly **one writer per frame**. Never write `rig.object3d.position` from new code, except in the `onTick` corner-visit branch defined in Task 7.
- New gesture motion writes only `rig.pose.scale` (squash/stretch) and `rig.pose.position.y` (the corner rise). The glow goes through `writeGlow()`.
- **Model changes are re-exports, never patches.** Copy `byte.glb` byte-for-byte from `/Volumes/SD500/Documents/blender/byte.glb`. The owner re-exported it with `ChestLight` at 729,036 B.
- Prettier: single quotes, semicolons, `printWidth` 100, trailing commas. Match the surrounding comment density (these files use doc comments that explain *why*).
- Commit after every task, with a conventional message scoped `(pet)`, `(page)`, `(sound)`, `(model)` or `(docs)`.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `public/models/byte.glb` | the re-exported model with the `ChestLight` node | 1 |
| `src/pet/types.ts` | `RigSource.chest`, `PetRig.chestWorld`, the `switching` state, `THEME`/`SWITCHED` events, `switchMs`, `ThemeApply`, `BytePetHandle.performThemeSwitch` | 1, 2, 3, 7 |
| `src/pet/glbLoader.ts` | maps the `ChestLight` node to `source.chest` | 1 |
| `src/pet/glbAsset.test.ts` | the re-export contract (size, names) | 1 |
| `src/pet/glbRig.ts`, `rig.ts`, `swapRig.ts` | `chestWorld()` on all three rigs | 2 |
| `src/pet/fsm.ts` | the `switching` state and wake-then-switch | 3 |
| `src/pet/sound/SoundEngine.ts`, `webAudioSynth.ts` | the `themeWhooshDown` cue | 4 |
| `src/pet/themeGesture.ts` (new) | plan choice, visibility maths, corner placement, gesture and pulse timelines | 5 |
| `src/lib/themeReveal.ts` (new), `src/styles/global.css` | circle reveal / crossfade via View Transitions | 6 |
| `src/pet/createBytePet.ts` | `performThemeSwitch` orchestration, glow composition, corner visit | 7 |
| `src/main.ts` | toggle wiring, busy lock, `aria-busy` | 8 |
| `docs/SPEC.md`, `AUDIO_SPEC.md`, `ASSET_SPEC.md`, `DECISIONS.md`, `TICKETS.md` | docs | 1, 4, 8 |

---

### Task 1: Ship the ChestLight re-export

**Files:**
- Replace: `public/models/byte.glb` (copied from `/Volumes/SD500/Documents/blender/byte.glb`)
- Modify: `src/pet/types.ts` (`RigSource`)
- Modify: `src/pet/glbLoader.ts` (`mapGltfToRigSource`)
- Test: `src/pet/glbLoader.test.ts`, `src/pet/glbAsset.test.ts`
- Docs: `docs/ASSET_SPEC.md` §5 and §7, `docs/SPEC.md:173`

**Interfaces:**
- Produces: `RigSource.chest?: THREE.Object3D`, the node named `ChestLight` (case-insensitive), parented to the `Torso` bone.

- [ ] **Step 1: Write the failing loader test.** Add this to `src/pet/glbLoader.test.ts`, inside the `describe` that holds `'finds Eye and Mouth nodes by name…'`:

```ts
  it('finds the ChestLight locator by name, case-insensitively, nested at any depth', () => {
    const scene = new THREE.Group();
    const torso = new THREE.Object3D();
    torso.name = 'Torso';
    const chest = new THREE.Object3D();
    chest.name = 'chestlight'; // proves case-insensitivity
    torso.add(chest);
    scene.add(torso);

    const result = mapGltfToRigSource({ scene, animations: [] });

    expect(result.chest).toBe(chest);
  });

  it('leaves chest undefined without throwing when there is no ChestLight', () => {
    const result = mapGltfToRigSource({ scene: new THREE.Group(), animations: [] });
    expect(result.chest).toBeUndefined();
  });
```

- [ ] **Step 2: Write the failing asset-contract test.** In `src/pet/glbAsset.test.ts`, change `const DELIVERED_BYTES = 728_928;` to `const DELIVERED_BYTES = 729_036;`. Then add this line to `'maps every name the rig reads…'`, right after the `mouth` expectation:

```ts
    expect(source.chest?.name).toBe('ChestLight');
    expect(source.chest?.parent?.name).toBe('Torso');
```

- [ ] **Step 3: Run the tests and confirm they fail.**

Run: `mise exec node@22 -- npx vitest run src/pet/glbLoader.test.ts src/pet/glbAsset.test.ts`
Expected: FAIL. `result.chest` is undefined, TypeScript reports that `chest` doesn't exist on `RigSource`, and the asset size is still 728928.

- [ ] **Step 4: Copy the model and verify it.**

```bash
cp /Volumes/SD500/Documents/blender/byte.glb public/models/byte.glb
wc -c < public/models/byte.glb
```
Expected: `729036`.

- [ ] **Step 5: Add `chest` to `RigSource`** in `src/pet/types.ts`, right after the `torso` field:

```ts
  /** Theme gesture (D4): the `ChestLight` locator, parented to `Torso` — the theme reveal's origin. Falls back to `torso`, then the root, when absent. */
  chest?: THREE.Object3D;
```

- [ ] **Step 6: Map the node** in `src/pet/glbLoader.ts`, `mapGltfToRigSource`.
  - Add `let chest: THREE.Object3D | undefined;` next to `let torso`.
  - Add this inside the traverse, after the `torso` line:

```ts
    if (!chest && sameName(object.name, 'ChestLight')) chest = object;
```
  - Add `chest,` to the returned object, after `torso,`.
  - Add a bullet to the doc comment: `` - `chest`: the `ChestLight` locator (theme gesture, D4). ``

- [ ] **Step 7: Run the tests and confirm they pass.**

Run: `mise exec node@22 -- npx vitest run src/pet/glbLoader.test.ts src/pet/glbAsset.test.ts`
Expected: PASS. This includes the existing clip-length, Eat-bite, height and triangle tests, which proves the re-export changed nothing else.

- [ ] **Step 8: Update the docs.**
  - `docs/ASSET_SPEC.md` §5: add a bullet after `Mouth`:
    - ``- **`ChestLight`** — an empty parented to the `Torso` bone at the chest light's centre (theme gesture, 2026-09-25). The theme reveal starts here; without it the code falls back to `Torso`.``
  - `docs/ASSET_SPEC.md` §7: change `` Nodes named `Eye`/`Head` and `Mouth` `` to `` Nodes named `Eye`/`Head`, `Mouth` and `ChestLight` ``.
  - `docs/SPEC.md:173`: replace `728,928 B raw` with `729,036 B raw`. Replace the gzip figure with the value from `gzip -9 -c public/models/byte.glb | wc -c`, rounded to KB the way the line already does.
  - Leave `DECISIONS.md`, `TICKETS.md` and `PROGRESS.md` alone. Those are historical records.

- [ ] **Step 9: Run the full check, then commit.**

```bash
mise exec node@22 -- npx vitest run && mise exec node@22 -- npx tsc --noEmit
git add public/models/byte.glb src/pet/types.ts src/pet/glbLoader.ts src/pet/glbLoader.test.ts src/pet/glbAsset.test.ts docs/ASSET_SPEC.md docs/SPEC.md
git commit -m "feat(model): ship the ChestLight re-export and map it to RigSource.chest"
```

---

### Task 2: `chestWorld()` on every rig

**Files:**
- Modify: `src/pet/types.ts` (`PetRig`), `src/pet/glbRig.ts`, `src/pet/rig.ts`, `src/pet/swapRig.ts`
- Test: `src/pet/glbRig.test.ts`, `src/pet/rig.test.ts`, `src/pet/swapRig.test.ts`

**Interfaces:**
- Consumes: `RigSource.chest` (Task 1).
- Produces: `PetRig.chestWorld(): { x: number; y: number; z: number }`, the chest light's world position (world units are CSS px).

- [ ] **Step 1: Write the failing tests.**

In `src/pet/glbRig.test.ts`, add a chest to `makeSource()`:
- Add `chest: THREE.Object3D;` to its return type.
- Create the node after `torso.add(head);`:

```ts
  const chest = new THREE.Object3D();
  chest.name = 'ChestLight';
  chest.position.set(0.0066, 0.489, 0.163);
  torso.add(chest);
```
- Add `chest,` to the returned object.

Then add this to `describe('createGlbRig blink, materials, mouth', …)`:

```ts
  it('reports the ChestLight world position, then Torso, when there is no ChestLight', () => {
    const source = makeSource();
    const rig = createGlbRig(source);
    const expected = source.chest.getWorldPosition(new THREE.Vector3());
    expect(rig.chestWorld()).toEqual({ x: expected.x, y: expected.y, z: expected.z });
    rig.dispose();

    const noChest = makeSource();
    const torsoOnly = createGlbRig({ ...noChest, chest: undefined });
    const torso = noChest.torso.getWorldPosition(new THREE.Vector3());
    expect(torsoOnly.chestWorld()).toEqual({ x: torso.x, y: torso.y, z: torso.z });
    torsoOnly.dispose();
  });
```

In `src/pet/rig.test.ts`, add this at the end of the file:

```ts
describe('createPetRig chestWorld', () => {
  it('uses the placeholder mouth as the chest (no chest light on the placeholder)', () => {
    const rig = createPetRig(createPlaceholderBot({ theme: 'light' }));
    expect(rig.chestWorld()).toEqual(rig.mouthWorld());
    rig.dispose();
  });
});
```

In `src/pet/swapRig.test.ts`:
- Add `chestWorld: vi.fn(() => ({ x: 4, y: 5, z: 6 })),` to `stubRig`, after `mouthWorld`.
- Add this line to `'forwards every call to the current leaf'`:

```ts
    expect(rig.chestWorld()).toEqual({ x: 4, y: 5, z: 6 });
```

- [ ] **Step 2: Run the tests and confirm they fail.**

Run: `mise exec node@22 -- npx vitest run src/pet/glbRig.test.ts src/pet/rig.test.ts src/pet/swapRig.test.ts`
Expected: FAIL, because `chestWorld` isn't a function.

- [ ] **Step 3: Add the method to `PetRig`** in `src/pet/types.ts`, after `mouthWorld()`:

```ts
  /** World position of the chest light (theme gesture, D4) — the reveal's origin. */
  chestWorld(): { x: number; y: number; z: number };
```

- [ ] **Step 4: Implement it in `src/pet/glbRig.ts`.**
  - Add `const tmpChest = new THREE.Vector3();` next to `tmpMouth`.
  - Add the function after `mouthWorld()`:

```ts
  /** The `ChestLight` locator's world position; without one, `Torso` (row 12 spirit), then the root. */
  function chestWorld(): { x: number; y: number; z: number } {
    (source.chest ?? source.torso ?? object3d).getWorldPosition(tmpChest);
    return { x: tmpChest.x, y: tmpChest.y, z: tmpChest.z };
  }
```
  - Add `chestWorld,` to the returned object, after `mouthWorld,`.

- [ ] **Step 5: Implement it in `src/pet/rig.ts`** (the placeholder), after `mouthWorld()`:

```ts
  /**
   * The placeholder has no chest light; its mouth sits on the same front face,
   * which is close enough for a reveal origin. A real `chest` wins if a source
   * ever provides one.
   */
  function chestWorld(): { x: number; y: number; z: number } {
    const node = source.chest ?? source.mouth;
    if (!node) {
      return { x: 0, y: 0, z: 0 };
    }
    node.getWorldPosition(tmpMouthWorld);
    return { x: tmpMouthWorld.x, y: tmpMouthWorld.y, z: tmpMouthWorld.z };
  }
```
Then add `chestWorld,` to the returned object, after `mouthWorld,`.

- [ ] **Step 6: Implement it in `src/pet/swapRig.ts`**, after `mouthWorld()`:

```ts
  function chestWorld(): { x: number; y: number; z: number } {
    return leaf.chestWorld();
  }
```
Then add `chestWorld,` to the returned object.

- [ ] **Step 7: Run the tests and confirm they pass.**

Run: `mise exec node@22 -- npx vitest run && mise exec node@22 -- npx tsc --noEmit`
Expected: PASS, with no type errors.

- [ ] **Step 8: Commit.**

```bash
git add src/pet/types.ts src/pet/glbRig.ts src/pet/rig.ts src/pet/swapRig.ts src/pet/glbRig.test.ts src/pet/rig.test.ts src/pet/swapRig.test.ts
git commit -m "feat(pet): add chestWorld() to every rig, backed by the ChestLight node"
```

---

### Task 3: FSM `switching` state

**Files:**
- Modify: `src/pet/types.ts` (`PetState`, `PetEvent`, `PetFSMConfig`)
- Modify: `src/pet/fsm.ts`
- Test: `src/pet/fsm.test.ts`

**Interfaces:**
- Produces:
  - `PetState` gains `'switching'`.
  - `PetEvent` gains `'THEME'` (the pet asks Byte to perform the switch) and `'SWITCHED'` (the gesture finished).
  - `PetFSMConfig.switchMs` (default 4000) is a safety cap only.
- Transitions:
  - idle, curious, invited or peeking, on `THEME` → `switching`
  - sleeping, on `THEME` → `waking`, with a pending theme
  - waking, on `THEME` → stays in `waking` and marks the theme pending
  - waking, once its timer elapses with a theme pending → `switching` (the theme wins over a pending feed)
  - switching, on `SWITCHED` → `idle`
  - switching, on its `switchMs` cap → `idle`
  - hidden, entering, traveling, dashing, eating and retyping ignore `THEME`
  - `switching` isn't sleep-eligible

- [ ] **Step 1: Write the failing tests.** Append this to `src/pet/fsm.test.ts`:

```ts
describe('createFSM: switching (theme gesture)', () => {
  it.each(['idle', 'curious', 'invited', 'peeking'] as const)('%s -> switching on THEME', (from) => {
    const fsm = createFSM({ initialState: from });
    fsm.send('THEME');
    expect(fsm.state()).toBe('switching');
  });

  it('switching -> idle on SWITCHED', () => {
    const fsm = createFSM();
    fsm.send('THEME');
    fsm.send('SWITCHED');
    expect(fsm.state()).toBe('idle');
  });

  it('ignores FEED, PEEK, THEME and MIGRATE while switching', () => {
    const fsm = createFSM();
    fsm.send('THEME');
    const onEnter = vi.fn();
    fsm.onEnter(onEnter);

    fsm.send('FEED');
    fsm.send('PEEK');
    fsm.send('THEME');
    fsm.send('MIGRATE');

    expect(fsm.state()).toBe('switching');
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('caps switching at switchMs (default 4000) -> idle, and never drifts to sleep', () => {
    const fsm = createFSM();
    fsm.tickTimers(29000); // idle, sleep accum 29000
    fsm.send('THEME'); // resets the sleep accumulator (a user action)
    fsm.tickTimers(3999);
    expect(fsm.state()).toBe('switching');
    fsm.tickTimers(1);
    expect(fsm.state()).toBe('idle');
  });

  it('honours a switchMs override', () => {
    const fsm = createFSM({ switchMs: 100 });
    fsm.send('THEME');
    fsm.tickTimers(100);
    expect(fsm.state()).toBe('idle');
  });

  it('sleeping -> waking on THEME, then -> switching (not dashing) once the wake elapses', () => {
    const fsm = createFSM();
    fsm.tickTimers(30000);
    expect(fsm.state()).toBe('sleeping');

    fsm.send('THEME');
    expect(fsm.state()).toBe('waking');

    fsm.tickTimers(599);
    expect(fsm.state()).toBe('waking');
    fsm.tickTimers(1);
    expect(fsm.state()).toBe('switching');
  });

  it('a THEME during a click-wake wins over the pending feed', () => {
    const fsm = createFSM();
    fsm.tickTimers(30000);
    fsm.send('POINTER_DOWN'); // -> waking, feed pending
    fsm.send('THEME'); // theme pending too; stays waking
    expect(fsm.state()).toBe('waking');

    fsm.tickTimers(600);
    expect(fsm.state()).toBe('switching');
    fsm.send('SWITCHED');
    expect(fsm.state()).toBe('idle');
    fsm.tickTimers(600); // the dropped feed never resurfaces
    expect(fsm.state()).toBe('idle');
  });

  it('a later click-wake after a theme-wake still counts as a feed (flags cleared)', () => {
    const fsm = createFSM();
    fsm.tickTimers(30000);
    fsm.send('THEME');
    fsm.tickTimers(600); // -> switching
    fsm.send('SWITCHED'); // -> idle
    fsm.tickTimers(30000); // -> sleeping
    fsm.send('POINTER_DOWN');
    fsm.tickTimers(600);
    expect(fsm.state()).toBe('dashing');
  });

  it.each(['hidden', 'entering', 'traveling', 'dashing', 'eating', 'retyping'] as const)(
    'ignores THEME while %s',
    (from) => {
      const fsm = createFSM({ initialState: from });
      fsm.send('THEME');
      expect(fsm.state()).toBe(from);
    },
  );
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**

Run: `mise exec node@22 -- npx vitest run src/pet/fsm.test.ts`
Expected: FAIL. TypeScript rejects the `'THEME'` / `'switching'` literals, and none of the new transitions exist yet.

- [ ] **Step 3: Extend the types** in `src/pet/types.ts`.
  - `PetState`: add `| 'switching'` after `| 'peeking'`. Extend the union's doc comment with: `Theme gesture adds `switching` (a resting state --THEME--> switching --SWITCHED--> idle).`
  - `PetEvent`: add these two members after `'ARRIVED'`. Move the trailing `;` accordingly.

```ts
  | 'THEME' // pet: the toggle asked Byte to perform the theme switch (resting -> switching; sleeping -> waking first)
  | 'SWITCHED'; // pet: the charge & release gesture finished (switching -> idle)
```
  - `PetFSMConfig`: add

```ts
  switchMs?: number; // default 4000 — SAFETY cap only; switching normally exits on SWITCHED (the corner visit runs ~2.6s).
```

- [ ] **Step 4: Implement the transitions** in `src/pet/fsm.ts`.

(a) In `DEFAULTS`, add `switchMs: 4000,` after `enteringMs`.

(b) Change `specificTimerTarget`'s signature and its `waking` case, and add a `switching` case:

```ts
function specificTimerTarget(
  state: PetState,
  stateTimerMs: number,
  cfg: ResolvedFSMConfig,
  pendingFeed: boolean,
  pendingTheme: boolean,
): PetState | null {
```
```ts
    case 'waking':
      // The wake always runs its full window first. Then a pending theme
      // switch wins over a pending feed (spec D6): the toggle is the newer,
      // explicit request, and the switch gesture needs Byte at home.
      if (stateTimerMs < cfg.wakeMs) {
        return null;
      }
      if (pendingTheme) {
        return 'switching';
      }
      return pendingFeed ? 'dashing' : null;
    case 'switching':
      // Safety cap only — the pet's SWITCHED normally fires when the gesture ends.
      return stateTimerMs >= cfg.switchMs ? 'idle' : null;
```

(c) In `createFSM`, add this next to `pendingFeed`:

```ts
  /** Set by sleeping/waking's THEME; consumed (with `pendingFeed`) when waking's timer elapses. */
  let pendingTheme = false;
```

(d) In `send`, add a `THEME` case to **each** of the `idle`, `curious` and `invited` inner switches:

```ts
          case 'THEME':
            // Theme gesture: the toggle asked Byte to flip the theme. A user
            // action, so it resets the sleep accumulator like FEED does.
            resetSleepAccum();
            enter('switching');
            return;
```
Add the same case to `peeking`, before `default` in its inner switch. Then replace the `sleeping` case:

```ts
      case 'sleeping':
        if (event === 'POINTER_DOWN') {
          resetSleepAccum();
          pendingFeed = true;
          enter('waking');
        } else if (event === 'THEME') {
          // Wake first (spec D6), then switch — see `specificTimerTarget`'s waking case.
          resetSleepAccum();
          pendingTheme = true;
          enter('waking');
        }
        return;
```
Add these cases before the final `default:` in `send`, and update that default's comment. `waking` is no longer the only state reaching it; now nothing does.

```ts
      case 'waking':
        // Waking still runs to completion via its own timer; a THEME only
        // queues the switch for when it elapses. Every other event is ignored.
        if (event === 'THEME') {
          pendingTheme = true;
        }
        return;
      case 'switching':
        // The theme gesture is atomic: it exits on the pet's SWITCHED (or the
        // switchMs cap). POINTER_* only reset the sleep accumulator (moot —
        // switching isn't sleep-eligible — but consistent with the resting
        // states); everything else, including a second THEME, is ignored.
        switch (event) {
          case 'SWITCHED':
            enter('idle');
            return;
          case 'POINTER_NEAR':
          case 'POINTER_FAR':
          case 'POINTER_DOWN':
            resetSleepAccum();
            return;
          default:
            return;
        }
```

(e) In `tickTimers`, pass `pendingTheme` to `specificTimerTarget`, and clear both wake flags on the waking exit:

```ts
    const specific = specificTimerTarget(current, stateTimerMs, config, pendingFeed, pendingTheme);
    if (specific) {
      if (current === 'waking') {
        pendingFeed = false;
        pendingTheme = false;
      } else if (current === 'dashing' || current === 'eating') {
```

(f) Module doc comment: append one sentence to the opening paragraph: "The theme gesture adds `switching` (a resting state --THEME--> switching --SWITCHED--> idle; a sleeping Byte wakes first)." In `isSleepEligible`'s doc list, add: "- `switching` is excluded: Byte never falls asleep mid-gesture."

- [ ] **Step 5: Run the tests and confirm they pass.**

Run: `mise exec node@22 -- npx vitest run src/pet/fsm.test.ts && mise exec node@22 -- npx tsc --noEmit`
Expected: PASS. The existing `'ignores every event while waking'` test still passes, because it never sends `THEME`.

- [ ] **Step 6: Run the full suite, then commit.**

```bash
mise exec node@22 -- npx vitest run
git add src/pet/types.ts src/pet/fsm.ts src/pet/fsm.test.ts
git commit -m "feat(pet): add the FSM switching state for the theme gesture"
```

---

### Task 4: Direction-aware whoosh

**Files:**
- Modify: `src/pet/sound/SoundEngine.ts` (the `Cue` union), `src/pet/sound/webAudioSynth.ts` (`CUE_VOICES`)
- Test: `src/pet/sound/webAudioSynth.test.ts`
- Docs: `docs/AUDIO_SPEC.md` §2

**Interfaces:**
- Produces: `Cue` gains `'themeWhooshDown'`. `themeWhoosh` stays the upward glide (220 → 660 Hz), played when going to light. `themeWhooshDown` is its mirror (660 → 220 Hz), played when going to dark.

- [ ] **Step 1: Write the failing test.** In `src/pet/sound/webAudioSynth.test.ts`:
  - Add `themeWhooshDown: true,` to `CUE_REGISTRY`, after `themeWhoosh`.
  - Give `MockAudioParam` a history. Add `readonly history: number[] = [];` as a field, and `this.history.push(value);` as the first line of both `setValueAtTime` and `exponentialRampToValueAtTime`.
  - Record oscillators. Next to `createdGains`, add:

```ts
/** Every `OscillatorNode` the engine builds, in creation order. */
const createdOscillators: MockOscillatorNode[] = [];
```
  - In `MockAudioContext.createOscillator`, keep the node in a local, then `createdOscillators.push(node)` before returning it.
  - Add `createdOscillators.length = 0;` to `beforeEach`.
  - Append:

```ts
describe('createWebAudioSynth: theme whoosh direction', () => {
  it('glides themeWhoosh up (to light) and themeWhooshDown down (to dark)', () => {
    const synth = createWebAudioSynth();
    synth.unlock();

    synth.play('themeWhoosh');
    synth.play('themeWhooshDown');

    const [up, down] = createdOscillators;
    expect(up.frequency.history).toEqual([220, 660]);
    expect(down.frequency.history).toEqual([660, 220]);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**

Run: `mise exec node@22 -- npx vitest run src/pet/sound/webAudioSynth.test.ts`
Expected: FAIL. `themeWhooshDown` isn't assignable to `Cue`, and the synth has no voice for it.

- [ ] **Step 3: Implement it.**
  - `SoundEngine.ts`: add `| 'themeWhooshDown'` to `Cue`, after `'themeWhoosh'`.
  - `webAudioSynth.ts`: add this to `CUE_VOICES`, after `themeWhoosh`:

```ts
  // Airy downward glide — themeWhoosh's mirror, for a switch to dark.
  themeWhooshDown: [{ type: 'sine', freqs: [660, 220], peak: 0.07, attack: 0.05, duration: 0.3 }],
```

- [ ] **Step 4: Run the tests and confirm they pass.**

Run: `mise exec node@22 -- npx vitest run && mise exec node@22 -- npx tsc --noEmit`
Expected: PASS. The `'plays every cue in the union'` test now covers the new cue too.

- [ ] **Step 5: Update the docs.** In `docs/AUDIO_SPEC.md` §2's table, change the `themeWhoosh` row's character to `short airy whoosh, upward — theme switch to light (on the gesture's flip beat)`. Add a row after it:

```
| `themeWhooshDown` | the same whoosh, downward — theme switch to dark (on the gesture's flip beat) | 200–350ms |
```

- [ ] **Step 6: Commit.**

```bash
git add src/pet/sound/SoundEngine.ts src/pet/sound/webAudioSynth.ts src/pet/sound/webAudioSynth.test.ts docs/AUDIO_SPEC.md
git commit -m "feat(sound): add a downward themeWhooshDown cue for switches to dark"
```

---

### Task 5: Pure gesture module `themeGesture.ts`

**Files:**
- Create: `src/pet/themeGesture.ts`
- Test: `src/pet/themeGesture.test.ts`

**Interfaces:**
- Consumes: `PetState` (Task 3), `StageRect`/`Point`/`Size` from `./stage`, and `REVEAL_MS` from `../lib/themeReveal`. That last one is imported **by the test only** and arrives in Task 6. Until then the test's parity check uses the literal `620`; Task 6 swaps in the import.
- Produces (every export is used by Task 7):
  - `type SwitchPlan = 'home' | 'corner' | 'layer' | 'button' | 'pulse' | 'instant'`
  - `chooseSwitchPlan(state: PetState, visible: number, reduced: boolean): SwitchPlan`
  - `visibleFraction(box: StageRect, clip: StageRect | null): number`
  - `byteScreenBox(feet: Point, unitPx: number): StageRect`
  - `cornerFeetScreen(viewport: Size, unitPx: number): Point`
  - `interface GestureState { sqY; sqXZ; glowMul; boost }`, `restingGesture(): GestureState`, `composeGlow(base: number, g: GestureState): number`
  - `buildChargeRelease(state: GestureState, to: 'light' | 'dark'): gsap.core.Timeline` (paused)
  - `buildPulse(state: GestureState): gsap.core.Timeline` (paused)
  - Constants: `VISIBLE_THRESHOLD`, `FLIP_AT_S`, `PULSE_S`, `THEME_SWITCH_LERP_S`, `CORNER_RISE_S`, `CORNER_SINK_S`, `CORNER_SINK_DELAY_S`, `CORNER_HIDDEN_Y`, `CORNER_REST_Y`

- [ ] **Step 1: Write the failing tests.** Create `src/pet/themeGesture.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildChargeRelease,
  buildPulse,
  byteScreenBox,
  chooseSwitchPlan,
  composeGlow,
  cornerFeetScreen,
  FLIP_AT_S,
  PULSE_S,
  restingGesture,
  THEME_SWITCH_LERP_S,
  visibleFraction,
  type GestureState,
} from './themeGesture';
import type { PetState } from './types';

/**
 * GSAP stamps an enumerable `_gsap` cache onto every object it tweens, so a
 * tweened `GestureState` never `toEqual`s a fresh one — compare its four
 * fields instead (verified against gsap 3.15, 2026-09-28).
 */
function fields(g: GestureState): GestureState {
  return { sqY: g.sqY, sqXZ: g.sqXZ, glowMul: g.glowMul, boost: g.boost };
}

describe('chooseSwitchPlan', () => {
  const resting: PetState[] = ['idle', 'curious', 'invited', 'peeking', 'sleeping', 'waking'];
  const busy: PetState[] = ['dashing', 'eating', 'retyping'];
  const away: PetState[] = ['hidden', 'entering', 'traveling', 'switching'];

  it.each(resting)('%s: home when >= 50%% visible, corner otherwise', (s) => {
    expect(chooseSwitchPlan(s, 0.5, false)).toBe('home');
    expect(chooseSwitchPlan(s, 0.49, false)).toBe('corner');
  });

  it.each(busy)('%s: layered when visible, button otherwise', (s) => {
    expect(chooseSwitchPlan(s, 1, false)).toBe('layer');
    expect(chooseSwitchPlan(s, 0, false)).toBe('button');
  });

  it.each(away)('%s: always the button reveal', (s) => {
    expect(chooseSwitchPlan(s, 1, false)).toBe('button');
  });

  it('reduced motion: a glow pulse when Byte is visible and able, else a plain crossfade', () => {
    expect(chooseSwitchPlan('idle', 1, true)).toBe('pulse');
    expect(chooseSwitchPlan('eating', 1, true)).toBe('pulse');
    expect(chooseSwitchPlan('idle', 0, true)).toBe('instant');
    expect(chooseSwitchPlan('traveling', 1, true)).toBe('instant');
  });
});

describe('visibleFraction', () => {
  const box = { x: 0, y: 0, width: 100, height: 100 };

  it('is 1 fully inside, 0.5 half clipped, 0 disjoint or with no clip', () => {
    expect(visibleFraction(box, { x: -10, y: -10, width: 200, height: 200 })).toBe(1);
    expect(visibleFraction(box, { x: 50, y: 0, width: 100, height: 100 })).toBe(0.5);
    expect(visibleFraction(box, { x: 200, y: 0, width: 100, height: 100 })).toBe(0);
    expect(visibleFraction(box, null)).toBe(0);
  });

  it('is 0 for a degenerate box', () => {
    expect(visibleFraction({ x: 0, y: 0, width: 0, height: 10 }, box)).toBe(0);
  });
});

describe('byteScreenBox / cornerFeetScreen', () => {
  it('boxes Byte as 0.6 x 1 unit heights standing on its feet', () => {
    expect(byteScreenBox({ x: 100, y: 200 }, 100)).toEqual({ x: 70, y: 100, width: 60, height: 100 });
  });

  it('stands Byte on the viewport bottom, inset 24px from the right edge', () => {
    expect(cornerFeetScreen({ width: 1000, height: 800 }, 100)).toEqual({ x: 946, y: 800 });
  });
});

describe('composeGlow', () => {
  it('scales the theme level by glowMul and adds the boost', () => {
    expect(composeGlow(1, restingGesture())).toBe(1);
    expect(composeGlow(1, { sqY: 1, sqXZ: 1, glowMul: 0.1, boost: 0 })).toBeCloseTo(0.1, 10);
    expect(composeGlow(0, { sqY: 1, sqXZ: 1, glowMul: 1, boost: 0.6 })).toBeCloseTo(0.6, 10);
  });
});

describe('buildChargeRelease', () => {
  it('is paused, ~1.45s long, and flips inside the release', () => {
    const tl = buildChargeRelease(restingGesture(), 'dark');
    expect(tl.paused()).toBe(true);
    expect(tl.duration()).toBeCloseTo(1.45, 5);
    expect(FLIP_AT_S).toBeGreaterThan(0.56);
    expect(FLIP_AT_S).toBeLessThan(0.67);
  });

  it('crouches to y 0.8 / xz 1.11 by the end of the charge', () => {
    const g = restingGesture();
    buildChargeRelease(g, 'light').seek(0.56);
    expect(g.sqY).toBeCloseTo(0.8, 5);
    expect(g.sqXZ).toBeCloseTo(1.11, 5);
  });

  it('going dark: the glow ignites from off during the charge', () => {
    const g = restingGesture();
    buildChargeRelease(g, 'dark').seek(0.5);
    expect(g.boost).toBeCloseTo(0.6, 5);
    expect(g.glowMul).toBe(1);
  });

  it('going light: the glow dims during the charge', () => {
    const g = restingGesture();
    buildChargeRelease(g, 'light').seek(0.5);
    expect(g.glowMul).toBeCloseTo(0.1, 5);
    expect(g.boost).toBe(0);
  });

  it.each(['light', 'dark'] as const)('to %s: flaring and stretched on the flip beat', (to) => {
    const g = restingGesture();
    buildChargeRelease(g, to).seek(FLIP_AT_S);
    expect(g.boost).toBeGreaterThan(1);
    expect(g.sqY).toBeGreaterThan(1);
  });

  it.each(['light', 'dark'] as const)('to %s: settles back to rest exactly', (to) => {
    const g = restingGesture();
    const tl = buildChargeRelease(g, to);
    tl.seek(tl.duration());
    expect(fields(g)).toEqual(restingGesture());
  });
});

describe('buildPulse', () => {
  it('peaks at PULSE_S, returns to rest, and never moves the body', () => {
    const g = restingGesture();
    const tl = buildPulse(g);
    expect(tl.paused()).toBe(true);
    tl.seek(PULSE_S);
    expect(g.boost).toBeCloseTo(1.2, 5);
    tl.seek(tl.duration());
    expect(fields(g)).toEqual(restingGesture());
  });
});

describe('THEME_SWITCH_LERP_S', () => {
  it("matches the page reveal's length so Byte's look lands with the circle", () => {
    expect(THEME_SWITCH_LERP_S * 1000).toBe(620);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**

Run: `mise exec node@22 -- npx vitest run src/pet/themeGesture.test.ts`
Expected: FAIL, because the module `./themeGesture` doesn't exist.

- [ ] **Step 3: Implement it.** Create `src/pet/themeGesture.ts`:

```ts
/**
 * Theme gesture — the pure half of "Byte flips the theme" (spec:
 * docs/superpowers/specs/2026-09-28-byte-theme-gesture-design.md).
 *
 * `createBytePet` owns every side effect (pose/glow writes, FSM sends, the
 * page's reveal callback, the corner visit's placement); this module decides
 * WHICH plan a toggle click runs and builds the paused GSAP timelines over a
 * plain `GestureState` object, so all of it is unit-testable under jsdom with
 * no WebGL. No `three`, no DOM.
 *
 * `GestureState` is a layer ON TOP of Byte, never a replacement: `sqY`/`sqXZ`
 * go to `rig.pose.scale` (consumer-owned; no clip touches it), and the glow
 * the rig shows is `composeGlow(themeLevel, state)` — the theme crossfade keeps
 * owning the base level while the gesture scales it (`glowMul`) and adds to it
 * (`boost`). That is what lets the gesture play over a running feed or retype
 * (spec D6) without fighting their writers.
 */
import gsap from 'gsap';
import type { Point, Size, StageRect } from './stage';
import type { PetState } from './types';

/** How a toggle click plays out (spec D5, D6, D8). */
export type SwitchPlan =
  /** Resting/sleeping Byte, visible: gesture where it stands (FSM `switching`). */
  | 'home'
  /** Resting/sleeping Byte, offscreen: rise from the bottom-right edge, gesture, sink back. */
  | 'corner'
  /** Feeding/retyping Byte, visible: gesture layered over the running state. */
  | 'layer'
  /** Byte can't act (entrance, travel, busy + offscreen): the page reveals from the toggle. */
  | 'button'
  /** Reduced motion, Byte visible: one glow pulse, crossfade on its peak. */
  | 'pulse'
  /** Reduced motion, Byte not visible: plain crossfade. */
  | 'instant';

/** Share of Byte's screen box that must be on screen (inside its stage) to gesture in place (D5). */
export const VISIBLE_THRESHOLD = 0.5;

/** States the gesture may interrupt: they go through the FSM's `switching` (sleeping/waking via a wake first). */
const INTERRUPTIBLE: ReadonlySet<PetState> = new Set<PetState>([
  'idle',
  'curious',
  'invited',
  'peeking',
  'sleeping',
  'waking',
]);

/** States the gesture layers over instead of interrupting — each has its own single-writer driver (D6). */
const LAYERABLE: ReadonlySet<PetState> = new Set<PetState>(['dashing', 'eating', 'retyping']);

export function chooseSwitchPlan(state: PetState, visible: number, reduced: boolean): SwitchPlan {
  const seen = visible >= VISIBLE_THRESHOLD;
  const able = INTERRUPTIBLE.has(state) || LAYERABLE.has(state);
  if (reduced) {
    return seen && able ? 'pulse' : 'instant';
  }
  if (INTERRUPTIBLE.has(state)) {
    return seen ? 'home' : 'corner';
  }
  if (LAYERABLE.has(state)) {
    return seen ? 'layer' : 'button';
  }
  // hidden/entering (the drop-in), traveling (fading between homes), and a
  // switch already in flight.
  return 'button';
}

/** Fraction (0…1) of `box` inside `clip` — `clip` is the stage already intersected with the viewport, `null` when off screen. */
export function visibleFraction(box: StageRect, clip: StageRect | null): number {
  if (!clip || box.width <= 0 || box.height <= 0) {
    return 0;
  }
  const w = Math.min(box.x + box.width, clip.x + clip.width) - Math.max(box.x, clip.x);
  const h = Math.min(box.y + box.height, clip.y + clip.height) - Math.max(box.y, clip.y);
  return w <= 0 || h <= 0 ? 0 : (w * h) / (box.width * box.height);
}

/** Byte's width as a fraction of its height — a loose screen box for the visibility test only. */
const BYTE_BOX_ASPECT = 0.6;

/** Byte's screen box, standing on `feet` (screen px, y-down) and `unitPx` tall. */
export function byteScreenBox(feet: Point, unitPx: number): StageRect {
  const width = unitPx * BYTE_BOX_ASPECT;
  return { x: feet.x - width / 2, y: feet.y - unitPx, width, height: unitPx };
}

/** Gap between Byte and the viewport's right edge during a corner visit. */
const CORNER_INSET_PX = 24;

/** Where Byte's feet stand for a corner visit: on the viewport's bottom edge, at the right (D5). */
export function cornerFeetScreen(viewport: Size, unitPx: number): Point {
  return {
    x: viewport.width - CORNER_INSET_PX - (unitPx * BYTE_BOX_ASPECT) / 2,
    y: viewport.height,
  };
}

/**
 * Corner visit timing and `pose.position.y` stops (pose units are fractions of
 * Byte's height; the pose origin is at the feet). Hidden sits a little over one
 * height below the edge; rest shows the top 70% — the visor and the chest light,
 * which sits ~0.39 of the height up.
 */
export const CORNER_RISE_S = 0.6;
export const CORNER_SINK_S = 0.45;
export const CORNER_SINK_DELAY_S = 0.1;
export const CORNER_HIDDEN_Y = -1.05;
export const CORNER_REST_Y = -0.3;

/** The gesture layer. Resting values are the identity: no squash, the theme glow untouched. */
export interface GestureState {
  sqY: number;
  sqXZ: number;
  glowMul: number;
  boost: number;
}

export function restingGesture(): GestureState {
  return { sqY: 1, sqXZ: 1, glowMul: 1, boost: 0 };
}

/** The glow level the rig shows: the theme's base level, scaled then boosted by the gesture. */
export function composeGlow(base: number, g: GestureState): number {
  return base * g.glowMul + g.boost;
}

/** Charge (crouch + glow dim/ignite) length, then the release. Values from the owner-approved demo (gesture B). */
const CHARGE_S = 0.56;
/** When the theme flips, measured from the gesture's start: on the flare (D2). */
export const FLIP_AT_S = 0.63;
/** Going dark, the off glow ignites to this level during the charge (D3). */
const IGNITE_LEVEL = 0.6;
/** Peak additive glow on release. */
const FLARE_LEVEL = 3.6;

/**
 * Charge & release (D2/D3), as a paused timeline over `state`. The caller
 * plays it, applies `state` every frame, and flips the theme at `FLIP_AT_S`.
 * Ends exactly at `restingGesture()` values (~1.45s).
 */
export function buildChargeRelease(state: GestureState, to: 'light' | 'dark'): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true });
  // Charge: crouch-squash while the glow gathers — ignites from off going
  // dark (light mode has no glow to dim), dims going light.
  tl.to(state, { sqY: 0.8, sqXZ: 1.11, duration: CHARGE_S, ease: 'power2.inOut' }, 0);
  if (to === 'dark') {
    tl.to(state, { boost: IGNITE_LEVEL, duration: 0.5, ease: 'power2.in' }, 0);
  } else {
    tl.to(state, { glowMul: 0.1, duration: 0.5, ease: 'power2.in' }, 0);
  }
  // Release: snap to a stretch with the chest flare; the flip lands mid-snap.
  tl.to(state, { sqY: 1.18, sqXZ: 0.92, duration: 0.11, ease: 'power3.out' }, CHARGE_S);
  tl.to(state, { glowMul: 1, boost: FLARE_LEVEL, duration: 0.09, ease: 'power3.out' }, CHARGE_S);
  // Settle.
  tl.to(state, { sqY: 1, sqXZ: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' }, 0.67);
  tl.to(state, { boost: 0, duration: 0.75, ease: 'power2.out' }, 0.7);
  return tl;
}

/** Reduced-motion pulse (D8): half-length, and the flip lands on its peak. */
export const PULSE_S = 0.15;
const PULSE_LEVEL = 1.2;

/** One soft glow pulse — the reduced-motion stand-in for the gesture. Touches `boost` only (no body motion). */
export function buildPulse(state: GestureState): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true });
  tl.to(state, { boost: PULSE_LEVEL, duration: PULSE_S, ease: 'sine.inOut' }, 0);
  tl.to(state, { boost: 0, duration: PULSE_S, ease: 'sine.inOut' }, PULSE_S);
  return tl;
}

/** Byte's light/material crossfade on a toggle switch — equals the page's circle reveal (`REVEAL_MS`, lib/themeReveal.ts) so both land together (D9). */
export const THEME_SWITCH_LERP_S = 0.62;
```

- [ ] **Step 4: Run the tests and confirm they pass.**

Run: `mise exec node@22 -- npx vitest run src/pet/themeGesture.test.ts && mise exec node@22 -- npx tsc --noEmit && mise exec node@22 -- npm run lint`
Expected: PASS. A scratch run against gsap 3.15 gave these values:
  - `seek(0.56)`: exactly `{0.8, 1.11}`.
  - `seek(0.63)`: boost ≈ 3.59, sqY ≈ 1.17.
  - `seek(1.45)`: exactly `{1, 1, 1, 0}` in both directions.

If `settles back to rest exactly` fails, don't loosen it to `toBeCloseTo`. GSAP lands `.to` tweens exactly on their end values at progress 1, so a failure means a tween's end value is wrong.

- [ ] **Step 5: Commit.**

```bash
git add src/pet/themeGesture.ts src/pet/themeGesture.test.ts
git commit -m "feat(pet): add the pure theme-gesture module (plans, visibility, charge & release)"
```

---

### Task 6: Page reveal `lib/themeReveal.ts`

**Files:**
- Create: `src/lib/themeReveal.ts`
- Test: `src/lib/themeReveal.test.ts`
- Modify: `src/styles/global.css`
- Modify: `src/pet/themeGesture.test.ts` (use `REVEAL_MS` for the parity check)

**Interfaces:**
- Produces:
  - `REVEAL_MS = 620`, `CROSSFADE_MS = 400`
  - `revealRadius(x, y, width, height): number`
  - `revealTheme(apply: () => void, origin: { x: number; y: number }, opts: { reduced: boolean }): Promise<void>`
- Behaviour:
  - `apply` always runs exactly once.
  - The promise resolves when the animation ends, or right away without View Transitions.
  - It never rejects.

- [ ] **Step 1: Write the failing tests.** Create `src/lib/themeReveal.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CROSSFADE_MS, REVEAL_MS, revealRadius, revealTheme } from './themeReveal';

// jsdom has neither `document.startViewTransition` nor `Element.animate`, while
// the DOM lib types both as always present — so stub them with
// `Object.defineProperty` and remove them with `Reflect.deleteProperty`,
// which sidestep the "operand of delete must be optional" and method-type
// assignment errors that plain `=`/`delete` would raise under tsc.
function stubViewTransition(ready: Promise<void> = Promise.resolve()) {
  const animate = vi.fn(() => ({ finished: Promise.resolve() }));
  Object.defineProperty(document.documentElement, 'animate', {
    value: animate,
    configurable: true,
    writable: true,
  });
  const start = vi.fn((cb: () => void) => {
    cb();
    return { ready, finished: ready.catch(() => {}), updateCallbackDone: Promise.resolve() };
  });
  Object.defineProperty(document, 'startViewTransition', {
    value: start,
    configurable: true,
    writable: true,
  });
  return { animate, start };
}

afterEach(() => {
  Reflect.deleteProperty(document, 'startViewTransition');
  Reflect.deleteProperty(document.documentElement, 'animate');
  vi.restoreAllMocks();
});

describe('revealRadius', () => {
  it("reaches the viewport's farthest corner from the origin", () => {
    expect(revealRadius(0, 0, 100, 50)).toBeCloseTo(Math.hypot(100, 50), 10);
    expect(revealRadius(50, 25, 100, 50)).toBeCloseTo(Math.hypot(50, 25), 10);
  });
});

describe('revealTheme', () => {
  it('without View Transitions: applies synchronously and resolves', async () => {
    const apply = vi.fn();
    await revealTheme(apply, { x: 10, y: 10 }, { reduced: false });
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('full motion: a circle clip from the origin on the new view', async () => {
    const { animate } = stubViewTransition();
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
    const apply = vi.fn();

    await revealTheme(apply, { x: 900, y: 700 }, { reduced: false });

    expect(apply).toHaveBeenCalledTimes(1);
    const [keyframes, options] = animate.mock.calls[0] as unknown as [
      { clipPath: string[] },
      KeyframeAnimationOptions,
    ];
    const r = Math.hypot(900, 700);
    expect(keyframes.clipPath).toEqual([
      'circle(0px at 900px 700px)',
      `circle(${r}px at 900px 700px)`,
    ]);
    expect(options.duration).toBe(REVEAL_MS);
    expect(options.pseudoElement).toBe('::view-transition-new(root)');
  });

  it('clamps an off-viewport origin onto the viewport edge', async () => {
    const { animate } = stubViewTransition();
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);

    await revealTheme(() => {}, { x: 1200, y: 900 }, { reduced: false });

    const [keyframes] = animate.mock.calls[0] as unknown as [{ clipPath: string[] }];
    expect(keyframes.clipPath[0]).toBe('circle(0px at 1000px 800px)');
  });

  it('reduced motion: an opacity crossfade, no circle', async () => {
    const { animate } = stubViewTransition();

    await revealTheme(() => {}, { x: 0, y: 0 }, { reduced: true });

    const [keyframes, options] = animate.mock.calls[0] as unknown as [
      { opacity: number[] },
      KeyframeAnimationOptions,
    ];
    expect(keyframes).toEqual({ opacity: [0, 1] });
    expect(options.duration).toBe(CROSSFADE_MS);
  });

  it('a skipped transition (ready rejects) still applied the theme and resolves', async () => {
    const { animate } = stubViewTransition(Promise.reject(new Error('InvalidStateError')));
    const apply = vi.fn();

    await expect(revealTheme(apply, { x: 0, y: 0 }, { reduced: false })).resolves.toBeUndefined();

    expect(apply).toHaveBeenCalledTimes(1);
    expect(animate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**

Run: `mise exec node@22 -- npx vitest run src/lib/themeReveal.test.ts`
Expected: FAIL, because the module `./themeReveal` doesn't exist.

- [ ] **Step 3: Implement it.** Create `src/lib/themeReveal.ts`:

```ts
/**
 * Theme reveal — the page's half of a theme switch (spec D10): swap the theme
 * inside a View Transition and expand the new view as a circle from `origin`
 * (Byte's chest light, or the toggle when Byte can't act). Reduced motion gets
 * an opacity crossfade instead of the circle (D8).
 *
 * Page-agnostic on purpose: it knows nothing about Byte or about how the theme
 * is stored — `apply` does the actual swap — so the portfolio can reuse it
 * with its own `.dark` class. Browsers without View Transitions just apply.
 * The animations run through WAAPI (`element.animate`), which the global
 * reduced-motion CSS freeze doesn't touch — the crossfade is chosen by `opts`.
 */

/** Circle reveal length; `THEME_SWITCH_LERP_S` (pet/themeGesture.ts) matches it. */
export const REVEAL_MS = 620;
/** Reduced-motion crossfade length. */
export const CROSSFADE_MS = 400;
const REVEAL_EASE = 'cubic-bezier(0.25, 0.8, 0.25, 1)';
const NEW_VIEW = '::view-transition-new(root)';

/** Radius that covers the whole viewport from `(x, y)`: the distance to the farthest corner. */
export function revealRadius(x: number, y: number, width: number, height: number): number {
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function revealTheme(
  apply: () => void,
  origin: { x: number; y: number },
  opts: { reduced: boolean },
): Promise<void> {
  if (typeof document.startViewTransition !== 'function') {
    apply();
    return Promise.resolve();
  }
  const transition = document.startViewTransition(apply);
  // A transition the browser skips (tab hidden, superseded) rejects these, but
  // the update callback still ran — the theme is applied either way.
  transition.finished.catch(() => {});
  transition.updateCallbackDone.catch(() => {});

  const width = window.innerWidth;
  const height = window.innerHeight;
  const x = clamp(origin.x, 0, width);
  const y = clamp(origin.y, 0, height);
  const root = document.documentElement;

  return transition.ready
    .then(() => {
      const animation = opts.reduced
        ? root.animate(
            { opacity: [0, 1] },
            { duration: CROSSFADE_MS, easing: 'ease', pseudoElement: NEW_VIEW },
          )
        : root.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${revealRadius(x, y, width, height)}px at ${x}px ${y}px)`,
              ],
            },
            { duration: REVEAL_MS, easing: REVEAL_EASE, pseudoElement: NEW_VIEW },
          );
      return animation.finished.then(() => undefined);
    })
    .catch(() => undefined);
}
```

If `tsc` complains that `document.startViewTransition` is always defined (TS 6 DOM lib), keep the runtime check and write it as `if (!('startViewTransition' in document))`, then use `document.startViewTransition(apply)` unchanged.

- [ ] **Step 4: Add the CSS.** In `src/styles/global.css`, add this right after the `:root[data-theme='dark'] { color-scheme: dark; }` block:

```css
/* Theme reveal (lib/themeReveal.ts): the script animates
   ::view-transition-new(root) itself (circle clip, or a crossfade under
   reduced motion), so switch off the browser's default root crossfade. */
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}
```

- [ ] **Step 5: Tie the lerp constant to the reveal.** In `src/pet/themeGesture.test.ts`:
  - Add `import { REVEAL_MS } from '../lib/themeReveal';`.
  - Change the parity test's body to `expect(THEME_SWITCH_LERP_S * 1000).toBe(REVEAL_MS);`.

- [ ] **Step 6: Run the tests and confirm they pass.**

Run: `mise exec node@22 -- npx vitest run && mise exec node@22 -- npx tsc --noEmit && mise exec node@22 -- npm run lint && mise exec node@22 -- npm run format:check`
Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add src/lib/themeReveal.ts src/lib/themeReveal.test.ts src/styles/global.css src/pet/themeGesture.test.ts
git commit -m "feat(page): add a View Transitions theme reveal (circle from an origin, crossfade when reduced)"
```

---

### Task 7: Pet orchestration `performThemeSwitch`

`createBytePet.ts` needs WebGL, so it has no unit tests (see `scene.ts`'s doc comment). This task is verified by `tsc`, the full suite, lint, and Task 8's browser QA. Keep every change additive and commented in the file's existing style.

**Files:**
- Modify: `src/pet/types.ts` (`ThemeApply`, `BytePetHandle.performThemeSwitch`)
- Modify: `src/pet/createBytePet.ts`

**Interfaces:**
- Consumes:
  - `rig.chestWorld()` (Task 2)
  - the `switching` state and `THEME`/`SWITCHED` events (Task 3)
  - the `'themeWhooshDown'` cue (Task 4)
  - everything exported by `./themeGesture` (Task 5)
  - `screenFromWorld` from `./scene` (it already exists)
- Produces:
  - `export type ThemeApply = (origin: Point | null) => Promise<void> | void;` in `types.ts`
  - `BytePetHandle.performThemeSwitch(next: 'light' | 'dark', apply: ThemeApply): Promise<void>`. It never rejects. A call while a switch is in flight returns the in-flight promise and doesn't flip twice.

- [ ] **Step 1: Types.** In `src/pet/types.ts`:
  - Change `import type { StageRect } from './stage';` to `import type { Point, StageRect } from './stage';`.
  - Add this above `BytePetHandle`:

```ts
/**
 * Theme gesture seam (spec D10): the page's reveal, called by the pet on the
 * flip beat with the reveal's screen origin (Byte's chest light), or `null`
 * for "use your own" (the toggle). It applies + persists the theme; the pet
 * never touches storage or the DOM theme attribute. May return the reveal's
 * completion so `performThemeSwitch` resolves only once it has finished.
 */
export type ThemeApply = (origin: Point | null) => Promise<void> | void;
```
  - Add this to `BytePetHandle`, after `setTheme`:

```ts
  /**
   * The toggle path (spec): Byte performs the switch — charge & release at
   * home, a corner visit when offscreen, layered over a feed/retype, or none
   * (entrance/travel) — and calls `apply(origin)` on the flip beat. Skips T8's
   * stretch. Resolves once both the gesture and `apply`'s reveal are done;
   * never rejects. A call while one is in flight returns that same promise.
   */
  performThemeSwitch(next: 'light' | 'dark', apply: ThemeApply): Promise<void>;
```

- [ ] **Step 2: Imports** in `src/pet/createBytePet.ts`.
  - Add `screenFromWorld` to the existing `from './scene'` import list (keep it alphabetical).
  - Add `ThemeApply` to the `import type { … } from './types'` list.
  - Add:

```ts
import {
  buildChargeRelease,
  buildPulse,
  byteScreenBox,
  chooseSwitchPlan,
  composeGlow,
  CORNER_HIDDEN_Y,
  CORNER_REST_Y,
  CORNER_RISE_S,
  CORNER_SINK_DELAY_S,
  CORNER_SINK_S,
  cornerFeetScreen,
  FLIP_AT_S,
  PULSE_S,
  restingGesture,
  THEME_SWITCH_LERP_S,
  visibleFraction,
  type SwitchPlan,
} from './themeGesture';
```

- [ ] **Step 3: `switching` is a home state.** Add `'switching',` to `HOME_STATES`, after `'waking'`. Append to its doc comment: "`switching` (the theme gesture) is a home state too: Byte gestures on its anchor, and the corner visit overrides the pin explicitly in `onTick`." Leave `MIGRATE_ELIGIBLE_STATES` and `MODEL_SWAP_STATES` unchanged. A migration or model swap waits for the `idle` after `SWITCHED`, like it does for peeking and waking.

- [ ] **Step 4: Compose the glow.** Replace the `let glowLevel = 0;` + `applyGlowLevel` pair (around line 412) with:

```ts
  let glowLevel = 0;
  /**
   * Theme gesture layer (themeGesture.ts): squash/stretch for `rig.pose.scale`
   * plus a scale/boost on the glow. Resting values are the identity, so
   * outside a gesture every glow write below is exactly the theme level.
   */
  const gesture = restingGesture();
  /** The one glow writer: the theme level (`glowLevel`) composed with the gesture layer. */
  function writeGlow(): void {
    rig.setGlowLevel(composeGlow(glowLevel, gesture), currentGlowAccent);
  }
  function applyGlowLevel(level: number): void {
    glowLevel = level;
    writeGlow();
  }
```
In `setGlowAccent` (around line 2312), replace `rig.setGlowLevel(glowLevel, currentGlowAccent);` with `writeGlow();`.

- [ ] **Step 5: Let `applyTheme` skip the stretch and take a duration.** Change its signature and doc comment's first sentence. It currently reads `(t: Theme, opts: { animate?: boolean } = {})`; make it:

```ts
  function applyTheme(
    t: Theme,
    opts: { animate?: boolean; stretch?: boolean; durationS?: number } = {},
  ): void {
```
In the animated path:
  - Add `const durationS = opts.durationS ?? THEME_LERP_DURATION_S;`.
  - Use `durationS` in place of `THEME_LERP_DURATION_S` in `scene.setTheme(t, …)` and in the proxy tween's `duration`.
  - Change the final `playThemeStretch();` to `if (opts.stretch ?? true) { playThemeStretch(); }`.

Add to the doc comment: "`stretch: false` + `durationS` are the theme gesture's flip (the gesture replaces the stretch, and the lerp matches the page's reveal)." The instant path and `setTheme()` stay unchanged.

- [ ] **Step 6: Switch state.** Add this right after `let peekTimeline …` (around line 754):

```ts
  // --- Theme switch (spec 2026-09-28) state ----------------------------------
  /** The gesture's master timeline (charge & release, or the reduced pulse). */
  let gestureTimeline: ReturnType<typeof gsap.timeline> | null = null;
  /** A toggle switch waiting for the FSM's `switching` entry (set before THEME; consumed by `dispatch`). */
  let pendingSwitch: {
    next: Theme;
    apply: ThemeApply;
    corner: boolean;
    resolve: () => void;
  } | null = null;
  /** The in-flight `performThemeSwitch` promise — a second call returns it (the page also locks). */
  let switchInFlight: Promise<void> | null = null;
  /** True while Byte is on a corner visit: `onTick` places it at the bottom-right and opens the stage to the viewport. */
  const cornerVisit = { active: false };
  /** The scissor clip `onTick` last fed the scene (viewport ∩ stage, or `null`) — the visibility test reads it. */
  let lastStageClip: StageRect | null = null;
  const tmpChest = new THREE.Vector3();
```

- [ ] **Step 7: The switch functions.** Add this block right after `runPeekReduced()`. It's a function-declaration block, so hoisting covers its uses in `dispatch` and in the returned handle.

```ts
  // --- Theme switch: Byte causes the flip (spec 2026-09-28) -----------------------
  /** Push the gesture layer onto Byte: squash/stretch on the consumer-owned pose, plus the composed glow. */
  function writeGesture(): void {
    rig.pose.scale.set(gesture.sqXZ, gesture.sqY, gesture.sqXZ);
    writeGlow();
  }

  function resetGesture(): void {
    Object.assign(gesture, restingGesture());
    writeGesture();
  }

  /** Share of Byte's screen box inside the current stage clip (D5). */
  function byteVisibleFraction(): number {
    const p = rig.object3d.position;
    const feet = screenFromWorld(p.x, p.y, window.innerWidth, window.innerHeight);
    return visibleFraction(byteScreenBox(feet, unitPx), lastStageClip);
  }

  /** The chest light projected through the real camera (it sits in front of z=0, so perspective matters). */
  function chestScreen(): Point {
    const c = rig.chestWorld();
    tmpChest.set(c.x, c.y, c.z).project(scene.camera);
    return {
      x: ((tmpChest.x + 1) / 2) * window.innerWidth,
      y: ((1 - tmpChest.y) / 2) * window.innerHeight,
    };
  }

  /**
   * The flip beat: whoosh in the new direction (D11), lerp Byte's own look over
   * the reveal's length with no T8 stretch (D9), and hand the page its origin.
   * Resolves when the page's reveal has; never rejects.
   */
  function flipTheme(next: Theme, apply: ThemeApply, origin: Point | null): Promise<void> {
    sound.play(next === 'dark' ? 'themeWhooshDown' : 'themeWhoosh');
    applyTheme(next, { animate: true, stretch: false, durationS: THEME_SWITCH_LERP_S });
    return Promise.resolve()
      .then(() => apply(origin))
      .catch(() => undefined);
  }

  /**
   * Charge & release, at home or on a corner visit. The corner visit: Byte
   * stands on the viewport's bottom-right edge (`onTick` places it while
   * `cornerVisit.active`), rises on `pose.position.y`, gestures, sinks back,
   * and is re-pinned home — invisibly, since home was offscreen. `done` runs
   * once both the gesture and the page's reveal have finished.
   */
  function runGesture(next: Theme, apply: ThemeApply, corner: boolean, done: () => void): void {
    gestureTimeline = killTracked(gestureTimeline);
    resetGesture();
    let flipped: Promise<void> = Promise.resolve();
    const gestureTl = buildChargeRelease(gesture, next);
    const start = corner ? CORNER_RISE_S : 0;
    const master = gsap.timeline({ onUpdate: writeGesture });

    if (corner) {
      master.call(
        () => {
          cornerVisit.active = true;
          shadow.mesh.visible = false;
          rig.pose.position.y = CORNER_HIDDEN_Y;
        },
        undefined,
        0,
      );
      master.to(
        rig.pose.position,
        { y: CORNER_REST_Y, duration: CORNER_RISE_S, ease: 'power3.out' },
        0,
      );
    }
    master.add(gestureTl.paused(false), start);
    master.call(
      () => {
        flipped = flipTheme(next, apply, chestScreen());
      },
      undefined,
      start + FLIP_AT_S,
    );
    if (corner) {
      const sinkAt = start + gestureTl.duration() + CORNER_SINK_DELAY_S;
      master.to(
        rig.pose.position,
        { y: CORNER_HIDDEN_Y, duration: CORNER_SINK_S, ease: 'power2.in' },
        sinkAt,
      );
      master.call(
        () => {
          cornerVisit.active = false;
          shadow.mesh.visible = true;
          rig.pose.position.y = 0;
        },
        undefined,
        sinkAt + CORNER_SINK_S,
      );
    }
    master.eventCallback('onComplete', () => {
      gestureTimeline = null;
      resetGesture();
      void flipped.then(done);
    });
    gestureTimeline = track(master);
  }

  /** Reduced motion (D8): one glow pulse, and the flip (a crossfade, page-side) on its peak. No body motion. */
  function runPulse(next: Theme, apply: ThemeApply, done: () => void): void {
    gestureTimeline = killTracked(gestureTimeline);
    resetGesture();
    let flipped: Promise<void> = Promise.resolve();
    const tl = buildPulse(gesture);
    tl.eventCallback('onUpdate', writeGlow);
    tl.call(
      () => {
        flipped = flipTheme(next, apply, null);
      },
      undefined,
      PULSE_S,
    );
    tl.eventCallback('onComplete', () => {
      gestureTimeline = null;
      void flipped.then(done);
    });
    gestureTimeline = track(tl.paused(false));
  }

  function runSwitchPlan(plan: SwitchPlan, next: Theme, apply: ThemeApply, resolve: () => void): void {
    switch (plan) {
      case 'home':
      case 'corner':
        // Through the FSM: THEME enters `switching` (dispatch starts the
        // gesture), or `waking` first for a sleeping Byte (spec D6).
        pendingSwitch = { next, apply, corner: plan === 'corner', resolve };
        fsm.send('THEME');
        return;
      case 'layer':
        // Over a running feed/retype: no FSM change, the driver keeps going.
        runGesture(next, apply, false, resolve);
        return;
      case 'pulse':
        runPulse(next, apply, resolve);
        return;
      case 'button':
      case 'instant':
        void flipTheme(next, apply, null).then(resolve);
        return;
    }
  }

  function performThemeSwitch(next: Theme, apply: ThemeApply): Promise<void> {
    if (switchInFlight) {
      return switchInFlight;
    }
    const plan = chooseSwitchPlan(fsm.state(), byteVisibleFraction(), reducedActive);
    const run = new Promise<void>((resolve) => runSwitchPlan(plan, next, apply, resolve));
    switchInFlight = run.then(() => {
      switchInFlight = null;
    });
    return switchInFlight;
  }
```

`Point` and `StageRect` are already imported from `./stage`. `shadow` and `unitPx` are declared earlier in the closure. Confirm with `grep -n "const shadow\|let unitPx" src/pet/createBytePet.ts`. If `unitPx` is declared *after* this block's position, that's fine: these are functions and only read it when called.

- [ ] **Step 8: Dispatch `switching`.** In `dispatch`'s `switch (state)`, add this after the `waking` case:

```ts
      case 'switching': {
        // Theme gesture (spec D6): run the charge & release queued by
        // `performThemeSwitch`, then hand back to idle. Beyond the shared
        // per-state resets above (no idle brain, no hint, no lean), this is
        // the whole choreography — the gesture layer never touches clips or
        // the root position, so whatever clip was playing (Idle, or the Wake
        // handing back to Idle) keeps running underneath.
        const queued = pendingSwitch;
        pendingSwitch = null;
        if (!queued) {
          // Defensive: nothing queued (should be unreachable) — don't strand the state.
          fireOnNextTick(() => fsm.send('SWITCHED'));
          break;
        }
        runGesture(queued.next, queued.apply, queued.corner, () => {
          queued.resolve();
          fireOnNextTick(() => fsm.send('SWITCHED'));
        });
        break;
      }
```

If the FSM's `switchMs` cap fires first, the state is already `idle` when `SWITCHED` arrives, so the event is ignored. That's harmless.

- [ ] **Step 9: `onTick`: the stage clip and the corner placement.** Replace the `scene.setStage(intersectViewport(activeStage, …));` call with:

```ts
    // Theme gesture corner visit (spec D5): Byte stands on the viewport's
    // bottom-right edge, outside both sections' stages, so the clip opens to
    // the whole viewport for the visit's ~2.6s — the one sanctioned exception
    // to the T12 containment guarantee, and only while `cornerVisit.active`.
    const stageClip: StageRect | null = cornerVisit.active
      ? { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }
      : intersectViewport(activeStage, { width: window.innerWidth, height: window.innerHeight });
    lastStageClip = stageClip;
    scene.setStage(stageClip);
```

Then change the root-placement chain. It starts with `if (home && !wasHome) {`; put a corner branch in front of it:

```ts
    if (cornerVisit.active) {
      // Corner visit: this is the root's sole writer for the visit (the gesture
      // moves only `pose`). `switching` is a HOME_STATE, so `wasHome` stays
      // true and the visit's end re-pins home on the next tick with a hard pin,
      // not a reacquire glide across the screen — invisible, as home is offscreen.
      const feet = cornerFeetScreen({ width: window.innerWidth, height: window.innerHeight }, unitPx);
      const w = scene.worldFromScreen(feet.x, feet.y);
      rig.object3d.position.set(w.x, w.y, 0);
    } else if (home && !wasHome) {
```
Leave the rest of the chain (`} else if (home && !reacquireTween) {` … `wasHome = home;`) as it is.

- [ ] **Step 10: Return the method.** Add `performThemeSwitch,` to the object returned at the end of `createBytePet`, after `setTheme,`.

- [ ] **Step 11: Verify.**

Run: `mise exec node@22 -- npx tsc --noEmit && mise exec node@22 -- npx vitest run && mise exec node@22 -- npm run lint && mise exec node@22 -- npm run format:check && mise exec node@22 -- npm run build`
Expected: everything passes, and the test count is unchanged from Task 6. `noUnusedLocals` catches anything imported and not wired up. Every Task 5 export is listed as consumed above, so there should be no leftovers.

- [ ] **Step 12: Commit.**

```bash
git add src/pet/types.ts src/pet/createBytePet.ts
git commit -m "feat(pet): performThemeSwitch — Byte charges and releases the theme flip"
```

---

### Task 8: Wire the toggle, browser QA, docs

**Files:**
- Modify: `src/main.ts` (`bindThemeToggle` and its call in `bootstrap`)
- Docs: `docs/SPEC.md` §6 "theme reaction", `docs/DECISIONS.md` (new D-25 at the top), `docs/TICKETS.md` (new ticket entry)
- Local only (gitignored): `.claude/launch.json`

**Interfaces:**
- Consumes: `bytePet.performThemeSwitch` (Task 7), `revealTheme` (Task 6), and `Theme` from `./lib/theme`.

- [ ] **Step 1: Rewrite `bindThemeToggle`** in `src/main.ts`.
  - Change the imports to `import { initTheme, type Theme, type ThemeController } from './lib/theme';` and add `import { revealTheme } from './lib/themeReveal';`.
  - Replace the function and its doc comment:

```ts
/**
 * Wires the nav theme-toggle button: keeps its `aria-pressed` state + icon in
 * sync with the active theme, and routes each click through `switchTheme` —
 * Byte's `performThemeSwitch` when the pet exists (it gestures and calls
 * back on the flip beat), else a plain reveal from the button. The page owns
 * the reveal and the theme write (`apply`), so the pet never touches
 * storage or `data-theme`. Clicks while a switch is running are ignored
 * (`aria-busy`) until the gesture and the reveal have both finished (spec
 * D7). `switchTheme` resolves late-bound: `bytePet` is created after this
 * binding, hence the closure over it in `bootstrap()`.
 */
function bindThemeToggle(
  root: HTMLElement,
  theme: ThemeController,
  switchTheme: (
    next: Theme,
    apply: (origin: { x: number; y: number } | null) => Promise<void>,
  ) => Promise<void>,
): void {
  const button = root.querySelector<HTMLButtonElement>('#theme-toggle');
  if (!button) {
    return;
  }
  const icon = button.querySelector<HTMLElement>('[data-theme-toggle-icon]');

  const sync = (): void => {
    const isDark = theme.current() === 'dark';
    button.setAttribute('aria-pressed', String(isDark));
    if (icon) {
      icon.textContent = isDark ? '☾' : '☀';
    }
  };

  let busy = false;
  const release = (): void => {
    busy = false;
    button.removeAttribute('aria-busy');
  };

  sync();
  button.addEventListener('click', () => {
    if (busy) {
      return;
    }
    busy = true;
    button.setAttribute('aria-busy', 'true');
    const next: Theme = theme.current() === 'dark' ? 'light' : 'dark';
    const apply = (origin: { x: number; y: number } | null): Promise<void> => {
      const r = button.getBoundingClientRect();
      return revealTheme(
        () => {
          theme.set(next);
          sync();
        },
        origin ?? { x: r.left + r.width / 2, y: r.top + r.height / 2 },
        { reduced: prefersReducedMotion() },
      );
    };
    void switchTheme(next, apply).then(release, release);
  });
}
```
  - In `bootstrap()`, replace `bindThemeToggle(root, theme, () => bytePet?.setTheme(theme.current()));` with:

```ts
  bindThemeToggle(root, theme, (next, apply) =>
    bytePet ? bytePet.performThemeSwitch(next, apply) : apply(null),
  );
```
  - Update the file header's mention of "the theme-toggle callback" (around lines 26–36 and 258) so it describes `performThemeSwitch`. `setTheme` stays on the handle for non-toggle theme changes. It just has no caller in `main.ts` now.

- [ ] **Step 2: Verify statically.**

Run: `mise exec node@22 -- npx tsc --noEmit && mise exec node@22 -- npx vitest run && mise exec node@22 -- npm run lint && mise exec node@22 -- npm run format:check && mise exec node@22 -- npm run build`
Expected: everything passes.

- [ ] **Step 3: Start the dev server.** Create `.claude/launch.json`. It's gitignored, so never commit it.

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "byte-vite",
      "runtimeExecutable": "mise",
      "runtimeArgs": ["exec", "node@22", "--", "npm", "run", "dev"],
      "port": 5180
    }
  ]
}
```
Start it with `preview_start` (name `byte-vite`) and open `http://localhost:5180/`. The Browser pane runs rAF at 60 fps. It can't zoom WebGL, so to inspect Byte up close, crop the canvas from JS.

- [ ] **Step 4: Browser QA.** Check each row in both directions (light → dark and dark → light) and look at the console after each one. Record pass/fail for every row in the commit body.

| # | Setup | Expected |
|---|---|---|
| 1 | At the top of the page, Byte idle at the hero caret. Click the toggle. | Byte crouches, its glow dims (going light) or ignites (going dark), then it stretches and flares. At about 0.63s a circle opens from its **chest**. Byte's body and lights lerp over the reveal. There's no T8 stretch afterwards. |
| 2 | Same as row 1, with sound on (the EQ button). | Going to light plays an upward whoosh, going to dark a downward one, both **on the flare**, not on the click. |
| 3 | Scroll to `#manifesto`, so Byte is offscreen. Click. | Byte rises from the **bottom-right edge**, gestures, the circle opens from its chest there, then Byte sinks back out. No shadow smear. Scroll back up: Byte is at home, with no glide across the screen. |
| 4 | Scroll so about 60%, then about 30%, of Byte shows at the hero's bottom edge. | 60%: it gestures at home. 30%: it makes a corner visit. |
| 5 | Leave Byte alone for 30s until it sleeps (z's). Click. | Byte wakes (Wake clip plus wakeBoing), then gestures, then goes to idle. |
| 6 | Click in the hero to feed Byte, then click the toggle mid-eat. | The eat keeps going (the glyph is eaten and the headline retypes), with the squash and flare layered on top. The circle comes from the chest. |
| 7 | Scroll fast from the hero to the footer and click during the hand-off fade. | No gesture. The circle opens from the **toggle button**. |
| 8 | Click the toggle 5 times quickly. | Exactly one switch. The button shows `aria-busy="true"` until it finishes, and the next click after that works. |
| 9 | Keyboard: Tab to the toggle and press Enter or Space. | Same as a click. |
| 10 | Reload the page right after a switch. | The new theme persists (`localStorage['byte-theme']`), with no flash. |
| 11 | **Reduced motion.** Start headless Chrome with `--force-prefers-reduced-motion` over CDP (the pane can't emulate it; see DECISIONS R-GLB-20 for the headless setup) and repeat rows 1, 3 and 6. | No body motion, no corner visit and no circle. Byte's glow pulses once when visible, and the theme crossfades over about 0.4s. |
| 12 | In the Style Lab (`?lab`), change the glow accent, then switch the theme. | The flare uses the new accent, and the glow settles correctly for the theme. |

If a row fails, go back to the task that owns the behaviour. Diagnose it with superpowers:systematic-debugging, fix it with a test where the logic is pure, re-run the static checks, then re-run the QA rows that could be affected.

- [ ] **Step 5: Update the docs.**
  - `docs/SPEC.md` §6: replace the `theme reaction` bullet with:
    - ``- **theme reaction** — toggle: **Byte causes the flip** — charge & release (crouch + glow dims/ignites → stretch + chest flare); the new theme expands as a circle from its chest light on the flare (~0.63s), with materials/lights lerping over the 0.62s reveal. Offscreen Byte rises from the bottom-right edge to do it; busy Byte (feeding/retyping) layers the gesture over what it's doing; during the entrance or a hand-off the circle opens from the toggle. Reduced motion: one glow pulse + a crossfade. Clicks are ignored mid-switch. _(**Supersedes** the original "~400ms token crossfade; Byte does a full-height stretch … Stretch goal: headbutts the toggle" — see `DECISIONS.md` **D-25** and `docs/superpowers/specs/2026-09-28-byte-theme-gesture-design.md`. `setTheme()` still does the stretch for non-toggle changes.)_``
  - `docs/DECISIONS.md`: add a new entry, `## D-25 · Byte causes the theme switch (charge & release + chest-light circle reveal) — 2026-09-28`, at the top. Put it above D-24, following D-24's **Choice:** / **Why:** format. Summarise the spec decisions D1–D12. Include the re-decision on busy states (layer, not interrupt, and why), the `ChestLight` re-export (729,036 B), the QA results table, and the test count delta.
  - `docs/TICKETS.md`: add a short `T13 — Byte flips the theme` entry in the file's existing ticket format, pointing to the spec and this plan and marked done.

- [ ] **Step 6: Commit.**

```bash
git add src/main.ts docs/SPEC.md docs/DECISIONS.md docs/TICKETS.md
git commit -m "feat(page): route the theme toggle through Byte's performThemeSwitch" -m "Browser QA: <paste the row-by-row pass/fail from Step 4>"
```

- [ ] **Step 7: Finish.** Use superpowers:finishing-a-development-branch. The branch has no upstream on purpose, because it was cut from `feat/byte-caret-lean` with the upstream unset. Ask the owner before pushing or opening a PR, and ask which base to target (`feat/byte-caret-lean` is the natural one).
