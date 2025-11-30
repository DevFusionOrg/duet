import React, { useEffect, useState, useCallback } from "react";
import {
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { updateDoc, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { listenToUserProfile, getUserProfile } from "../firebase/firestore";
import { openUploadWidget } from "services/cloudinary";
import "../styles/Profile.css";

export default function Profile({ user }) {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    displayName: "",
    username: "",
    bio: "",
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Fallback method to load profile
  const loadProfileFallback = useCallback(async () => {
    try {
      let userProfile = await getUserProfile(user.uid);

      if (!userProfile) {
        // Create basic profile from auth data
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

        // Save to Firestore
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, userProfile);
      }

      setProfile(userProfile);
      setFormData({
        displayName: userProfile.displayName || "",
        username: userProfile.username || "",
        bio: userProfile.bio || "",
      });
    } catch (error) {
      console.error("Error in fallback:", error);
    }
  }, [user]);

  // Load profile data with fallback
  useEffect(() => {
    if (!user) return;

    // Try real-time listener first
    const unsubscribe = listenToUserProfile(user.uid, (userProfile) => {
      if (userProfile) {
        setProfile(userProfile);
        setFormData({
          displayName: userProfile.displayName || user.displayName || "",
          username: userProfile.username || user.email?.split("@")[0] || "",
          bio: userProfile.bio || "",
        });
      } else {
        // If no profile found, create one or use auth data
        loadProfileFallback();
      }
    });

    return unsubscribe;
  }, [user, loadProfileFallback]);

  // Upload profile picture using Cloudinary
  const handleProfilePictureUpload = async () => {
    if (!user) return;

    setUploadingImage(true);
    setMessage("");

    try {
      const result = await openUploadWidget();
      
      if (result) {
        // Update Firebase Auth profile
        await updateProfile(user, {
          photoURL: result.secure_url
        });

        // Update Firestore user document
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          photoURL: result.secure_url,
          cloudinaryPublicId: result.public_id // Store Cloudinary public ID for future management
        });

        setMessage("Profile picture updated successfully!");
        
        // Update local state
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
    }
    
    setUploadingImage(false);
  };

  // Remove profile picture (revert to Google or default)
  const handleRemoveProfilePicture = async () => {
    if (!user) return;

    setLoading(true);
    setMessage("");

    try {
      // Revert to Google photo URL or null
      const originalPhotoURL = user.providerData?.[0]?.photoURL || null;

      // Update Firebase Auth
      await updateProfile(user, {
        photoURL: originalPhotoURL
      });

      // Update Firestore
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        photoURL: originalPhotoURL,
        cloudinaryPublicId: null
      });

      setMessage("Profile picture removed successfully!");
      
      // Update local state
      setProfile(prev => ({
        ...prev,
        photoURL: originalPhotoURL
      }));
    } catch (error) {
      console.error("Error removing profile picture:", error);
      setMessage("Error removing profile picture: " + error.message);
    }
    
    setLoading(false);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setMessage("");

    try {
      // Update Firebase Auth display name
      if (formData.displayName !== user.displayName) {
        await updateProfile(user, { displayName: formData.displayName });
      }

      // Update Firestore user document
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        displayName: formData.displayName,
        username: formData.username,
        bio: formData.bio,
      });

      setMessage("Profile updated successfully!");
      setEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage("Error updating profile: " + error.message);
    }
    setLoading(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!user || !user.email) return;

    setLoading(true);
    setMessage("");

    try {
      // Validate passwords
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setMessage("New passwords don't match");
        setLoading(false);
        return;
      }

      if (passwordData.newPassword.length < 6) {
        setMessage("Password should be at least 6 characters");
        setLoading(false);
        return;
      }

      // Reauthenticate user before password change
      const credential = EmailAuthProvider.credential(
        user.email,
        passwordData.currentPassword,
      );
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, passwordData.newPassword);

      setMessage("Password updated successfully!");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setChangingPassword(false);
    } catch (error) {
      console.error("Error updating password:", error);
      if (error.code === "auth/wrong-password") {
        setMessage("Current password is incorrect");
      } else {
        setMessage("Error updating password: " + error.message);
      }
    }
    setLoading(false);
  };

  // Get current profile picture URL (prioritize Cloudinary, then Google, then default)
  const getProfilePictureUrl = () => {
    if (profile?.photoURL) {
      return profile.photoURL;
    }
    if (user?.photoURL) {
      return user.photoURL;
    }
    return "/default-avatar.png";
  };

  // Check if current picture is from Cloudinary
  const isCloudinaryPicture = () => {
    return profile?.cloudinaryPublicId || 
           (profile?.photoURL && profile.photoURL.includes('cloudinary') && 
            !profile.photoURL.includes('googleusercontent'));
  };

  // If profile is still loading after 3 seconds, show fallback
  if (!profile) {
    return (
      <div className="profile-container">
        <h2 className="profile-title">Your Profile</h2>
        <div className="profile-loading">
          <p>Loading profile...</p>
          <button
            onClick={loadProfileFallback}
            className="profile-fallback-button"
          >
            Click here if loading takes too long
          </button>
        </div>
      </div>
    );
  }

  const profilePictureUrl = getProfilePictureUrl();

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h2 className="profile-title">Your Profile</h2>
        <button
          onClick={() => {
            setEditing(!editing);
            setChangingPassword(false);
            setMessage("");
          }}
          className={`profile-edit-button ${
            editing
              ? "profile-edit-button-secondary"
              : "profile-edit-button-primary"
          }`}
        >
          {editing ? "Cancel" : "Edit Profile"}
        </button>
      </div>

      {/* Profile Picture Section */}
      <div className="profile-picture-section">
        <img
          src={profilePictureUrl}
          alt="Profile"
          className="profile-picture"
        />
        <p className="profile-picture-note">
          {isCloudinaryPicture() 
            ? "Custom profile picture" 
            : user?.photoURL 
              ? "Profile picture from Google" 
              : "Default profile picture"
          }
        </p>
        
        {/* Profile Picture Actions */}
        <div className="profile-picture-actions">
          <button
            onClick={handleProfilePictureUpload}
            disabled={uploadingImage}
            className="profile-picture-upload-button"
          >
            {uploadingImage ? "Uploading..." : "Change Picture"}
          </button>
          
          {(isCloudinaryPicture() || user?.photoURL) && (
            <button
              onClick={handleRemoveProfilePicture}
              disabled={loading}
              className="profile-picture-remove-button"
            >
              Remove Picture
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`profile-message ${
            message.includes("Error")
              ? "profile-message-error"
              : "profile-message-success"
          }`}
        >
          {message}
        </div>
      )}

      {editing ? (
        <form onSubmit={handleUpdate} className="profile-form">
          <div className="profile-form-group">
            <label className="profile-label">Display Name:</label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) =>
                setFormData({ ...formData, displayName: e.target.value })
              }
              required
              className="profile-input"
            />
          </div>

          <div className="profile-form-group">
            <label className="profile-label">Username:</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              required
              className="profile-input"
            />
          </div>

          <div className="profile-form-group">
            <label className="profile-label">Bio:</label>
            <textarea
              value={formData.bio}
              onChange={(e) =>
                setFormData({ ...formData, bio: e.target.value })
              }
              rows="4"
              className="profile-input profile-textarea"
              placeholder="Tell others about yourself..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="profile-save-button"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </form>
      ) : (
        <div className="profile-display">
          <div className="profile-field">
            <div className="profile-field-label">Name:</div>
            <div className="profile-field-value">{profile.displayName}</div>
          </div>

          <div className="profile-field">
            <div className="profile-field-label">Username:</div>
            <div className="profile-field-value">@{profile.username}</div>
          </div>

          <div className="profile-field">
            <div className="profile-field-label">Email:</div>
            <div className="profile-field-value">{user.email}</div>
          </div>

          {profile.bio && (
            <div className="profile-field">
              <div className="profile-field-label">Bio:</div>
              <div className="profile-bio-content">{profile.bio}</div>
            </div>
          )}

          <div className="profile-stats">
            <div className="profile-stat">
              <div className="profile-stat-number">
                {profile.friends ? profile.friends.length : 0}
              </div>
              <div className="profile-stat-label">Friends</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-number">
                {profile.friendRequests ? profile.friendRequests.length : 0}
              </div>
              <div className="profile-stat-label">Requests</div>
            </div>
          </div>

          {/* Password Change Section */}
          {!changingPassword ? (
            <button
              onClick={() => setChangingPassword(true)}
              className="profile-password-button"
            >
              Change Password
            </button>
          ) : (
            <div className="profile-password-section">
              <h3 className="profile-password-title">Change Password</h3>
              <form onSubmit={handlePasswordChange}>
                <div className="profile-form-group">
                  <label className="profile-label">Current Password:</label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        currentPassword: e.target.value,
                      })
                    }
                    required
                    className="profile-input"
                  />
                </div>

                <div className="profile-form-group">
                  <label className="profile-label">New Password:</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        newPassword: e.target.value,
                      })
                    }
                    required
                    className="profile-input"
                  />
                  <p className="profile-password-requirements">
                    Password must be at least 6 characters long
                  </p>
                </div>

                <div className="profile-form-group">
                  <label className="profile-label">Confirm New Password:</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        confirmPassword: e.target.value,
                      })
                    }
                    required
                    className="profile-input"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="profile-save-button"
                  >
                    {loading ? "Updating..." : "Update Password"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChangingPassword(false);
                      setPasswordData({
                        currentPassword: "",
                        newPassword: "",
                        confirmPassword: "",
                      });
                      setMessage("");
                    }}
                    className="profile-password-button profile-password-cancel"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}