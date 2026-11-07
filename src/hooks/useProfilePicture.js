import { useState, useCallback } from "react";
import { supabase } from "../supabase/supabase";
import { updateUserProfilePicture } from "../firebase/firestore";
import { openProfilePictureUploadWidget, getOptimizedProfilePictureUrl } from "../services/cloudinary";

export function useProfilePicture(user, setProfile, setMessage) {
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleProfilePictureUpload = useCallback(async () => {
    if (!user) return;

    setMessage("");

    try {
      const result = await openProfilePictureUploadWidget(() => {
        setUploadingImage(true);
      });
      
      if (result) {
        const optimizedUrl = getOptimizedProfilePictureUrl(result.public_id, 200);

        await supabase.auth.updateUser({
          data: { avatar_url: optimizedUrl, picture: optimizedUrl }
        });

        await updateUserProfilePicture(user.uid, optimizedUrl, result.public_id);

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
      await supabase.auth.updateUser({
        data: { avatar_url: null, picture: null }
      });

      await updateUserProfilePicture(user.uid, null, null);

      setMessage("Profile picture removed successfully!");
      setProfile(prev => ({
        ...prev,
        photoURL: null,
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
