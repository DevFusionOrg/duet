import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { supabase } from '../../supabase/supabase';
import LoadingScreen from '../LoadingScreen';
import '../../styles/Home.css';

function SuggestedFriends({ user, currentFriends, friendRequests, onOpenProfile }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const fetchSuggestedFriends = useCallback(async () => {
    try {
      setLoading(true);

      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*')
        .limit(50);

      const allUsers = (allProfiles || []).map(p => ({
        uid: p.id,
        id: p.id,
        displayName: p.display_name || p.username,
        photoURL: p.photo_url,
        username: p.username,
      }));

      let sentFriendRequestIds = new Set();
      try {
        const { data: sentData } = await supabase
          .from('friend_requests')
          .select('to_user_id')
          .eq('from_user_id', user.uid)
          .eq('status', 'pending');

        sentFriendRequestIds = new Set((sentData || []).map(r => r.to_user_id));
      } catch (error) {
        console.warn('Unable to fetch sent friend requests:', error);
      }

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

      setSuggestions(suggestedUsers.slice(0, 6));
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
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/default-avatar.png';
                }}
              />
            </div>
            
            <div className="suggested-friend-info" onClick={() => handleProfileClick(suggestion)} style={{ cursor: 'pointer' }}>
              <h3 className="suggested-friend-name">{suggestion.displayName}</h3>
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
