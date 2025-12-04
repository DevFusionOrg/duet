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
      <p className="profile-picture-note">
        {isCloudinaryPicture() 
          ? "Custom profile picture" 
          : (userHasPhotoURL && isOwnProfile)
            ? "Profile picture from Google" 
            : "Profile picture"
        }
      </p>
      
      {isOwnProfile && (
        <div className="profile-picture-actions">
          <button
            onClick={onUploadPicture}
            disabled={uploadingImage}
            className="profile-picture-upload-button"
          >
            {uploadingImage ? "Uploading..." : "Change Picture"}
          </button>
          
          {(isCloudinaryPicture() || userHasPhotoURL) && (
            <button
              onClick={onRemovePicture}
              disabled={loading}
              className="profile-picture-remove-button"
            >
              Remove Picture
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ProfilePicture;