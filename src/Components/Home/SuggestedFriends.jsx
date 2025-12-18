import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { sendFriendRequest } from '../../firebase/firestore';
import UserBadge from '../UserBadge';
import '../../styles/Home.css';

function SuggestedFriends({ user, currentFriends, friendRequests }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState({});
  const [sentRequests, setSentRequests] = useState(new Set());
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showBadgeTooltip, setShowBadgeTooltip] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const hasFetched = useRef(false);

  useEffect(() => {
    // Only fetch once on component mount
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchSuggestedFriends();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount

  const fetchSuggestedFriends = async () => {
    try {
      setLoading(true);
      
      // Get all users and current user's sent requests
      const usersSnap = await getDocs(collection(db, 'users'));
      const allUsers = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      
      // Get current user's data to check sent friend requests
      const currentUserData = allUsers.find(u => u.uid === user.uid);
      const sentFriendRequestIds = new Set(
        (currentUserData?.sentFriendRequests || [])
          .filter(r => r.status === 'pending')
          .map(r => r.to)
      );

      // Filter: exclude self, current friends, received pending requests, and sent pending requests
      const currentFriendIds = new Set(currentFriends.map(f => f.uid || f.id));
      const pendingRequestIds = new Set(
        (friendRequests || []).filter(r => r.status === 'pending').map(r => r.from)
      );

      const suggestedUsers = allUsers.filter(u => 
        u.uid !== user.uid && 
        !currentFriendIds.has(u.uid) &&
        !pendingRequestIds.has(u.uid) &&
        !sentFriendRequestIds.has(u.uid)
      );

      // Calculate mutual friends for each suggestion
      const suggestionsWithMutual = suggestedUsers.map(suggestion => {
        const mutualFriendIds = (suggestion.friends || []).filter(fid => currentFriendIds.has(fid));
        
        // Get names of mutual friends
        const mutualFriendNames = mutualFriendIds
          .map(fid => {
            const friend = currentFriends.find(f => (f.uid || f.id) === fid);
            return friend?.displayName || friend?.username || 'User';
          })
          .slice(0, 3); // Limit to 3 names to display
        
        return {
          ...suggestion,
          mutualCount: mutualFriendIds.length,
          mutualFriendsIds: mutualFriendIds,
          mutualFriendNames: mutualFriendNames
        };
      });

      // Sort by mutual friends count (descending)
      suggestionsWithMutual.sort((a, b) => b.mutualCount - a.mutualCount);

      // Take top 6
      setSuggestions(suggestionsWithMutual.slice(0, 6));
    } catch (error) {
      console.error('Error fetching suggested friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (suggestedUserId, suggestedUserName) => {
    try {
      setRequesting(prev => ({ ...prev, [suggestedUserId]: true }));
      await sendFriendRequest(user.uid, suggestedUserId, user.displayName || user.email, suggestedUserName);
      
      // Mark as sent and remove from suggestions
      setSentRequests(prev => new Set([...prev, suggestedUserId]));
      setSuggestions(prev => prev.filter(s => s.uid !== suggestedUserId));
      
      // Refetch suggestions after a brief delay to ensure Firebase is updated
      setTimeout(() => {
        hasFetched.current = false;
        fetchSuggestedFriends();
      }, 1500);
    } catch (error) {
      console.error('Error sending friend request:', error);
      setRequesting(prev => ({ ...prev, [suggestedUserId]: false }));
    }
  };

  const handleProfileClick = (suggestion) => {
    setSelectedProfile(suggestion);
    setShowProfilePopup(true);
  };

  const checkHasPendingRequest = (userId) => {
    // Check if current user has sent a pending request to this user
    return (user?.sentFriendRequests || []).some(req => req.to === userId && req.status === 'pending');
  };

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

  if (loading) {
    return <div className="suggested-friends-loading">Loading suggestions...</div>;
  }

  if (suggestions.length === 0) {
    return (
      <div className="suggested-friends-empty">
        <p>No more suggestions at this time</p>
      </div>
    );
  }

  return (
    <div className="suggested-friends-section">
      <h2 className="section-title">People You Might Know</h2>
      <div className="suggested-friends-grid">
        {suggestions.map(suggestion => (
          <div key={suggestion.uid} className="suggested-friend-card">
            <div 
              className="suggested-friend-header" 
              onClick={() => handleProfileClick(suggestion)}
              style={{ cursor: 'pointer' }}
            >
              <img 
                src={suggestion.photoURL || '/default-avatar.png'}
                alt={suggestion.displayName}
                className="suggested-friend-avatar"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/default-avatar.png';
                }}
              />
            </div>
            
            <div className="suggested-friend-info" onClick={() => handleProfileClick(suggestion)} style={{ cursor: 'pointer' }}>
              <h3 className="suggested-friend-name badge-with-name">
                {suggestion.displayName}
                {(() => {
                  const displayBadge = suggestion.badge || (suggestion.username === 'ashwinirai492' ? 'tester' : null);
                  if (!displayBadge) return null;
                  
                  const badgeNames = { 
                    developer: 'Developer', 
                    support: 'Supporter', 
                    tester: 'Tester' 
                  };
                  
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
              </h3>
              {suggestion.mutualCount > 0 && (
                <p className="mutual-friends">
                  <span className="mutual-icon">👥</span>
                  {suggestion.mutualFriendNames.join(', ')}
                  {suggestion.mutualCount > 3 && ` +${suggestion.mutualCount - 3}`}
                </p>
              )}
            </div>

            <button
              className="add-friend-btn"
              onClick={() => handleAddFriend(suggestion.uid, suggestion.displayName)}
              disabled={requesting[suggestion.uid] || sentRequests.has(suggestion.uid) || checkHasPendingRequest(suggestion.uid)}
            >
              {checkHasPendingRequest(suggestion.uid) ? (
                <>
                  <span style={{ marginRight: '4px' }}>⏳</span>
                  Pending Request
                </>
              ) : sentRequests.has(suggestion.uid) ? (
                <>
                  <span style={{ marginRight: '4px' }}>✓</span>
                  Request Sent
                </>
              ) : requesting[suggestion.uid] ? (
                'Adding...'
              ) : (
                'Add'
              )}
            </button>
          </div>
        ))}
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

      {showProfilePopup && selectedProfile && (
        <div className="profile-popup-overlay" onClick={() => setShowProfilePopup(false)}>
          <div className="profile-popup-content" onClick={(e) => e.stopPropagation()}>
            <button className="profile-popup-close" onClick={() => setShowProfilePopup(false)}>✕</button>
            
            <img 
              src={selectedProfile.photoURL || '/default-avatar.png'}
              alt={selectedProfile.displayName}
              className="profile-popup-avatar"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/default-avatar.png';
              }}
            />
            
            <h2 className="profile-popup-name badge-with-name">
              {selectedProfile.displayName}
              {(() => {
                const displayBadge = selectedProfile.badge || (selectedProfile.username === 'ashwinirai492' ? 'tester' : null);
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
            </h2>
            
            <p className="profile-popup-username">@{selectedProfile.username}</p>
            
            {selectedProfile.bio && (
              <p className="profile-popup-bio">{selectedProfile.bio}</p>
            )}
            
            {selectedProfile.mutualCount > 0 && (
              <div className="profile-popup-mutual">
                <p className="profile-popup-mutual-title">Mutual Friends ({selectedProfile.mutualCount})</p>
                <p className="profile-popup-mutual-names">
                  {selectedProfile.mutualFriendNames.join(', ')}
                  {selectedProfile.mutualCount > 3 && ` +${selectedProfile.mutualCount - 3} more`}
                </p>
              </div>
            )}
            
            <button
              className="profile-popup-add-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleAddFriend(selectedProfile.uid, selectedProfile.displayName);
                setShowProfilePopup(false);
              }}
              disabled={requesting[selectedProfile.uid] || sentRequests.has(selectedProfile.uid)}
            >
              {sentRequests.has(selectedProfile.uid) ? (
                <>
                  <span style={{ marginRight: '4px' }}>✓</span>
                  Request Sent
                </>
              ) : requesting[selectedProfile.uid] ? (
                'Adding...'
              ) : (
                'Add Friend'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SuggestedFriends;
