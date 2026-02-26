import React, { useState, useEffect, useRef } from "react";
import UserBadge from "../UserBadge";
import Spinner from "../Spinner";
import SuggestedFriends from "./SuggestedFriends";
import { useFriends } from "../../hooks/useFriends";
import DevFusionModal from "./DevFusionModal";

function SearchView({ user }) {
  const [showDevFusion, setShowDevFusion] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState({});
  const [message, setMessage] = useState("");
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [pendingError, setPendingError] = useState("");
  const hasFetchedPending = useRef(false);
  const searchTimeoutRef = useRef(null);

  const { friends } = useFriends(user);

  useEffect(() => {
    if (!hasFetchedPending.current && user?.uid) {
      hasFetchedPending.current = true;
      fetchPendingRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Auto-search as user types with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchTerm.trim()) {
      setSearchResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const { searchUsers } = await import("../../firebase/firestore");
        const results = await searchUsers(searchTerm);
        const filteredResults = results.filter(
          (result) => result.uid !== user.uid,
        );
        setSearchResults(filteredResults);
      } catch (error) {
        console.error("Error searching users:", error);
        setMessage("Error searching users: " + error.message);
      }
      setLoading(false);
    }, 500); // 500ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, user?.uid]);

  const fetchPendingRequests = async () => {
    try {
      setLoadingPending(true);
      setPendingError("");
      const { db } = await import("../../firebase/firebase");
      const { collection, getDocs, query, orderBy, doc, getDoc } = await import("firebase/firestore");
      const { getUserFriendsWithProfiles } = await import("../../firebase/firestore");

      let sentRequests = [];
      try {
        const sentRef = collection(db, "users", user.uid, "sentFriendRequests");
        const sentSnap = await getDocs(query(sentRef, orderBy("timestamp", "desc")));
        sentRequests = sentSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
      } catch (err) {
        console.warn("Sent requests subcollection read failed, falling back to user doc:", err);
      }

      if (sentRequests.length === 0) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const sentArray = userSnap.exists() ? (userSnap.data().sentFriendRequests || []) : [];
        sentRequests = sentArray.map((req) => ({
          id: req.to,
          ...req,
        }));
      }

      const pendingOnly = sentRequests.filter(
        (req) => (req.status || "pending") === "pending" && req.to
      );
      const targetIds = pendingOnly.map((req) => req.to);
      const profiles = await getUserFriendsWithProfiles(targetIds);
      const profileMap = new Map(profiles.map((profile) => [profile.uid || profile.id, profile]));

      const pending = pendingOnly.map((req) => {
        const profile = profileMap.get(req.to) || {};
        return {
          uid: req.to,
          displayName: profile.displayName || "User",
          username: profile.username || "user",
          photoURL: profile.photoURL,
          bio: profile.bio,
          badge: profile.badge,
          status: req.status || "pending",
          timestamp: req.timestamp || null,
        };
      });

      setPendingRequests(pending);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      setPendingError(error?.message || "Failed to load pending requests.");
    } finally {
      setLoadingPending(false);
    }
  };

  const handleCancelRequest = async (toUserId, toUserName) => {
    setRequestLoading((prev) => ({ ...prev, [toUserId]: true }));
    
    try {
      const { db } = await import("../../firebase/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");

      await Promise.all([
        deleteDoc(doc(db, 'users', toUserId, 'friendRequests', user.uid)).catch(() => {}),
        deleteDoc(doc(db, 'users', user.uid, 'sentFriendRequests', toUserId)).catch(() => {}),
      ]);

      setPendingRequests(prev => prev.filter(r => r.uid !== toUserId));
      setMessage(`Friend request to ${toUserName} cancelled!`);

      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error('Error cancelling friend request:', error);
      setMessage('Error cancelling request: ' + error.message);
    }
    setRequestLoading((prev) => ({ ...prev, [toUserId]: false }));
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    // Form submission no longer needed since we search on input change
    // But we keep it to support Enter key submission
  };

  const handleSendRequest = async (toUserId, toUserName) => {
    setRequestLoading((prev) => ({ ...prev, [toUserId]: true }));
    setMessage("");

    try {
      const { sendFriendRequest } = await import("../../firebase/firestore");
      await sendFriendRequest(user.uid, toUserId);
      setMessage(`Friend request sent to ${toUserName}!`);
      fetchPendingRequests();

      setSearchResults((prev) =>
        prev.map((user) =>
          user.uid === toUserId
            ? {
                ...user,
                hasSentRequest: true,
                friendRequests: [
                  ...(user.friendRequests || []),
                  { from: user.uid, status: "pending" },
                ],
              }
            : user,
        ),
      );
    } catch (error) {
      console.error("Error sending friend request:", error);
      setMessage(error.message);
    }
    setRequestLoading((prev) => ({ ...prev, [toUserId]: false }));
  };

  const hasSentRequest = (currentUserId) => {
    return pendingRequests.some((req) => req.uid === currentUserId);
  };

  const isAlreadyFriend = (currentUserId) => {
    return friends.some((friend) => (friend.uid || friend.id) === currentUserId);
  };

  return (
    <div className="search-container">
      <div className="search-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' , margin: '0px 10px' }}>
        <h1 className="SearchHeading" style={{ margin: 0 }}>Lookup Friends</h1>
        <button
          className="devfusion-trigger-btn"
          title="About DevFusion"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
          onClick={() => setShowDevFusion(true)}
        >
          <img src="/DevFusion.png" alt="DevFusion Logo" style={{ width: 50, height: 50, borderRadius: '50%' }} />
        </button>
      </div>
      {showDevFusion && (
        <DevFusionModal isOpen={showDevFusion} onClose={() => setShowDevFusion(false)} currentUserId={user?.uid} />
      )}

      {message && (
        <div className={`search-message ${message.includes("Error") ? "search-message-error" : "search-message-success"}`}>
          {message}
        </div>
      )}

      {}
      {!loadingPending && pendingRequests.length > 0 && (
        <div className="pending-requests-section">
          <h2 className="pending-requests-title">Friend Requests Sent ({pendingRequests.length})</h2>
          {pendingError && (
            <div className="search-message search-message-error">{pendingError}</div>
          )}
          <div className="pending-requests-list">
            {pendingRequests.map(request => (
              <div key={request.uid} className="pending-request-item">
                <img
                  src={request.photoURL || '/default-avatar.png'}
                  alt={request.displayName}
                  className="pending-request-avatar"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/default-avatar.png";
                  }}
                />
                <div className="pending-request-info">
                  <h4 className="badge-with-name">
                    {request.displayName}
                    {(() => { const displayBadge = request.badge || (request.username === 'ashwinirai492' ? 'tester' : null); return displayBadge ? <UserBadge badge={displayBadge} size="small" /> : null; })()}
                  </h4>
                  <p className="pending-request-username">@{request.username}</p>
                  {request.bio && (
                    <p className="pending-request-bio">{request.bio}</p>
                  )}
                </div>
                <div className="pending-request-actions">
                  <span className="status-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    Pending
                  </span>
                  <button
                    className="cancel-request-btn"
                    onClick={() => handleCancelRequest(request.uid, request.displayName)}
                    disabled={requestLoading[request.uid]}
                    title="Cancel request"
                  >
                    {requestLoading[request.uid] ? '...' : '✕'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          placeholder="Search here..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <button
          type="submit"
          disabled={loading}
          className="search-button"
        >
          <svg aria-label="Search" class="x1lliihq x1n2onr6 x5n08af" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Search</title><path d="M19 10.5A8.5 8.5 0 1 1 10.5 2a8.5 8.5 0 0 1 8.5 8.5Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path><line fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" x1="16.511" x2="22" y1="16.511" y2="22"></line></svg>
        </button>
      </form>

      {!searchTerm.trim() && (
        <SuggestedFriends 
          user={user}
          currentFriends={friends}
          friendRequests={[]}
        />
      )}

      <div className="search-results">
        {loading && searchTerm.trim() && (
          <div className="search-loading">
            <Spinner size="medium" />
            <p>Searching for users...</p>
          </div>
        )}

        {!loading && searchResults.map((result) => {
          const alreadyFriends = isAlreadyFriend(result.uid);
          const requestSent = hasSentRequest(result.uid);

          return (
            <div
              key={result.uid}
              className="search-result-item"
            >
              <img
                src={result.photoURL || '/default-avatar.png'}
                alt={result.displayName}
                className="search-result-avatar"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/default-avatar.png";
              }}
              />
              <div className="search-result-info">
                <h4 className="badge-with-name">
                  {result.displayName}
                  {(() => { const displayBadge = result.badge || (result.username === 'ashwinirai492' ? 'tester' : null); return displayBadge ? <UserBadge badge={displayBadge} size="small" /> : null; })()}
                </h4>
                <p className="search-result-username">@{result.username}</p>
                {result.bio && (
                  <p className="search-result-bio">{result.bio}</p>
                )}

                {}
                {alreadyFriends && (
                  <p className="status-indicator status-friends">
                    ✓ Already friends
                  </p>
                )}
                {requestSent && (
                  <p className="status-indicator status-pending">
                    ⏳ Friend request sent
                  </p>
                )}
              </div>

              {!alreadyFriends && !requestSent ? (
                <button
                  onClick={() =>
                    handleSendRequest(result.uid, result.displayName)
                  }
                  disabled={requestLoading[result.uid]}
                  className="add-friend-button"
                >
                  {requestLoading[result.uid] ? "Sending..." : "Add Friend"}
                </button>
              ) : (
                <button
                  disabled
                  className="disabled-button"
                >
                  {alreadyFriends ? "Friends" : "Request Sent"}
                </button>
              )}
            </div>
          );
        })}

        {!loading && searchResults.length === 0 && searchTerm.trim() && (
          <p className="no-results">No users found. Try a different search term.</p>
        )}
      </div>
    </div>
  );
}

export default SearchView;