import React from "react";

function ProfileHeader({ isOwnProfile }) {
  return (
    <div className="profile-header">
      <h2 className="profile-title">
        {isOwnProfile ? "My Account" : "Profile"}
      </h2>
    </div>
  );
}

export default ProfileHeader;
