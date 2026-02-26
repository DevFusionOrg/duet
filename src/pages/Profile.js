import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase/firebase";

import ProfileHeader from '../Components/Profile/ProfileHeader';
import ProfileForm from '../Components/Profile/ProfileForm';
import ProfileDisplay from '../Components/Profile/ProfileDisplay';
import PasswordChange from '../Components/Profile/PasswordChange';
import BlockedUsersSection from '../Components/Profile/BlockedUsersSection';
import BlockedUsersModal from '../Components/Profile/BlockedUsersModal';
import FriendsView from '../Components/Home/FriendsView';
import { deleteUserAccount } from "../firebase/firestore";
import { Device } from "@capacitor/device";
import { useProfiles } from "../hooks/useProfiles";
import { useBlockedUsers } from "../hooks/useBlockedUsers";
import { useProfilePicture } from "../hooks/useProfilePicture";
import { useFriends } from "../hooks/useFriends";
import { useFriendsOnlineStatus } from "../hooks/useFriendsOnlineStatus";

import "../styles/Profile.css";

export default function Profile({
  user,
  isDarkMode,
  toggleTheme,
  openSettingsAsView = false,
  onOpenSettingsTab,
  onCloseSettingsTab,
  onOpenUserProfile,
}) {
  const { uid } = useParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [installedVersion, setInstalledVersion] = useState(null);
  const [updateInfo, setUpdateInfo] = useState({ loading: false, latest: null, apkUrl: null, hasUpdate: false, error: null });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showPhotoControls, setShowPhotoControls] = useState(false);

  const {
    profile,
    formData,
    loading,
    message,
    isOwnProfile,
    setMessage,
    setProfile,
    handleFormChange,
    handleUpdate,
    getProfilePictureUrl,
    loadProfileFallback
  } = useProfiles(user, uid);

  const {
    blockedUsers,
    showBlockedUsers,
    loadingBlockedUsers,
    setShowBlockedUsers,
    handleUnblockUser
  } = useBlockedUsers(user?.uid);

  const {
    uploadingImage,
    handleProfilePictureUpload,
    handleRemoveProfilePicture
  } = useProfilePicture(user, setProfile, setMessage);

  const { friends, loading: friendsLoading } = useFriends(user);
  const { friendsOnlineStatus } = useFriendsOnlineStatus(user, friends);

  const handleFriendCardClick = (friend, e) => {
    if (!e.target.closest('.chat-button')) {
      
    }
  };

  const handleStartChat = (friend) => {
    if (!friend || !friend.uid) return;
    
    navigate(`/?senderId=${encodeURIComponent(friend.uid)}&view=chats`);
  };

  useEffect(() => {
    
    if (!window.cloudinary) {
      const script = document.createElement("script");
      script.src = "https://upload-widget.cloudinary.com/global/all.js";
      script.type = "text/javascript";
      script.async = true;
      script.id = 'cloudinary-profile-script'; 
      document.head.appendChild(script);
      console.log("Cloudinary script loading for profile...");
    }
  }, []);

  useEffect(() => {
    if (isOwnProfile) {
      setShowSettings(!!openSettingsAsView);
    }
  }, [openSettingsAsView, isOwnProfile]);

  useEffect(() => {
    (async () => {
      try {
        const info = await Device.getInfo();
        if (info && info.appVersion) {
          setInstalledVersion(info.appVersion);
          return;
        }
      } catch (e) {}
      const envVersion = process.env.REACT_APP_VERSION || process.env.VITE_APP_VERSION || null;
      setInstalledVersion(envVersion || "0.0.0");
    })();
  }, []);

  function compareSemver(a = "0.0.0", b = "0.0.0") {
    const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
    const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }

  const fetchLatestRelease = async () => {
    setUpdateInfo((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await fetch("https://asia-south1-duet-2025.cloudfunctions.net/getLatestRelease");
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Latest release not found");
      }
      const data = await response.json();
      const latest = (data?.version || "").toString();
      const apkUrl = data?.apkUrl || "";
      const hasUpdate = compareSemver(installedVersion || "0.0.0", latest) === -1;
      setUpdateInfo({ loading: false, latest, apkUrl, hasUpdate, error: null });
    } catch (e) {
      setUpdateInfo({ loading: false, latest: null, apkUrl: null, hasUpdate: false, error: e.message || "Failed to fetch" });
    }
  };
  const handleToggleEdit = () => {
    setEditing(!editing);
    setChangingPassword(false);
    setMessage("");
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!user || !user.email) return;

    setPasswordLoading(true);
    setMessage("");

    try {
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setMessage("New passwords don't match");
        setPasswordLoading(false);
        return;
      }

      if (passwordData.newPassword.length < 6) {
        setMessage("Password should be at least 6 characters");
        setPasswordLoading(false);
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
    setPasswordLoading(false);
  };

  const handlePasswordDataChange = (field, value) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const reauthenticateForDeletion = async () => {
    const usesPasswordProvider = user?.providerData?.some((p) => p.providerId === "password");
    if (usesPasswordProvider) {
      const password = window.prompt("Enter your password to delete your account. This cannot be undone.");
      if (!password) {
        throw new Error("Password is required to delete the account");
      }
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
    }
  };

  const handleDeleteAccount = async () => {
    if (!isOwnProfile || !user?.uid) return;
    const confirmed = window.confirm(
      "Delete your account and all data (chats, friends, profile)? This action is irreversible.",
    );
    if (!confirmed) return;

    setDeletingAccount(true);
    setMessage("");

    try {
      await reauthenticateForDeletion();
      await deleteUserAccount(user.uid, { deleteAuth: true });
      await signOut(auth);
      window.location.href = "/";
    } catch (error) {
      console.error("Error deleting account:", error);
      setMessage(error?.message || "Failed to delete account. Please try again.");
    } finally {
      setDeletingAccount(false);
    }
  };

  const handlePasswordCancel = () => {
    setChangingPassword(false);
    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setMessage("");
  };

  const handleUnblockUserWithFeedback = async (userId) => {
    try {
      await handleUnblockUser(userId, () => {
        setMessage("User unblocked successfully!");
      });
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleUpdateWithEdit = async (e) => {
    const success = await handleUpdate(e);
    if (success) {
      setEditing(false);
    }
  };

  const handleOpenSettings = () => {
    if (onOpenSettingsTab) {
      onOpenSettingsTab();
      return;
    }
    setShowSettings(true);
    setEditing(false);
    setShowPhotoControls(false);
  };

  const handleCloseSettings = () => {
    if (onCloseSettingsTab) {
      onCloseSettingsTab();
      return;
    }
    setShowSettings(false);
    setChangingPassword(false);
    setMessage("");
  };

  if (!profile) {
    return (
      <div className="profile-container">
        <h1 className="profile-title">
          {isOwnProfile ? "Your Profile" : "Profile"}
        </h1>
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
      {isOwnProfile && !showSettings && (
        <ProfileHeader
          username={profile?.username}
          onOpenSettings={handleOpenSettings}
          onToggleTheme={toggleTheme}
          isDarkMode={isDarkMode}
        />
      )}

      {!showSettings && <div className="profile-summary">
        <div className="profile-summary-left">
          <div className="profile-picture-wrapper">
            <img
              src={profilePictureUrl}
              alt="Profile"
              className="profile-picture profile-picture-summary"
              onClick={() => isOwnProfile && setShowPhotoControls(prev => !prev)}
              style={isOwnProfile ? { cursor: 'pointer' } : {}}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/default-avatar.png";
              }}
            />
          </div>
          {isOwnProfile && showPhotoControls && (
            <div className="photo-options-overlay" onClick={() => setShowPhotoControls(false)}>
              <div className="photo-options-modal" onClick={(e) => e.stopPropagation()}>
                <div className="photo-options-close-area" onClick={() => setShowPhotoControls(false)}>
                  Back
                </div>
                <button
                  onClick={handleProfilePictureUpload}
                  disabled={uploadingImage}
                  className="photo-option-button"
                >
                  {uploadingImage ? "Uploading..." : "Change Photo"}
                </button>
                {profilePictureUrl && profilePictureUrl !== "/default-avatar.png" && (
                  <button
                    onClick={handleRemoveProfilePicture}
                    disabled={uploadingImage}
                    className="photo-option-button"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="profile-summary-right">
          <button 
            className="summary-card summary-button"
            onClick={() => setShowFriendsModal(true)}
            title="Click to view friends"
          >
            <div className="summary-number">{friends?.length || 0}</div>
            <div className="summary-label">Friends</div>
          </button>
        </div>
      </div>}

      {!showSettings && message && (
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

      {showSettings && isOwnProfile ? (
        <div className="profile-settings-tab">
          <div className="profile-settings-tab-header">
            <button className="profile-settings-back-button" onClick={handleCloseSettings}>
              ← Back to Profile
            </button>
            <h3>Settings</h3>
          </div>

          <div className="profile-settings-sections">
            <section className="profile-settings-card">
              <h4>Account & Security</h4>
              <button
                className="profile-password-button"
                onClick={() => setChangingPassword(prev => !prev)}
              >
                {changingPassword ? 'Close Change Password' : 'Change Password'}
              </button>
              {changingPassword && (
                <PasswordChange
                  passwordData={passwordData}
                  loading={passwordLoading}
                  onPasswordChange={handlePasswordDataChange}
                  onCancel={handlePasswordCancel}
                  onSubmit={handlePasswordChange}
                />
              )}
            </section>

            <section className="profile-settings-card">
              <h4>Privacy</h4>
              <BlockedUsersSection
                blockedUsers={blockedUsers}
                loadingBlockedUsers={loadingBlockedUsers}
                onShowBlockedUsers={() => setShowBlockedUsers(true)}
                isOwnProfile={isOwnProfile}
              />
            </section>

            <section className="profile-settings-card">
              <h4>App Preferences</h4>
              <div className="settings-app-row">
                <span>Theme</span>
                <button className="update-check-button" onClick={toggleTheme}>
                  {isDarkMode ? 'Use Light Mode' : 'Use Dark Mode'}
                </button>
              </div>
              <div className="updates-inline">
                <div className="updates-row">
                  <span>Installed: {installedVersion || '—'}</span>
                  <button className="update-check-button" onClick={fetchLatestRelease} disabled={updateInfo.loading}>
                    {updateInfo.loading ? 'Checking…' : 'Check for updates'}
                  </button>
                </div>
                {updateInfo.error && <div className="error">{updateInfo.error}</div>}
                {updateInfo.latest && (
                  <div className="updates-latest">
                    Latest: <strong>{updateInfo.latest}</strong>
                    {updateInfo.hasUpdate ? (
                      updateInfo.apkUrl ? (
                        <a className="btn btn-primary" href={updateInfo.apkUrl} target="_blank" rel="noopener noreferrer">Download APK</a>
                      ) : (
                        <span style={{ marginLeft: 8 }}>New version available.</span>
                      )
                    ) : (
                      <span style={{ marginLeft: 8 }}>No new release</span>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="profile-settings-card">
              <h4>Account Actions</h4>
              <div className="profile-settings-actions">
                <button
                  onClick={async () => {
                    try {
                      await signOut(auth);
                      window.location.href = "/";
                    } catch (error) {
                      console.error("Error logging out:", error);
                    }
                  }}
                  disabled={deletingAccount}
                  className="profile-action-button profile-logout-button"
                >
                  Logout
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="profile-action-button profile-delete-button"
                >
                  {deletingAccount ? "Deleting…" : "Delete Account"}
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : editing ? (
        <ProfileForm
          formData={formData}
          loading={loading}
          onFormChange={handleFormChange}
          onSubmit={handleUpdateWithEdit}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <ProfileDisplay
          profile={profile}
          isOwnProfile={isOwnProfile}
          blockedUsers={blockedUsers}
          loadingBlockedUsers={loadingBlockedUsers}
          onShowBlockedUsers={() => setShowBlockedUsers(true)}
          editing={editing}
          onToggleEdit={handleToggleEdit}
        />
      )}

      {}
      {showFriendsModal && isOwnProfile && (
        <div className="profile-friends-modal-overlay" onClick={() => setShowFriendsModal(false)}>
          <div className="profile-friends-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="friends-modal-header">
              <h3>Friends ({friends?.length || 0})</h3>
              <button 
                className="friends-modal-close"
                onClick={() => setShowFriendsModal(false)}
              >✕</button>
            </div>
            <FriendsView 
              friends={friends}
              loading={friendsLoading}
              onStartChat={handleStartChat}
              onOpenProfile={(friend) => {
                if (onOpenUserProfile) {
                  onOpenUserProfile(friend);
                  setShowFriendsModal(false);
                }
              }}
              onFriendCardClick={handleFriendCardClick}
              friendsOnlineStatus={friendsOnlineStatus}
              currentUserId={user?.uid}
              hideHeaders={true}
              allowRemove={true}
            />
          </div>
        </div>
      )}

      <BlockedUsersModal
        showBlockedUsers={showBlockedUsers}
        blockedUsers={blockedUsers}
        loadingBlockedUsers={loadingBlockedUsers}
        loading={loading}
        onClose={() => setShowBlockedUsers(false)}
        onUnblockUser={handleUnblockUserWithFeedback}
      />
    </div>
  );
}
