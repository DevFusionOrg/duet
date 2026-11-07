// Presence Bridge: Powered by Supabase Realtime Presence
// Replaces Firebase RTDB onDisconnect with zero database writes and 24/7 reliability

export {
  setupPresence,
  listenToPresence,
  listenToPresenceMap,
} from "../supabase/presence";
