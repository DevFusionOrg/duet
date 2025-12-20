import { database, db } from "./firebase";
import {
  ref,
  onValue,
  onDisconnect,
  serverTimestamp,
  update,
} from "firebase/database";
import { doc, updateDoc } from "firebase/firestore";

// Generate a session id so multiple devices/tabs for the same user can report presence independently.
const newSessionId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function computeAggregate(sessionsSnap) {
  const sessions = sessionsSnap?.val() || {};
  let isOnline = false;
  let lastSeen = null;

  Object.values(sessions).forEach((session) => {
    if (session?.state === "online") {
      isOnline = true;
    }
    const ts = session?.lastSeen;
    if (ts && (!lastSeen || ts > lastSeen)) {
      lastSeen = ts;
    }
  });

  return {
    isOnline,
    lastSeen: lastSeen ? new Date(lastSeen) : null,
  };
}

// Per-session presence with RTDB onDisconnect safety; mirrors aggregate to Firestore for legacy reads.
export function setupPresence(userId) {
  if (!userId) return () => {};

  const sessionId = newSessionId();
  const sessionRef = ref(database, `status/${userId}/sessions/${sessionId}`);
  const connectedRef = ref(database, ".info/connected");

  const idleMs = 3 * 60 * 1000; // 3 minutes
  let idleTimeout = null;
  let lastMirrorWrite = 0;
  let lastOnlineState = null;

  const mirrorToFirestore = async (isOnline) => {
    const now = Date.now();
    // Only mirror when state changes or at most once per minute
    if (lastOnlineState !== isOnline || (now - lastMirrorWrite) > 60_000) {
      try {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
          isOnline,
          lastSeen: new Date(),
        });
        lastMirrorWrite = now;
        lastOnlineState = isOnline;
      } catch (err) {
        console.error("Presence mirror error:", err);
      }
    }
  };

  const clearIdleTimer = () => {
    if (idleTimeout) {
      clearTimeout(idleTimeout);
      idleTimeout = null;
    }
  };

  const scheduleIdle = () => {
    clearIdleTimer();
    idleTimeout = setTimeout(async () => {
      try {
        await update(sessionRef, {
          state: "offline",
          lastSeen: serverTimestamp(),
          idle: true,
        });
        await mirrorToFirestore(false);
      } catch (err) {
        console.error("Presence inactivity timeout error:", err);
      }
    }, idleMs);
  };

  const markActive = async () => {
    try {
      await update(sessionRef, {
        state: "online",
        lastSeen: serverTimestamp(),
        idle: false,
      });
      await mirrorToFirestore(true);
    } catch (err) {
      console.error("Presence activity update error:", err);
    } finally {
      scheduleIdle();
    }
  };

  const activityEvents = ["click", "keydown", "mousemove", "touchstart", "visibilitychange"];
  const bindActivityListeners = () => {
    if (typeof window === "undefined") return;
    activityEvents.forEach((ev) => {
      window.addEventListener(ev, markActive, { passive: true });
    });
  };

  const unbindActivityListeners = () => {
    if (typeof window === "undefined") return;
    activityEvents.forEach((ev) => {
      window.removeEventListener(ev, markActive);
    });
  };

  const unsubscribe = onValue(connectedRef, async (snap) => {
    if (!snap.val()) return;

    try {
      await onDisconnect(sessionRef).update({
        state: "offline",
        lastSeen: serverTimestamp(),
      });

      await update(sessionRef, {
        state: "online",
        lastSeen: serverTimestamp(),
        idle: false,
      });
      // Mirror aggregate into Firestore for any remaining consumers, throttled.
      await mirrorToFirestore(true);

      bindActivityListeners();
      scheduleIdle();
    } catch (err) {
      console.error("Presence setup error:", err);
    }
  });

  return async () => {
    try {
      await onDisconnect(sessionRef).cancel();
      await update(sessionRef, {
        state: "offline",
        lastSeen: serverTimestamp(),
        idle: true,
      });
      await mirrorToFirestore(false);
    } catch (err) {
      console.error("Presence cleanup error:", err);
    } finally {
      unsubscribe();
      unbindActivityListeners();
      clearIdleTimer();
    }
  };
}

export function listenToPresence(userId, callback) {
  if (!userId) return () => {};
  const sessionsRef = ref(database, `status/${userId}/sessions`);
  return onValue(sessionsRef, (snap) => {
    const { isOnline, lastSeen } = computeAggregate(snap);
    callback({ isOnline, lastSeen });
  });
}

export function listenToPresenceMap(userIds, callback) {
  if (!userIds || userIds.length === 0) return () => {};

  const unsubscribers = [];
  const status = {};
  const loaded = new Set();

  userIds.forEach((id) => {
    const unsub = listenToPresence(id, ({ isOnline, lastSeen }) => {
      status[id] = { isOnline, lastSeen };
      loaded.add(id);
      if (loaded.size === userIds.length) {
        callback({ ...status });
      }
    });
    unsubscribers.push(unsub);
  });

  return () => unsubscribers.forEach((u) => u());
}
