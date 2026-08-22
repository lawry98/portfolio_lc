/**
 * Copy foundation for the hero, footer, and style-lab: the hero/footer phrase
 * sets and the shared line-budget guard (SPEC §10, Global Constraints).
 *
 * Pure module — no gsap/three/DOM imports. Consumed by the hero (Task 2/4),
 * footer (Task 2/5), lab (Task 6), and later the retype engine (T6).
 */

export type Phrase = readonly [string, string]; // [line1, line2]

export interface PhraseSet {
  readonly identity: readonly Phrase[];
  readonly punchy: readonly Phrase[];
  readonly footer: readonly Phrase[];
}

export const phrases: PhraseSet = {
  identity: [
    ['FULL-STACK', '+AI'],
    ['I SHIP', 'PRODUCTS'],
    ['IDEAS →', 'SHIPPED'],
    ['FEED', 'BYTE'],
    ['LAWRENCE', 'CRASTO'],
  ],
  punchy: [
    ['MAKE IT', 'MOVE'],
    ['MAKE IT', 'REAL'],
    ['MAKE IT', 'SHIP'],
    ['BUILT BY', 'LAWRENCE'],
  ],
  footer: [
    ["LET'S", 'BUILD'],
    ['SAY', 'HELLO'],
    ['WORK', 'TOGETHER'],
  ],
};

/** Hero-line character budget (Global Constraints: hero lines ≤ 14 chars/line). */
export const LINE_BUDGET = 14;

/** Whether `line` fits within `max` characters (defaults to `LINE_BUDGET`). */
export function fitsLineBudget(line: string, max: number = LINE_BUDGET): boolean {
  return line.length <= max;
}
