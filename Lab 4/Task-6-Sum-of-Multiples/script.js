/* ==========================================================================
   Lab 4 · Task #6 — Sum of all the multiples of x or y below z
   Example: the natural numbers below 10 that are multiples of 3 or 5 are
   3, 5, 6 and 9, and their sum is 23 (3 + 5 + 6 + 9).
   ========================================================================== */

/**
 * Returns every natural number below z that is a multiple of x or y.
 * A number that is a multiple of both (e.g. 15 for 3 and 5) is counted once.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {number[]}
 */
function multiplesBelow(x, y, z) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z) || x <= 0 || y <= 0) {
    throw new Error("x and y must be positive whole numbers and z must be a whole number");
  }
  let multiples = [];
  for (let n = 1; n < z; n++) {
    if (n % x === 0 || n % y === 0) {
      multiples.push(n);
    }
  }
  return multiples;
}

/**
 * Sum of all the multiples of x or y below z.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {number}
 */
function sumOfMultiples(x, y, z) {
  let multiples = multiplesBelow(x, y, z);
  let sum = 0;
  for (let i = 0; i < multiples.length; i++) {
    sum += multiples[i];
  }
  return sum;
}

// The example from the lab manual
let x = 3, y = 5, z = 10;
console.log("Multiples of " + x + " or " + y + " below " + z + ": " + multiplesBelow(x, y, z).join(", "));
console.log("Sum = " + multiplesBelow(x, y, z).join(" + ") + " = " + sumOfMultiples(x, y, z));   // 23

// More examples
console.log("sumOfMultiples(3, 5, 1000) =", sumOfMultiples(3, 5, 1000));   // 233168
console.log("sumOfMultiples(4, 6, 25) =", sumOfMultiples(4, 6, 25));       // 4+6+8+12+16+18+20+24 = 108
console.log("sumOfMultiples(7, 7, 50) =", sumOfMultiples(7, 7, 50));       // 7+14+...+49 = 196
