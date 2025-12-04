import React, { useState, useEffect } from "react";
import { updateProfile } from "firebase/auth";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { openUploadWidget } from "../../services/cloudinary";

function ProfileView({ user, userProfile, editing, onEditToggle, onBack }) {
  const [formData, setFormData] = useState({
    displayName: "",
    username: "",
    bio: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [loadingBlockedUsers, setLoadingBlockedUsers] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setFormData({
        displayName: userProfile.displayName || "",
        username: userProfile.username || "",
        bio: userProfile.bio || "",
      });
    }
  }, [userProfile, editing]);

  useEffect(() => {
    const loadBlockedUsers = async () => {
      if (!user?.uid) return;
      
      setLoadingBlockedUsers(true);
      try {
        const { getBlockedUsers } = await import("../../firebase/firestore");
        const blockedList = await getBlockedUsers(user.uid);
        setBlockedUsers(blockedList);
      } catch (error) {
        console.error("Error loading blocked users:", error);
        setMessage("Error loading blocked users: " + error.message);
      } finally {
        setLoadingBlockedUsers(false);
      }
    };

    if (!editing) {
      loadBlockedUsers();
    }
  }, [user?.uid, editing]);

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
    } catch (error) {
      console.error("Error removing profile picture:", error);
      setMessage("Error removing profile picture: " + error.message);
    }
    
    setLoading(false);
  };

  const isCloudinaryPicture = () => {
    return userProfile?.cloudinaryPublicId || 
           (userProfile?.photoURL && userProfile.photoURL.includes('cloudinary') && 
            !userProfile.photoURL.includes('googleusercontent'));
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
      setTimeout(() => {
        onEditToggle();
        setMessage("");
      }, 2000);
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage("Error updating profile: " + error.message);
    }
    setLoading(false);
  };

  const handleUnblockUser = async (userId) => {
    if (!user?.uid) return;

    const confirmUnblock = window.confirm(
      "Are you sure you want to unblock this user? You will be able to message each other again."
    );
    
    if (!confirmUnblock) return;

    setLoading(true);
    setMessage("");

    try {
      const { unblockUser } = await import("../../firebase/firestore");
      await unblockUser(user.uid, userId);
      
      setBlockedUsers(prev => prev.filter(user => user.uid !== userId));
      
      setMessage("User unblocked successfully!");
    } catch (error) {
      console.error("Error unblocking user:", error);
      setMessage("Error unblocking user: " + error.message);
    } finally {
      setLoading(false);
    }
  };

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

  if (!userProfile) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="profile-tab-container">
        <div className="profile-edit-header">
          <button onClick={onBack} className="back-button">
            ← Back
          </button>
          <h2>Edit Profile</h2>
        </div>

        <div className="profile-tab-content">
          {message && (
            <div className={`profile-message ${message.includes("Error") ? "profile-message-error" : "profile-message-success"}`}>
              {message}
            </div>
          )}

          {/* Profile Picture Section in Edit Mode */}
          <div className="profile-picture-edit-section">
            <div className="profile-picture-preview">
              <img
                src={userProfile.photoURL || user?.photoURL || "/default-avatar.png"}
                alt="Profile"
                className="profile-picture-edit"
              />
            </div>
            <p className="profile-picture-note">
              {isCloudinaryPicture() 
                ? "Custom profile picture" 
                : user?.photoURL 
                  ? "Profile picture from Google" 
                  : "Default profile picture"
              }
            </p>
            
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

          <form onSubmit={handleUpdate} className="profile-edit-form">
            <div className="profile-form-group">
              <label className="profile-label">Display Name:</label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                required
                className="profile-input"
              />
            </div>

            <div className="profile-form-group">
              <label className="profile-label">Username:</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                className="profile-input"
              />
            </div>

            <div className="profile-form-group">
              <label className="profile-label">Bio:</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows="4"
                className="profile-input profile-textarea"
                placeholder="Tell others about yourself..."
              />
            </div>

            <div className="profile-edit-actions">
              <button
                type="submit"
                disabled={loading}
                className="save-profile-button"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={onBack}
                className="cancel-profile-button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-tab-container">
      <div className="profile-tab-content">
        <div className="profile-header-section">
          <div className="profile-picture-large-container">
            <img 
              src={userProfile.photoURL || user?.photoURL} 
              alt={userProfile.displayName}
              className="profile-picture-large"
            />
          </div>
          
          <div className="profile-basic-info">
            <h2 className="profile-display-name">{userProfile.displayName}</h2>
            <p className="profile-username">@{userProfile.username}</p>
            <p className="profile-email">{user?.email}</p>
          </div>
        </div>

        <div className="profile-details">
          <div className="profile-section">
            <h3 className="profile-section-title">About</h3>
            <div className="profile-bio">
              {userProfile.bio ? (
                <p>{userProfile.bio}</p>
              ) : (
                <p className="no-bio">No bio yet. Tell others about yourself!</p>
              )}
            </div>
          </div>

          <div className="profile-section">
            <h3 className="profile-section-title">Stats</h3>
            <div className="profile-stats-grid">
              <div className="profile-stat-item">
                <span className="stat-number">{userProfile.friends ? userProfile.friends.length : 0}</span>
                <span className="stat-label">Friends</span>
              </div>
              <div className="profile-stat-item">
                <span className="stat-number">{userProfile.friendRequests ? userProfile.friendRequests.length : 0}</span>
                <span className="stat-label">Requests</span>
              </div>
            </div>
          </div>

          <div className="profile-section">
            <h3 className="profile-section-title">Privacy & Security</h3>
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
          </div>

          <div className="profile-actions">
            <button 
              onClick={onEditToggle}
              className="edit-profile-button"
            >
              Edit Profile
            </button>
          </div>
        </div>
      </div>
      {renderBlockedUsersModal()}
    </div>
  );
}

export default ProfileView;