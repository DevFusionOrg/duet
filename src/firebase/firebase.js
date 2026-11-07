// Firebase compatibility shim - Duet has migrated to Supabase
import { supabase } from "../supabase/supabase";

export const auth = {
  get currentUser() {
    return null;
  },
  onAuthStateChanged: (cb) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
        ? {
            uid: session.user.id,
            id: session.user.id,
            email: session.user.email,
            displayName:
              session.user.user_metadata?.full_name ||
              session.user.email?.split("@")[0] ||
              "User",
            photoURL: session.user.user_metadata?.avatar_url || "",
          }
        : null;
      cb(u);
    });
    return () => subscription?.unsubscribe();
  },
  signOut: () => supabase.auth.signOut(),
};

export const googleProvider = {};
export const db = {};
export const database = {};
export const messaging = null;
export const requestNotificationPermission = async () => null;
export const onMessageListener = () => Promise.resolve(null);

const firebaseExport = { auth, googleProvider, db, database, messaging };
export default firebaseExport;
