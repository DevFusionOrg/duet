import React from "react";
import Profile from "../../pages/Profile";

function ProfileView({ user, isDarkMode, toggleTheme, openSettingsAsView = false, onOpenSettingsTab, onCloseSettingsTab }) {
  return (
    <div className="profile-tab-container">
      <Profile
        user={user}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        openSettingsAsView={openSettingsAsView}
        onOpenSettingsTab={onOpenSettingsTab}
        onCloseSettingsTab={onCloseSettingsTab}
      />
    </div>
  );
}

export default ProfileView;
