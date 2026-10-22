/* ==========================================================================
   lib/validate.js - schema-based validation for request bodies
   --------------------------------------------------------------------------
   The same validator as Part 1. Products, accounts, reviews and orders each
   describe their fields once in a schema; validate() returns the cleaned
   value or a list of { field, message } problems, which the router sends
   back as a 422 response. `prefix` names nested fields, e.g. shipping.city.

   Field options
     type      string | int | number | enum | date | email | bool | object
     keepSpaces  do not trim the text (passwords)
     required  true when the field must be present (POST and PUT)
     min, max  length for strings, value for numbers
     pattern   RegExp a string must match, with `hint` explaining it
     values    allowed values for enum
     default   used when an optional field is missing
   ========================================================================== */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date as YYYY-MM-DD in local time. */
export function todayISO(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** True for a real calendar date such as 2026-10-21 (rejects 2026-02-30). */
export function isRealDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function checkField(name, spec, raw) {
  const label = spec.label || name;

  switch (spec.type) {
    case "string":
    case "email": {
      if (typeof raw !== "string") return { error: `${label} must be text.` };
      const value = spec.type === "email" ? raw.trim().toLowerCase() : spec.keepSpaces ? raw : raw.trim().replace(/\s+/g, " ");
      if (spec.required && value === "") return { error: `${label} is required.` };
      if (spec.min && value.length < spec.min) return { error: `${label} must be at least ${spec.min} characters.` };
      if (spec.max && value.length > spec.max) return { error: `${label} must be at most ${spec.max} characters.` };
      if (spec.type === "email" && !EMAIL_RE.test(value)) return { error: `${label} must be a valid email address.` };
      if (spec.pattern && value !== "" && !spec.pattern.test(value)) return { error: `${label} ${spec.hint || "has an invalid format."}` };
      return { value };
    }
    case "object": {
      // checked field by field afterwards with its own schema
      if (typeof raw !== "object" || Array.isArray(raw)) return { error: `${label} must be an object.` };
      return { value: raw };
    }
    case "bool": {
      if (typeof raw !== "boolean") return { error: `${label} must be true or false.` };
      return { value: raw };
    }
    case "int":
    case "number": {
      // numbers may arrive as JSON numbers or as numeric strings from a form
      const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
      if (typeof value !== "number" || !Number.isFinite(value)) return { error: `${label} must be a number.` };
      if (spec.type === "int" && !Number.isInteger(value)) return { error: `${label} must be a whole number.` };
      if (spec.min !== undefined && value < spec.min) return { error: `${label} must be at least ${spec.min}.` };
      if (spec.max !== undefined && value > spec.max) return { error: `${label} must be at most ${spec.max}.` };
      if (spec.positive && value <= 0) return { error: `${label} must be greater than 0.` };
      return { value };
    }
    case "enum": {
      const value = typeof raw === "string" ? raw.trim() : raw;
      const match = spec.values.find((v) => String(v).toLowerCase() === String(value).toLowerCase());
      if (match === undefined) return { error: `${label} must be one of: ${spec.values.join(", ")}.` };
      return { value: match };
    }
    case "date": {
      const value = typeof raw === "string" ? raw.trim() : raw;
      if (!isRealDate(value)) return { error: `${label} must be a real date in YYYY-MM-DD format.` };
      if (spec.notFuture && value > todayISO()) return { error: `${label} cannot be in the future.` };
      return { value };
    }
    default:
      throw new Error(`Unknown field type "${spec.type}" for ${name}`);
  }
}

/**
 * Validates a request body against a schema.
 * @param {object} body       parsed JSON body
 * @param {object} schema     { fieldName: spec }
 * @param {object} options    readOnly: names that are allowed but ignored (id, rating...)
 *                            prefix:   added to field names in errors, e.g. "shipping." 
 * @returns {{ value: object, errors: {field: string, message: string}[] }}
 */
export function validate(body, schema, { readOnly = [], prefix = "" } = {}) {
  const errors = [];
  const value = {};
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { value, errors: [{ field: prefix.replace(/\.$/, "") || "body", message: "Must be a JSON object." }] };
  }

  for (const key of Object.keys(body)) {
    if (!(key in schema) && !readOnly.includes(key)) {
      errors.push({ field: prefix + key, message: `"${key}" is not a field of this record.` });
    }
  }

  for (const [name, spec] of Object.entries(schema)) {
    const raw = body[name];
    const missing = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
    if (missing) {
      if (spec.required) errors.push({ field: prefix + name, message: `${spec.label || name} is required.` });
      else if (spec.default !== undefined) value[name] = spec.default;
      else if (spec.type === "string") value[name] = "";
      continue;
    }
    const result = checkField(name, spec, raw);
    if (result.error) errors.push({ field: prefix + name, message: result.error });
    else value[name] = result.value;
  }

  return { value, errors };
}
