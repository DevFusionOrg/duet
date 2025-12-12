import React from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import Chat from './Chat';
import { useFriends } from '../hooks/useFriends';

export default function ChatWrapper({ user }) {
  const { uid } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { friends } = useFriends(user);

  const friendFromState = location.state?.friend;
  const friend = friendFromState || friends?.find(f => f.uid === uid) || { uid };

  const handleBack = () => {
    navigate(-1);
  };

  return <Chat user={user} friend={friend} onBack={handleBack} />;
}
