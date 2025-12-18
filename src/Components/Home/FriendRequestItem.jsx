import React, { useState, useEffect } from "react";
import UserBadge from "../UserBadge";

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
  const [showBadgeTooltip, setShowBadgeTooltip] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const handleBadgeClick = (e, badgeName) => {
    e.stopPropagation();
    const badgeNames = { 
      developer: 'Developer', 
      support: 'Supporter', 
      tester: 'Tester' 
    };
    setShowBadgeTooltip(badgeNames[badgeName] || badgeName);
    
    // Position tooltip above the badge
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
    
    // Auto-hide tooltip after 3 seconds
    setTimeout(() => setShowBadgeTooltip(null), 3000);
  };

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
              <h4 className="badge-with-name">
                {requesterProfile.displayName}
                {(() => { 
                  const displayBadge = requesterProfile.badge || (requesterProfile.username === 'ashwinirai492' ? 'tester' : null); 
                  if (!displayBadge) return null;
                  const badgeNames = { developer: 'Developer', support: 'Supporter', tester: 'Tester' };
                  return (
                    <span 
                      className="badge-tooltip-wrapper"
                      title={badgeNames[displayBadge] || displayBadge}
                      onClick={(e) => handleBadgeClick(e, displayBadge)}
                      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <UserBadge badge={displayBadge} size="small" />
                    </span>
                  );
                })()}
              </h4>
              <p className="request-username">@{requesterProfile.username}</p>
              {requesterProfile.bio && (
                <p className="request-bio">
                  {requesterProfile.bio}
                </p>
              )}
              <p className="request-time">
                {request.timestamp?.toDate?.()?.toLocaleString() || "Recently"}
              </p>
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
        >
          {loading ? "..." : "Accept"}
        </button>
        <button
          onClick={() => onReject(request.from, index, requesterName)}
          disabled={loading}
          className="reject-btn"
        >
          {loading ? "..." : "Reject"}
        </button>
      </div>

      {showBadgeTooltip && (
        <div 
          className="badge-tooltip" 
          style={{
            position: 'fixed',
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none'
          }}
        >
          {showBadgeTooltip}
        </div>
      )}
    </div>
  );
}

export default FriendRequestItem;