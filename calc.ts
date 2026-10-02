// The calculation: chamber geometry, the dilution as typed, the results and how they are rounded.
// docs/CALCULATIONS.md is the reference for every number and rule here. No React or React Native
// imports, so `npm run check:calc` can run this file under Node.

// One entry per chamber: the unit of the ruling that the app calls a "square" (its width and
// height on the grid) and the depth of liquid under the cover slip, in µm. Whole numbers, so the
// volume and everything derived from it are exact.
export const CHAMBERS = [
  { key: 'neubauer', label: 'Neubauer Improved', unit: 'large square', width: 1000, height: 1000, depth: 100 },
  { key: 'fuchsRosenthal', label: 'Fuchs-Rosenthal', unit: 'large square', width: 1000, height: 1000, depth: 200 },
  { key: 'malassez', label: 'Malassez', unit: 'rectangle', width: 250, height: 200, depth: 200 },
] as const;
export type Chamber = (typeof CHAMBERS)[number];
export type ChamberKey = Chamber['key'];

// An exact fraction of whole numbers, num >= 0 and den > 0. Results stay fractions until they are
// shown, so each is rounded once, from its exact value, never from a rounded intermediate.
export type Frac = { num: bigint; den: bigint };

// Not `10n ** n`: Babel's exponentiation transform turns `**` into Math.pow, which rejects BigInt.
const pow10 = (n: number) => BigInt('1' + '0'.repeat(n));
const UM3_PER_UL = pow10(9); // 1 µL = 1 mm³ = (10³ µm)³
const UM3_PER_ML = pow10(12); // 1 mL = 1 cm³ = (10⁴ µm)³

// The counted unit of a chamber: sides and depth in mm and volume in µL as exact decimal text,
// the volume in mL, and the chamber factor = 1 / volume in mL (counted units per mL).
export function chamberGeometry(c: Chamber) {
  const um3 = BigInt(c.width * c.height * c.depth);
  const mm = (um: number) => trimZeros(formatFixed({ num: BigInt(um), den: 1000n }, 3));
  return {
    width: mm(c.width),
    height: mm(c.height),
    depth: mm(c.depth),
    microlitres: trimZeros(formatFixed({ num: um3, den: UM3_PER_UL }, 9)),
    millilitres: { num: um3, den: UM3_PER_ML },
    factor: { num: UM3_PER_ML, den: um3 },
  };
}

// The dilution factor as typed, as an exact fraction: "2,5" is 25 / 10. Only digits with at most
// one `.` or `,` (the decimal separator) are a number. Anything else ("1 000", "1:10", "1e3") is
// rejected rather than half-read, and so is zero.
export function parseDilution(text: string): Frac | null {
  const m = /^(\d*)[.,]?(\d*)$/.exec(text.trim());
  if (!m || !(m[1] + m[2])) return null;
  const num = BigInt(m[1] + m[2]);
  return num > 0n ? { num, den: pow10(m[2].length) } : null;
}

// The −/+ steppers: the next whole number in that direction (2.5 goes to 3 or 2, not 4 or 1),
// never below 1. Text that isn't a dilution steps from 1.
export function stepDilution(text: string, delta: 1 | -1) {
  const d = parseDilution(text) ?? { num: 1n, den: 1n };
  const next = delta > 0 ? d.num / d.den + 1n : (d.num + d.den - 1n) / d.den - 1n;
  return String(next < 1n ? 1n : next);
}

type Counts = { touched: boolean; live: number; dead: number };

// Everything the app shows, from the counted squares. "Counted" means touched, not nonzero: a
// square genuinely counted as zero belongs in the mean, a square the user never visited doesn't.
// null is "no result": no counted square, no cell (viability) or no valid dilution (concentrations).
export function computeStats(squares: readonly Counts[], dilutionText: string, chamber: Chamber) {
  const counted = squares.filter((s) => s.touched);
  const n = counted.length;
  const live = counted.reduce((sum, s) => sum + s.live, 0);
  const dead = counted.reduce((sum, s) => sum + s.dead, 0);
  const dilution = parseDilution(dilutionText);
  const { factor } = chamberGeometry(chamber);
  const mean = (cells: number): Frac | null => (n ? { num: BigInt(cells), den: BigInt(n) } : null);
  // cells/mL = cells / n × dilution × factor, as one fraction.
  const conc = (cells: number): Frac | null =>
    n && dilution
      ? { num: BigInt(cells) * dilution.num * factor.num, den: BigInt(n) * dilution.den * factor.den }
      : null;
  const viability: Frac | null = live + dead > 0 ? { num: BigInt(live * 100), den: BigInt(live + dead) } : null;
  return {
    n,
    live,
    dead,
    dilutionValid: dilution !== null,
    meanLive: mean(live),
    meanDead: mean(dead),
    concLive: conc(live),
    concDead: conc(dead),
    concTotal: conc(live + dead),
    viability,
  };
}

// num / den to the nearest whole number, halves up.
const roundDiv = (num: bigint, den: bigint) => (num * 2n + den) / (den * 2n);

// f × 10^n
const shift = (f: Frac, n: number): Frac =>
  n >= 0 ? { num: f.num * pow10(n), den: f.den } : { num: f.num, den: f.den * pow10(-n) };

// f with `digits` decimals, halves rounded up: "2.67". `–` for no result.
export function formatFixed(f: Frac | null, digits: number) {
  if (!f) return '–';
  const s = String(roundDiv(f.num * pow10(digits), f.den)).padStart(digits + 1, '0');
  return digits ? `${s.slice(0, -digits)}.${s.slice(-digits)}` : s;
}

// Drops the zeros a fixed-point text ends with: "0.250" is "0.25", "1.000" is "1".
const trimZeros = (fixed: string) => fixed.replace(/\.?0+$/, '');

// f to 3 significant figures in scientific notation, halves rounded up: "5.33 × 10⁴".
// `–` for no result, and a plain "0" for zero.
export function formatSci(f: Frac | null) {
  if (!f) return '–';
  if (f.num === 0n) return '0';
  // The exponent is the one with 10^exp <= f < 10^(exp + 1); the digit counts give it or one more.
  let exp = String(f.num).length - String(f.den).length;
  const scaled = shift(f, -exp);
  if (scaled.num < scaled.den) exp -= 1;
  const m = shift(f, 2 - exp);
  let mantissa = roundDiv(m.num, m.den);
  // 9.995 and above rounds to "10.00": that is 1.00 at the next exponent.
  if (mantissa === 1000n) {
    mantissa = 100n;
    exp += 1;
  }
  const digits = String(mantissa);
  return `${digits[0]}.${digits.slice(1)} × 10${toSuperscript(exp)}`;
}

const SUPERSCRIPT: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

function toSuperscript(n: number) {
  return String(n).split('').map((c) => SUPERSCRIPT[c] ?? c).join('');
}
