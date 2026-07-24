#!/usr/bin/env node
// Validates a layout/geometry change gate report against
// docs/gates/layout-change-schema.json. Hand-rolled (no ajv/schema-validator
// dependency added) — supports exactly the subset of JSON Schema draft
// 2020-12 the gate schema actually uses: type, const, enum, required,
// properties, additionalProperties, items, $ref (in-document only),
// minLength, minimum/maximum/exclusiveMinimum. Exits non-zero on any missing
// field, wrong type, or any `pass: false` found anywhere in the report — see
// docs/gates/layout-change-gate.md for what each check means and why.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, '..', 'docs', 'gates', 'layout-change-schema.json');

const reportPath = process.argv[2];
if (!reportPath) {
  console.error('Usage: node scripts/validate-layout-change-gate.mjs <report.json>');
  process.exit(1);
}

function loadJson(p, label) {
  let raw;
  try {
    raw = readFileSync(p, 'utf8');
  } catch (e) {
    console.error(`Cannot read ${label} at ${p}: ${e.message}`);
    process.exit(1);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(`${label} at ${p} is not valid JSON: ${e.message}`);
    process.exit(1);
  }
}

const schema = loadJson(SCHEMA_PATH, 'schema');
const report = loadJson(reportPath, 'report');

const errors = [];
const passFailures = [];

function resolveRef(ref) {
  // Only in-document refs of the form "#/$defs/name" are used by this schema.
  const m = /^#\/\$defs\/(.+)$/.exec(ref);
  if (!m) throw new Error(`Unsupported $ref: ${ref}`);
  const def = schema.$defs?.[m[1]];
  if (!def) throw new Error(`$ref target not found: ${ref}`);
  return def;
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

function typeMatches(expected, value) {
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  return actual === expected;
}

function validate(node, value, at) {
  if (node.$ref) node = resolveRef(node.$ref);

  if ('const' in node) {
    if (value !== node.const) errors.push(`${at}: expected const ${JSON.stringify(node.const)}, got ${JSON.stringify(value)}`);
    return;
  }

  if (node.enum) {
    if (!node.enum.includes(value)) errors.push(`${at}: ${JSON.stringify(value)} is not one of ${JSON.stringify(node.enum)}`);
    return;
  }

  if (node.type) {
    if (!typeMatches(node.type, value)) {
      errors.push(`${at}: expected type ${node.type}, got ${typeOf(value)} (${JSON.stringify(value)})`);
      return;
    }
  }

  if (node.type === 'object' || (node.properties && typeof value === 'object' && value !== null && !Array.isArray(value))) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push(`${at}: expected object, got ${typeOf(value)}`);
      return;
    }
    for (const req of node.required ?? []) {
      if (!(req in value)) errors.push(`${at}: missing required field "${req}"`);
    }
    if (node.additionalProperties === false) {
      const allowed = new Set(Object.keys(node.properties ?? {}));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) errors.push(`${at}: unexpected field "${key}" (additionalProperties: false)`);
      }
    }
    for (const [key, propSchema] of Object.entries(node.properties ?? {})) {
      if (key in value) validate(propSchema, value[key], `${at}.${key}`);
    }
  }

  if (node.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push(`${at}: expected array, got ${typeOf(value)}`);
      return;
    }
    if (node.items) value.forEach((item, i) => validate(node.items, item, `${at}[${i}]`));
  }

  if (typeof value === 'string') {
    if (node.minLength !== undefined && value.length < node.minLength) {
      errors.push(`${at}: string shorter than minLength ${node.minLength}`);
    }
  }

  if (typeof value === 'number') {
    if (node.minimum !== undefined && value < node.minimum) errors.push(`${at}: ${value} < minimum ${node.minimum}`);
    if (node.maximum !== undefined && value > node.maximum) errors.push(`${at}: ${value} > maximum ${node.maximum}`);
    if (node.exclusiveMinimum !== undefined && value <= node.exclusiveMinimum) {
      errors.push(`${at}: ${value} <= exclusiveMinimum ${node.exclusiveMinimum}`);
    }
  }

  // Bare-boolean-pass guard: any object with a "pass" field must also carry
  // evidence alongside it — at least one other sibling field. This is the
  // schema's own core invariant (never a bare boolean), enforced defensively
  // even if a future schema edit forgets to require a value field explicitly.
  if (typeof value === 'object' && value !== null && !Array.isArray(value) && 'pass' in value) {
    if (Object.keys(value).length < 2) {
      errors.push(`${at}: "pass" with no accompanying evidence field (bare boolean)`);
    }
  }
}

function collectFailedPasses(value, at) {
  if (typeof value !== 'object' || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectFailedPasses(item, `${at}[${i}]`));
    return;
  }
  for (const [key, v] of Object.entries(value)) {
    const nextAt = `${at}.${key}`;
    if (key === 'pass' && v === false) passFailures.push(at);
    else collectFailedPasses(v, nextAt);
  }
}

validate(schema, report, '$');
collectFailedPasses(report, '$');

if (errors.length === 0 && passFailures.length === 0) {
  console.log(`OK: ${reportPath} is schema-valid and every check passes.`);
  process.exit(0);
}

if (errors.length > 0) {
  console.error(`Schema violations (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
}
if (passFailures.length > 0) {
  console.error(`Failed checks (${passFailures.length}):`);
  for (const p of passFailures) console.error(`  - ${p}.pass is false`);
}
process.exit(1);
