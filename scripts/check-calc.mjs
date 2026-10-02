// Checks calc.ts against docs/CALCULATIONS.md: `npm run check:calc`.
// Needs a Node that runs TypeScript files directly (22.18 or later).
import assert from 'node:assert/strict';
import { CHAMBERS, chamberGeometry, computeStats, formatFixed, formatSci, parseDilution, stepDilution } from '../calc.ts';

const chamber = (key) => CHAMBERS.find((c) => c.key === key);
const sq = (live, dead, touched = true) => ({ live, dead, touched });
const frac = (num, den = 1) => ({ num: BigInt(num), den: BigInt(den) });

// What the app shows for a set of squares.
const shown = (squares, dilution, key) => {
  const s = computeStats(squares, dilution, chamber(key));
  return {
    n: s.n,
    meanLive: formatFixed(s.meanLive, 2),
    meanDead: formatFixed(s.meanDead, 2),
    live: formatSci(s.concLive),
    dead: formatSci(s.concDead),
    total: formatSci(s.concTotal),
    viability: s.viability ? `${formatFixed(s.viability, 1)} %` : '–',
  };
};

// Chamber geometry: the counted unit, its volume and the factor ("The chambers").
const geometry = (key) => {
  const g = chamberGeometry(chamber(key));
  return [g.width, g.height, g.depth, g.microlitres, formatSci(g.millilitres), formatSci(g.factor)];
};
assert.deepEqual(geometry('neubauer'), ['1', '1', '0.1', '0.1', '1.00 × 10⁻⁴', '1.00 × 10⁴']);
assert.deepEqual(geometry('fuchsRosenthal'), ['1', '1', '0.2', '0.2', '2.00 × 10⁻⁴', '5.00 × 10³']);
assert.deepEqual(geometry('malassez'), ['0.25', '0.2', '0.2', '0.01', '1.00 × 10⁻⁵', '1.00 × 10⁵']);
// The factors are whole numbers, exactly.
for (const [key, factor] of [['neubauer', 10000n], ['fuchsRosenthal', 5000n], ['malassez', 100000n]]) {
  const f = chamberGeometry(chamber(key)).factor;
  assert.equal(f.num, factor * f.den, key);
}

// The worked example ("Worked example", and "Checking a change" in ARCHITECTURE.md).
const two = [sq(3, 1), sq(5, 1)];
const base = { n: 2, meanLive: '4.00', meanDead: '1.00', live: '8.00 × 10⁴', dead: '2.00 × 10⁴', total: '1.00 × 10⁵', viability: '80.0 %' };
assert.deepEqual(shown(two, '2', 'neubauer'), base);
// An untouched square is not counted.
assert.deepEqual(shown([...two, sq(0, 0, false)], '2', 'neubauer'), base);
// A touched square with no cells is a counted zero.
assert.deepEqual(shown([...two, sq(0, 0)], '2', 'neubauer'), {
  n: 3, meanLive: '2.67', meanDead: '0.67', live: '5.33 × 10⁴', dead: '1.33 × 10⁴', total: '6.67 × 10⁴', viability: '80.0 %',
});
// The same counts in the other chambers.
assert.deepEqual(shown(two, '2', 'fuchsRosenthal'), { ...base, live: '4.00 × 10⁴', dead: '1.00 × 10⁴', total: '5.00 × 10⁴' });
assert.deepEqual(shown(two, '2', 'malassez'), { ...base, live: '8.00 × 10⁵', dead: '2.00 × 10⁵', total: '1.00 × 10⁶' });

// No result.
const none = { n: 0, meanLive: '–', meanDead: '–', live: '–', dead: '–', total: '–', viability: '–' };
assert.deepEqual(shown([sq(0, 0, false)], '2', 'neubauer'), none);
assert.deepEqual(shown([sq(0, 0)], '2', 'neubauer'), { ...none, n: 1, meanLive: '0.00', meanDead: '0.00', live: '0', dead: '0', total: '0' });
for (const bad of ['', '0', '0,0', '.', 'abc', '1 000', '1:10', '1e3', '1.2.3', '2,5,3', '-2', '+2', '٢']) {
  assert.equal(parseDilution(bad), null, `dilution "${bad}"`);
  assert.deepEqual(shown(two, bad, 'neubauer'), { ...base, live: '–', dead: '–', total: '–' }, `dilution "${bad}"`);
}

