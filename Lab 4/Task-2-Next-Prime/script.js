/* ==========================================================================
   Lab 4 · Task #2 — The next prime number
   Get used to JS loops and the 'let' keyword.
   Given any prime number (hardcoded, no keyboard input), print the prime
   number that comes after it. Example: the prime after 11 is 13.
   ========================================================================== */

/**
 * Checks whether a number is prime.
 * Only divisors up to the square root need to be tested.
 * @param {number} n
 * @returns {boolean}
 */
function isPrime(n) {
  if (!Number.isInteger(n) || n < 2) return false;
  for (let divisor = 2; divisor * divisor <= n; divisor++) {
    if (n % divisor === 0) return false;
  }
  return true;
}

/**
 * Returns the first prime number greater than the given prime.
 * @param {number} prime - must itself be a prime number
 * @returns {number}
 */
function nextPrime(prime) {
  if (!isPrime(prime)) {
    throw new Error(prime + " is not a prime number");
  }
  let candidate = prime + 1;
  while (!isPrime(candidate)) {
    candidate++;
  }
  return candidate;
}

// List the first six prime numbers with a loop: 2, 3, 5, 7, 11, 13
let firstSix = [];
for (let n = 2; firstSix.length < 6; n++) {
  if (isPrime(n)) firstSix.push(n);
}
console.log("The first six prime numbers are: " + firstSix.join(", "));

// The given (hardcoded) prime number
let givenPrime = 11;
console.log("Given prime: " + givenPrime);
console.log("The prime after " + givenPrime + " is " + nextPrime(givenPrime));

// A few more hardcoded examples
let examples = [2, 13, 23, 89, 997];
for (let i = 0; i < examples.length; i++) {
  console.log("The prime after " + examples[i] + " is " + nextPrime(examples[i]));
}
