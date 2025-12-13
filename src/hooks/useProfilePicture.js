import { useState, useCallback } from "react";
import { updateProfile } from "firebase/auth";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { openProfilePictureUploadWidget, getOptimizedProfilePictureUrl } from "../services/cloudinary";

export function useProfilePicture(user, setProfile, setMessage) {
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleProfilePictureUpload = useCallback(async () => {
    if (!user) return;

    setUploadingImage(true);
    setMessage("");

    try {
      // Use profile picture specific upload widget
      const result = await openProfilePictureUploadWidget();
      
      if (result) {
        // Generate optimized profile picture URL
        const optimizedUrl = getOptimizedProfilePictureUrl(result.public_id, 200);
        
        // Update Firebase Auth profile
        await updateProfile(user, {
          photoURL: optimizedUrl
        });

        // Update Firestore user document
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          photoURL: optimizedUrl,
          cloudinaryPublicId: result.public_id,
          profilePictureUpdatedAt: new Date().toISOString()
        });

        setMessage("Profile picture updated successfully!");
        setProfile(prev => ({
          ...prev,
          photoURL: optimizedUrl,
          cloudinaryPublicId: result.public_id
        }));
      }
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      if (error.message === "Upload cancelled") {
        setMessage("Profile picture upload cancelled");
      } else {
        setMessage("Error uploading profile picture: " + error.message);
      }
    } finally {
      setUploadingImage(false);
    }
  }, [user, setProfile, setMessage]);

  const handleRemoveProfilePicture = useCallback(async () => {
    if (!user) return;

    try {
      const originalPhotoURL = user.providerData?.[0]?.photoURL || null;
      await updateProfile(user, {
        photoURL: originalPhotoURL
      });

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        photoURL: originalPhotoURL,
        cloudinaryPublicId: null,
        profilePictureUpdatedAt: null
      });

      setMessage("Profile picture removed successfully!");
      setProfile(prev => ({
        ...prev,
        photoURL: originalPhotoURL,
        cloudinaryPublicId: null
      }));
    } catch (error) {
      console.error("Error removing profile picture:", error);
      setMessage("Error removing profile picture: " + error.message);
      throw error;
    }
  }, [user, setProfile, setMessage]);

  return {
    uploadingImage,
    handleProfilePictureUpload,
    handleRemoveProfilePicture
  };
}