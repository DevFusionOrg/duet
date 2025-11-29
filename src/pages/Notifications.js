import React, { useState, useEffect } from "react";
import {
  listenToUserProfile,
  acceptFriendRequest,
  rejectFriendRequest,
  getUserProfile,
} from "../firebase/firestore";
import "../styles/Notifications.css"; // Import the CSS file

function Notifications({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState({});
  const [processedRequests, setProcessedRequests] = useState(new Set());
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    if (user) {
      const unsubscribe = listenToUserProfile(user.uid, (userProfile) => {
        console.log("Notifications - Profile updated:", userProfile);
        setProfile(userProfile);
      });
      return unsubscribe;
    }
  }, [user]);

  const handleAccept = async (requestFromId, requestIndex, requesterName) => {
    const requestKey = `${requestFromId}_${requestIndex}`;

    // Don't process if already handled
    if (processedRequests.has(requestKey)) {
      return;
    }

    setLoading((prev) => ({ ...prev, [requestKey]: true }));
    setActionMessage("");

    try {
      await acceptFriendRequest(user.uid, requestFromId);

      // Mark this request as processed
      setProcessedRequests((prev) => new Set(prev.add(requestKey)));
      setActionMessage(`✅ Accepted friend request from ${requesterName}`);

      console.log("Friend request accepted and marked as processed");

      // Clear message after 3 seconds
      setTimeout(() => setActionMessage(""), 3000);
    } catch (error) {
      console.error("Error accepting friend request:", error);
      setActionMessage(`❌ Error: ${error.message}`);
    }

    setLoading((prev) => ({ ...prev, [requestKey]: false }));
  };

  const handleReject = async (requestFromId, requestIndex, requesterName) => {
    const requestKey = `${requestFromId}_${requestIndex}`;

    // Don't process if already handled
    if (processedRequests.has(requestKey)) {
      return;
    }

    setLoading((prev) => ({ ...prev, [requestKey]: true }));
    setActionMessage("");

    try {
      await rejectFriendRequest(user.uid, requestFromId);

      // Mark this request as processed
      setProcessedRequests((prev) => new Set(prev.add(requestKey)));
      setActionMessage(`❌ Rejected friend request from ${requesterName}`);

      console.log("Friend request rejected and marked as processed");

      // Clear message after 3 seconds
      setTimeout(() => setActionMessage(""), 3000);
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      setActionMessage(`❌ Error: ${error.message}`);
    }

    setLoading((prev) => ({ ...prev, [requestKey]: false }));
  };

  if (!profile) {
    return (
      <div className="notifications-loading">Loading notifications...</div>
    );
  }

  const friendRequests = profile.friendRequests || [];

  // Filter out processed requests
  const activeFriendRequests = friendRequests.filter((request, index) => {
    const requestKey = `${request.from}_${index}`;
    return !processedRequests.has(requestKey);
  });

  return (
    <div className="notifications-container">
      <h2 className="notifications-title">Notifications</h2>

      {actionMessage && (
        <div
          className={`notifications-message ${
            actionMessage.includes("✅")
              ? "notifications-message-success"
              : "notifications-message-error"
          }`}
        >
          {actionMessage}
        </div>
      )}

      {activeFriendRequests.length === 0 ? (
        <div className="notifications-empty">
          <div className="notifications-empty-illustration">📭</div>
          <p>No new notifications</p>
          <p className="notifications-empty-subtext">
            You're all caught up! New friend requests will appear here.
          </p>
        </div>
      ) : (
        <div className="notifications-section">
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

// Enhanced FriendRequestItem component
function FriendRequestItem({
  request,
  index,
  onAccept,
  onReject,
  loading,
  isProcessed,
}) {
  const [requesterProfile, setRequesterProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const fetchRequesterProfile = async () => {
      try {
        const profile = await getUserProfile(request.from);
        setRequesterProfile(profile);
      } catch (error) {
        console.error("Error fetching requester profile:", error);
      } finally {
        setProfileLoading(false);
      }
    };
    fetchRequesterProfile();
  }, [request.from]);

  if (isProcessed) {
    return null; // Don't render processed requests
  }

  if (profileLoading) {
    return (
      <div className="notifications-request-loading">
        Loading user information...
      </div>
    );
  }

  const requesterName = requesterProfile?.displayName || "Unknown User";

  return (
    <div
      className={`notifications-request-item ${
        loading ? "notifications-request-item-loading" : ""
      }`}
    >
      <div className="notifications-request-content">
        {requesterProfile ? (
          <>
            <img
              src={requesterProfile.photoURL}
              alt={requesterProfile.displayName}
              className="notifications-request-avatar"
            />
            <div className="notifications-request-info">
              <h4 className="notifications-request-name">
                {requesterProfile.displayName}
              </h4>
              <p className="notifications-request-username">
                @{requesterProfile.username}
              </p>
              {requesterProfile.bio && (
                <p className="notifications-request-bio">
                  {requesterProfile.bio}
                </p>
              )}
              <p className="notifications-request-time">
                {request.timestamp?.toDate?.()?.toLocaleString() || "Recently"}
              </p>
            </div>
          </>
        ) : (
          <div className="notifications-request-info">
            <p className="notifications-request-name">User not found</p>
            <p className="notifications-request-time">
              User ID: {request.from}
            </p>
          </div>
        )}
      </div>
      <div className="notifications-request-actions">
        <button
          onClick={() => onAccept(request.from, index, requesterName)}
          disabled={loading}
          className="notifications-button notifications-button-accept"
        >
          {loading ? "..." : "Accept"}
        </button>
        <button
          onClick={() => onReject(request.from, index, requesterName)}
          disabled={loading}
          className="notifications-button notifications-button-reject"
        >
          {loading ? "..." : "Reject"}
        </button>
      </div>
    </div>
  );
}

export default Notifications;
