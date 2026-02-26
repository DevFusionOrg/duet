import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { db } from '../../firebase/firebase';
import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { sendFriendRequest } from '../../firebase/firestore';
import LoadingScreen from '../LoadingScreen';
import '../../styles/Home.css';

function SuggestedFriends({ user, currentFriends, friendRequests }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState({});
  const [sentRequests, setSentRequests] = useState(new Set());
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const hasFetched = useRef(false);

  const fetchSuggestedFriends = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching suggested friends...');

      const usersSnap = await getDocs(
        query(collection(db, 'users'), limit(50)) // Limit to prevent loading all users
      );
      const allUsers = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

      let sentFriendRequestIds = new Set();
      try {
        const sentSnap = await getDocs(
          query(collection(db, 'users', user.uid, 'sentFriendRequests'), orderBy('timestamp', 'desc'))
        );
        sentFriendRequestIds = new Set(
          sentSnap.docs
            .map((docSnap) => docSnap.data())
            .filter((req) => (req.status || 'pending') === 'pending' && req.to)
            .map((req) => req.to)
        );
      } catch (error) {
        console.warn('Unable to fetch sent friend requests subcollection:', error);
      }

      setSentRequests(sentFriendRequestIds);
      
      console.log('Total users found:', allUsers.length);
      console.log('Sample user data:', allUsers.slice(0, 3).map(u => ({ 
        uid: u.uid, 
        displayName: u.displayName, 
        photoURL: u.photoURL ? 'HAS_PHOTO' : 'NO_PHOTO',
        photoURLPreview: u.photoURL ? u.photoURL.substring(0, 50) + '...' : null
      })));
      
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

      const suggestionsWithMutual = suggestedUsers.map(suggestion => {
        const mutualFriendIds = (suggestion.friends || []).filter(fid => currentFriendIds.has(fid));

        const mutualFriendNames = mutualFriendIds
          .map(fid => {
            const friend = currentFriends.find(f => (f.uid || f.id) === fid);
            return friend?.displayName || friend?.username || 'User';
          })
          .slice(0, 3); 
        
        return {
          ...suggestion,
          mutualCount: mutualFriendIds.length,
          mutualFriendsIds: mutualFriendIds,
          mutualFriendNames: mutualFriendNames
        };
      });

      suggestionsWithMutual.sort((a, b) => b.mutualCount - a.mutualCount);

      setSuggestions(suggestionsWithMutual.slice(0, 6));
    } catch (error) {
      console.error('Error fetching suggested friends:', error);
    } finally {
      setLoading(false);
    }
  }, [currentFriends, friendRequests, user.uid]);

  useEffect(() => {
    if (!hasFetched.current && currentFriends) {
      hasFetched.current = true;
      fetchSuggestedFriends();
    }
  }, [fetchSuggestedFriends, currentFriends]);

  const handleAddFriend = async (suggestedUserId, suggestedUserName) => {
    try {
      setRequesting(prev => ({ ...prev, [suggestedUserId]: true }));
      await sendFriendRequest(user.uid, suggestedUserId, user.displayName || user.email, suggestedUserName);

      setSentRequests(prev => new Set([...prev, suggestedUserId]));
      setSuggestions(prev => prev.filter(s => s.uid !== suggestedUserId));

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
    return sentRequests.has(userId);
  };

  if (loading) {
    return <LoadingScreen message="Finding suggestions..." size="small" />;
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
                  console.log('Image failed to load for user:', suggestion.displayName, 'URL:', suggestion.photoURL);
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/default-avatar.png';
                }}
                onLoad={() => {
                  console.log('Image loaded successfully for user:', suggestion.displayName);
                }}
              />
            </div>
            
            <div className="suggested-friend-info" onClick={() => handleProfileClick(suggestion)} style={{ cursor: 'pointer' }}>
              <h3 className="suggested-friend-name">{suggestion.displayName}</h3>
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
            
            <h2 className="profile-popup-name">{selectedProfile.displayName}</h2>
            
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
              disabled={requesting[selectedProfile.uid] || sentRequests.has(selectedProfile.uid) || checkHasPendingRequest(selectedProfile.uid)}
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

export default memo(SuggestedFriends);
