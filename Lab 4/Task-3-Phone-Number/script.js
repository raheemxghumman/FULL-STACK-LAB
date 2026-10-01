/* ==========================================================================
   Lab 4 · Task #3 — Phone number from an array
   Write a function that accepts an array of 10 integers (between 0 and 9)
   and returns a string of those numbers in the form of a phone number.

   createPhoneNumber([1, 2, 3, 4, 5, 6, 7, 8, 9, 0])
   // => returns "(123) 456-7890"
   ========================================================================== */

/**
 * Function takes array of numbers and returns
 * @param {array of numbers} numbers
 * @returns string in following format: "(123) 456-7890"
 */
function createPhoneNumber(numbers) {
  // Validate the input: exactly 10 whole numbers, each between 0 and 9
  if (!Array.isArray(numbers) || numbers.length !== 10) {
    throw new Error("Please pass an array of exactly 10 numbers");
  }
  for (let i = 0; i < numbers.length; i++) {
    if (!Number.isInteger(numbers[i]) || numbers[i] < 0 || numbers[i] > 9) {
      throw new Error("Item " + (i + 1) + " must be a whole number between 0 and 9");
    }
  }

  let areaCode = "";
  let prefix = "";
  let lineNumber = "";
  for (let i = 0; i < numbers.length; i++) {
    if (i < 3) areaCode += numbers[i];
    else if (i < 6) prefix += numbers[i];
    else lineNumber += numbers[i];
  }
  return "(" + areaCode + ") " + prefix + "-" + lineNumber;
}

console.log(createPhoneNumber([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]));   // "(123) 456-7890"
console.log(createPhoneNumber([0, 3, 3, 1, 8, 8, 8, 6, 8, 6]));   // "(033) 188-8686"
console.log(createPhoneNumber([5, 5, 5, 0, 1, 0, 9, 9, 9, 9]));   // "(555) 010-9999"

// Invalid input is reported instead of producing a wrong number
try {
  createPhoneNumber([1, 2, 3]);
} catch (error) {
  console.error(error.message);
}
