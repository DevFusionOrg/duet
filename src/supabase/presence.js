import { supabase } from "./supabase";

let presenceChannel = null;
const presenceListeners = new Set();
let currentPresenceState = {};

export function setupPresence(userId) {
  if (!userId) return () => {};

  if (presenceChannel) {
    try {
      presenceChannel.unsubscribe();
    } catch {}
    presenceChannel = null;
  }

  presenceChannel = supabase.channel("online-presence", {
    config: {
      presence: {
        key: userId,
      },
    },
  });

  const notifyListeners = () => {
    currentPresenceState = presenceChannel?.presenceState() || {};
    presenceListeners.forEach((listener) => {
      try {
        listener(currentPresenceState);
      } catch (err) {
        console.error("Presence listener error:", err);
      }
    });
  };

  presenceChannel
    .on("presence", { event: "sync" }, notifyListeners)
    .on("presence", { event: "join" }, notifyListeners)
    .on("presence", { event: "leave" }, notifyListeners)
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        try {
          await presenceChannel.track({
            userId,
            onlineAt: new Date().toISOString(),
          });
        } catch (err) {
          console.warn("Error tracking presence:", err);
        }
      }
    });

  // Cleanup on unmount
  return () => {
    if (presenceChannel) {
      try {
        presenceChannel.untrack();
        presenceChannel.unsubscribe();
      } catch {}
      presenceChannel = null;
    }
  };
}

export function listenToPresence(userId, callback) {
  if (!userId) return () => {};

  const handler = (state) => {
    const userPresences = state[userId];
    const isOnline = Array.isArray(userPresences) && userPresences.length > 0;
    callback({
      isOnline,
      lastSeen: isOnline ? new Date() : null,
    });
  };

  presenceListeners.add(handler);
  handler(currentPresenceState);

  return () => {
    presenceListeners.delete(handler);
  };
}

export function listenToPresenceMap(userIds, callback) {
  if (!userIds || userIds.length === 0) return () => {};

  const handler = (state) => {
    const status = {};
    userIds.forEach((id) => {
      const presences = state[id];
      const isOnline = Array.isArray(presences) && presences.length > 0;
      status[id] = {
        isOnline,
        lastSeen: isOnline ? new Date() : null,
      };
    });
    callback(status);
  };

  presenceListeners.add(handler);
  handler(currentPresenceState);

  return () => {
    presenceListeners.delete(handler);
  };
}

