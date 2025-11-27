const admin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.REACT_APP_CLOUDINARY_API_KEY,
  api_secret: process.env.REACT_APP_CLOUDINARY_API_SECRET
});

// Initialize Firebase Admin
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function cleanupCloudinaryImages() {
  try {
    const db = admin.firestore();
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    console.log('🔍 Searching for deleted image messages...');

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
      errors: []
    };

    for (const doc of deletedMessagesSnapshot.docs) {
      const messageData = doc.data();
      
      if (messageData.image && messageData.image.publicId) {
        try {
          const result = await cloudinary.uploader.destroy(messageData.image.publicId);
          
          if (result.result === 'ok') {
            console.log(`✅ Deleted from Cloudinary: ${messageData.image.publicId}`);
            results.deleted++;
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
      }
    }

    console.log('\n📊 Cleanup Summary:');
    console.log(`✅ Successfully deleted: ${results.deleted} images`);
    console.log(`❌ Failed to delete: ${results.failed} images`);
    
    if (results.errors.length > 0) {
      console.log('\n🚨 Errors:');
      results.errors.forEach(error => console.log(`   - ${error}`));
    }

    console.log('\n🎉 Cloudinary cleanup completed!');
    
    await admin.app().delete();
    
  } catch (error) {
    console.error('💥 Cleanup error:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  cleanupCloudinaryImages()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { cleanupCloudinaryImages };