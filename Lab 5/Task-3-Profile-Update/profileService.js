/* ==========================================================================
   Task 3 - Safe Student Profile Update Service
   --------------------------------------------------------------------------
   updateProfile(student, update) returns a NEW student object:
     - fields missing from the update stay as they are
     - nested objects (address, contact) are merged, not replaced
     - 0, false and "" in the update are real values and are kept
     - undefined in the update means "not provided" and is ignored
   The original student is never modified.

   Concepts used (marked with [tag] in the comments):
     [object destructuring] [nested destructuring] [renaming] [default values]
     [array destructuring] [rest parameters] [object rest] [spread]
     [optional chaining] [nullish coalescing] [property shorthand]
   ========================================================================== */

const NESTED_FIELDS = ["address", "contact"];

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Copies an object without the keys whose value is undefined ("not provided"). */
export function withoutUndefined(source = {}) {                                    // [default values]
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined)           // [array destructuring]
  );
}

/**
 * Returns a new student with the update applied.
 * @param {object} student  original record (not modified)
 * @param {object} update   partial update, e.g. { name, address: { city } }
 */
export function updateProfile(student, update = {}) {
  if (!isPlainObject(student)) throw new TypeError("student must be an object");
  if (update !== null && !isPlainObject(update)) throw new TypeError("update must be an object");

  // [object destructuring] + [renaming] + [default values] + [object rest]
  const { address: currentAddress = {}, contact: currentContact = {}, ...currentTopLevel } = student;
  const { address: addressChanges = {}, contact: contactChanges = {}, ...topLevelChanges } = update ?? {};  // [nullish coalescing]

  if (!isPlainObject(addressChanges) || !isPlainObject(contactChanges)) {
    throw new TypeError("address and contact in an update must be objects");
  }

  // [spread]: later spreads win, and new nested objects are created so nothing is shared
  return {
    ...currentTopLevel,
    ...withoutUndefined(topLevelChanges),
    address: { ...currentAddress, ...withoutUndefined(addressChanges) },
    contact: { ...currentContact, ...withoutUndefined(contactChanges) }
  };
}

/**
 * Applies several updates in order.          [rest parameters]
 * applyUpdates(student, updateA, updateB, ...)
 */
export function applyUpdates(student, ...updates) {
  return updates.reduce((current, next) => updateProfile(current, next), student);
}

/** Lists which fields an update changed, e.g. ["name", "address.city"]. */
export function changedFields(before, after) {
  const changes = [];
  for (const key of Object.keys(after)) {
    if (NESTED_FIELDS.includes(key)) {
      for (const inner of Object.keys(after[key])) {
        if (before?.[key]?.[inner] !== after[key][inner]) changes.push(`${key}.${inner}`);   // [optional chaining]
      }
    } else if (before?.[key] !== after[key]) {
      changes.push(key);
    }
  }
  return changes;
}

/** A short readable summary built from the updated record. */
export function profileSummary(student) {
  // [nested destructuring] + [renaming] + [default values]
  const {
    id,
    name,
    marks,
    scholarship,
    address: { city, sector = "not set" } = {},
    contact: { email: emailAddress = "no email", phone = "no phone" } = {}
  } = student;

  // ?? keeps 0 / false; || would wrongly turn them into the fallback
  const marksText = marks ?? "not recorded";
  const marksWithOr = marks || "not recorded";

  return { id, name, city, sector, emailAddress, phone, marks: marksText, marksIfOrWasUsed: marksWithOr, scholarship };  // [property shorthand]
}

/**
 * Reference challenge: are the top-level and nested objects the same objects
 * in memory (===) or different ones?
 */
export function compareReferences(original, updated) {
  const describe = (label, a, b) => ({
    pair: label,
    same: a === b,
    reason: a === b
      ? "Both variables point to the same object in memory, so a change through one is visible through the other."
      : "updateProfile created a new object with spread, so they are different objects even if some values match."
  });
  return [
    describe("original vs updated", original, updated),
    describe("original.address vs updated.address", original.address, updated.address),
    describe("original.contact vs updated.contact", original.contact, updated.contact)
  ];
}

/** Recursively freezes an object, used in the demo to prove nothing is mutated. */
export function deepFreeze(object) {
  Object.values(object).forEach((value) => {
    if (value !== null && typeof value === "object") deepFreeze(value);
  });
  return Object.freeze(object);
}
