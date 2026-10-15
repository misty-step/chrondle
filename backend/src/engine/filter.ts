/**
 * Evaluation of serialized Convex values, filter expressions and index ranges
 * (the JSON produced by `convex/server`'s query, filter and range builders).
 */
import { compareValues, jsonToConvex, type JSONValue, type Value } from "convex/values";
import { fieldValue } from "./keys";

/** Like `jsonToConvex`, but accepts the `{ $undefined: null }` marker. */
export function jsonToConvexOrUndefined(json: JSONValue): Value | undefined {
  if (
    json !== null &&
    typeof json === "object" &&
    !Array.isArray(json) &&
    Object.keys(json).length === 1 &&
    "$undefined" in json
  ) {
    return undefined;
  }
  return jsonToConvex(json);
}

type Expr = Record<string, JSONValue>;

function arithmetic(op: string, left: Value | undefined, right: Value | undefined): Value {
  if (typeof left === "bigint" && typeof right === "bigint") {
    switch (op) {
      case "$add":
        return left + right;
      case "$sub":
        return left - right;
      case "$mul":
        return left * right;
      case "$div":
        return left / right;
      case "$mod":
        return left % right;
    }
  }
  if (typeof left === "number" && typeof right === "number") {
    switch (op) {
      case "$add":
        return left + right;
      case "$sub":
        return left - right;
      case "$mul":
        return left * right;
      case "$div":
        return left / right;
      case "$mod":
        return left % right;
    }
  }
  throw new Error(`Cannot apply ${op} to ${typeof left} and ${typeof right}`);
}

export function evaluateExpression(expression: JSONValue, document: Record<string, Value>): Value | undefined {
  const expr = expression as Expr;
  const [op] = Object.keys(expr);
  const operand = expr[op];
  switch (op) {
    case "$field":
      return fieldValue(document, operand as string);
    case "$literal":
      return jsonToConvexOrUndefined(operand);
    case "$eq":
    case "$neq":
    case "$lt":
    case "$lte":
    case "$gt":
    case "$gte": {
      const [left, right] = (operand as JSONValue[]).map((e) => evaluateExpression(e, document));
      const cmp = compareValues(left, right);
      return op === "$eq"
        ? cmp === 0
        : op === "$neq"
          ? cmp !== 0
          : op === "$lt"
            ? cmp < 0
            : op === "$lte"
              ? cmp <= 0
              : op === "$gt"
                ? cmp > 0
                : cmp >= 0;
    }
    case "$and":
      return (operand as JSONValue[]).every((e) => evaluateExpression(e, document) === true);
    case "$or":
      return (operand as JSONValue[]).some((e) => evaluateExpression(e, document) === true);
    case "$not":
      return evaluateExpression(operand, document) !== true;
    case "$neg": {
      const value = evaluateExpression(operand, document);
      if (typeof value === "number") return -value;
      if (typeof value === "bigint") return -value;
      throw new Error(`Cannot negate ${typeof value}`);
    }
    case "$add":
    case "$sub":
    case "$mul":
    case "$div":
    case "$mod": {
      const [left, right] = (operand as JSONValue[]).map((e) => evaluateExpression(e, document));
      return arithmetic(op, left, right);
    }
    default:
      throw new Error(`Unsupported filter expression ${JSON.stringify(expression).slice(0, 120)}`);
  }
}

export function matchesFilter(filter: JSONValue, document: Record<string, Value>): boolean {
  return evaluateExpression(filter, document) === true;
}
