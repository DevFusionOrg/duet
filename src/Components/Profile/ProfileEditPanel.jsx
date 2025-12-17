import React from "react";
import PropTypes from "prop-types";
import ProfilePicture from "./ProfilePicture";
import ProfileForm from "./ProfileForm";

export default function ProfileEditPanel({
  user,
  profile,
  formData,
  loading,
  isOwnProfile,
  uploadingImage,
  onUploadPicture,
  onRemovePicture,
  onErrorPicture,
  onFormChange,
  onSubmit,
}) {
  const profilePictureUrl = (profile && profile.photoURL) || (user && user.photoURL) || "/default-avatar.png";

  return (
    <div className="profile-edit-panel">
      <div className="profile-edit-panel-left">
        <ProfilePicture
          profilePictureUrl={profilePictureUrl}
          isOwnProfile={isOwnProfile}
          isCloudinaryPicture={() => Boolean(profile?.cloudinaryPublicId)}
          userHasPhotoURL={!!user?.photoURL}
          uploadingImage={uploadingImage}
          loading={loading}
          onUploadPicture={onUploadPicture}
          onRemovePicture={onRemovePicture}
          onError={onErrorPicture}
        />
      </div>
      <div className="profile-edit-panel-right">
        <ProfileForm
          formData={formData}
          loading={loading}
          onFormChange={onFormChange}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}

ProfileEditPanel.propTypes = {
  user: PropTypes.object,
  profile: PropTypes.object,
  formData: PropTypes.object.isRequired,
  loading: PropTypes.bool,
  isOwnProfile: PropTypes.bool,
  uploadingImage: PropTypes.bool,
  onUploadPicture: PropTypes.func.isRequired,
  onRemovePicture: PropTypes.func.isRequired,
  onErrorPicture: PropTypes.func,
  onFormChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};
