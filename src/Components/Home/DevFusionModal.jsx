import React, { useState, useEffect } from 'react';
import { doc, collection, addDoc, query, where, getDocs, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import UserBadge from '../UserBadge';
import '../../styles/DevFusionModal.css';

function DevFusionModal({ isOpen, onClose, currentUserId }) {
  const [sendingTo, setSendingTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [userFriends, setUserFriends] = useState([]);
  const [devFusionTeam, setDevFusionTeam] = useState([
    {
      id: 'dushyant',
      name: 'Dushyant',
      username: 'dushyantrajotia',
      role: 'Developer',
      photo: 'https://via.placeholder.com/100?text=Dushyant',
      uid: null
    },
    {
      id: 'manul',
      name: 'Manul Sahu',
      username: 'manulsahu',
      role: 'Developer',
      photo: 'https://via.placeholder.com/100?text=Manul',
      uid: null
    },
    {
      id: 'adarsh',
      name: 'Adarsh',
      username: 'adarsh',
      role: 'Support',
      photo: 'https://via.placeholder.com/100?text=Adarsh',
      uid: null
    }
  ]);

  // Fetch current user's friends list
  useEffect(() => {
    if (!currentUserId) return;
    
    const fetchUserFriends = async () => {
      try {
        const userRef = doc(db, 'users', currentUserId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().friends) {
          setUserFriends(userSnap.data().friends);
        }
      } catch (error) {
        console.error('Error fetching user friends:', error);
      }
    };
    
    fetchUserFriends();
  }, [currentUserId]);

  // Fetch user UIDs by username when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchUserUIDs = async () => {
      try {
        const updatedTeam = await Promise.all(
          devFusionTeam.map(async (member) => {
            try {
              // Try to find user by username
              const usersSnap = await getDocs(
                query(
                  collection(db, 'users'),
                  where('username', '==', member.username)
                )
              );
              
              if (usersSnap.docs.length > 0) {
                return { ...member, uid: usersSnap.docs[0].id };
              }
            } catch (err) {
              console.error(`Error fetching UID for ${member.username}:`, err);
            }
            return member;
          })
        );

        // Fetch profile pictures and set badges
        const teamWithPhotos = await Promise.all(
          updatedTeam.map(async (member) => {
            if (member.uid) {
              try {
                const userRef = doc(db, 'users', member.uid);
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists()) {
                  const userData = userSnap.data();
                  
                  // Set badge on user profile if not already set
                  const badge = member.role === 'Developer' ? 'developer' : 'support';
                  if (!userData.badge || userData.badge !== badge) {
                    await updateDoc(userRef, { badge, updatedAt: new Date() });
                  }
                  
                  return { ...member, photo: userData.photoURL || member.photo };
                }
              } catch (err) {
                console.error(`Error fetching profile for ${member.username}:`, err);
              }
            }
            return member;
          })
        );

        setDevFusionTeam(teamWithPhotos);
      } catch (error) {
        console.error('Error fetching DevFusion team data:', error);
      }
    };

    fetchUserUIDs();
  }, [isOpen]);

  const isFriend = (teamMemberId) => userFriends.includes(teamMemberId);
  const isCurrentUser = (teamMemberId) => teamMemberId === currentUserId;

  const handleSendRequest = async (teamMember) => {
    if (!teamMember.uid || teamMember.uid.includes('_uid')) {
      setMessage('Unable to send request - user profile not found');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setLoading(true);
    setSendingTo(teamMember.id);

    try {
      // Check if request already exists
      const requestsRef = collection(db, 'friendRequests');
      const existingQuery = query(
        requestsRef,
        where('fromUserId', '==', currentUserId),
        where('toUserId', '==', teamMember.uid)
      );
      const existingSnapshot = await getDocs(existingQuery);

      if (!existingSnapshot.empty) {
        setMessage('Request already sent to ' + teamMember.name);
        setTimeout(() => setMessage(''), 3000);
        setLoading(false);
        setSendingTo(null);
        return;
      }

      // Send friend request
      await addDoc(requestsRef, {
        fromUserId: currentUserId,
        toUserId: teamMember.uid,
        status: 'pending',
        timestamp: new Date(),
        message: `Hi ${teamMember.name}! I'd like to connect with you.`
      });

      setMessage(`Request sent to ${teamMember.name}!`);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error sending request:', error);
      setMessage('Failed to send request. Please try again.');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
      setSendingTo(null);
    }
  };

  const handleEmailClick = () => {
    window.location.href = 'mailto:devfusionorg@gmail.com';
  };

  if (!isOpen) return null;

  return (
    <div className="devfusion-modal-overlay" onClick={onClose}>
      <div className="devfusion-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="devfusion-modal-close" onClick={onClose}>
          ✕
        </button>

        <div className="devfusion-modal-header">
          <img src="./DevFusion.png" alt="DevFusion Logo" className="devfusion-modal-logo" />
          <h2>DevFusion</h2>
          <p className="devfusion-subtitle">Meet the team behind Duet</p>
        </div>

        {message && <div className="devfusion-message">{message}</div>}

        <div className="devfusion-section">
          <h3 className="devfusion-section-title">
            <UserBadge badge="developer" size="medium" />
            Developers
          </h3>
          <div className="devfusion-team-grid">
            {devFusionTeam.filter(member => member.role === 'Developer').map((member) => {
              const isMe = isCurrentUser(member.uid);
              const isFriendAlready = isFriend(member.uid);
              
              return (
                <div key={member.id} className="devfusion-team-card">
                  <img 
                    src={member.photo} 
                    alt={member.name}
                    className="devfusion-team-photo"
                    onError={(e) => {
                      e.currentTarget.src = '/default-avatar.png';
                    }}
                  />
                  <h4 className="devfusion-team-name">{member.name}</h4>
                  <p className="devfusion-team-username">@{member.username}</p>
                  <button
                    className={`devfusion-request-btn ${sendingTo === member.id ? 'loading' : ''} ${isMe ? 'is-me' : ''} ${isFriendAlready ? 'already-friend' : ''}`}
                    onClick={() => handleSendRequest(member)}
                    disabled={isMe || isFriendAlready || (loading && sendingTo === member.id)}
                  >
                    {isMe ? 'That\'s You!' : isFriendAlready ? 'Already Friends' : (sendingTo === member.id && loading ? 'Sending...' : 'Send Request')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="devfusion-section">
          <h3 className="devfusion-section-title">
            <UserBadge badge="support" size="medium" />
            Support
          </h3>
          <div className="devfusion-team-grid">
            {devFusionTeam.filter(member => member.role === 'Support').map((member) => {
              const isMe = isCurrentUser(member.uid);
              const isFriendAlready = isFriend(member.uid);
              
              return (
                <div key={member.id} className="devfusion-team-card">
                  <img 
                    src={member.photo} 
                    alt={member.name}
                    className="devfusion-team-photo"
                    onError={(e) => {
                      e.currentTarget.src = '/default-avatar.png';
                    }}
                  />
                  <h4 className="devfusion-team-name">{member.name}</h4>
                  <p className="devfusion-team-username">@{member.username}</p>
                  <button
                    className={`devfusion-request-btn ${sendingTo === member.id ? 'loading' : ''} ${isMe ? 'is-me' : ''} ${isFriendAlready ? 'already-friend' : ''}`}
                    onClick={() => handleSendRequest(member)}
                    disabled={isMe || isFriendAlready || (loading && sendingTo === member.id)}
                  >
                    {isMe ? 'That\'s You!' : isFriendAlready ? 'Already Friends' : (sendingTo === member.id && loading ? 'Sending...' : 'Send Request')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="devfusion-section">
          <h3 className="devfusion-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display: 'inline-block', marginRight: '8px'}}>
              <rect x="3" y="4" width="18" height="16" rx="2" ry="2"></rect>
              <path d="m3 4 9 6 9-6"></path>
            </svg>
            Support Email
          </h3>
          <button 
            className="devfusion-email-btn"
            onClick={handleEmailClick}
          >
            <span>devfusionorg@gmail.com</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="16" rx="2" ry="2"></rect>
              <path d="m3 4 9 6 9-6"></path>
            </svg>
          </button>
        </div>

        <div className="devfusion-footer">
          <p>Made with ❤️ by DevFusion</p>
        </div>
      </div>
    </div>
  );
}

export default DevFusionModal;
