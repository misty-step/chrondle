/**
 * Server-side validation of Convex values against exported validator JSON
 * (`fn.exportArgs()` and `schema.export()`), matching Convex's behaviour of
 * rejecting malformed arguments and schema-invalid documents.
 */
import { jsonToConvex, type JSONValue, type Value } from "convex/values";

export type ValidatorJSON =
  | { type: "null" | "number" | "bigint" | "boolean" | "string" | "bytes" | "any" }
  | { type: "literal"; value: JSONValue }
  | { type: "id"; tableName: string }
  | { type: "array"; value: ValidatorJSON }
  | { type: "record"; keys: ValidatorJSON; values: FieldJSON }
  | { type: "object"; value: Record<string, FieldJSON> }
  | { type: "union"; value: ValidatorJSON[] };

type FieldJSON = { fieldType: ValidatorJSON; optional: boolean };

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Resolves whether an ID string belongs to the named table. */
export type IdChecker = (id: string, tableName: string) => boolean;

function describe(value: Value | undefined): string {
  if (value === undefined) return "undefined";
  if (typeof value === "bigint") return `${value}n`;
  if (value instanceof ArrayBuffer) return "bytes";
  try {
    return JSON.stringify(value)?.slice(0, 120) ?? String(value);
  } catch {
    return String(value);
  }
}

function isPlainObject(value: unknown): value is Record<string, Value> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  if (value instanceof ArrayBuffer) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype || proto?.constructor?.name === "Object";
}

function literalEquals(expected: JSONValue, actual: Value | undefined): boolean {
  const literal = jsonToConvex(expected);
  return typeof literal === typeof actual && literal === actual;
}

export function check(
  validator: ValidatorJSON,
  value: Value | undefined,
  isId: IdChecker,
  path = "",
): void {
  const where = path ? ` at path \`${path}\`` : "";
  const fail = (): never => {
    throw new ValidationError(
      `Value ${describe(value)} does not match validator ${JSON.stringify(validator).slice(0, 200)}${where}`,
    );
  };
  switch (validator.type) {
    case "any":
      return;
    case "null":
      if (value !== null) fail();
      return;
    case "number":
      if (typeof value !== "number") fail();
      return;
    case "bigint":
      if (typeof value !== "bigint") fail();
      return;
    case "boolean":
      if (typeof value !== "boolean") fail();
      return;
    case "string":
      if (typeof value !== "string") fail();
      return;
    case "bytes":
      if (!(value instanceof ArrayBuffer)) fail();
      return;
    case "literal":
      if (!literalEquals(validator.value, value)) fail();
      return;
    case "id":
      if (typeof value !== "string" || !isId(value, validator.tableName)) fail();
      return;
    case "array":
      if (!Array.isArray(value)) fail();
      (value as Value[]).forEach((element, index) =>
        check(validator.value, element, isId, `${path}[${index}]`),
      );
      return;
    case "record": {
      if (!isPlainObject(value)) fail();
      for (const [key, element] of Object.entries(value as Record<string, Value>)) {
        check(validator.keys, key, isId, `${path}.${key}`);
        if (element === undefined && validator.values.optional) continue;
        check(validator.values.fieldType, element, isId, `${path}.${key}`);
      }
      return;
    }
    case "object": {
      if (!isPlainObject(value)) fail();
      const record = value as Record<string, Value | undefined>;
      for (const [field, spec] of Object.entries(validator.value)) {
        const fieldPath = path ? `${path}.${field}` : field;
        if (record[field] === undefined) {
          if (!spec.optional) {
            throw new ValidationError(`Object is missing the required field \`${fieldPath}\``);
          }
          continue;
        }
        check(spec.fieldType, record[field], isId, fieldPath);
      }
      for (const field of Object.keys(record)) {
        if (record[field] !== undefined && !(field in validator.value)) {
          throw new ValidationError(
            `Object contains extra field \`${path ? `${path}.` : ""}${field}\` that is not in the validator`,
          );
        }
      }
      return;
    }
    case "union": {
      for (const member of validator.value) {
        try {
          check(member, value, isId, path);
          return;
        } catch (error) {
          if (!(error instanceof ValidationError)) throw error;
        }
      }
      fail();
      return;
    }
    default:
      throw new ValidationError(`Unsupported validator ${JSON.stringify(validator)}`);
  }
}

/** Validate a stored document; system fields are checked separately by the store. */
export function checkDocument(
  documentType: ValidatorJSON,
  document: Record<string, Value>,
  isId: IdChecker,
): void {
  const fields = { ...document };
  delete fields._id;
  delete fields._creationTime;
  check(documentType, fields, isId);
}
