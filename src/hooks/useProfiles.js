import { useState, useEffect, useCallback } from "react";
import { updateProfile } from "firebase/auth";
import { updateDoc, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { 
  listenToUserProfile, 
  getUserProfile
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

      if (!userProfile && isOwnProfile) {
        userProfile = {
          uid: user.uid,
          displayName: user.displayName || "User",
          email: user.email,
          photoURL: user.photoURL,
          username: user.email?.split("@")[0] || "user",
          bio: "",
          friends: [],
          friendRequests: [],
          createdAt: new Date(),
        };

        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, userProfile);
      } else if (!userProfile) {
        userProfile = {
          uid: profileUid,
          displayName: "User",
          username: "user",
          bio: "",
          friends: [],
          friendRequests: [],
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
            displayName: userProfile.displayName || user.displayName || "",
            username: userProfile.username || user.email?.split("@")[0] || "",
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
    if (!user) return;

    setLoading(true);
    setMessage("");

    try {
      if (formData.displayName !== user.displayName) {
        await updateProfile(user, { displayName: formData.displayName });
      }

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        displayName: formData.displayName,
        username: formData.username,
        bio: formData.bio,
      });

      setMessage("Profile updated successfully!");
      return true; // Success
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage("Error updating profile: " + error.message);
      return false; // Error
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