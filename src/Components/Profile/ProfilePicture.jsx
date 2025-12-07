import React from "react";

function ProfilePicture({ 
  profilePictureUrl, 
  isOwnProfile, 
  isCloudinaryPicture, 
  userHasPhotoURL,
  uploadingImage,
  loading,
  onUploadPicture,
  onRemovePicture
}) {
  return (
    <div className="profile-picture-section">
      <img
        src={profilePictureUrl}
        alt="Profile"
        className="profile-picture"
      />
      
      {isOwnProfile && (
        <div className="profile-picture-actions">
          <button
            onClick={onUploadPicture}
            disabled={uploadingImage}
            className="profile-picture-upload-button"
          >
            {uploadingImage ? "Uploading..." : "Update"}
          </button>
          
          {(isCloudinaryPicture() || userHasPhotoURL) && (
            <button
              onClick={onRemovePicture}
              disabled={loading}
              className="profile-picture-remove-button"
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ProfilePicture;