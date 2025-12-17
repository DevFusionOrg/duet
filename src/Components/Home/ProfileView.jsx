import React from "react";
import Profile from "../../pages/Profile";

function ProfileView({ user, isDarkMode, toggleTheme }) {
  return (
    <div className="profile-tab-container">
      <Profile user={user} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
    </div>
  );
}

export default ProfileView;
