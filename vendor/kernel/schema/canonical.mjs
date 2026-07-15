// Role: the v3 canonical form and the one named hash (intake data model v3, Section 1). Turns a
//   record into a byte-exact canonical form and hashes it. This is the determinism foundation of
//   the gate kernel: two inputs with the same content produce identical bytes and identical hashes.
// Contract: canonicalize(value, policy) -> canonical node; encode(node) -> canonical string;
//   hashOf(value|node) -> hex sha256; computeIdentity(fields...) helpers. ESM, kernel imports only
//   kernel. sha256 (schema/sha256.mjs, a vendored pure-JS implementation) is the one named hash, so
//   the trusted core hashes identically headless and in a file:// page; nothing else hashes.
// Invariant: DETERMINISM DISCIPLINE, one canonical form, byte-exact. Fields sorted by field-name
//   byte order; strings NFC + LF + outer-trimmed, interior preserved; NUMBERS are exact-decimal
//   strings preserved verbatim and NEVER parsed to a floating-point value anywhere (a JS `number`
//   on the path throws). Absent optionals omitted; no null in canonical form. Reference lists and
//   generic arrays sort by canonical byte order (reference lists drop exact duplicates); a
//   sequence child list keeps authored order. The extension area is hashed and read by no check.
import { sha256Hex } from "./sha256.mjs";

// ---- string normalization (Section 1) ----
export function normalizeString(s) {
  return s.normalize("NFC").replace(/\r\n?/g, "\n").replace(/^\s+|\s+$/gu, "");
}

// ---- exact-decimal validation: no leading zeros, no trailing fraction zeros, no exponent, finite ----
const DECIMAL_RE = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$/;
export function isExactDecimal(s) {
  return typeof s === "string" && s !== "-0" && DECIMAL_RE.test(s);
}

// ---- byte-order comparison over UTF-8 (field names and canonical forms sort by byte order) ----
// UTF-8 is designed so a byte-order sort equals a Unicode code-point sort, so comparing by code
// point (not by UTF-16 code unit, which mis-orders astral characters) is byte-exact and Buffer-free.
export function byteCompare(a, b) {
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    const ca = a.codePointAt(i), cb = b.codePointAt(j);
    if (ca !== cb) return ca < cb ? -1 : 1;
    i += ca > 0xffff ? 2 : 1;
    j += cb > 0xffff ? 2 : 1;
  }
  if (i >= a.length && j >= b.length) return 0;
  return i >= a.length ? -1 : 1;
}

// a decimal node is tagged so it encodes as a bare token, distinct from a quoted string of the same
// digits: a measured value 1.5 and the text "1.5" are different content and hash differently.
function decimalNode(dec) {
  return { $dec: dec };
}
function isDecimalNode(n) {
  return n !== null && typeof n === "object" && !Array.isArray(n) && typeof n.$dec === "string";
}

// canonicalize a value. `policy` steers arrays: "reference" (sort + drop exact dupes), "child"
// (sort, keep dupes: Section 1 grants dedup to reference lists only), "sequence" (keep authored
// order), "decimal" (an exact-decimal string), or undefined (a plain value: objects recurse,
// arrays sort without dedup). Throws on a JS number, holding the no-float invariant structurally.
export function canonicalize(value, policy) {
  if (typeof value === "number")
    throw new Error("no floating-point values on the canonical path; pass numbers as exact-decimal strings (Section 1)");
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (policy === "decimal") {
      const n = normalizeString(value);
      if (!isExactDecimal(n)) throw new Error(`not an exact-decimal string: ${JSON.stringify(value)} (Section 1)`);
      return decimalNode(n);
    }
    return normalizeString(value);
  }
  if (Array.isArray(value)) {
    const elemPolicy = policy === "reference" || policy === "child" || policy === "sequence" ? undefined : policy;
    const elems = value.filter((v) => v !== undefined && v !== null).map((v) => canonicalize(v, elemPolicy)); // no null in canonical form
    if (policy === "sequence") return elems; // authored order preserved
    // unordered: sort by canonical byte order; reference lists drop exact duplicates
    const sorted = elems.slice().sort((a, b) => byteCompare(encode(a), encode(b)));
    if (policy === "reference") {
      const out = [];
      let last = null;
      for (const e of sorted) {
        const enc = encode(e);
        if (enc !== last) out.push(e);
        last = enc;
      }
      return out;
    }
    return sorted;
  }
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) {
      if (value[k] === undefined || value[k] === null) continue; // absent optional omitted; no null in canonical form
      out[k] = canonicalize(value[k]);
    }
    return out;
  }
  throw new Error(`uncanonical value: ${String(value)} (null/undefined are omitted, not encoded)`);
}

// ---- the canonical byte string: a deterministic encoding with full byte control ----
export function encode(node) {
  if (node === true) return "true";
  if (node === false) return "false";
  if (isDecimalNode(node)) return node.$dec; // bare decimal token
  if (typeof node === "string") return JSON.stringify(node); // deterministic string escaping
  if (Array.isArray(node)) return "[" + node.map(encode).join(",") + "]";
  if (node !== null && typeof node === "object") {
    const keys = Object.keys(node).sort(byteCompare); // fields by byte order
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + encode(node[k])).join(",") + "}";
  }
  throw new Error(`cannot encode node: ${String(node)}`);
}

// ---- the one named hash over the full canonical byte sequence, extensions included ----
// accepts the canonical string (UTF-8) or a byte array; sha256Hex encodes a string to UTF-8 itself.
export function hashBytes(bytes) {
  return sha256Hex(bytes);
}
export function hashOf(valueOrNode, { pre = false } = {}) {
  const node = pre ? valueOrNode : canonicalize(valueOrNode);
  return hashBytes(encode(node));
}

// content identities (Section 2). A claim identity is the hash of (kind, statement); a link identity
// is the hash of (link_kind, from_identity, to_identity). Over a SUBSET of fields, so identity is
// not the record hash.
export function computeClaimIdentity(kind, statement) {
  return hashOf({ kind, statement });
}
export function computeLinkIdentity(link_kind, from_identity, to_identity) {
  return hashOf({ link_kind, from_identity, to_identity });
}
