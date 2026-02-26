import React, { useState, useEffect } from "react";
import { loadFriendRequests } from "../../firebase/firestore";
import FriendRequestItem from "./FriendRequestItem";
import "../../styles/NotificationsModal.css";

function NotificationsModal({ isOpen, onClose, user, onFriendRequestUpdate, asPage = false }) {
  const [requests, setRequests] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState({});
  const [loadingPage, setLoadingPage] = useState(false);
  const [processedRequests, setProcessedRequests] = useState(new Set());
  const [actionMessage, setActionMessage] = useState("");
  const [sentRequests, setSentRequests] = useState([]);

  useEffect(() => {
    if (!isOpen || !user) return;
    const fetchInitial = async () => {
      setLoadingPage(true);
      setProcessedRequests(new Set());
      try {
        const { requests: page, hasMore, nextCursor } = await loadFriendRequests(user.uid, 20, null);
        setRequests(page);
        setHasMore(hasMore);
        setNextCursor(nextCursor || null);

        const { db } = await import("../../firebase/firebase");
        const { collection, getDocs, query, orderBy } = await import("firebase/firestore");
        const { getUserFriendsWithProfiles } = await import("../../firebase/firestore");

        let sent = [];
        try {
          const sentRef = collection(db, "users", user.uid, "sentFriendRequests");
          const sentSnap = await getDocs(query(sentRef, orderBy("timestamp", "desc")));
          sent = sentSnap.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
            .filter((item) => (item.status || "pending") === "pending" && item.to);
        } catch (err) {
          console.warn("Failed to load sent friend requests:", err);
        }

        if (sent.length > 0) {
          const targetIds = sent.map((item) => item.to);
          const profiles = await getUserFriendsWithProfiles(targetIds);
          const profileMap = new Map(profiles.map((profile) => [profile.uid || profile.id, profile]));
          const withProfiles = sent
            .map((item) => {
              const profile = profileMap.get(item.to) || {};
              return {
                ...item,
                uid: item.to,
                displayName: profile.displayName || "User",
                username: profile.username || "user",
                photoURL: profile.photoURL || null,
              };
            })
            .sort((a, b) => {
              const ta = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp || 0).getTime();
              const tb = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp || 0).getTime();
              return tb - ta;
            });
          setSentRequests(withProfiles);
        } else {
          setSentRequests([]);
        }
      } catch (err) {
        console.error("Error loading friend requests:", err);
      } finally {
        setLoadingPage(false);
      }
    };
    fetchInitial();
  }, [user, isOpen]);

  const handleLoadMore = async () => {
    if (!hasMore || loadingPage) return;
    setLoadingPage(true);
    try {
      const { requests: page, hasMore: more, nextCursor: cursor } = await loadFriendRequests(user.uid, 20, nextCursor);
      setRequests(prev => [...prev, ...page]);
      setHasMore(more);
      setNextCursor(cursor || null);
    } catch (err) {
      console.error("Error loading more requests:", err);
    } finally {
      setLoadingPage(false);
    }
  };

  const handleAccept = async (requestFromId, requestIndex, requesterName, requestTimestamp) => {
    const requestKey = `${requestFromId}_${requestTimestamp}`;
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

  const handleReject = async (requestFromId, requestIndex, requesterName, requestTimestamp) => {
    const requestKey = `${requestFromId}_${requestTimestamp}`;
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

  const handleCancelSent = async (toUserId, toUserName) => {
    const requestKey = `sent_${toUserId}`;
    setLoading((prev) => ({ ...prev, [requestKey]: true }));
    setActionMessage("");

    try {
      const { db } = await import("../../firebase/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");

      await Promise.all([
        deleteDoc(doc(db, 'users', toUserId, 'friendRequests', user.uid)).catch(() => {}),
        deleteDoc(doc(db, 'users', user.uid, 'sentFriendRequests', toUserId)).catch(() => {}),
      ]);

      setSentRequests((prev) => prev.filter((item) => item.uid !== toUserId));
      setActionMessage(`✅ Cancelled request to ${toUserName}`);
      if (onFriendRequestUpdate) onFriendRequestUpdate();
      setTimeout(() => setActionMessage(""), 3000);
    } catch (error) {
      setActionMessage(`❌ Error: ${error?.message || 'Failed to cancel request'}`);
    } finally {
      setLoading((prev) => ({ ...prev, [requestKey]: false }));
    }
  };

  if (!isOpen) return null;

  const activeFriendRequests = requests.filter((request) => {
    const ts = request.timestamp?.toDate ? request.timestamp.toDate().getTime() : new Date(request.timestamp).getTime();
    const requestKey = `${request.from}_${ts}`;
    return !processedRequests.has(requestKey);
  });

  const formatRequestTime = (timestamp) => {
    const dt = timestamp?.toDate ? timestamp.toDate() : (timestamp ? new Date(timestamp) : null);
    if (!dt || Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const content = (
    <div className={`notifications-modal-content ${asPage ? 'notifications-page-content' : ''}`} onClick={(e) => !asPage && e.stopPropagation()}>
      {!asPage && <button className="notifications-modal-close" onClick={onClose} aria-label="Close">×</button>}
        <div className="notifications-modal-header">
          <h1 className="SearchHeading">Alerts</h1>
          {activeFriendRequests.length > 0 }
        </div>
        
        {actionMessage && (
          <div className={`action-message ${actionMessage.includes("✅") ? "action-message-success" : "action-message-error"}`}>
            {actionMessage}
          </div>
        )}

        {activeFriendRequests.length === 0 && sentRequests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No Pending Requests</h3>
            <p>You're all caught up!</p>
          </div>
        ) : (
          <div className="friend-requests-list">
            <h3 className="notifications-section-title">
              Received Requests
              <span className="notifications-badge">{activeFriendRequests.length}</span>
            </h3>
            {activeFriendRequests.map((request, index) => (
              <FriendRequestItem
                key={`${request.from}_${request.timestamp}`}
                request={request}
                index={index}
                onAccept={(fromId, idx, name) => {
                  const ts = request.timestamp?.toDate ? request.timestamp.toDate().getTime() : new Date(request.timestamp).getTime();
                  return handleAccept(fromId, idx, name, ts);
                }}
                onReject={(fromId, idx, name) => {
                  const ts = request.timestamp?.toDate ? request.timestamp.toDate().getTime() : new Date(request.timestamp).getTime();
                  return handleReject(fromId, idx, name, ts);
                }}
                loading={(() => {
                  const ts = request.timestamp?.toDate ? request.timestamp.toDate().getTime() : new Date(request.timestamp).getTime();
                  return loading[`${request.from}_${ts}`] || false;
                })()}
                isProcessed={(() => {
                  const ts = request.timestamp?.toDate ? request.timestamp.toDate().getTime() : new Date(request.timestamp).getTime();
                  return processedRequests.has(`${request.from}_${ts}`);
                })()}
              />
            ))}

            {sentRequests.length > 0 && (
              <>
                <h3 className="notifications-section-title sent-title">
                  Sent Requests (Pending)
                  <span className="notifications-badge">{sentRequests.length}</span>
                </h3>
                <div className="sent-requests-list">
                  {sentRequests.map((request) => (
                    <div key={`sent_${request.uid}_${request.id}`} className="friend-request-item sent-request-item">
                      <div className="request-user-info">
                        <img
                          src={request.photoURL || '/default-avatar.png'}
                          alt={request.displayName}
                          className="request-avatar"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = '/default-avatar.png';
                          }}
                        />
                        <div className="request-details">
                          <h4>{request.displayName}</h4>
                          <p className="request-username">@{request.username}</p>
                          <p className="request-time">Sent {formatRequestTime(request.timestamp)}</p>
                        </div>
                      </div>
                      <div className="sent-request-actions">
                        <span className="request-status-pill">Pending</span>
                        <button
                          className="cancel-sent-request-btn"
                          onClick={() => handleCancelSent(request.uid, request.displayName)}
                          disabled={!!loading[`sent_${request.uid}`]}
                          aria-label="Cancel sent request"
                          title="Cancel sent request"
                        >
                          {loading[`sent_${request.uid}`] ? '…' : '✕'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {hasMore && (
              <div className="load-more-container">
                <button className="load-more-button" onClick={handleLoadMore} disabled={loadingPage}>
                  {loadingPage ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
  );

  if (asPage) {
    return <div className="notifications-page-wrapper">{content}</div>;
  }

  return (
    <div className="notifications-modal-overlay" onClick={onClose}>
      {content}
    </div>
  );
}

export default NotificationsModal;
