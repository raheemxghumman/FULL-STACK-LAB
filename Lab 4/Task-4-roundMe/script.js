/* ==========================================================================
   Lab 4 · Task #4 — roundMe()
   roundMe works on 0 to N arguments. For multiple arguments it returns an
   array of rounded values.
     roundMe()          // returns 0
     roundMe(4.7)       // returns 5
     roundMe(4.7, 4.4)  // returns [5, 4]

   The rounding itself is written by hand (no Math.round) so the logic is
   visible. It follows the same rule as Math.round: .5 rounds up, so
   roundMe(2.5) is 3 and roundMe(-2.5) is -2.
   ========================================================================== */

/**
 * Rounds a single number to the nearest whole number.
 * @param {number} value
 * @returns {number}
 */
function roundOne(value) {
  let n = Number(value);
  if (!Number.isFinite(n)) return n;          // NaN, Infinity and -Infinity stay as they are

  // Whole-number part, always rounding towards -Infinity (this is "floor")
  let whole = n - (n % 1);                    // drops the fraction (towards zero)
  if (n < 0 && whole !== n) whole = whole - 1; // negative numbers need one step further down

  let fraction = n - whole;                   // always between 0 and 1
  return fraction >= 0.5 ? whole + 1 : whole;
}

/**
 * roundMe(...numbers)
 *  - no arguments       -> 0
 *  - one argument       -> the rounded number
 *  - several arguments  -> an array of rounded numbers
 * @param {...number} numbers
 * @returns {number|number[]}
 */
function roundMe(...numbers) {
  if (numbers.length === 0) return 0;
  if (numbers.length === 1) return roundOne(numbers[0]);

  let rounded = [];
  for (let i = 0; i < numbers.length; i++) {
    rounded.push(roundOne(numbers[i]));
  }
  return rounded;
}

console.log("roundMe() ->", roundMe());                         // 0
console.log("roundMe(4.7) ->", roundMe(4.7));                   // 5
console.log("roundMe(4.7, 4.4) ->", roundMe(4.7, 4.4));         // [5, 4]
console.log("roundMe(2.5, -2.5, -4.7) ->", roundMe(2.5, -2.5, -4.7)); // [3, -2, -5]
console.log("roundMe(1.49, 9.99, 0.5, 7) ->", roundMe(1.49, 9.99, 0.5, 7)); // [1, 10, 1, 7]
