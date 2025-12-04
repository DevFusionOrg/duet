import { useState, useCallback } from "react";
import { updateProfile } from "firebase/auth";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { openUploadWidget } from "../services/cloudinary";

export function useProfilePicture(user, setProfile, setMessage) {
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleProfilePictureUpload = useCallback(async () => {
    if (!user) return;

    setUploadingImage(true);
    setMessage("");

    try {
      const result = await openUploadWidget();
      
      if (result) {
        await updateProfile(user, {
          photoURL: result.secure_url
        });

        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          photoURL: result.secure_url,
          cloudinaryPublicId: result.public_id
        });

        setMessage("Profile picture updated successfully!");
        setProfile(prev => ({
          ...prev,
          photoURL: result.secure_url
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
        cloudinaryPublicId: null
      });

      setMessage("Profile picture removed successfully!");
      setProfile(prev => ({
        ...prev,
        photoURL: originalPhotoURL
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