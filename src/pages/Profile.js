import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase/firebase";

import ProfileHeader from '../Components/Profile/ProfileHeader';
import ProfilePicture from '../Components/Profile/ProfilePicture';
import ProfileForm from '../Components/Profile/ProfileForm';
import ProfileDisplay from '../Components/Profile/ProfileDisplay';
import PasswordChange from '../Components/Profile/PasswordChange';
import BlockedUsersSection from '../Components/Profile/BlockedUsersSection';
import BlockedUsersModal from '../Components/Profile/BlockedUsersModal';
import UpdateChecker from "../Components/UpdateChecker";
import { Device } from "@capacitor/device";
import { useProfiles } from "../hooks/useProfiles";
import { useBlockedUsers } from "../hooks/useBlockedUsers";
import { useProfilePicture } from "../hooks/useProfilePicture";

import "../styles/Profile.css";

export default function Profile({ user }) {
  const { uid } = useParams();
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [showSettings, setShowSettings] = useState(false);
  const [installedVersion, setInstalledVersion] = useState(null);
  const [updateInfo, setUpdateInfo] = useState({ loading: false, latest: null, apkUrl: null, hasUpdate: false, error: null });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
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
    isCloudinaryPicture,
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

  useEffect(() => {
    // Preload Cloudinary script when profile page loads
    if (!window.cloudinary) {
      const script = document.createElement("script");
      script.src = "https://upload-widget.cloudinary.com/global/all.js";
      script.type = "text/javascript";
      script.async = true;
      script.id = 'cloudinary-profile-script'; // Add ID to avoid duplicate scripts
      document.head.appendChild(script);
      console.log("Cloudinary script loading for profile...");
    }
  }, []);

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
      const { doc, getDoc } = await import("firebase/firestore");
      const { db } = await import("../firebase/firebase");
      const ref = doc(db, "appConfig", "latestRelease");
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error("Latest release not found");
      const data = snap.data();
      const latest = (data.version || "").toString();
      const apkUrl = data.apkUrl || "";
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
    setActiveTab('profile');
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
      <ProfileHeader
        username={profile?.username}
        onOpenSettings={() => setShowSettings((s) => !s)}
      />

      <div className="profile-summary">
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
                  disabled={uploadingImage || loading}
                  className="photo-option-button"
                >
                  {uploadingImage ? (
                    <>
                      <span className="upload-spinner"></span>
                      Uploading...
                    </>
                  ) : (
                    "Change Photo"
                  )}
                </button>
                {profilePictureUrl && profilePictureUrl !== "/default-avatar.png" && (
                  <button
                    onClick={handleRemoveProfilePicture}
                    disabled={uploadingImage || loading}
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
          <div className="summary-card">
            <div className="summary-number">{profile.friends ? profile.friends.length : 0}</div>
            <div className="summary-label">Friends</div>
          </div>
          <div className="summary-card">
            <div className="summary-number">{profile.friendRequests ? profile.friendRequests.length : 0}</div>
            <div className="summary-label">Requests</div>
          </div>
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
      <div className="profile-tab-panel">
        {activeTab === 'profile' && (
          <>
            {editing ? (
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
                user={user}
                blockedUsers={blockedUsers}
                loadingBlockedUsers={loadingBlockedUsers}
                onShowBlockedUsers={() => setShowBlockedUsers(true)}
                editing={editing}
                onToggleEdit={handleToggleEdit}
              />
            )}
          </>
        )}

        {activeTab === 'security' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <button
                className="profile-password-button"
                onClick={() => setChangingPassword(prev => !prev)}
              >
                {changingPassword ? 'Close Change Password' : 'Change Password'}
              </button>
            </div>

            {changingPassword && (
              <PasswordChange
                passwordData={passwordData}
                loading={passwordLoading}
                onPasswordChange={handlePasswordDataChange}
                onCancel={handlePasswordCancel}
                onSubmit={handlePasswordChange}
              />
            )}

            <BlockedUsersSection
              blockedUsers={blockedUsers}
              loadingBlockedUsers={loadingBlockedUsers}
              onShowBlockedUsers={() => setShowBlockedUsers(true)}
              isOwnProfile={isOwnProfile}
            />
          </>
        )}

        {activeTab === 'updates' && (
          <div className="profile-actions-row">
            <UpdateChecker />
            <button
              onClick={async () => {
                try {
                  await signOut(auth);
                  window.location.href = "/";
                } catch (error) {
                  console.error("Error logging out:", error);
                }
              }}
              className="profile-action-button profile-logout-button"
            >
              Logout
            </button>
          </div>
        )}
      </div>

      {showSettings && (
        <div className="profile-settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="profile-settings-panel" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h4>Settings</h4>
              <button className="settings-close-button" onClick={() => setShowSettings(false)}>✕</button>
            </div>
          <div className="settings-section">
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
          </div>

          <div className="settings-section">
            <h5>Blocklist</h5>
            <BlockedUsersSection
              blockedUsers={blockedUsers}
              loadingBlockedUsers={loadingBlockedUsers}
              onShowBlockedUsers={() => setShowBlockedUsers(true)}
              isOwnProfile={isOwnProfile}
            />
          </div>

          <div className="settings-section">
            <h5>Updates</h5>
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
          </div>

          <div className="settings-section">
            <button
              onClick={async () => {
                try {
                  await signOut(auth);
                  window.location.href = "/";
                } catch (error) {
                  console.error("Error logging out:", error);
                }
              }}
              className="profile-action-button profile-logout-button"
            >
              Logout
            </button>
          </div>
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
