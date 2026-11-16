import { TransformFnParams } from 'class-transformer';

/** Trims human-readable text before it is measured, so "   " becomes "" and fails the length check. */
export const trimText = ({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim() : value);

/** Email: trimmed and lower-cased, so "Ali@FixFlow.test " and "ali@fixflow.test" are the same account. */
export const normaliseEmail = ({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

/**
 * Explicit conversion of numeric query values: only a string of digits (optionally negative) is
 * turned into a number. "1.5", "abc", "1e2" or "" stay as they are, so @IsInt rejects them.
 */
export const toInteger = ({ value }: TransformFnParams) =>
  typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;
