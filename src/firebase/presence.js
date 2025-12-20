import { database, db } from "./firebase";
import {
  ref,
  onValue,
  onDisconnect,
  serverTimestamp,
  update as rtdbUpdate,
} from "firebase/database";
import { doc, updateDoc } from "firebase/firestore";

// Keep presence in Realtime Database with server-managed onDisconnect,
// and mirror a minimal flag into Firestore for existing consumers.
export function setupPresence(userId) {
  if (!userId) return () => {};

  const statusRef = ref(database, `status/${userId}`);
  const connectedRef = ref(database, ".info/connected");

  const unsubscribe = onValue(connectedRef, async (snap) => {
    if (!snap.val()) return;

    try {
      // Ensure the server marks offline if the client disconnects abruptly.
      await onDisconnect(statusRef).update({
        state: "offline",
        lastSeen: serverTimestamp(),
      });

      await rtdbUpdate(statusRef, {
        state: "online",
        lastSeen: serverTimestamp(),
      });

      // Mirror to Firestore for code paths still reading user docs.
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        isOnline: true,
        lastSeen: new Date(),
      });
    } catch (err) {
      console.error("Presence setup error:", err);
    }
  });

  return async () => {
    try {
      await onDisconnect(statusRef).cancel();
      await rtdbUpdate(statusRef, {
        state: "offline",
        lastSeen: serverTimestamp(),
      });

      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        isOnline: false,
        lastSeen: new Date(),
      });
    } catch (err) {
      console.error("Presence cleanup error:", err);
    } finally {
      unsubscribe();
    }
  };
}

export function listenToPresence(userId, callback) {
  if (!userId) return () => {};
  const statusRef = ref(database, `status/${userId}`);
  return onValue(statusRef, (snap) => {
    const val = snap.val();
    const isOnline = val?.state === "online";
    const lastSeen = val?.lastSeen ? new Date(val.lastSeen) : null;
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
