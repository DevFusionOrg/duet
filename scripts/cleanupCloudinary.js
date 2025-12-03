const admin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');

dotenv.config();

cloudinary.config({
  cloud_name: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.REACT_APP_CLOUDINARY_API_KEY,
  api_secret: process.env.REACT_APP_CLOUDINARY_API_SECRET
});

// Initialize Firebase Admin
function initializeFirebase() {
  try {
    // Check if Firebase is already initialized
    if (admin.apps.length > 0) {
      return admin.app();
    }

    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
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

// NEW: Simpler approach to get referenced images without complex queries
async function getReferencedImagePublicIds(db) {
  try {
    console.log('🔍 Fetching referenced images from Firebase...');
    
    const referencedPublicIds = new Set();
    
    // NEW APPROACH 1: Try to get all users and their messages
    try {
      const usersSnapshot = await db.collection('users').get();
      console.log(`📊 Found ${usersSnapshot.size} users`);
      
      for (const userDoc of usersSnapshot.docs) {
        try {
          // Get user's messages collection
          const messagesRef = userDoc.ref.collection('messages');
          const imageMessagesSnapshot = await messagesRef
            .where('type', '==', 'image')
            .limit(100) // Limit to avoid timeout
            .get();
          
          imageMessagesSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.image && data.image.publicId) {
              referencedPublicIds.add(data.image.publicId);
            }
          });
          
          console.log(`   User ${userDoc.id}: Found ${imageMessagesSnapshot.size} image messages`);
        } catch (userError) {
          console.log(`   ⚠️ Error processing user ${userDoc.id}: ${userError.message}`);
        }
      }
    } catch (usersError) {
      console.log(`⚠️ Could not fetch users: ${usersError.message}`);
    }
    
    // NEW APPROACH 2: Try direct collection paths if you know them
    // Add any known specific collection paths here
    const knownCollections = [
      'chatrooms/{chatroomId}/messages',
      'conversations/{conversationId}/messages'
      // Add your actual collection paths
    ];
    
    for (const collectionPath of knownCollections) {
      try {
        // This is a simplified example - adjust based on your actual structure
        const collectionName = collectionPath.split('/')[0];
        const subCollectionName = collectionPath.split('/')[2];
        
        if (collectionName && subCollectionName) {
          const parentDocs = await db.collection(collectionName).limit(10).get();
          
          for (const parentDoc of parentDocs.docs) {
            const messagesSnapshot = await parentDoc.ref
              .collection(subCollectionName)
              .where('type', '==', 'image')
              .limit(50)
              .get();
            
            messagesSnapshot.forEach(doc => {
              const data = doc.data();
              if (data.image && data.image.publicId) {
                referencedPublicIds.add(data.image.publicId);
              }
            });
          }
        }
      } catch (pathError) {
        console.log(`⚠️ Could not fetch from ${collectionPath}: ${pathError.message}`);
      }
    }
    
    console.log(`📊 Found ${referencedPublicIds.size} total referenced images in Firebase`);
    return referencedPublicIds;
  } catch (error) {
    console.error('❌ Error fetching referenced images:', error.message);
    // Return empty set instead of throwing, so cleanup can continue
    return new Set();
  }
}

// NEW: Alternative function without Firebase queries
async function cleanupByAgeOnly() {
  try {
    console.log('🚀 Starting Cloudinary asset cleanup by age only...');
    
    // Validate Cloudinary configuration
    if (!process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 
        !process.env.REACT_APP_CLOUDINARY_API_KEY || 
        !process.env.REACT_APP_CLOUDINARY_API_SECRET) {
      throw new Error('Missing Cloudinary environment variables');
    }
    
    // Get all assets from Cloudinary
    console.log('🔍 Fetching Cloudinary assets...');
    const result = await cloudinary.api.resources({
      type: 'upload',
      max_results: 500
    });
    
    const cloudinaryAssets = result.resources;
    console.log(`📁 Found ${cloudinaryAssets.length} total assets in Cloudinary`);
    
    const results = {
      totalAssets: cloudinaryAssets.length,
      oldAssets: 0,
      deleted: 0,
      failed: 0,
      errors: []
    };

    // Delete assets older than 30 days (adjust as needed)
    const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
    
    const oldAssets = cloudinaryAssets.filter(asset => {
      const createdAt = new Date(asset.created_at);
      return createdAt < thirtyDaysAgo;
    });
    
    results.oldAssets = oldAssets.length;
    console.log(`🗑️ Found ${oldAssets.length} assets older than 30 days`);
    
    // Delete old assets
    for (const asset of oldAssets) {
      try {
        console.log(`🗑️ Deleting old asset: ${asset.public_id}`);
        
        const result = await cloudinary.uploader.destroy(asset.public_id);
        
        if (result.result === 'ok') {
          console.log(`✅ Deleted: ${asset.public_id}`);
          results.deleted++;
        } else if (result.result === 'not found') {
          console.log(`⚠️ Already deleted: ${asset.public_id}`);
        } else {
          console.log(`❌ Failed: ${asset.public_id} - ${result.result}`);
          results.failed++;
          results.errors.push(`${asset.public_id}: ${result.result}`);
        }
      } catch (error) {
        console.log(`❌ Error: ${asset.public_id} - ${error.message}`);
        results.failed++;
        results.errors.push(`${asset.public_id}: ${error.message}`);
      }
    }

    console.log('\n📊 Cleanup Summary:');
    console.log(`📁 Total Cloudinary assets: ${results.totalAssets}`);
    console.log(`🗑️ Old assets found: ${results.oldAssets}`);
    console.log(`✅ Successfully deleted: ${results.deleted} assets`);
    console.log(`❌ Failed to delete: ${results.failed} assets`);
    
    if (results.errors.length > 0) {
      console.log('\n🚨 Errors:');
      results.errors.forEach(error => console.log(`   - ${error}`));
    }

    console.log('🎉 Cleanup completed!');
    return results;
    
  } catch (error) {
    console.error('💥 Cleanup error:', error);
    throw error;
  }
}

