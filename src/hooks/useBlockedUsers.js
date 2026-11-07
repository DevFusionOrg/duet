import { useState, useEffect } from "react";
import { getBlockedUsers, unblockUser } from "../firebase/firestore";
import { supabase } from "../supabase/supabase";

export function useBlockedUsers(userId) {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [loadingBlockedUsers, setLoadingBlockedUsers] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchBlocked = async () => {
      try {
        const ids = await getBlockedUsers(userId);
        setBlockedUsers(ids);
      } catch (e) {
        console.error("Error loading blocked users:", e);
      } finally {
        setLoadingBlockedUsers(false);
      }
    };

    fetchBlocked();

    const channel = supabase
      .channel(`blocked_users:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "blocked_users",
          filter: `user_id=eq.${userId}`,
        },
        () => fetchBlocked()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleUnblockUser = async (blockedUserId, onSuccess) => {
    if (!blockedUserId || typeof blockedUserId !== "string") {
      throw new Error("Invalid blocked user");
    }

    await unblockUser(userId, blockedUserId);
    setBlockedUsers((prev) => prev.filter((id) => id !== blockedUserId));
    if (onSuccess) onSuccess();
  };

  return {
    blockedUsers,
    showBlockedUsers,
    setShowBlockedUsers,
    loadingBlockedUsers,
    handleUnblockUser,
  };
}
