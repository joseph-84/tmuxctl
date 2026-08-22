"use strict";
// Defense-in-depth against online brute-forcing of PAM accounts through the
// web login form. PAM's own lockout (pam_faillock/pam_tally2) may or may not
// be configured on the host — deploy/pam.d-tmuxctl doesn't assume it — so
// the app enforces its own limit independent of that. Keyed by username
// alone (not IP): the threat model here is "protect this specific account
// from being guessed", which matters more for a single/few-admin tool than
// tolerating a same-account lockout from multiple source IPs.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

const state = new Map(); // username -> { count, windowStart, lockedUntil }

function checkLocked(username) {
  const s = state.get(username);
  if (!s || !s.lockedUntil) return 0;
  const remaining = s.lockedUntil - Date.now();
  return remaining > 0 ? remaining : 0;
}

function recordFailure(username) {
  const now = Date.now();
  let s = state.get(username);
  if (!s || now - s.windowStart > WINDOW_MS) {
    s = { count: 0, windowStart: now, lockedUntil: 0 };
  }
  s.count++;
  if (s.count >= MAX_ATTEMPTS) {
    s.lockedUntil = now + LOCK_MS;
  }
  state.set(username, s);
  return s.lockedUntil > now;
}

function recordSuccess(username) {
  state.delete(username);
}

module.exports = { checkLocked, recordFailure, recordSuccess };
