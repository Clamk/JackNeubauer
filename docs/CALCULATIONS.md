# Hemocytometers and calculations

The reference for every number CellCounter shows: the chambers and their dimensions, what the app counts, the formulas, how results are rounded, and what the result does and does not tell you. The code is [calc.ts](../calc.ts), and `npm run check:calc` checks it against this document.

## What a hemocytometer measures

A hemocytometer (counting chamber) is a glass slide with a grid engraved on its floor and a cover slip held at a fixed height above it. The liquid over a ruled area therefore has a known volume:

```
volume = width × height of the ruled area × chamber depth
```

Counting the cells over that area gives a number of cells per volume, which is a concentration. The units used here:

| Unit | Equals |
| ---- | ------ |
| 1 mm³ | 1 µL |
| 1 mL | 1000 µL = 1 cm³ |
| 1 µL | 10⁻³ mL |

## The chambers

Each chamber has one unit of its ruling that the app calls a **square**: you count the cells of one such unit per square in the app (SQ 1, SQ 2…). The chamber factor is the number of those units in 1 mL, which is 1 / (unit volume in mL).

| Chamber | Depth | Counted unit ("square") | Unit volume | Factor |
| ------- | ----- | ----------------------- | ----------- | ------ |
| Neubauer Improved | 0.1 mm | One large square, 1 mm × 1 mm | 0.1 µL = 1 × 10⁻⁴ mL | 1 × 10⁴ |
| Fuchs-Rosenthal | 0.2 mm | One large square, 1 mm × 1 mm | 0.2 µL = 2 × 10⁻⁴ mL | 5 × 10³ |
| Malassez | 0.2 mm | One rectangle, 0.25 mm × 0.20 mm | 0.01 µL = 1 × 10⁻⁵ mL | 1 × 10⁵ |

The factor is derived, not stored: `CHAMBERS` holds the width, height and depth in whole µm and `chamberGeometry` computes the volume and the factor from them.

### Neubauer Improved

- Depth 0.1 mm.
- The grid is 3 mm × 3 mm: nine large squares of 1 mm × 1 mm, each 0.1 µL. Any of the nine is a counted unit; the four corner squares are the usual choice for cultured cells.
- The four corner squares are each divided into 16 squares of 0.25 mm × 0.25 mm.
- The centre square is divided into 25 group squares of 0.2 mm × 0.2 mm (0.004 µL each), separated by triple lines. Each group square is divided into 16 small squares of 0.05 mm × 0.05 mm (0.0025 mm², 0.00025 µL).

### Fuchs-Rosenthal

- Depth 0.2 mm.
- The grid is 4 mm × 4 mm (16 mm², 3.2 µL): 16 large squares of 1 mm × 1 mm, each 0.2 µL.
- Each large square is divided into 16 small squares of 0.25 mm × 0.25 mm (0.0125 µL each).

### Malassez

- Depth 0.2 mm.
- The grid is 2.5 mm × 2 mm (5 mm², 1 µL): 100 rectangles of 0.25 mm × 0.20 mm (0.05 mm²), each 0.01 µL.
- Rectangles are divided into 20 small squares of 0.05 mm × 0.05 mm (0.0005 µL each). How many of the 100 rectangles are fully divided depends on the maker.

### Counting a different unit

The factors assume the unit in the table. To count another area as one square in the app, multiply the dilution factor you enter by

```
unit volume in the table / volume you count per square
```

| You count, as one square in the app | Multiply the dilution by |
| ----------------------------------- | ------------------------ |
| Neubauer Improved: one group square of the centre (0.004 µL) | 25 |
| Neubauer Improved: five group squares together (0.02 µL) | 5 |
| Fuchs-Rosenthal: one small square (0.0125 µL) | 16 |
| Fuchs-Rosenthal: the whole grid (3.2 µL) | 0.0625 |
| Malassez: ten rectangles together (0.1 µL) | 0.1 |
| Malassez: the whole grid (1 µL) | 0.01 |

A chamber with another depth or ruling is not one of these three, even under the same name: check the depth engraved on the slide.

## Counting

- **One square in the app is one counted unit.** Count every cell of it, live in one zone and dead in the other.
- **Cells on the lines.** A cell touching a boundary line belongs to one unit only. The usual rule: count the cells touching the top and left lines, not those touching the bottom and right lines. Where the boundary is a triple line (Neubauer Improved), the middle line is the boundary.
- **Which squares enter the mean.** Only squares you have started counting. A square that really holds no cell must still be counted: tap once and press Undo, and it stays in the mean as a zero. A square you added and never touched is left out.
- **Live and dead.** The app counts what you tap. With a dye-exclusion stain such as trypan blue, the stained cells are the dead ones.
- **Dilution factor.** The final volume divided by the volume of sample in it: 1 volume of suspension plus 1 volume of stain is 2; 10 µL of suspension in 100 µL total is 10. Successive dilutions multiply. An undiluted sample is 1.

## Formulas

For the squares that are counted:

| Symbol | Meaning |
| ------ | ------- |
| ΣL, ΣD | Live and dead cells, summed over the counted squares |
| N | Number of counted squares |
| d | Dilution factor |
| F | Chamber factor = 1 / (unit volume in mL) |

```
mean live       = ΣL / N
mean dead       = ΣD / N
live cells/mL   = ΣL / N × d × F
dead cells/mL   = ΣD / N × d × F
total cells/mL  = (ΣL + ΣD) / N × d × F
viability (%)   = ΣL / (ΣL + ΣD) × 100
```

