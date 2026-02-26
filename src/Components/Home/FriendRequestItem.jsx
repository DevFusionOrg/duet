import React, { useState, useEffect } from "react";

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
        const { getUserProfile } = await import("../../firebase/firestore");
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
    return null;
  }

  if (profileLoading) {
    return (
      <div className="notifications-request-loading">
        Loading user information...
      </div>
    );
  }

  const requesterName = requesterProfile?.displayName || "Unknown User";
  const requestTime = request?.timestamp?.toDate
    ? request.timestamp.toDate()
    : (request?.timestamp ? new Date(request.timestamp) : null);

  return (
    <div className={`friend-request-item ${loading ? "friend-request-item-loading" : ""}`}>
      <div className="request-user-info">
        {requesterProfile ? (
          <>
            <img
              src={requesterProfile.photoURL || '/default-avatar.png'}
              alt={requesterProfile.displayName}
              className="request-avatar"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/default-avatar.png";
              }}
            />
            <div className="request-details">
              <h4>{requesterProfile.displayName}</h4>
              <p className="request-username">@{requesterProfile.username}</p>
              {requestTime && (
                <p className="request-time">Requested {requestTime.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              )}
            </div>
          </>
        ) : (
          <div className="request-details">
            <p className="request-name">User not found</p>
            <p className="request-time">
              User ID: {request.from}
            </p>
          </div>
        )}
      </div>
      <div className="request-actions">
        <button
          onClick={() => onAccept(request.from, index, requesterName)}
          disabled={loading}
          className="accept-btn"
          title="Accept"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
        <button
          onClick={() => onReject(request.from, index, requesterName)}
          disabled={loading}
          className="reject-btn"
          title="Reject"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

    </div>
  );
}

export default FriendRequestItem;