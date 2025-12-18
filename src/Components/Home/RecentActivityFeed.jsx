import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase/firebase';
import { collection, getDocs } from 'firebase/firestore';
import '../../styles/Home.css';

function RecentActivityFeed({ user, currentFriends }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  useEffect(() => {
    // Only fetch once on component mount
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchRecentActivity();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount

  const fetchRecentActivity = async () => {
    try {
      setLoading(true);
      const activities = [];

      // 1. Get recent mutual connections from friend's profiles
      const friendIds = currentFriends.map(f => f.uid || f.id);
      
      if (friendIds.length > 0) {
        // Get friends who recently became friends with each other
        const friendsSnap = await getDocs(collection(db, 'users'));
        
        friendsSnap.docs.forEach(doc => {
          const friendData = doc.data();
          if (friendData.uid === user.uid) return;
          
          // Find mutual connections among current friends
          const friendFriends = friendData.friends || [];
          const newMutuals = friendFriends.filter(
            fid => friendIds.includes(fid) && fid !== user.uid
          );

          if (newMutuals.length > 0) {
            activities.push({
              id: `mutual_${friendData.uid}`,
              type: 'mutual_connection',
              timestamp: new Date(),
              actor: {
                uid: friendData.uid,
                displayName: friendData.displayName,
                photoURL: friendData.photoURL
              },
              content: `${friendData.displayName} connected with ${newMutuals.length} of your friends`,
              mutualCount: newMutuals.length
            });
          }
        });
      }

      // 2. Get recent messages from friends (for preview)
      for (const friend of currentFriends.slice(0, 5)) {
        try {
          const chatId = [user.uid, friend.uid].sort().join('_');
          const messagesRef = collection(db, 'chats', chatId, 'messages');
          const messagesSnap = await getDocs(
            query(messagesRef, orderBy('timestamp', 'desc'), limit(1))
          );

          if (!messagesSnap.empty) {
            const lastMessage = messagesSnap.docs[0].data();
            const messageTime = lastMessage.timestamp?.toDate?.() || new Date(lastMessage.timestamp);
            
            // Only include messages from last 7 days
            const daysAgo = (Date.now() - messageTime.getTime()) / (1000 * 60 * 60 * 24);
            if (daysAgo < 7) {
              activities.push({
                id: `message_${chatId}`,
                type: 'recent_message',
                timestamp: messageTime,
                actor: {
                  uid: friend.uid,
                  displayName: friend.displayName,
                  photoURL: friend.photoURL
                },
                content: lastMessage.type === 'image' 
                  ? '📷 Sent a photo'
                  : lastMessage.type === 'voice'
                  ? '🎤 Sent a voice message'
                  : lastMessage.text || '(Message)',
                isUnread: !lastMessage.read && lastMessage.senderId !== user.uid
              });
            }
          }
        } catch (error) {
          console.warn('Error fetching messages for friend:', error);
        }
      }

      // Sort by timestamp (most recent first)
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      setActivities(activities.slice(0, 6)); // Show top 6 activities
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatActivityTime = (timestamp) => {
    const now = new Date();
    const diffMs = now - new Date(timestamp);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return new Date(timestamp).toLocaleDateString();
  };

  if (loading) {
    return <div className="activity-feed-loading">Loading activity...</div>;
  }

  if (activities.length === 0) {
    return (
      <div className="activity-feed-empty">
        <p>No recent activity yet</p>
      </div>
    );
  }

  return (
    <div className="activity-feed-section">
      <h2 className="section-title">Recent Activity</h2>
      <div className="activity-feed-list">
        {activities.map(activity => (
          <div key={activity.id} className={`activity-item ${activity.type}`}>
            <div className="activity-avatar">
              <img
                src={activity.actor.photoURL || '/default-avatar.png'}
                alt={activity.actor.displayName}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/default-avatar.png';
                }}
              />
            </div>

            <div className="activity-content">
              <div className="activity-text">
                <span className="activity-actor">{activity.actor.displayName}</span>
                <span className="activity-action">
                  {activity.type === 'mutual_connection' && ' connected with people you know'}
                  {activity.type === 'recent_message' && ' sent a message'}
                </span>
              </div>
              
              {activity.type === 'recent_message' && (
                <div className={`activity-preview ${activity.isUnread ? 'unread' : ''}`}>
                  {activity.content}
                  {activity.isUnread && <span className="unread-dot"></span>}
                </div>
              )}
            </div>

            <div className="activity-time">
              {formatActivityTime(activity.timestamp)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RecentActivityFeed;
