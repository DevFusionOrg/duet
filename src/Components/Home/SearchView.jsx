import React, { useState, useEffect, useRef } from "react";
import Spinner from "../Spinner";
import SuggestedFriends from "./SuggestedFriends";
import { useFriends } from "../../hooks/useFriends";

function SearchView({ user, onOpenProfile }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const searchTimeoutRef = useRef(null);

  const { friends } = useFriends(user);

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

  const handleSearch = async (e) => {
    e.preventDefault();
    // Form submission no longer needed since we search on input change
    // But we keep it to support Enter key submission
  };

  const isAlreadyFriend = (currentUserId) => {
    return friends.some((friend) => (friend.uid || friend.id) === currentUserId);
  };

  return (
    <div className="search-container">
      <div className="search-header-bar" style={{ alignItems: 'center', justifyContent: 'space-between' , margin: '0px 10px' }}>
        <h1 className="SearchHeading" style={{ margin: 0 }}>Lookup Friends</h1>
      </div>

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

      {!searchTerm.trim() && (
        <SuggestedFriends 
          user={user}
          currentFriends={friends}
          friendRequests={[]}
          onOpenProfile={onOpenProfile}
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
          return (
            <div
              key={result.uid}
              className="search-result-item"
              onClick={() => onOpenProfile && onOpenProfile(result)}
              style={{ cursor: onOpenProfile ? 'pointer' : 'default' }}
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
                <h4>{result.displayName}</h4>
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
              </div>

              <button
                type="button"
                className="disabled-button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpenProfile) onOpenProfile(result);
                }}
              >
                View Profile
              </button>
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