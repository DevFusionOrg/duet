import React from "react";

function ProfileForm({ 
  formData, 
  loading, 
  onFormChange, 
  onSubmit 
}) {
  return (
    <form onSubmit={onSubmit} className="profile-form">
      <div className="profile-form-group">
        <label className="profile-label">Display Name:</label>
        <input
          type="text"
          value={formData.displayName}
          onChange={(e) => onFormChange('displayName', e.target.value)}
          required
          className="profile-input"
        />
      </div>

      <div className="profile-form-group">
        <label className="profile-label">Username:</label>
        <input
          type="text"
          value={formData.username}
          onChange={(e) => onFormChange('username', e.target.value)}
          required
          className="profile-input"
        />
      </div>

      <div className="profile-form-group">
        <label className="profile-label">Bio:</label>
        <textarea
          value={formData.bio}
          onChange={(e) => onFormChange('bio', e.target.value)}
          rows="4"
          className="profile-input profile-textarea"
          placeholder="Tell others about yourself..."
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="profile-save-button"
      >
        {loading ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}

export default ProfileForm;