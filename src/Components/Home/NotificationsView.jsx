import React, { useState, useEffect } from "react";
import { loadFriendRequests } from "../../firebase/firestore";
import FriendRequestItem from "./FriendRequestItem";

function NotificationsView({ user, onFriendRequestUpdate }) {
  const [requests, setRequests] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState({});
  const [loadingPage, setLoadingPage] = useState(false);
  const [processedRequests, setProcessedRequests] = useState(new Set());
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetchInitial = async () => {
      setLoadingPage(true);
      setProcessedRequests(new Set());
      try {
        const { requests: page, hasMore, nextCursor } = await loadFriendRequests(user.uid, 20, null);
        setRequests(page);
        setHasMore(hasMore);
        setNextCursor(nextCursor || null);
      } catch (err) {
        console.error("Error loading friend requests:", err);
      } finally {
        setLoadingPage(false);
      }
    };
    fetchInitial();
  }, [user]);

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

  const handleReject = async (requestFromId, requestIndex, requesterName, requestTimestamp) => {
    const requestKey = `${requestFromId}_${requestTimestamp}`;

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

  const activeFriendRequests = requests.filter((request) => {
    const ts = request.timestamp?.toDate ? request.timestamp.toDate().getTime() : new Date(request.timestamp).getTime();
    const requestKey = `${request.from}_${ts}`;
    return !processedRequests.has(requestKey);
  });

  return (
    <div className="notifications-container">
      <h1 className="SearchHeading">Alerts</h1>
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
}

export default NotificationsView;