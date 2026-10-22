/* ==========================================================================
   lib/validate.js - schema-based validation for request bodies
   --------------------------------------------------------------------------
   Every module (students, teachers, attendance, marks) describes its fields
   once in a schema. validate() checks a body against it and returns either
   the cleaned value or a list of { field, message } problems, which the
   router sends back as a 422 response.

   Field options
     type      string | int | number | enum | date | email | ref
     required  true when the field must be present (POST and PUT)
     min, max  length for strings, value for numbers
     pattern   RegExp a string must match, with `hint` explaining it
     values    allowed values for enum
     ref       collection name for ref fields (checked by the router)
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
      const value = spec.type === "email" ? raw.trim().toLowerCase() : raw.trim().replace(/\s+/g, " ");
      if (spec.required && value === "") return { error: `${label} is required.` };
      if (spec.min && value.length < spec.min) return { error: `${label} must be at least ${spec.min} characters.` };
      if (spec.max && value.length > spec.max) return { error: `${label} must be at most ${spec.max} characters.` };
      if (spec.type === "email" && !EMAIL_RE.test(value)) return { error: `${label} must be a valid email address.` };
      if (spec.pattern && value !== "" && !spec.pattern.test(value)) return { error: `${label} ${spec.hint || "has an invalid format."}` };
      return { value };
    }
    case "int":
    case "number":
    case "ref": {
      // numbers may arrive as JSON numbers or as numeric strings from a form
      const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
      if (typeof value !== "number" || !Number.isFinite(value)) return { error: `${label} must be a number.` };
      if ((spec.type === "int" || spec.type === "ref") && !Number.isInteger(value)) return { error: `${label} must be a whole number.` };
      if (spec.type === "ref" && value < 1) return { error: `${label} must be a positive id.` };
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
 * @param {object} options    readOnly: names that are allowed but ignored (id, createdAt...)
 * @returns {{ value: object, errors: {field: string, message: string}[] }}
 */
export function validate(body, schema, { readOnly = [] } = {}) {
  const errors = [];
  const value = {};

  for (const key of Object.keys(body)) {
    if (!(key in schema) && !readOnly.includes(key)) {
      errors.push({ field: key, message: `"${key}" is not a field of this record.` });
    }
  }

  for (const [name, spec] of Object.entries(schema)) {
    const raw = body[name];
    const missing = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
    if (missing) {
      if (spec.required) errors.push({ field: name, message: `${spec.label || name} is required.` });
      else if (spec.default !== undefined) value[name] = spec.default;
      else if (spec.type === "string") value[name] = "";
      continue;
    }
    const result = checkField(name, spec, raw);
    if (result.error) errors.push({ field: name, message: result.error });
    else value[name] = result.value;
  }

  return { value, errors };
}
