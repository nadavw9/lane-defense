// Entitlements (2026-10-20): what this install has bought, as plain string keys ('remove_ads',
// 'family_plan', ...). Storage is injected; the store's restore() is the source of truth
// (purchases.js), this is only its offline cache. Shared with The Math Wolf.
const KEY = 'ld_entitlements';
let _storage = null;
let _owned = new Set();

function _defaultStorage() { try { return globalThis.localStorage ?? null; } catch { return null; } }

/** Point the cache at a storage (default localStorage) and load it. Unreadable = nothing owned. */
export function configureEntitlements(storage = _defaultStorage()) {
  _storage = storage;
  _owned = new Set();
  try {
    const v = JSON.parse(_storage?.getItem(KEY) ?? '[]');
    if (Array.isArray(v)) for (const k of v) if (typeof k === 'string') _owned.add(k);
  } catch { /* corrupt or unavailable: nothing owned */ }
}

export function hasEntitlement(key) {
  if (_storage === null) configureEntitlements();
  return _owned.has(key);
}

/** Replace the whole set (after a store restore). */
export function setEntitlements(keys) {
  if (_storage === null) configureEntitlements();
  _owned = new Set(keys.filter(k => typeof k === 'string'));
  try { _storage?.setItem(KEY, JSON.stringify([..._owned])); } catch { /* unavailable */ }
}

export function grantEntitlement(key) { setEntitlements([...(_owned), key]); }
