/* ==========================================================================
   Task 1 - Admission Decision and Data Sanitization Engine
   --------------------------------------------------------------------------
   Form values arrive as strings and cannot be trusted. Every applicant is
   sanitised first (explicit conversion + validation). Merit is only
   calculated for applicants whose data is valid.

   Merit = Matric 20% + Intermediate 30% + Entry Test 50%
   Eligible = Merit >= 70 AND Entry Test >= 60 AND Intermediate >= 60

   Status rules (our definition of SELECTED vs WAITING):
     INVALID DATA  any missing / non-numeric / out-of-range / unsupported value
     REJECTED      valid data but not eligible
     SELECTED      eligible, merit reaches the program's closing merit AND fee is paid
     WAITING       eligible, but merit is below the program's closing merit
                   OR the admission fee has not been paid yet
   ========================================================================== */

export const WEIGHTS = { matric: 0.2, intermediate: 0.3, entryTest: 0.5 };
export const ELIGIBILITY = { merit: 70, entryTest: 60, intermediate: 60 };
export const AGE_LIMITS = { min: 17, max: 30 };
export const MARK_LIMITS = { min: 0, max: 100 };
export const STATUS = {
  SELECTED: "SELECTED",
  WAITING: "WAITING",
  REJECTED: "REJECTED",
  INVALID: "INVALID DATA"
};

const MARK_FIELDS = ["matricMarks", "intermediateMarks", "entryTest"];

/**
 * Closing merit for each program. A switch is used on purpose: unsupported
 * programs fall to the default branch and return null.
 * @param {string} program
 * @returns {number|null}
 */
export function closingMerit(program) {
  switch (program) {
    case "BSCS":
      return 80;
    case "BSAI":
      return 78;
    case "BSSE":
      return 76;
    case "BSDS":
      return 75;
    default:
      return null;     // unsupported program
  }
}

// A value counts as missing when it is undefined, null, or only whitespace.
// Note: 0 and "0" are NOT missing even though 0 is falsy, so we cannot use !value.
export function isMissing(value) {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

/**
 * Explicitly converts a form value to a number.
 * Number("") would silently give 0 and Number("12abc") gives NaN, so both are
 * checked instead of trusting the conversion.
 * @returns {{ value: number|null, error: string|null }}
 */
export function toNumber(raw, label) {
  if (isMissing(raw)) return { value: null, error: `${label} is missing` };
  const value = Number(typeof raw === "string" ? raw.trim() : raw);
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return { value: null, error: `${label} "${raw}" is not a valid number` };
  }
  return { value, error: null };
}

/**
 * Converts "true"/"false" (any case) or a real boolean.
 * Boolean("false") is true, which is why explicit comparison is used.
 */
export function toBoolean(raw, label) {
  if (typeof raw === "boolean") return { value: raw, error: null };
  if (isMissing(raw)) return { value: null, error: `${label} is missing` };
  const text = String(raw).trim().toLowerCase();
  if (text === "true") return { value: true, error: null };
  if (text === "false") return { value: false, error: null };
  return { value: null, error: `${label} "${raw}" must be true or false` };
}

const LABELS = {
  age: "Age",
  matricMarks: "Matric marks",
  intermediateMarks: "Intermediate marks",
  entryTest: "Entry test marks",
  feePaid: "Fee paid"
};

/**
 * Validates and converts one raw applicant. Never changes the input object.
 * @returns {{ ok: boolean, errors: string[], data: object }}
 */
export function sanitizeApplicant(raw) {
  // guard clause: the record itself must be an object
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["Applicant record must be an object"], data: {} };
  }

  const errors = [];
  const id = isMissing(raw.id) ? null : String(raw.id).trim();
  const name = isMissing(raw.name) ? null : String(raw.name).trim();
  const program = isMissing(raw.program) ? null : String(raw.program).trim().toUpperCase();

  if (id === null) errors.push("ID is missing");
  if (name === null) errors.push("Name is missing");

  if (program === null) errors.push("Program is missing");
  else if (closingMerit(program) === null) errors.push(`Program "${program}" is not supported`);

  // age: must be a whole number between 17 and 30
  const age = toNumber(raw.age, LABELS.age);
  if (age.error) errors.push(age.error);
  else if (!Number.isInteger(age.value)) errors.push(`Age must be a whole number (got ${age.value})`);
  else if (age.value < AGE_LIMITS.min || age.value > AGE_LIMITS.max) {
    errors.push(`Age ${age.value} is outside ${AGE_LIMITS.min}-${AGE_LIMITS.max}`);
  }

  // marks: all three must be numbers between 0 and 100
  const marks = {};
  for (const field of MARK_FIELDS) {
    const converted = toNumber(raw[field], LABELS[field]);
    if (converted.error) {
      errors.push(converted.error);
    } else if (converted.value < MARK_LIMITS.min || converted.value > MARK_LIMITS.max) {
      errors.push(`${LABELS[field]} ${converted.value} must be between ${MARK_LIMITS.min} and ${MARK_LIMITS.max}`);
    }
    marks[field] = converted.value;
  }

  const fee = toBoolean(raw.feePaid, LABELS.feePaid);
  if (fee.error) errors.push(fee.error);

  return {
    ok: errors.length === 0,
    errors,
    data: { id, name, program, age: age.value, ...marks, feePaid: fee.value }
  };
}

