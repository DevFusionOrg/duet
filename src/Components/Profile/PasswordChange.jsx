import React from "react";

function PasswordChange({ 
  passwordData, 
  loading, 
  onPasswordChange,
  onCancel,
  onSubmit 
}) {
  return (
    <div className="profile-password-section">
      <h3 className="profile-password-title">Change Password</h3>
      <form onSubmit={onSubmit}>
        <div className="profile-form-group">
          <label className="profile-label">Current Password:</label>
          <input
            type="password"
            value={passwordData.currentPassword}
            onChange={(e) => onPasswordChange('currentPassword', e.target.value)}
            required
            className="profile-input"
          />
        </div>

        <div className="profile-form-group">
          <label className="profile-label">New Password:</label>
          <input
            type="password"
            value={passwordData.newPassword}
            onChange={(e) => onPasswordChange('newPassword', e.target.value)}
            required
            className="profile-input"
          />
          <p className="profile-password-requirements">
            Password must be at least 6 characters long
          </p>
        </div>

        <div className="profile-form-group">
          <label className="profile-label">Confirm New Password:</label>
          <input
            type="password"
            value={passwordData.confirmPassword}
            onChange={(e) => onPasswordChange('confirmPassword', e.target.value)}
            required
            className="profile-input"
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="profile-save-button"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="profile-password-button profile-password-cancel"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default PasswordChange;