import React, { useState } from "react";

function SearchView({ user }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState({});
  const [message, setMessage] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setMessage("");
    try {
      const { searchUsers } = await import("../../firebase/firestore");
      const results = await searchUsers(searchTerm);
      const filteredResults = results.filter(
        (result) => result.uid !== user.uid,
      );
      setSearchResults(filteredResults);

      if (filteredResults.length === 0) {
        setMessage("No users found. Try a different search term.");
      }
    } catch (error) {
      console.error("Error searching users:", error);
      setMessage("Error searching users: " + error.message);
    }
    setLoading(false);
  };

  const handleSendRequest = async (toUserId, toUserName) => {
    setRequestLoading((prev) => ({ ...prev, [toUserId]: true }));
    setMessage("");

    try {
      const { sendFriendRequest } = await import("../../firebase/firestore");
      await sendFriendRequest(user.uid, toUserId);
      setMessage(`Friend request sent to ${toUserName}!`);

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

  const hasSentRequest = (userProfile, currentUserId) => {
    return (
      userProfile.friendRequests &&
      userProfile.friendRequests.some(
        (req) => req.from === currentUserId && req.status === "pending",
      )
    );
  };

  const isAlreadyFriend = (userProfile, currentUserId) => {
    return userProfile.friends && userProfile.friends.includes(currentUserId);
  };

  return (
    <div className="search-container">
      <h1 className="SearchHeading">Search</h1>

      {message && (
        <div className={`search-message ${message.includes("Error") ? "search-message-error" : "search-message-success"}`}>
          {message}
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

      <div className="search-results">
        {searchResults.map((result) => {
          const alreadyFriends = isAlreadyFriend(result, user.uid);
          const requestSent = hasSentRequest(result, user.uid);

          return (
            <div
              key={result.uid}
              className="search-result-item"
            >
              <img
                src={result.photoURL || '/default-avatar.png'}
                alt={result.displayName}
                className="search-result-avatar"
              />
              <div className="search-result-info">
                <h4>{result.displayName}</h4>
                <p className="search-result-username">@{result.username}</p>
                {result.bio && (
                  <p className="search-result-bio">{result.bio}</p>
                )}

                {/* Status indicators */}
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

        {searchResults.length === 0 && searchTerm && !loading && !message && (
          <p className="no-results">No users found. Try a different search term.</p>
        )}
      </div>
    </div>
  );
}

export default SearchView;