- The mean count per unit, divided by the unit volume, is the concentration in the liquid loaded on the slide. Multiplying by the dilution gives the concentration in the sample before it was diluted, which is what the app reports.
- Total is live plus dead, exactly.
- Viability is the ratio of the summed counts, not the mean of each square's ratio. It does not depend on the chamber or the dilution.

A result that cannot be computed shows `–`:

| Result | Shows `–` when |
| ------ | -------------- |
| Means | No square is counted |
| Concentrations | No square is counted, or the dilution is not a positive number |
| Viability | No cell is counted |

A concentration of exactly zero shows `0`.

## The dilution as typed

`parseDilution` reads the field as an exact decimal: `2,5` is 25 / 10, never a binary approximation.

- A number is digits with at most one `.` or `,`, which is the decimal separator: `2`, `2.5`, `2,5`, `.5`, `2.`. Spaces around it are ignored.
- There is no thousands separator: `1,000` is 1, not one thousand. Type `1000`.
- Anything else is not a number and gives no concentration: empty, `0`, `1 000`, `1:10`, `1e3`, a sign, a second separator.
- A value below 1 is accepted when typed. The − / + buttons move to the next whole number and stop at 1.

## Exact arithmetic and rounding

Every input is exact: the counts are whole numbers, the chamber dimensions are whole micrometres, and the dilution is a decimal. `computeStats` keeps each result as one exact fraction (`Frac`, whole-number numerator and denominator, as `BigInt`), so nothing is lost to floating point and no result is computed from a rounded one.

A result is rounded once, when it is shown, from its exact value, with halves rounded up:

| Result | Shown as | Function |
| ------ | -------- | -------- |
| Concentrations, chamber volume and factor | 3 significant figures, scientific notation: `5.33 × 10⁴` | `formatSci` |
| Means | 2 decimals: `2.67` | `formatFixed` |
| Viability | 1 decimal: `80.0 %` | `formatFixed` |

Two consequences:

- The shown live and dead concentrations can add up to one unit of the last digit more or less than the shown total (5.33 + 1.33 against 6.67 in the example below). The total is the exact sum, rounded; it is not the sum of the rounded parts.
- Recomputing a concentration from the shown mean gives a slightly different number, because the shown mean is already rounded. The app never does that.

## Worked example

Neubauer Improved, dilution 2. Square 1 has 3 live and 1 dead, square 2 has 5 live and 1 dead: ΣL = 8, ΣD = 2, N = 2.

```
mean live      = 8 / 2                 = 4.00
mean dead      = 2 / 2                 = 1.00
live cells/mL  = 8 / 2 × 2 × 10 000    = 80 000   → 8.00 × 10⁴
dead cells/mL  = 2 / 2 × 2 × 10 000    = 20 000   → 2.00 × 10⁴
total cells/mL = 10 / 2 × 2 × 10 000   = 100 000  → 1.00 × 10⁵
viability      = 8 / 10 × 100          = 80.0 %
```

The same counts in the app, step by step:

| Step | Live cells/mL | Dead cells/mL | Total cells/mL | Viability |
| ---- | ------------- | ------------- | -------------- | --------- |
| Square 1: 3 live, 1 dead. Square 2: 5 live, 1 dead | 8.00 × 10⁴ | 2.00 × 10⁴ | 1.00 × 10⁵ | 80.0 % |
| Add square 3 and leave it untouched | 8.00 × 10⁴ | 2.00 × 10⁴ | 1.00 × 10⁵ | 80.0 % |
| Tap live in square 3, then Undo: it is now a counted zero (N = 3) | 5.33 × 10⁴ | 1.33 × 10⁴ | 6.67 × 10⁴ | 80.0 % |
| Reset square 3 | 8.00 × 10⁴ | 2.00 × 10⁴ | 1.00 × 10⁵ | 80.0 % |

With the first row's counts and dilution in the other chambers:

| Chamber | Live cells/mL | Dead cells/mL | Total cells/mL |
| ------- | ------------- | ------------- | -------------- |
| Fuchs-Rosenthal | 4.00 × 10⁴ | 1.00 × 10⁴ | 5.00 × 10⁴ |
| Malassez | 8.00 × 10⁵ | 2.00 × 10⁵ | 1.00 × 10⁶ |

`scripts/check-calc.mjs` asserts all of these, the rounding of halves, the dilution rules, and that 20 000 fractions of every size are shown within half a unit of their last digit.

## What the result does not include

The arithmetic is exact; the measurement is not. The app shows no uncertainty, and these are not in its numbers:

- **Counting statistics.** Cells land in the squares at random, so a count of n cells has a relative standard deviation of about 1 / √n: 10 % for 100 cells, 5 % for 400, about 3 % for 1000. Three significant figures are shown whatever the count.
- **The sample on the slide.** Mixing, pipetting, an overfilled or underfilled chamber, a cover slip that is not seated, and cells settling or clumping all change the count.
- **The dilution.** The app uses the factor you type.
- **The chamber.** The app uses the nominal dimensions above, not the tolerance of your slide.

## Sources

- Paul Marienfeld GmbH, "Counting grids": https://www.marienfeld-superior.com/counting-grids.html (depth and ruling of the three chambers).
- Wikipedia, "Hemocytometer": https://en.wikipedia.org/wiki/Hemocytometer (Neubauer Improved ruling and volumes, the boundary-line rule, the concentration formula).

## Changing a chamber or a formula

[ARCHITECTURE.md](ARCHITECTURE.md) has the recipe ("Recipes", "Identifiers with outside effects"). A change to `calc.ts` changes this document and `scripts/check-calc.mjs` with it.
