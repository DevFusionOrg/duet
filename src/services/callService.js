import { supabase } from '../supabase/supabase';

class CallService {
  async createCall(callerId, callerName, receiverId, receiverName) {
    try {
      const callId = `${callerId}_${receiverId}_${Date.now()}`;

      const callData = {
        id: callId,
        caller_id: callerId,
        caller_name: callerName,
        receiver_id: receiverId,
        receiver_name: receiverName,
        status: 'ringing',
        type: 'audio',
        duration: 0,
      };

      const { error } = await supabase.from('active_calls').upsert(callData);
      if (error) throw error;

      return {
        callId,
        callerId,
        callerName,
        receiverId,
        receiverName,
        status: 'ringing',
        type: 'audio',
        createdAt: Date.now(),
        duration: 0,
      };
    } catch (error) {
      console.error('❌ Error creating audio call:', error);
      throw error;
    }
  }

  async createVideoCall(callerId, callerName, receiverId, receiverName) {
    try {
      const callId = `${callerId}_${receiverId}_${Date.now()}`;

      const callData = {
        id: callId,
        caller_id: callerId,
        caller_name: callerName,
        receiver_id: receiverId,
        receiver_name: receiverName,
        status: 'ringing',
        type: 'video',
        duration: 0,
      };

      const { error } = await supabase.from('active_calls').upsert(callData);
      if (error) throw error;

      return {
        callId,
        callerId,
        callerName,
        receiverId,
        receiverName,
        status: 'ringing',
        type: 'video',
        createdAt: Date.now(),
        duration: 0,
      };
    } catch (error) {
      console.error('❌ Error creating video call:', error);
      throw error;
    }
  }

  async acceptCall(callId, receiverId) {
    try {
      const { data, error } = await supabase
        .from('active_calls')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', callId)
        .select('*')
        .single();

      if (error) throw error;

      return {
        callId: data.id,
        callerId: data.caller_id,
        callerName: data.caller_name,
        receiverId: data.receiver_id,
        receiverName: data.receiver_name,
        status: data.status,
        type: data.type,
      };
    } catch (error) {
      console.error('❌ Error accepting call:', error);
      throw error;
    }
  }

  async declineCall(callId) {
    try {
      await supabase
        .from('active_calls')
        .update({
          status: 'declined',
          ended_at: new Date().toISOString(),
        })
        .eq('id', callId);

      setTimeout(async () => {
        try {
          await supabase.from('active_calls').delete().eq('id', callId);
        } catch {}
      }, 30000);
    } catch (error) {
      console.error('❌ Error declining call:', error);
    }
  }

  async endCall(callId, userId, duration = 0, status = 'ended') {
    try {
      const finalStatus = status === 'ended' && duration === 0 ? 'missed' : status;

      await supabase
        .from('active_calls')
        .update({
          status: finalStatus,
          ended_at: new Date().toISOString(),
          duration: duration || 0,
        })
        .eq('id', callId);

      setTimeout(async () => {
        try {
          await supabase.from('active_calls').delete().eq('id', callId);
        } catch {}
      }, 5000);
    } catch (error) {
      console.error('❌ Error ending call:', error);
    }
  }

  listenForIncomingCalls(userId, callback) {
    if (!userId) return () => {};

    const fetchIncoming = async () => {
      try {
        const { data } = await supabase
          .from('active_calls')
          .select('*')
          .eq('receiver_id', userId)
          .eq('status', 'ringing');

        const calls = (data || []).map((c) => ({
          callId: c.id,
          callerId: c.caller_id,
          callerName: c.caller_name,
          receiverId: c.receiver_id,
          receiverName: c.receiver_name,
          status: c.status,
          type: c.type,
          createdAt: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
        }));

        callback(calls);
      } catch (err) {
        console.error('Error fetching incoming calls:', err);
      }
    };

    fetchIncoming();

    const channel = supabase
      .channel(`incoming_calls:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_calls',
          filter: `receiver_id=eq.${userId}`,
        },
        () => fetchIncoming()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  listenToCallStatus(callId, callback) {
    if (!callId) return () => {};

    const channel = supabase
      .channel(`call_status:${callId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_calls',
          filter: `id=eq.${callId}`,
        },
        (payload) => {
          if (payload.new) {
            callback({
              callId: payload.new.id,
              status: payload.new.status,
              acceptedAt: payload.new.accepted_at ? new Date(payload.new.accepted_at).getTime() : null,
              endedAt: payload.new.ended_at ? new Date(payload.new.ended_at).getTime() : null,
              duration: payload.new.duration || 0,
              ...payload.new,
            });
          } else {
            callback(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  async sendCallNotification(chatId, userId, friendId, type, duration = 0, callData = null) {
    try {
      if (!chatId) return;

      let messageText = '';
      let senderId = '';

      if (type === 'ended') {
        if (duration > 0) {
          messageText = `Call (${this.formatDuration(duration)})`;
        } else {
          messageText = `Missed call`;
        }
        senderId = callData?.callerId || userId;
      } else if (type === 'missed') {
        messageText = `Missed call`;
        senderId = friendId;
      }

      if (messageText) {
        await supabase.from('messages').insert({
          chat_id: chatId,
          sender_id: senderId,
          text: messageText,
          type: 'call',
          created_at: new Date().toISOString(),
        });

        await supabase
          .from('chats')
          .update({
            last_message: messageText,
            last_message_at: new Date().toISOString(),
          })
          .eq('id', chatId);
      }
    } catch (error) {
      console.error('❌ Error sending call notification:', error);
    }
  }

  async sendVideoCallNotification(chatId, userId, friendId, type, duration = 0, callData = null) {
    try {
      if (!chatId) return;

      let messageText = '';
      let senderId = '';

      if (type === 'ended') {
        messageText = duration > 0 ? `Video call (${this.formatDuration(duration)})` : 'Missed video call';
        senderId = callData?.callerId || userId;
      } else if (type === 'missed') {
        messageText = 'Missed video call';
        senderId = friendId;
      }

      if (messageText) {
        await supabase.from('messages').insert({
          chat_id: chatId,
          sender_id: senderId,
          text: messageText,
          type: 'video-call',
          created_at: new Date().toISOString(),
        });

        await supabase
          .from('chats')
          .update({
            last_message: messageText,
            last_message_at: new Date().toISOString(),
          })
          .eq('id', chatId);
      }
    } catch (error) {
      console.error('❌ Error sending video call notification:', error);
    }
  }

  formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

const callServiceInstance = new CallService();
export default callServiceInstance;
