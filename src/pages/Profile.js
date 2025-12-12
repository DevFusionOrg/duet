import React, { useState } from "react";
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
import { useProfiles } from "../hooks/useProfiles";
import { useBlockedUsersProfile } from "../hooks/useBlockedUsersProfile";
import { useProfilePicture } from "../hooks/useProfilePicture";

import "../styles/Profile.css";

export default function Profile({ user }) {
  const { uid } = useParams();
  const [editing, setEditing] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

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
  } = useBlockedUsersProfile(user, isOwnProfile);

  const {
    uploadingImage,
    handleProfilePictureUpload,
    handleRemoveProfilePicture
  } = useProfilePicture(user, setProfile, setMessage);

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
      <ProfileHeader
        isOwnProfile={isOwnProfile}
        // editing and onToggleEdit no longer used in header
      />

      <ProfilePicture
        profilePictureUrl={profilePictureUrl}
        isOwnProfile={isOwnProfile}
        isCloudinaryPicture={() => isCloudinaryPicture()}
        userHasPhotoURL={!!user?.photoURL}
        uploadingImage={uploadingImage}
        loading={loading}
        onUploadPicture={handleProfilePictureUpload}
        onRemovePicture={handleRemoveProfilePicture}
      />

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
        <ProfileForm
          formData={formData}
          loading={loading}
          onFormChange={handleFormChange}
          onSubmit={handleUpdateWithEdit}
        />
      ) : (
        <>
          <ProfileDisplay
            profile={profile}
            isOwnProfile={isOwnProfile}
            user={user}
            blockedUsers={blockedUsers}
            loadingBlockedUsers={loadingBlockedUsers}
            onShowBlockedUsers={() => setShowBlockedUsers(true)}
            onTogglePasswordChange={() => setChangingPassword(true)}
            editing={editing}
            onToggleEdit={handleToggleEdit}
          />

          {isOwnProfile && changingPassword && (
            <PasswordChange
              passwordData={passwordData}
              loading={passwordLoading}
              onPasswordChange={handlePasswordDataChange}
              onCancel={handlePasswordCancel}
              onSubmit={handlePasswordChange}
            />
          )}
        </>
      )}

      <BlockedUsersSection
        blockedUsers={blockedUsers}
        loadingBlockedUsers={loadingBlockedUsers}
        onShowBlockedUsers={() => setShowBlockedUsers(true)}
        isOwnProfile={isOwnProfile}
      />

      <BlockedUsersModal
        showBlockedUsers={showBlockedUsers}
        blockedUsers={blockedUsers}
        loadingBlockedUsers={loadingBlockedUsers}
        loading={loading}
        onClose={() => setShowBlockedUsers(false)}
        onUnblockUser={handleUnblockUserWithFeedback}
      />

      {isOwnProfile && (
        <>
          <UpdateChecker className="profile-action-container" />
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
        </>
      )}
    </div>
  );
}
