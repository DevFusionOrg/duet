import React, { useEffect, useState } from "react";
import { collection, doc, getCountFromServer, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { getUserProfile, sendFriendRequest } from "../../firebase/firestore";

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
        const [profileData, friendsCountSnap, friendshipSnap, sentRequestSnap] = await Promise.all([
          getUserProfile(userId),
          getCountFromServer(collection(db, "users", userId, "friends")),
          currentUserId ? getDoc(doc(db, "users", currentUserId, "friends", userId)) : Promise.resolve({ exists: () => false }),
          currentUserId ? getDoc(doc(db, "users", currentUserId, "sentFriendRequests", userId)) : Promise.resolve({ exists: () => false, data: () => ({}) }),
        ]);
        if (!active) return;
        setProfile(profileData || null);
        setFriendCount(friendsCountSnap?.data()?.count || 0);
        setIsFriend(!!friendshipSnap?.exists?.());
        setRequestSent(!!sentRequestSnap?.exists?.() && (sentRequestSnap?.data?.()?.status || "pending") === "pending");
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

  const profileName = profile.displayName || profile.username || "User";
  const profileUsername = profile.username || "user";
  const isSelf = currentUserId && (profile.uid === currentUserId || userId === currentUserId);

  const handleAddFriend = async () => {
    if (!currentUserId || !userId || isSelf || isFriend || requestSent) return;
    setActionLoading(true);
    setActionMessage("");
    try {
      await sendFriendRequest(currentUserId, userId);
      setRequestSent(true);
      setActionMessage("Friend request sent");
    } catch (error) {
      setActionMessage(error?.message || "Unable to send request");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="desktop-profile-pane">
      <div className="desktop-profile-pane-header">
        <h2>Profile</h2>
        <button type="button" className="desktop-profile-close" onClick={onClose}>✕</button>
      </div>

      <div className="desktop-profile-pane-body">
        <div className="desktop-profile-summary">
          <div className="desktop-profile-summary-left">
            <img
              src={profile.photoURL || "/default-avatar.png"}
              alt={profileName}
              className="desktop-profile-avatar"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/default-avatar.png";
              }}
            />
          </div>
          <div className="desktop-profile-summary-right">
            <div className="desktop-profile-stat-card">
              <div className="desktop-profile-stat-number">{friendCount}</div>
              <div className="desktop-profile-stat-label">Friends</div>
            </div>
          </div>
        </div>

        <div className="desktop-profile-display">
          <div className="desktop-profile-field">
            <div className="desktop-profile-field-label">Username</div>
            <div className="desktop-profile-field-value">@{profileUsername}</div>
          </div>

          <div className="desktop-profile-field">
            <div className="desktop-profile-field-label">Name</div>
            <div className="desktop-profile-field-value">{profileName}</div>
          </div>

          {profile.bio && (
            <div className="desktop-profile-field">
              <div className="desktop-profile-field-label">Bio</div>
              <div className="desktop-profile-bio">{profile.bio}</div>
            </div>
          )}
        </div>

        {!isSelf && (
          <div className="desktop-profile-actions">
            <button
              type="button"
              className={`desktop-profile-friend-btn ${isFriend ? 'friends' : ''}`}
              onClick={handleAddFriend}
              disabled={isFriend || requestSent || actionLoading}
            >
              {isFriend ? '✓ Friends' : requestSent ? 'Request Sent' : actionLoading ? 'Sending...' : 'Add Friend'}
            </button>
            <button
              type="button"
              className="desktop-profile-chat-btn"
              onClick={() => onStartChat({ ...profile, uid: userId, id: userId })}
              disabled={!isFriend}
              title={!isFriend ? 'Add as friend first to start messaging' : 'Open chat'}
            >
              {isFriend ? 'Message' : 'Friends only'}
            </button>
          </div>
        )}
        {!!actionMessage && <p className="desktop-profile-action-message">{actionMessage}</p>}
      </div>
    </div>
  );
}

export default UserProfilePane;
