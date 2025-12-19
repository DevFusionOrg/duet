# Testing the Encryption Implementation

## Quick Test Instructions

### Option 1: Test in Browser Console

Open your app, press F12, and run:

```javascript
// Import encryption functions (if not already available)
import { encryptMessage, decryptMessage, generateChatKey } from './utils/encryption';

// 1. Generate a key
const key = await generateChatKey();
console.log('Generated key:', key.substring(0, 20) + '...');

// 2. Encrypt a message
const plaintext = "Hello, this is a secret message!";
const encrypted = await encryptMessage(plaintext, key);
console.log('Encrypted:', encrypted);

// 3. Decrypt the message
const decrypted = await decryptMessage(encrypted, key);
console.log('Decrypted:', decrypted);

// 4. Verify
console.log('Match:', plaintext === decrypted ? '✅ SUCCESS' : '❌ FAILED');
```

### Option 2: Use the Test Component

1. **Add to your App.js temporarily:**

```javascript
// Add import at top
import EncryptionTest from './Components/EncryptionTest';

// Add route (if using React Router)
<Route path="/encryption-test" element={<EncryptionTest />} />

// Or add conditionally
{process.env.NODE_ENV === 'development' && <EncryptionTest />}
```

2. **Navigate to the test page:**
   - Visit: `http://localhost:3000/encryption-test`
   - Or render it conditionally in development

3. **Run the tests:**
   - Click "Run Full Test" button
   - Verify all steps pass
   - Check encrypted output is unreadable

### Option 3: Test with Real Messages

1. **Start your app:**
```bash
npm start
```

2. **Send a test message:**
   - Open a chat
   - Send any message
   - Message should send normally

3. **Verify in Firebase Console:**
   - Go to Firebase Console
   - Navigate to: Firestore Database → `chats` → `{chatId}` → `messages`
   - Click on any message document
   - Look at the `text` field

**Expected Result:**
```
text: "jA3kLp9xR2..." (long base64 string)
encrypted: true
```

4. **Verify in app:**
   - Message should display normally
   - No errors in console
   - Chat works as before

## What to Check

### ✅ Success Indicators
- [ ] Messages send successfully
- [ ] Messages display correctly in chat
- [ ] In Firestore, `text` field is encrypted (base64 string)
- [ ] `encrypted: true` flag present on new messages
- [ ] No console errors
- [ ] Edit message works
- [ ] Reply works
- [ ] Encryption indicator shows in chat

### ❌ Failure Indicators
- Messages not sending
- Messages showing as encrypted text
- Console errors about encryption
- Messages not decrypting
- Performance issues

## Common Issues

### Issue: "crypto.subtle is undefined"
**Solution:** Make sure you're using HTTPS or localhost

### Issue: "Failed to decrypt message"
**Solution:** 
- Check browser console for details
- Verify IndexedDB is enabled
- Try clearing site data and refresh

### Issue: Messages showing as base64
**Solution:**
- Encryption key not found
- Check getChatKey() is working
- Verify initializeChatEncryption() is called

### Issue: Performance is slow
**Solution:**
- Check encryption is running async
- Verify no synchronous blocking
- Profile in Chrome DevTools

## Benchmark Performance

Run this in console to measure encryption speed:

```javascript
import { encryptMessage, decryptMessage, generateChatKey } from './utils/encryption';

const key = await generateChatKey();
const message = "Test message for performance";

// Encryption speed
console.time('encrypt');
const encrypted = await encryptMessage(message, key);
console.timeEnd('encrypt');

// Decryption speed
console.time('decrypt');
const decrypted = await decryptMessage(encrypted, key);
console.timeEnd('decrypt');

// Expected: < 5ms for both
```

## Verify Firestore Data

Check that your Firestore contains encrypted data:

1. Go to Firebase Console
2. Firestore Database → `chats`
3. Pick any chat → `messages`
4. Open a message document

**Before Encryption:**
```json
{
  "text": "Hello, how are you?",
  "encrypted": false or undefined
}
```

**After Encryption:**
```json
{
  "text": "kJx8vH3N2P1mQw5YnR8cL...",
  "encrypted": true
}
```

## Next Steps

1. ✅ Test encryption locally
2. ✅ Verify Firestore data is encrypted
3. ✅ Test on mobile browsers
4. ✅ Remove EncryptionTest component before production
5. ✅ Monitor performance in production

## Remove Test Component

Before deploying to production:

```javascript
// Remove from App.js
- import EncryptionTest from './Components/EncryptionTest';
- <Route path="/encryption-test" element={<EncryptionTest />} />

// Or delete files
rm src/Components/EncryptionTest.jsx
rm src/styles/EncryptionTest.css
```

---

**Ready to deploy once testing is complete!** 🚀
