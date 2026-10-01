/* ==========================================================================
   Lab 4 · Task #5 — abs, ceil and floor "just like in Task 4"
   Each method works on 0 to N arguments:
     - no arguments       -> 0
     - one argument       -> a single number
     - several arguments  -> an array of numbers
   The maths is written by hand (no Math.abs / Math.ceil / Math.floor).
   ========================================================================== */

/* ---------- the single-number versions ---------- */

// Absolute value: distance from zero, so negative numbers flip sign.
function absOne(value) {
  let n = Number(value);
  return n <= 0 ? 0 - n : n;      // 0 - n also turns -0 into 0
}

// Floor: the largest whole number that is less than or equal to n.
function floorOne(value) {
  let n = Number(value);
  if (!Number.isFinite(n)) return n;
  let whole = n - (n % 1);                  // drops the fraction (towards zero)
  if (n < 0 && whole !== n) whole = whole - 1;
  return whole;
}

// Ceil: the smallest whole number that is greater than or equal to n.
function ceilOne(value) {
  let n = Number(value);
  if (!Number.isFinite(n)) return n;
  let whole = n - (n % 1);
  if (n > 0 && whole !== n) whole = whole + 1;
  return whole;
}

/* ---------- 0..N argument versions, same behaviour as roundMe() ---------- */

/**
 * absMe(...numbers): absolute value of 0..N numbers.
 * @returns {number|number[]}
 */
function absMe(...numbers) {
  if (numbers.length === 0) return 0;
  if (numbers.length === 1) return absOne(numbers[0]);
  let result = [];
  for (let i = 0; i < numbers.length; i++) result.push(absOne(numbers[i]));
  return result;
}

/**
 * ceilMe(...numbers): rounds 0..N numbers up.
 * @returns {number|number[]}
 */
function ceilMe(...numbers) {
  if (numbers.length === 0) return 0;
  if (numbers.length === 1) return ceilOne(numbers[0]);
  let result = [];
  for (let i = 0; i < numbers.length; i++) result.push(ceilOne(numbers[i]));
  return result;
}

/**
 * floorMe(...numbers): rounds 0..N numbers down.
 * @returns {number|number[]}
 */
function floorMe(...numbers) {
  if (numbers.length === 0) return 0;
  if (numbers.length === 1) return floorOne(numbers[0]);
  let result = [];
  for (let i = 0; i < numbers.length; i++) result.push(floorOne(numbers[i]));
  return result;
}

console.log("absMe() ->", absMe());                          // 0
console.log("absMe(-4.7) ->", absMe(-4.7));                  // 4.7
console.log("absMe(-4.7, 4.4, -9) ->", absMe(-4.7, 4.4, -9)); // [4.7, 4.4, 9]

console.log("ceilMe() ->", ceilMe());                        // 0
console.log("ceilMe(4.2) ->", ceilMe(4.2));                  // 5
console.log("ceilMe(4.2, -4.7, 3) ->", ceilMe(4.2, -4.7, 3)); // [5, -4, 3]

console.log("floorMe() ->", floorMe());                      // 0
console.log("floorMe(4.7) ->", floorMe(4.7));                // 4
console.log("floorMe(4.7, -4.2, 3) ->", floorMe(4.7, -4.2, 3)); // [4, -5, 3]
