

const ENCRYPTION_ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

export const generateChatKey = async () => {
  const key = await crypto.subtle.generateKey(
    {
      name: ENCRYPTION_ALGORITHM,
      length: KEY_LENGTH,
    },
    true, 
    ['encrypt', 'decrypt']
  );

  const exportedKey = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(exportedKey);
};

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

    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);

    return arrayBufferToBase64(combined);
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
};

export const decryptMessage = async (encryptedText, keyBase64) => {
  try {
    if (!encryptedText || typeof encryptedText !== 'string') {
      return encryptedText;
    }

    const key = await importChatKey(keyBase64);
    const combined = base64ToArrayBuffer(encryptedText);

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
    
    return encryptedText;
  }
};

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

export const initializeChatEncryption = async (chatId, db) => {
  try {
    
    let key = await getChatKey(chatId);
    
    if (!key && db) {
      
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const chatRef = doc(db, 'chats', chatId);
        const chatSnap = await getDoc(chatRef);
        
        if (chatSnap.exists() && chatSnap.data().encryptionKey) {
          key = chatSnap.data().encryptionKey;
          
          await storeChatKey(chatId, key);
        }
      } catch (firestoreError) {
        console.log('Key not in Firestore yet, will generate new one');
      }
    }
    
    if (!key) {
      
      key = await generateChatKey();
      await storeChatKey(chatId, key);

      if (db) {
        try {
          const { doc, setDoc, getDoc } = await import('firebase/firestore');
          const chatRef = doc(db, 'chats', chatId);
          const chatSnap = await getDoc(chatRef);

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
