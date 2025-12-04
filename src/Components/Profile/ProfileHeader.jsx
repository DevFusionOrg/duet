import React from "react";

function ProfileHeader({ isOwnProfile, editing, onToggleEdit }) {
  return (
    <div className="profile-header">
      <h2 className="profile-title">
        {isOwnProfile ? "Your Profile" : "Profile"}
      </h2>
      
      {isOwnProfile && (
        <button
          onClick={onToggleEdit}
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
  );
}

export default ProfileHeader;