// The dilution as typed.
assert.deepEqual(parseDilution('2'), frac(2));
assert.deepEqual(parseDilution(' 2,5 '), frac(25, 10));
assert.deepEqual(parseDilution('2.5'), frac(25, 10));
assert.deepEqual(parseDilution('2.'), frac(2));
assert.deepEqual(parseDilution('.5'), frac(5, 10));
assert.deepEqual(parseDilution('1,000'), frac(1000, 1000)); // a decimal comma: this is 1, not 1000
assert.equal(shown(two, '2,5', 'neubauer').live, '1.00 × 10⁵');
assert.equal(shown(two, '0.1', 'neubauer').live, '4.00 × 10³');
// 1.1 has no exact binary form: 3 × 1.1 × 10⁴ is 33 000 exactly here (3 × 11 × 10¹² over 10 × 10⁸).
assert.deepEqual(computeStats([sq(3, 0)], '1.1', chamber('neubauer')).concLive, frac('33' + '0'.repeat(12), '1' + '0'.repeat(9)));
assert.equal(shown([sq(3, 0)], '1.1', 'neubauer').live, '3.30 × 10⁴');

// The steppers.
assert.equal(stepDilution('2', 1), '3');
assert.equal(stepDilution('2', -1), '1');
assert.equal(stepDilution('1', -1), '1');
assert.equal(stepDilution('2,5', 1), '3');
assert.equal(stepDilution('2.5', -1), '2');
assert.equal(stepDilution('0.5', -1), '1');
assert.equal(stepDilution('abc', 1), '2');
assert.equal(stepDilution('', -1), '1');

// Halves round up, from the exact value. Each of these goes the other way in binary floating point
// or with the round-half-to-even rule.
assert.equal(formatFixed(frac(201, 200), 2), '1.01'); // 1.005
assert.equal(formatFixed(frac(1, 8), 2), '0.13'); // 0.125
assert.equal(formatFixed(frac(29 * 100, 200), 1), '14.5');
assert.equal(formatFixed(frac(2029, 2000), 2), '1.01'); // 1.0145
assert.equal(shown([sq(2001, 1999)], '1', 'neubauer').viability, '50.0 %'); // 50.025
assert.equal(shown([sq(1001, 999)], '1', 'neubauer').viability, '50.1 %'); // 50.05
assert.equal(shown([sq(999, 1)], '1', 'neubauer').viability, '99.9 %');
assert.equal(shown([sq(1999, 1)], '1', 'neubauer').viability, '100.0 %'); // 99.95
assert.equal(formatSci(frac(10050)), '1.01 × 10⁴');
assert.equal(formatSci(frac(10049)), '1.00 × 10⁴');
assert.equal(formatSci(frac(9995)), '1.00 × 10⁴');
assert.equal(formatSci(frac(9994)), '9.99 × 10³');
assert.equal(formatSci(frac(1005, 1000)), '1.01 × 10⁰');
assert.equal(formatSci(frac(1000)), '1.00 × 10³');
assert.equal(formatSci(frac(999)), '9.99 × 10²');
assert.equal(formatSci(frac(123, 1000000)), '1.23 × 10⁻⁴');
assert.equal(formatSci(frac(0, 7)), '0');
assert.equal(formatSci(null), '–');
assert.equal(formatFixed(null, 2), '–');
assert.equal(formatFixed(frac(5, 2), 0), '3');

// Every result is within half a unit of its last shown digit, for fractions of every size. The
// text is read back and compared with the exact fraction, in whole-number arithmetic only.
const SUPER = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const pow10 = (n) => BigInt('1' + '0'.repeat(n));
let seed = 12345;
const random = (max) => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return (seed % max) + 1;
};
for (let i = 0; i < 20000; i++) {
  const f = frac(BigInt(random(100000)) * pow10(random(12) - 1), BigInt(random(100000)) * pow10(random(12) - 1));

  const [, mantissa, sign, digits] = /^(\d\.\d\d) × 10(⁻?)(.+)$/.exec(formatSci(f));
  const exp = Number([...digits].map((d) => SUPER.indexOf(d)).join('')) * (sign ? -1 : 1);
  const m = BigInt(mantissa.replace('.', ''));
  assert.ok(m >= 100n && m <= 999n, `mantissa of ${f.num}/${f.den}`);
  // |f − m × 10^(exp − 2)| <= half a unit of the last digit, and exactly half only when rounded up.
  const e = exp - 2;
  const [up, down] = e >= 0 ? [pow10(e), 1n] : [1n, pow10(-e)];
  const twiceError = 2n * (f.num * down - m * up * f.den);
  const unit = up * f.den;
  assert.ok(twiceError >= -unit && twiceError < unit, `formatSci of ${f.num}/${f.den}`);

  const fixed = BigInt(formatFixed(f, 2).replace('.', ''));
  const twiceFixedError = 2n * (f.num * 100n - fixed * f.den);
  assert.ok(twiceFixedError >= -f.den && twiceFixedError < f.den, `formatFixed of ${f.num}/${f.den}`);
}

console.log('calc.ts: all checks passed');
