import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabase/supabase';
import LoadingScreen from '../LoadingScreen';
import '../../styles/Home.css';

function RecentActivityFeed({ user, currentFriends = [] }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!hasFetched.current && user) {
      hasFetched.current = true;
      fetchRecentActivity();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchRecentActivity = async () => {
    try {
      setLoading(true);
      const activityList = [];

      for (const friend of currentFriends.slice(0, 5)) {
        try {
          const chatId = [user.uid, friend.uid].sort().join('_');
          const { data } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: false })
            .limit(1);

          if (data && data.length > 0) {
            const lastMessage = data[0];
            const messageTime = new Date(lastMessage.created_at);
            const daysAgo = (Date.now() - messageTime.getTime()) / (1000 * 60 * 60 * 24);

            if (daysAgo < 7) {
              activityList.push({
                id: `message_${chatId}`,
                type: 'recent_message',
                timestamp: messageTime,
                actor: {
                  uid: friend.uid,
                  displayName: friend.displayName,
                  photoURL: friend.photoURL,
                },
                content:
                  lastMessage.type === 'image'
                    ? '📷 Sent a photo'
                    : lastMessage.type === 'voice'
                    ? '🎤 Sent a voice message'
                    : lastMessage.text || '(Message)',
                isUnread: !lastMessage.read && lastMessage.sender_id !== user.uid,
              });
            }
          }
        } catch (error) {
          console.warn('Error fetching messages for friend activity:', error);
        }
      }

      activityList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setActivities(activityList.slice(0, 6));
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
    return <LoadingScreen message="Loading activity..." size="small" />;
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
        {activities.map((activity) => (
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

            <div className="activity-time">{formatActivityTime(activity.timestamp)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RecentActivityFeed;
