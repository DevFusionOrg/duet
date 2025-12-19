import React, { useState } from 'react';
import {
  encryptMessage,
  decryptMessage,
  generateChatKey,
  storeChatKey,
  getChatKey,
} from '../utils/encryption';
import '../styles/EncryptionTest.css';

const EncryptionTest = () => {
  const [plaintext, setPlaintext] = useState('Hello, this is a secret message!');
  const [encrypted, setEncrypted] = useState('');
  const [decrypted, setDecrypted] = useState('');
  const [chatKey, setChatKey] = useState('');
  const [status, setStatus] = useState('');
  const [testChatId] = useState('test-chat-123');

  const handleGenerateKey = async () => {
    try {
      setStatus('Generating key...');
      const key = await generateChatKey();
      setChatKey(key.substring(0, 20) + '...'); 
      await storeChatKey(testChatId, key);
      setStatus('✅ Key generated and stored!');
    } catch (error) {
      setStatus('❌ Error: ' + error.message);
    }
  };

  const handleEncrypt = async () => {
    try {
      setStatus('Encrypting...');
      const key = await getChatKey(testChatId);
      if (!key) {
        setStatus('❌ No key found. Generate key first!');
        return;
      }
      const encryptedText = await encryptMessage(plaintext, key);
      setEncrypted(encryptedText);
      setStatus('✅ Message encrypted!');
    } catch (error) {
      setStatus('❌ Error: ' + error.message);
    }
  };

  const handleDecrypt = async () => {
    try {
      setStatus('Decrypting...');
      const key = await getChatKey(testChatId);
      if (!key) {
        setStatus('❌ No key found. Generate key first!');
        return;
      }
      const decryptedText = await decryptMessage(encrypted, key);
      setDecrypted(decryptedText);
      setStatus('✅ Message decrypted!');
    } catch (error) {
      setStatus('❌ Error: ' + error.message);
    }
  };

  const handleTestAll = async () => {
    try {
      setStatus('Running full test...');

      const key = await generateChatKey();
      await storeChatKey(testChatId, key);
      setChatKey(key.substring(0, 20) + '...');

      const encryptedText = await encryptMessage(plaintext, key);
      setEncrypted(encryptedText);

      const decryptedText = await decryptMessage(encryptedText, key);
      setDecrypted(decryptedText);

      if (decryptedText === plaintext) {
        setStatus('✅ ALL TESTS PASSED! Encryption working correctly!');
      } else {
        setStatus('❌ Test failed: Decrypted text does not match original');
      }
    } catch (error) {
      setStatus('❌ Test failed: ' + error.message);
    }
  };

  return (
    <div className="encryption-test-container">
      <div className="encryption-test-card">
        <h2>🔒 Encryption Test Panel</h2>
        <p className="encryption-test-subtitle">
          Test the end-to-end encryption system
        </p>

        <div className="encryption-test-section">
          <label>1. Plaintext Message</label>
          <textarea
            value={plaintext}
            onChange={(e) => setPlaintext(e.target.value)}
            placeholder="Enter a message to encrypt..."
            rows={3}
          />
        </div>

        <div className="encryption-test-section">
          <label>2. Chat Encryption Key</label>
          <input
            type="text"
            value={chatKey}
            readOnly
            placeholder="Click 'Generate Key' button"
          />
          <button onClick={handleGenerateKey} className="test-btn">
            Generate Key
          </button>
        </div>

        <div className="encryption-test-section">
          <label>3. Encrypted Message</label>
          <textarea
            value={encrypted}
            readOnly
            placeholder="Encrypted text will appear here..."
            rows={3}
          />
          <button onClick={handleEncrypt} className="test-btn">
            Encrypt Message
          </button>
        </div>

        <div className="encryption-test-section">
          <label>4. Decrypted Message</label>
          <textarea
            value={decrypted}
            readOnly
            placeholder="Decrypted text will appear here..."
            rows={3}
          />
          <button onClick={handleDecrypt} className="test-btn">
            Decrypt Message
          </button>
        </div>

        <div className="encryption-test-actions">
          <button onClick={handleTestAll} className="test-btn primary">
            🚀 Run Full Test
          </button>
        </div>

        {status && (
          <div className={`encryption-test-status ${status.startsWith('✅') ? 'success' : status.startsWith('❌') ? 'error' : ''}`}>
            {status}
          </div>
        )}

        <div className="encryption-test-info">
          <h3>How to Test:</h3>
          <ol>
            <li>Enter a message in the plaintext box</li>
            <li>Click "Generate Key" to create an encryption key</li>
            <li>Click "Encrypt Message" to see the encrypted version</li>
            <li>Click "Decrypt Message" to decrypt it back</li>
            <li>Or click "Run Full Test" to do everything at once</li>
          </ol>
          
          <h3>What to Verify:</h3>
          <ul>
            <li>Encrypted text should be a long base64 string</li>
            <li>Decrypted text should match the original plaintext</li>
            <li>The encrypted text should be unreadable</li>
          </ul>

          <p className="warning">
            ⚠️ This is a test component. Remove it before deploying to production.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EncryptionTest;