// Main cleanup function (updated to handle errors gracefully)
async function cleanupCloudinaryAssets() {
  let app;
  
  try {
    console.log('🚀 Starting Cloudinary asset cleanup...');
    
    // Validate Cloudinary configuration
    if (!process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 
        !process.env.REACT_APP_CLOUDINARY_API_KEY || 
        !process.env.REACT_APP_CLOUDINARY_API_SECRET) {
      throw new Error('Missing Cloudinary environment variables');
    }

    // Initialize Firebase
    app = initializeFirebase();
    const db = admin.firestore();
    
    // Get all assets from Cloudinary
    const cloudinaryAssets = await cloudinary.api.resources({
      type: 'upload',
      max_results: 500
    });
    
    console.log(`📁 Found ${cloudinaryAssets.resources.length} total assets in Cloudinary`);
    
    // Try to get referenced images, but continue even if it fails
    let referencedPublicIds;
    try {
      referencedPublicIds = await getReferencedImagePublicIds(db);
    } catch (fbError) {
      console.log(`⚠️ Could not fetch Firebase references: ${fbError.message}`);
      console.log('⚠️ Continuing with age-based cleanup only...');
      referencedPublicIds = new Set();
    }
    
    const results = {
      totalAssets: cloudinaryAssets.resources.length,
      orphanedAssets: 0,
      deleted: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    // Identify orphaned assets
    const orphanedAssets = cloudinaryAssets.resources.filter(asset => {
      const createdAt = new Date(asset.created_at);
      const twentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
      const isOldEnough = createdAt < twentyFourHoursAgo;
      
      // If we couldn't get references, just use age
      if (referencedPublicIds.size === 0) {
        return isOldEnough;
      }
      
      const isNotReferenced = !referencedPublicIds.has(asset.public_id);
      return isOldEnough && isNotReferenced;
    });
    
    results.orphanedAssets = orphanedAssets.length;
    console.log(`🗑️ Found ${orphanedAssets.length} orphaned/old assets to delete`);
    
    // Delete orphaned assets
    for (const asset of orphanedAssets) {
      try {
        console.log(`🗑️ Deleting: ${asset.public_id}`);
        
        const result = await cloudinary.uploader.destroy(asset.public_id);
        
        if (result.result === 'ok') {
          console.log(`✅ Deleted: ${asset.public_id}`);
          results.deleted++;
        } else if (result.result === 'not found') {
          console.log(`⚠️ Not found: ${asset.public_id}`);
          results.skipped++;
        } else {
          console.log(`❌ Failed: ${asset.public_id} - ${result.result}`);
          results.failed++;
          results.errors.push(`${asset.public_id}: ${result.result}`);
        }
      } catch (error) {
        console.log(`❌ Error: ${asset.public_id} - ${error.message}`);
        results.failed++;
        results.errors.push(`${asset.public_id}: ${error.message}`);
      }
    }

    console.log('\n📊 Cleanup Summary:');
    console.log(`📁 Total Cloudinary assets: ${results.totalAssets}`);
    console.log(`🗑️ Assets to delete: ${results.orphanedAssets}`);
    console.log(`✅ Successfully deleted: ${results.deleted} assets`);
    console.log(`❌ Failed to delete: ${results.failed} assets`);
    console.log(`⚠️ Skipped: ${results.skipped} assets`);
    
    if (results.errors.length > 0) {
      console.log('\n🚨 Errors:');
      results.errors.forEach(error => console.log(`   - ${error}`));
    }

    console.log('🎉 Cleanup completed!');
    return results;
    
  } catch (error) {
    console.error('💥 Cleanup error:', error.message);
    
    // Try the simpler cleanup if main one fails
    console.log('\n🔄 Attempting simpler cleanup...');
    try {
      const simpleResults = await cleanupByAgeOnly();
      return simpleResults;
    } catch (simpleError) {
      console.error('❌ Both cleanup methods failed');
      throw error;
    }
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

// Quick test function
async function testFirebaseConnection() {
  try {
    console.log('🧪 Testing Firebase connection...');
    const app = initializeFirebase();
    const db = admin.firestore();
    
    // Simple test query
    const testSnapshot = await db.collection('users').limit(1).get();
    console.log(`✅ Firebase connected. Users count: ${testSnapshot.size}`);
    
    await app.delete();
    console.log('✅ Test passed');
    return true;
  } catch (error) {
    console.error('❌ Firebase test failed:', error.message);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--test')) {
    testFirebaseConnection()
      .then(success => process.exit(success ? 0 : 1))
      .catch(() => process.exit(1));
  } else if (args.includes('--simple')) {
    cleanupByAgeOnly()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    cleanupCloudinaryAssets()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

module.exports = { 
  cleanupCloudinaryAssets, 
  cleanupByAgeOnly,
  testFirebaseConnection
};