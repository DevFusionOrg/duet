import React from "react";
import Profile from "../../pages/Profile";

function ProfileView({ user }) {
  return (
    <div className="profile-tab-container">
      <Profile user={user} />
    </div>
  );
}

export default ProfileView;
