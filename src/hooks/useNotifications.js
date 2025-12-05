import { useState, useEffect } from "react";
import { notificationService } from '../services/notificationService';

export function useNotifications(user, chatId) {
  const [hasPermission, setHasPermission] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    // Initialize notification service
    notificationService.initialize();
    
    // Check initial permission
    const checkPermission = async () => {
      const permission = (typeof Notification !== 'undefined') ? Notification.permission : 'default';
      setHasPermission(permission === 'granted');
    };
    checkPermission();

    // Listen for incoming calls
    const removeCallListener = notificationService.addCallListener((callData) => {
      if (callData.type === 'incoming_call') {
        setIncomingCall(callData);
      }
    });

    // Listen for new messages
    const removeMessageListener = notificationService.addMessageListener((messageData) => {
      // Handle message notifications if needed
      console.log('New message notification:', messageData);
    });

    // Cleanup
    return () => {
      removeCallListener();
      removeMessageListener();
    };
  }, []);

  // Handle call acceptance
  const acceptCall = async () => {
    if (!incomingCall) return;
    await notificationService.acceptCall(incomingCall.callId);
    setIncomingCall(null);
  };

  // Handle call rejection
  const rejectCall = async () => {
    if (!incomingCall) return;
    await notificationService.rejectCall(incomingCall.callId);
    setIncomingCall(null);
  };

  // Show chat message notification
  const showChatNotification = (message, sender) => {
    notificationService.showLocalNotification(
      sender.displayName,
      message.text || 'New message',
      {
        channelId: 'chat_channel',
        chatId,
        senderId: sender.uid,
        senderPhoto: sender.photoURL,
        smallIcon: 'ic_notification',
        largeIcon: sender.photoURL
      }
    );
  };

  return {
    hasPermission,
    incomingCall,
    acceptCall,
    rejectCall,
    showChatNotification
  };
}