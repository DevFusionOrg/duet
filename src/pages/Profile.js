import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { updateDoc, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { 
  listenToUserProfile, 
  getUserProfile,
  getBlockedUsers,
  unblockUser 
} from "../firebase/firestore";
import { openUploadWidget } from "../services/cloudinary";
import "../styles/Profile.css";

export default function Profile({ user }) {
  const { uid } = useParams();
  const isOwnProfile = !uid || uid === user?.uid;
  
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
  
  // New state for blocked users
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [loadingBlockedUsers, setLoadingBlockedUsers] = useState(false);

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

  // Load blocked users
  const loadBlockedUsers = useCallback(async () => {
    if (!user?.uid || !isOwnProfile) return;
    
    setLoadingBlockedUsers(true);
    try {
      const blockedList = await getBlockedUsers(user.uid);
      setBlockedUsers(blockedList);
    } catch (error) {
      console.error("Error loading blocked users:", error);
      setMessage("Error loading blocked users: " + error.message);
    } finally {
      setLoadingBlockedUsers(false);
    }
  }, [user?.uid, isOwnProfile]);

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

  // Load blocked users when component mounts and user changes
  useEffect(() => {
    if (isOwnProfile && user?.uid) {
      loadBlockedUsers();
    }
  }, [isOwnProfile, user?.uid, loadBlockedUsers]);

  const handleProfilePictureUpload = async () => {
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
    }
    
    setUploadingImage(false);
  };

  const handleRemoveProfilePicture = async () => {
    if (!user) return;

    setLoading(true);
    setMessage("");

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
    }
    
    setLoading(false);
  };

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

      const credential = EmailAuthProvider.credential(
        user.email,
        passwordData.currentPassword,
      );
      await reauthenticateWithCredential(user, credential);

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

  // Handle unblock user
  const handleUnblockUser = async (userId) => {
    if (!user?.uid) return;

    const confirmUnblock = window.confirm(
      "Are you sure you want to unblock this user? You will be able to message each other again."
    );
    
    if (!confirmUnblock) return;

    setLoading(true);
    setMessage("");

    try {
      await unblockUser(user.uid, userId);
      
      // Refresh blocked users list
      await loadBlockedUsers();
      
      setMessage("User unblocked successfully!");
    } catch (error) {
      console.error("Error unblocking user:", error);
      setMessage("Error unblocking user: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Render blocked users modal
  const renderBlockedUsersModal = () => {
    if (!showBlockedUsers) return null;

    return (
      <div className="blocked-users-modal-overlay">
        <div className="blocked-users-modal">
          <div className="blocked-users-modal-header">
            <h3>Blocked Users ({blockedUsers.length})</h3>
            <button 
              onClick={() => setShowBlockedUsers(false)}
              className="blocked-users-close-button"
            >
              ×
            </button>
          </div>
          
          <div className="blocked-users-modal-content">
            {loadingBlockedUsers ? (
              <div className="blocked-users-loading">
                <p>Loading blocked users...</p>
              </div>
            ) : blockedUsers.length === 0 ? (
              <div className="no-blocked-users">
                <p>No blocked users</p>
                <p className="no-blocked-users-description">
                  When you block someone, they won't be able to message you or see your profile.
                </p>
              </div>
            ) : (
              <div className="blocked-users-list">
                {blockedUsers.map((blockedUser) => (
                  <div key={blockedUser.uid} className="blocked-user-item">
                    <img 
                      src={blockedUser.photoURL || "/default-avatar.png"} 
                      alt={blockedUser.displayName}
                      className="blocked-user-avatar"
                    />
                    <div className="blocked-user-info">
                      <div className="blocked-user-name">{blockedUser.displayName}</div>
                      <div className="blocked-user-username">@{blockedUser.username}</div>
                    </div>
                    <button
                      onClick={() => handleUnblockUser(blockedUser.uid)}
                      disabled={loading}
                      className="unblock-user-button"
                    >
                      {loading ? "Processing..." : "Unblock"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="blocked-users-modal-footer">
            <button
              onClick={() => setShowBlockedUsers(false)}
              className="blocked-users-close-footer-button"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
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

  if (!profile) {
    return (
      <div className="profile-container">
        <h2 className="profile-title">
          {isOwnProfile ? "Your Profile" : "Profile"}
        </h2>
        <div className="profile-loading">
          <p>Loading profile...</p>
          {isOwnProfile && (
            <button
              onClick={loadProfileFallback}
              className="profile-fallback-button"
            >
              Click here if loading takes too long
            </button>
          )}
        </div>
      </div>
    );
  }

  const profilePictureUrl = getProfilePictureUrl();

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h2 className="profile-title">
          {isOwnProfile ? "Your Profile" : "Profile"}
        </h2>
        
        {isOwnProfile && (
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
        )}
      </div>

      <div className="profile-picture-section">
        <img
          src={profilePictureUrl}
          alt="Profile"
          className="profile-picture"
        />
        <p className="profile-picture-note">
          {isCloudinaryPicture() 
            ? "Custom profile picture" 
            : (user?.photoURL && isOwnProfile)
              ? "Profile picture from Google" 
              : "Profile picture"
          }
        </p>
        
        {isOwnProfile && (
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
        )}
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

          {isOwnProfile && (
            <div className="profile-field">
              <div className="profile-field-label">Email:</div>
              <div className="profile-field-value">{user.email}</div>
            </div>
          )}

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

          {/* Blocked Users Section - Only show on own profile */}
          {isOwnProfile && (
            <div className="profile-blocked-section">
              <div className="profile-blocked-header">
                <h4 className="profile-blocked-title">Blocked Users</h4>
                <div className="profile-blocked-count">
                  {blockedUsers.length} user{blockedUsers.length !== 1 ? 's' : ''} blocked
                </div>
              </div>
              
              <div className="profile-blocked-description">
                <p>Blocked users cannot message you, call you, or see your profile.</p>
              </div>
              
              <button
                onClick={() => setShowBlockedUsers(true)}
                className="profile-manage-blocked-button"
                disabled={loadingBlockedUsers}
              >
                {loadingBlockedUsers ? "Loading..." : "Manage Blocked Users"}
              </button>
            </div>
          )}

          {isOwnProfile && (
            <>
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
            </>
          )}
        </div>
      )}

      {/* Blocked Users Modal */}
      {renderBlockedUsersModal()}
    </div>
  );
}