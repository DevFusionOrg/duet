import React from "react";

function ProfileHeader({ isOwnProfile }) {
  return (
    <div className="profile-header">
      <h2 className="profile-title">
        {isOwnProfile ? "Your Profile" : "Profile"}
      </h2>
    </div>
  );
}

export default ProfileHeader;
