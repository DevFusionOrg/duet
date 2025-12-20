import React, { useState, useEffect } from "react";
import { listenToUserProfile } from "../../firebase/firestore";
import FriendRequestItem from "./FriendRequestItem";
import "../../styles/NotificationsModal.css";

function NotificationsModal({ isOpen, onClose, user, onFriendRequestUpdate }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState({});
  const [processedRequests, setProcessedRequests] = useState(new Set());
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    if (!isOpen || !user) return;

    const unsubscribe = listenToUserProfile(user.uid, (userProfile) => {
      setProfile(userProfile);
    });

    return unsubscribe;
  }, [user, isOpen]);

  const handleAccept = async (requestFromId, requestIndex, requesterName) => {
    const requestKey = `${requestFromId}_${requestIndex}`;
    if (processedRequests.has(requestKey)) return;

    setLoading((prev) => ({ ...prev, [requestKey]: true }));
    setActionMessage("");

    try {
      const { acceptFriendRequest } = await import("../../firebase/firestore");
      await acceptFriendRequest(user.uid, requestFromId);

      setProcessedRequests((prev) => new Set(prev.add(requestKey)));
      setActionMessage(`✅ Accepted friend request from ${requesterName}`);

      if (onFriendRequestUpdate) onFriendRequestUpdate();
      setTimeout(() => setActionMessage(""), 3000);
    } catch (error) {
      setActionMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading((prev) => ({ ...prev, [requestKey]: false }));
    }
  };

  const handleReject = async (requestFromId, requestIndex, requesterName) => {
    const requestKey = `${requestFromId}_${requestIndex}`;
    if (processedRequests.has(requestKey)) return;

    setLoading((prev) => ({ ...prev, [requestKey]: true }));
    setActionMessage("");

    try {
      const { rejectFriendRequest } = await import("../../firebase/firestore");
      await rejectFriendRequest(user.uid, requestFromId);

      setProcessedRequests((prev) => new Set(prev.add(requestKey)));
      setActionMessage(`❌ Rejected friend request from ${requesterName}`);

      if (onFriendRequestUpdate) onFriendRequestUpdate();
      setTimeout(() => setActionMessage(""), 3000);
    } catch (error) {
      setActionMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading((prev) => ({ ...prev, [requestKey]: false }));
    }
  };

  if (!isOpen) return null;

  const friendRequests = profile?.friendRequests || [];
  const activeFriendRequests = friendRequests.filter((request, index) => {
    const requestKey = `${request.from}_${index}`;
    return !processedRequests.has(requestKey);
  });

  return (
    <div className="notifications-modal-overlay" onClick={onClose}>
      <div className="notifications-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="notifications-modal-close" onClick={onClose} aria-label="Close">×</button>
        <div className="notifications-modal-header">
          <h2>Alerts</h2>
          {activeFriendRequests.length > 0 }
        </div>

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
              <span className="notifications-badge">{activeFriendRequests.length}</span>
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
    </div>
  );
}

export default NotificationsModal;
