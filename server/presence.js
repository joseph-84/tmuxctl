"use strict";
// In-memory "who's using tmuxctl right now" tracker. Touched on every
// authenticated request; a user counts as online if seen within TTL. This is
// intentionally not persisted — it's a live indicator, not an audit log
// (see activity.js for that).
const TTL_MS = 2 * 60 * 1000;
const lastSeen = new Map();

function touch(username) {
  lastSeen.set(username, Date.now());
}

function onlineUsers() {
  const now = Date.now();
  const set = new Set();
  for (const [user, ts] of lastSeen) {
    if (now - ts <= TTL_MS) set.add(user);
    else lastSeen.delete(user);
  }
  return set;
}

module.exports = { touch, onlineUsers };
