import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { db } from '../../firebase/firebase';
import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import LoadingScreen from '../LoadingScreen';
import '../../styles/Home.css';

function SuggestedFriends({ user, currentFriends, friendRequests, onOpenProfile }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const handleProfileClick = (suggestion) => {
    if (onOpenProfile) onOpenProfile(suggestion);
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
              onClick={() => handleProfileClick(suggestion)}
            >
              View Profile
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(SuggestedFriends);