/** Merit with the 20 / 30 / 50 weights, rounded to 2 decimal places. */
export function calculateMerit({ matricMarks, intermediateMarks, entryTest }) {
  const merit =
    matricMarks * WEIGHTS.matric + intermediateMarks * WEIGHTS.intermediate + entryTest * WEIGHTS.entryTest;
  return Math.round(merit * 100) / 100;
}

export function isEligible(merit, { entryTest, intermediateMarks }) {
  return merit >= ELIGIBILITY.merit && entryTest >= ELIGIBILITY.entryTest && intermediateMarks >= ELIGIBILITY.intermediate;
}

/**
 * Processes one applicant and returns a decision object.
 */
export function evaluateApplicant(raw) {
  const { ok, errors, data } = sanitizeApplicant(raw);

  // guard clause: merit is never calculated for invalid data
  if (!ok) {
    return { id: data.id ?? null, name: data.name ?? null, program: data.program ?? null, status: STATUS.INVALID, merit: null, reasons: errors };
  }

  const merit = calculateMerit(data);
  const eligible = isEligible(merit, data);
  const cutoff = closingMerit(data.program);
  const reasons = [];
  let status;

  if (!eligible) {
    status = STATUS.REJECTED;
    if (merit < ELIGIBILITY.merit) reasons.push(`Merit ${merit} is below ${ELIGIBILITY.merit}`);
    if (data.entryTest < ELIGIBILITY.entryTest) reasons.push(`Entry test ${data.entryTest} is below ${ELIGIBILITY.entryTest}`);
    if (data.intermediateMarks < ELIGIBILITY.intermediate) reasons.push(`Intermediate ${data.intermediateMarks} is below ${ELIGIBILITY.intermediate}`);
  } else if (merit >= cutoff && data.feePaid) {
    status = STATUS.SELECTED;
    reasons.push(`Merit ${merit} meets the ${data.program} closing merit of ${cutoff} and the fee is paid`);
  } else {
    status = STATUS.WAITING;
    reasons.push(merit < cutoff ? `Eligible, but merit ${merit} is below the ${data.program} closing merit of ${cutoff}` : "Eligible, but the admission fee has not been paid");
  }

  return { id: data.id, name: data.name, program: data.program, status, merit, reasons };
}

/** Evaluates every applicant. Returns a new array; the input is not changed. */
export function processApplicants(applicants) {
  if (!Array.isArray(applicants)) throw new TypeError("applicants must be an array");
  const decisions = [];
  for (const applicant of applicants) {
    decisions.push(evaluateApplicant(applicant));
  }
  return decisions;
}

/**
 * Final summary from the decisions.
 * Applicants per program counts every applicant whose program could be read.
 */
export function summarize(decisions) {
  let validCount = 0;
  let invalidCount = 0;
  let meritTotal = 0;
  let highest = null;
  let lowest = null;
  const perProgram = {};
  const perStatus = {};

  for (const decision of decisions) {
    perStatus[decision.status] = (perStatus[decision.status] ?? 0) + 1;
    const programKey = decision.program ?? "UNKNOWN";
    perProgram[programKey] = (perProgram[programKey] ?? 0) + 1;

    if (decision.status === STATUS.INVALID) {
      invalidCount++;
      continue;
    }
    validCount++;
    meritTotal += decision.merit;
    if (highest === null || decision.merit > highest.merit) highest = decision;
    if (lowest === null || decision.merit < lowest.merit) lowest = decision;
  }

  return {
    validApplicants: validCount,
    invalidApplicants: invalidCount,
    highestMerit: highest ? { id: highest.id, name: highest.name, merit: highest.merit } : null,
    lowestMerit: lowest ? { id: lowest.id, name: lowest.name, merit: lowest.merit } : null,
    averageMerit: validCount > 0 ? Math.round((meritTotal / validCount) * 100) / 100 : null,
    applicantsPerProgram: perProgram,
    applicantsPerStatus: perStatus
  };
}
