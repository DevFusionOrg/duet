import React, { useState } from "react";
import { searchUsers, sendFriendRequest } from "../firebase/firestore";

function Search({ user }) {
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
      const results = await searchUsers(searchTerm);
      // Filter out current user from results
      const filteredResults = results.filter(result => result.uid !== user.uid);
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
    setRequestLoading(prev => ({ ...prev, [toUserId]: true }));
    setMessage("");
    
    try {
      const result = await sendFriendRequest(user.uid, toUserId);
      setMessage(`Friend request sent to ${toUserName}!`);
      
      // Update the UI to show request sent
      setSearchResults(prev => 
        prev.map(user => 
          user.uid === toUserId 
            ? { 
                ...user, 
                hasSentRequest: true,
                friendRequests: [...(user.friendRequests || []), 
                  { from: user.uid, status: 'pending' }
                ]
              }
            : user
        )
      );
    } catch (error) {
      console.error("Error sending friend request:", error);
      setMessage(error.message);
    }
    setRequestLoading(prev => ({ ...prev, [toUserId]: false }));
  };

  const hasSentRequest = (userProfile, currentUserId) => {
    return userProfile.friendRequests && 
           userProfile.friendRequests.some(req => 
             req.from === currentUserId && req.status === 'pending'
           );
  };

  const isAlreadyFriend = (userProfile, currentUserId) => {
    return userProfile.friends && userProfile.friends.includes(currentUserId);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Search Users</h2>
      
      {message && (
        <div style={{
          padding: '10px',
          backgroundColor: message.includes('Error') ? '#ffebee' : '#e8f5e8',
          border: '1px solid',
          borderColor: message.includes('Error') ? '#f44336' : '#4caf50',
          borderRadius: '4px',
          marginBottom: '20px',
          color: message.includes('Error') ? '#c62828' : '#2e7d32'
        }}>
          {message}
        </div>
      )}
      
      <form onSubmit={handleSearch} style={{ marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="Search by name or username..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ 
            padding: '10px', 
            width: '300px',
            marginRight: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        />
        <button 
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      <div>
        {searchResults.map((result) => {
          const alreadyFriends = isAlreadyFriend(result, user.uid);
          const requestSent = hasSentRequest(result, user.uid);
          
          return (
            <div key={result.uid} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '15px',
              border: '1px solid #eee',
              borderRadius: '8px',
              marginBottom: '10px',
              backgroundColor: '#f9f9f9'
            }}>
              <img 
                src={result.photoURL} 
                alt={result.displayName}
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  marginRight: '15px'
                }}
              />
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0 }}>{result.displayName}</h4>
                <p style={{ margin: 0, color: '#666' }}>@{result.username}</p>
                {result.bio && <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>{result.bio}</p>}
                
                {/* Status indicators */}
                {alreadyFriends && (
                  <p style={{ margin: '5px 0 0 0', color: '#34a853', fontSize: '12px' }}>
                    ✓ Already friends
                  </p>
                )}
                {requestSent && (
                  <p style={{ margin: '5px 0 0 0', color: '#fbbc05', fontSize: '12px' }}>
                    ⏳ Friend request sent
                  </p>
                )}
              </div>
              
              {!alreadyFriends && !requestSent ? (
                <button 
                  onClick={() => handleSendRequest(result.uid, result.displayName)}
                  disabled={requestLoading[result.uid]}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#34a853',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    opacity: requestLoading[result.uid] ? 0.6 : 1
                  }}
                >
                  {requestLoading[result.uid] ? 'Sending...' : 'Add Friend'}
                </button>
              ) : (
                <button 
                  disabled
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'not-allowed'
                  }}
                >
                  {alreadyFriends ? 'Friends' : 'Request Sent'}
                </button>
              )}
            </div>
          );
        })}
        
        {searchResults.length === 0 && searchTerm && !loading && !message && (
          <p>No users found. Try a different search term.</p>
        )}
      </div>
    </div>
  );
}

export default Search;