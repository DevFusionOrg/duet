import React, { useEffect, useState } from "react";
import { supabase } from "../../supabase/supabase";
import { getUserProfile, sendFriendRequest, getUserFriends } from "../../firebase/firestore";

function UserProfilePane({ userId, currentUserId, onClose, onStartChat }) {
  const [profile, setProfile] = useState(null);
  const [friendCount, setFriendCount] = useState(0);
  const [isFriend, setIsFriend] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    if (!userId) return;
    let active = true;

    const load = async () => {
      try {
        const [profileData, friendIds, friendshipRes, sentReqRes] = await Promise.all([
          getUserProfile(userId),
          getUserFriends(userId),
          currentUserId
            ? supabase.from("friends").select("id").eq("user_id", currentUserId).eq("friend_id", userId).maybeSingle()
            : Promise.resolve({ data: null }),
          currentUserId
            ? supabase.from("friend_requests").select("id").eq("from_user_id", currentUserId).eq("to_user_id", userId).eq("status", "pending").maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        if (!active) return;
        setProfile(profileData || null);
        setFriendCount(friendIds?.length || 0);
        setIsFriend(!!friendshipRes?.data);
        setRequestSent(!!sentReqRes?.data);
      } catch (error) {
        if (!active) return;
        setProfile(null);
        setFriendCount(0);
        setIsFriend(false);
        setRequestSent(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [userId, currentUserId]);

  if (!profile) {
    return (
      <div className="desktop-profile-pane desktop-profile-loading">
        <p>Loading profile...</p>
      </div>
    );
  }

  const handleSendRequest = async () => {
    if (!currentUserId || !userId || requestSent || isFriend) return;
    try {
      setActionLoading(true);
      setActionMessage("");
      await sendFriendRequest(currentUserId, userId);
      setRequestSent(true);
      setActionMessage("Friend request sent!");
    } catch (error) {
      setActionMessage(error.message || "Failed to send friend request");
    } finally {
      setActionLoading(false);
    }
  };

  const isOwn = currentUserId === userId;

  return (
    <div className="desktop-profile-pane">
      <div className="desktop-profile-header">
        <h3>User Profile</h3>
        <button type="button" className="close-button" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="desktop-profile-card">
        <img
          src={profile.photoURL || "/default-avatar.png"}
          alt={profile.displayName || profile.username}
          className="desktop-profile-avatar"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/default-avatar.png";
          }}
        />

        <h4 className="desktop-profile-name">{profile.displayName || "User"}</h4>
        <p className="desktop-profile-username">@{profile.username || "username"}</p>

        {profile.bio && <p className="desktop-profile-bio">{profile.bio}</p>}

        <div className="desktop-profile-stats">
          <span>{friendCount} Friends</span>
        </div>

        {actionMessage && <p className="action-message">{actionMessage}</p>}

        <div className="desktop-profile-actions">
          {isOwn ? (
            <p className="desktop-profile-own-tag">This is you</p>
          ) : isFriend ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onStartChat && onStartChat({ ...profile, uid: userId, id: userId })}
            >
              Start Chat
            </button>
          ) : requestSent ? (
            <button type="button" className="btn btn-secondary" disabled>
              Request Pending
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSendRequest}
              disabled={actionLoading}
            >
              {actionLoading ? "Sending..." : "Add Friend"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserProfilePane;
