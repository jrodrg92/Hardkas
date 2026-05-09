/**
 * Filter evaluation engine.
 * Evaluates QueryFilter[] predicates against arbitrary objects using dot-path field access.
 * All evaluation is deterministic and null-safe.
 */
import type { QueryFilter, FilterOp } from "./types.js";

/**
 * Resolves a dot-separated field path on an object.
 * Returns undefined if any segment is missing.
 */
export function resolveFieldPath(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return undefined;

  const segments = path.split(".");
  let current: unknown = obj;

  for (const seg of segments) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[seg];
  }

  return current;
}

/**
 * Evaluates a single filter predicate against an item.
 */
export function evaluateFilter(item: unknown, filter: QueryFilter): boolean {
  const value = resolveFieldPath(item, filter.field);
  return applyOp(value, filter.op, filter.value);
}

/**
 * Evaluates all filters (AND semantics). Returns true only if all pass.
 */
export function evaluateFilters(item: unknown, filters: readonly QueryFilter[]): boolean {
  for (const f of filters) {
    if (!evaluateFilter(item, f)) return false;
  }
  return true;
}

/**
 * Applies a filter operation to a resolved value.
 */
function applyOp(resolved: unknown, op: FilterOp, target: QueryFilter["value"]): boolean {
  switch (op) {
    case "exists":
      return resolved !== undefined && resolved !== null;

    case "eq":
      return String(resolved) === String(target);

    case "neq":
      return String(resolved) !== String(target);

    case "gt":
      return toNumber(resolved) > toNumber(target);

    case "lt":
      return toNumber(resolved) < toNumber(target);

    case "gte":
      return toNumber(resolved) >= toNumber(target);

    case "lte":
      return toNumber(resolved) <= toNumber(target);

    case "in":
      if (!Array.isArray(target)) return false;
      return target.includes(String(resolved));

    case "contains":
      if (typeof resolved !== "string") return false;
      return resolved.includes(String(target));

    default:
      return false;
  }
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}
