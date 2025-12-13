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
  // Function to get optimized profile picture URL
  const getOptimizedUrl = (url) => {
    if (!url) return url;
    
    // If it's already a Cloudinary URL with transformations, use as is
    if (url.includes('/upload/') && url.includes('/duet-dp/')) {
      return url;
    }
    
    // If it's a Cloudinary URL without proper transformations, add them
    if (url.includes('cloudinary.com')) {
      const publicIdMatch = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
      if (publicIdMatch && publicIdMatch[1]) {
        const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
        return `https://res.cloudinary.com/${cloudName}/image/upload/w_200,h_200,c_fill,g_face,q_auto,f_auto,r_max/${publicIdMatch[1]}`;
      }
    }
    
    return url;
  };

  return (
    <div className="profile-picture-section">
      <img
        src={getOptimizedUrl(profilePictureUrl)}
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
            {uploadingImage ? (
              <>
                <span className="upload-spinner"></span>
                Uploading...
              </>
            ) : "Update Profile Picture"}
          </button>
          
          {(isCloudinaryPicture() || userHasPhotoURL) && (
            <button
              onClick={onRemovePicture}
              disabled={loading || uploadingImage}
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