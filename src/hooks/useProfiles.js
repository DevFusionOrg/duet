import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase/supabase";
import { 
  listenToUserProfile, 
  getUserProfile,
  updateUsername,
  createUserProfile,
} from "../firebase/firestore";

export function useProfiles(user, uid) {
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({
    displayName: "",
    username: "",
    bio: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const isOwnProfile = !uid || uid === user?.uid;

  const loadProfileFallback = useCallback(async () => {
    try {
      const profileUid = uid || user?.uid;
      let userProfile = await getUserProfile(profileUid);

      if (!userProfile && isOwnProfile && user) {
        await createUserProfile(user);
        userProfile = await getUserProfile(profileUid);
      }

      if (!userProfile) {
        userProfile = {
          uid: profileUid,
          displayName: "User",
          username: "user",
          bio: "",
        };
      }

      setProfile(userProfile);

      if (isOwnProfile) {
        setFormData({
          displayName: userProfile.displayName || "",
          username: userProfile.username || "",
          bio: userProfile.bio || "",
        });
      }
    } catch (error) {
      console.error("Error in fallback:", error);
    }
  }, [user, uid, isOwnProfile]);

  useEffect(() => {
    if (!user && !uid) return;

    const profileUid = uid || user?.uid;
    const unsubscribe = listenToUserProfile(profileUid, (userProfile) => {
      if (userProfile) {
        setProfile(userProfile);
        if (isOwnProfile) {
          setFormData({
            displayName: userProfile.displayName || user?.displayName || "",
            username: userProfile.username || user?.email?.split("@")[0] || "",
            bio: userProfile.bio || "",
          });
        }
      } else {
        loadProfileFallback();
      }
    });

    return unsubscribe;
  }, [user, uid, isOwnProfile, loadProfileFallback]);

  const handleFormChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!user) return false;

    setLoading(true);
    setMessage("");

    try {
      if (formData.displayName !== user.displayName) {
        await supabase.auth.updateUser({
          data: { full_name: formData.displayName, name: formData.displayName }
        });
      }

      if (formData.username && formData.username !== profile?.username) {
        await updateUsername(user.uid, formData.username);
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: formData.displayName,
          bio: formData.bio,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.uid);

      if (error) throw error;

      setMessage("Profile updated!");
      return true;
    } catch (error) {
      console.error("Profile update error:", error);
      setMessage(error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getProfilePictureUrl = () => {
    if (profile?.photoURL) {
      return profile.photoURL;
    }
    if (user?.photoURL && isOwnProfile) {
      return user.photoURL;
    }
    return "/default-avatar.png";
  };

  const isCloudinaryPicture = () => {
    return profile?.cloudinaryPublicId || 
           (profile?.photoURL && profile.photoURL.includes('cloudinary') && 
            !profile.photoURL.includes('googleusercontent'));
  };

  return {
    profile,
    formData,
    loading,
    message,
    isOwnProfile,
    setMessage,
    setProfile,
    setFormData,
    handleFormChange,
    handleUpdate,
    getProfilePictureUrl,
    isCloudinaryPicture,
    loadProfileFallback
  };
}
