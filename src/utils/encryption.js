// End-to-End Encryption Utilities using Web Crypto API

const ENCRYPTION_ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

/**
 * Generate a random encryption key for a chat
 */
export const generateChatKey = async () => {
  const key = await crypto.subtle.generateKey(
    {
      name: ENCRYPTION_ALGORITHM,
      length: KEY_LENGTH,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
  
  // Export key to store it
  const exportedKey = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(exportedKey);
};

/**
 * Import a chat key from base64 string
 */
export const importChatKey = async (keyBase64) => {
  const keyBuffer = base64ToArrayBuffer(keyBase64);
  return await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    {
      name: ENCRYPTION_ALGORITHM,
      length: KEY_LENGTH,
    },
    true,
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypt a message text
 */
export const encryptMessage = async (text, keyBase64) => {
  try {
    if (!text || typeof text !== 'string') {
      return text;
    }

    const key = await importChatKey(keyBase64);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encodedText = new TextEncoder().encode(text);

    const encryptedData = await crypto.subtle.encrypt(
      {
        name: ENCRYPTION_ALGORITHM,
        iv: iv,
      },
      key,
      encodedText
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);

    return arrayBufferToBase64(combined);
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
};

/**
 * Decrypt a message text
 */
export const decryptMessage = async (encryptedText, keyBase64) => {
  try {
    if (!encryptedText || typeof encryptedText !== 'string') {
      return encryptedText;
    }

    const key = await importChatKey(keyBase64);
    const combined = base64ToArrayBuffer(encryptedText);
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, IV_LENGTH);
    const encryptedData = combined.slice(IV_LENGTH);

    const decryptedData = await crypto.subtle.decrypt(
      {
        name: ENCRYPTION_ALGORITHM,
        iv: iv,
      },
      key,
      encryptedData
    );

    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    console.error('Decryption error:', error);
    // Return encrypted text if decryption fails (backward compatibility)
    return encryptedText;
  }
};

/**
 * Store chat key in IndexedDB
 */
export const storeChatKey = async (chatId, keyBase64) => {
  try {
    const dbName = 'duet-encryption-keys';
    const storeName = 'chat-keys';
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      
      request.onerror = () => reject(request.error);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'chatId' });
        }
      };
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        store.put({ chatId, key: keyBase64 });
        
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      };
    });
  } catch (error) {
    console.error('Error storing chat key:', error);
    throw error;
  }
};

/**
 * Retrieve chat key from IndexedDB
 */
export const getChatKey = async (chatId) => {
  try {
    const dbName = 'duet-encryption-keys';
    const storeName = 'chat-keys';
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      
      request.onerror = () => reject(request.error);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'chatId' });
        }
      };
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const getRequest = store.get(chatId);
        
        getRequest.onsuccess = () => {
          db.close();
          resolve(getRequest.result?.key || null);
        };
        
        getRequest.onerror = () => {
          db.close();
          reject(getRequest.error);
        };
      };
    });
  } catch (error) {
    console.error('Error getting chat key:', error);
    return null;
  }
};

/**
 * Initialize chat encryption (generate and store key)
 * Now also stores key in Firestore for sharing between users
 */
export const initializeChatEncryption = async (chatId, db) => {
  try {
    // First check local storage
    let key = await getChatKey(chatId);
    
    if (!key && db) {
      // If not in local storage, try fetching from Firestore
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const chatRef = doc(db, 'chats', chatId);
        const chatSnap = await getDoc(chatRef);
        
        if (chatSnap.exists() && chatSnap.data().encryptionKey) {
          key = chatSnap.data().encryptionKey;
          // Store locally for future use
          await storeChatKey(chatId, key);
        }
      } catch (firestoreError) {
        console.log('Key not in Firestore yet, will generate new one');
      }
    }
    
    if (!key) {
      // Generate new key if still not found
      key = await generateChatKey();
      await storeChatKey(chatId, key);
      
      // Store in Firestore for the other user
      if (db) {
        try {
          const { doc, setDoc, getDoc } = await import('firebase/firestore');
          const chatRef = doc(db, 'chats', chatId);
          const chatSnap = await getDoc(chatRef);
          
          // Only set if chat exists and doesn't already have a key
          if (chatSnap.exists() && !chatSnap.data().encryptionKey) {
            await setDoc(chatRef, { encryptionKey: key }, { merge: true });
          }
        } catch (firestoreError) {
          console.error('Error storing key in Firestore:', firestoreError);
        }
      }
    }
    
    return key;
  } catch (error) {
    console.error('Error initializing chat encryption:', error);
    throw error;
  }
};

/**
 * Delete chat key from IndexedDB (when chat is deleted)
 */
export const deleteChatKey = async (chatId) => {
  try {
    const dbName = 'duet-encryption-keys';
    const storeName = 'chat-keys';
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        store.delete(chatId);
        
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      };
    });
  } catch (error) {
    console.error('Error deleting chat key:', error);
  }
};

// Helper functions
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
