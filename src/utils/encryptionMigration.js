/**
 * Migration Utility for End-to-End Encryption
 * 
 * This script helps with managing the transition to encrypted messages.
 * 
 * NOTE: This is for reference only. Existing messages will remain unencrypted.
 * New messages will be automatically encrypted.
 * 
 * The system gracefully handles both encrypted and unencrypted messages:
 * - Old messages: Displayed as-is (no 'encrypted' flag)
 * - New messages: Automatically encrypted (has 'encrypted: true' flag)
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { initializeChatEncryption } from './encryption';

/**
 * Check if user has any existing chats
 */
export const hasExistingChats = async (userId) => {
  try {
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.length > 0;
  } catch (error) {
    console.error('Error checking existing chats:', error);
    return false;
  }
};

/**
 * Initialize encryption keys for all user's chats
 * Call this once after user logs in for the first time with encryption enabled
 */
export const initializeAllChatKeys = async (userId, db) => {
  try {
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', userId));
    const snapshot = await getDocs(q);
    
    console.log(`Initializing encryption for ${snapshot.docs.length} chats...`);
    
    const promises = snapshot.docs.map(async (doc) => {
      const chatId = doc.id;
      await initializeChatEncryption(chatId, db);
      console.log(`✓ Initialized encryption for chat: ${chatId}`);
    });
    
    await Promise.all(promises);
    console.log('All chat encryption keys initialized successfully');
    
    return { success: true, count: snapshot.docs.length };
  } catch (error) {
    console.error('Error initializing chat keys:', error);
    throw error;
  }
};

/**
 * Display encryption status notification to user
 */
export const showEncryptionInfo = () => {
  const hasSeenInfo = localStorage.getItem('encryption-info-seen');
  
  if (!hasSeenInfo) {
    console.log('🔒 End-to-end encryption is now enabled!');
    console.log('Your new messages will be encrypted and can only be read by you and your chat partner.');
    console.log('Previous messages remain unchanged.');
    
    localStorage.setItem('encryption-info-seen', 'true');
    
    return {
      title: 'End-to-End Encryption Enabled',
      message: 'Your messages are now protected with end-to-end encryption. Only you and your chat partner can read them.',
      type: 'info'
    };
  }
  
  return null;
};

/**
 * Get encryption statistics for debugging
 */
export const getEncryptionStats = async (chatId) => {
  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const snapshot = await getDocs(messagesRef);
    
    const stats = {
      total: snapshot.docs.length,
      encrypted: 0,
      unencrypted: 0,
    };
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.encrypted) {
        stats.encrypted++;
      } else {
        stats.unencrypted++;
      }
    });
    
    return stats;
  } catch (error) {
    console.error('Error getting encryption stats:', error);
    return null;
  }
};

export default {
  hasExistingChats,
  initializeAllChatKeys,
  showEncryptionInfo,
  getEncryptionStats,
};
