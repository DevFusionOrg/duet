import React from "react";
import PropTypes from "prop-types";

function ProfileForm({ 
  formData, 
  loading, 
  onFormChange, 
  onSubmit,
  onCancel
}) {
  return (
    <form onSubmit={onSubmit} className="profile-form">
      <div className="profile-form-group">
        <label className="profile-label">Name:</label>
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
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="profile-password-cancel"
          disabled={loading}
          style={{ marginLeft: 10 }}
        >
          Cancel
        </button>
      )}
    </form>
  );
}

ProfileForm.propTypes = {
  formData: PropTypes.object.isRequired,
  loading: PropTypes.bool,
  onFormChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
};

export default ProfileForm;