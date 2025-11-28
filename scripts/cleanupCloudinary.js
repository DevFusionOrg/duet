const admin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.REACT_APP_CLOUDINARY_API_KEY,
  api_secret: process.env.REACT_APP_CLOUDINARY_API_SECRET
});

// Initialize Firebase Admin with better error handling
function initializeFirebase() {
  try {
    // Check if Firebase is already initialized
    if (admin.apps.length > 0) {
      return admin.app();
    }

    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    // Validate required environment variables
    if (!process.env.FIREBASE_PROJECT_ID || !privateKey || !process.env.FIREBASE_CLIENT_EMAIL) {
      throw new Error('Missing required Firebase environment variables');
    }

    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: privateKey,
      client_email: process.env.FIREBASE_CLIENT_EMAIL
    };

    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    throw error;
  }
}

async function cleanupCloudinaryImages() {
  let app;
  
  try {
    console.log('🚀 Starting Cloudinary cleanup...');
    
    // Validate Cloudinary configuration
    if (!process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 
        !process.env.REACT_APP_CLOUDINARY_API_KEY || 
        !process.env.REACT_APP_CLOUDINARY_API_SECRET) {
      throw new Error('Missing Cloudinary environment variables');
    }

    // Initialize Firebase
    app = initializeFirebase();
    const db = admin.firestore();
    
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    console.log('🔍 Searching for deleted image messages...');
    console.log('⏰ Time threshold:', twentyFourHoursAgo.toISOString());

    const deletedMessagesSnapshot = await db
      .collectionGroup('messages')
      .where('deletionTime', '<=', twentyFourHoursAgo)
      .where('isSaved', '==', false)
      .where('type', '==', 'image')
      .get();

    console.log(`📄 Found ${deletedMessagesSnapshot.size} deleted image messages`);

    const results = {
      deleted: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    // Early exit if no messages to process
    if (deletedMessagesSnapshot.size === 0) {
      console.log('✅ No images to delete. Cleanup completed!');
      return results;
    }

    for (const doc of deletedMessagesSnapshot.docs) {
      const messageData = doc.data();
      
      if (messageData.image && messageData.image.publicId) {
        try {
          console.log(`🗑️ Attempting to delete: ${messageData.image.publicId}`);
          const result = await cloudinary.uploader.destroy(messageData.image.publicId);
          
          if (result.result === 'ok') {
            console.log(`✅ Deleted from Cloudinary: ${messageData.image.publicId}`);
            results.deleted++;
          } else if (result.result === 'not found') {
            console.log(`⚠️ Image not found in Cloudinary: ${messageData.image.publicId}`);
            results.skipped++;
          } else {
            console.log(`❌ Failed to delete: ${messageData.image.publicId} - ${result.result}`);
            results.failed++;
            results.errors.push(`${messageData.image.publicId}: ${result.result}`);
          }
        } catch (error) {
          console.log(`❌ Error deleting: ${messageData.image.publicId} - ${error.message}`);
          results.failed++;
          results.errors.push(`${messageData.image.publicId}: ${error.message}`);
        }
      } else {
        results.skipped++;
      }
    }

    console.log('\n📊 Cleanup Summary:');
    console.log(`✅ Successfully deleted: ${results.deleted} images`);
    console.log(`❌ Failed to delete: ${results.failed} images`);
    console.log(`⚠️ Skipped: ${results.skipped} images`);
    
    if (results.errors.length > 0) {
      console.log('\n🚨 Errors:');
      results.errors.forEach(error => console.log(`   - ${error}`));
    }

    console.log('🎉 Cloudinary cleanup completed!');
    return results;
    
  } catch (error) {
    console.error('💥 Cleanup error:', error);
    throw error;
  } finally {
    // Always clean up Firebase app
    if (app) {
      try {
        await app.delete();
        console.log('🔥 Firebase app cleaned up');
      } catch (error) {
        console.log('⚠️ Error cleaning up Firebase app:', error.message);
      }
    }
  }
}

// Run if called directly
if (require.main === module) {
  cleanupCloudinaryImages()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupCloudinaryImages };