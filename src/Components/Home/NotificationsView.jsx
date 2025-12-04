import React, { useState, useEffect } from "react";
import { listenToUserProfile } from "../../firebase/firestore";
import FriendRequestItem from "./FriendRequestItem";

function NotificationsView({ user, onFriendRequestUpdate }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState({});
  const [processedRequests, setProcessedRequests] = useState(new Set());
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToUserProfile(user.uid, (userProfile) => {
      console.log("Notifications - Profile updated:", userProfile);
      setProfile(userProfile);
    });

    return unsubscribe;
  }, [user]);

  const handleAccept = async (requestFromId, requestIndex, requesterName) => {
    const requestKey = `${requestFromId}_${requestIndex}`;

    if (processedRequests.has(requestKey)) {
      return;
    }

    setLoading((prev) => ({ ...prev, [requestKey]: true }));
    setActionMessage("");

    try {
      const { acceptFriendRequest } = await import("../../firebase/firestore");
      await acceptFriendRequest(user.uid, requestFromId);

      setProcessedRequests((prev) => new Set(prev.add(requestKey)));
      setActionMessage(`✅ Accepted friend request from ${requesterName}`);

      console.log("Friend request accepted and marked as processed");

      if (onFriendRequestUpdate) {
        onFriendRequestUpdate();
      }

      setTimeout(() => setActionMessage(""), 3000);
    } catch (error) {
      console.error("Error accepting friend request:", error);
      setActionMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading((prev) => ({ ...prev, [requestKey]: false }));
    }
  };

  const handleReject = async (requestFromId, requestIndex, requesterName) => {
    const requestKey = `${requestFromId}_${requestIndex}`;

    if (processedRequests.has(requestKey)) {
      return;
    }

    setLoading((prev) => ({ ...prev, [requestKey]: true }));
    setActionMessage("");

    try {
      const { rejectFriendRequest } = await import("../../firebase/firestore");
      await rejectFriendRequest(user.uid, requestFromId);

      setProcessedRequests((prev) => new Set(prev.add(requestKey)));
      setActionMessage(`❌ Rejected friend request from ${requesterName}`);

      console.log("Friend request rejected and marked as processed");

      if (onFriendRequestUpdate) {
        onFriendRequestUpdate();
      }

      setTimeout(() => setActionMessage(""), 3000);
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      setActionMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading((prev) => ({ ...prev, [requestKey]: false }));
    }
  };

  if (!profile) {
    return (
      <div className="notifications-loading">Loading notifications...</div>
    );
  }

  const friendRequests = profile.friendRequests || [];
  const activeFriendRequests = friendRequests.filter((request, index) => {
    const requestKey = `${request.from}_${index}`;
    return !processedRequests.has(requestKey);
  });

  return (
    <div className="notifications-container">

      {actionMessage && (
        <div className={`action-message ${actionMessage.includes("✅") ? "action-message-success" : "action-message-error"}`}>
          {actionMessage}
        </div>
      )}

      {activeFriendRequests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No Pending Requests</h3>
          <p>You're all caught up!</p>
        </div>
      ) : (
        <div className="friend-requests-list">
          <h3 className="notifications-section-title">
            Friend Requests
            <span className="notifications-badge">
              {activeFriendRequests.length}
            </span>
          </h3>
          {activeFriendRequests.map((request, index) => (
            <FriendRequestItem
              key={`${request.from}_${index}`}
              request={request}
              index={index}
              onAccept={handleAccept}
              onReject={handleReject}
              loading={loading[`${request.from}_${index}`] || false}
              isProcessed={processedRequests.has(`${request.from}_${index}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default NotificationsView;