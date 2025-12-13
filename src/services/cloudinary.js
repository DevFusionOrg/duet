import { Cloudinary } from "@cloudinary/url-gen";

const cld = new Cloudinary({
  cloud: {
    cloudName: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME,
  },
});

export default cld;

// PROFILE PICTURE UPLOAD (duet-dp folder, duet_dp preset, square cropping)
export const openProfilePictureUploadWidget = (options = {}) => {
  return new Promise((resolve, reject) => {
    if (!window.cloudinary) {
      reject(new Error("Cloudinary widget not loaded"));
      return;
    }

    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME,
        uploadPreset: "duet_dp", // Use duet_dp preset
        sources: ["local", "camera"],
        multiple: false,
        maxFileSize: 5000000,
        clientAllowedFormats: ["jpg", "jpeg", "png", "webp"], // No GIFs for profile
        folder: "duet-dp", // Profile pictures folder
        resourceType: "image",
        cropping: true,
        croppingAspectRatio: 1,
        croppingDefaultSelectionRatio: 0.9,
        showSkipCropButton: false,
        croppingCoordinatesMode: "custom",
        ...options
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result && result.event === "success") {
          resolve(result.info);
        } else if (result && result.event === "close") {
          reject(new Error("Upload cancelled"));
        }
      },
    );

    widget.open();
  });
};

// CHAT IMAGE UPLOAD (duet-chat folder, duet_chat preset, no cropping)
export const openChatImageUploadWidget = (options = {}) => {
  return new Promise((resolve, reject) => {
    if (!window.cloudinary) {
      reject(new Error("Cloudinary widget not loaded"));
      return;
    }

    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME,
        uploadPreset: "duet_chat", // Use duet_chat preset
        sources: ["local", "camera"],
        multiple: false,
        maxFileSize: 5000000,
        clientAllowedFormats: ["jpg", "jpeg", "png", "gif", "webp"],
        folder: "duet-chat", // Chat images folder
        resourceType: "image", // Only images, no videos
        cropping: false, // No cropping for chat images
        ...options
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result && result.event === "success") {
          resolve(result.info);
        } else if (result && result.event === "close") {
          reject(new Error("Upload cancelled"));
        }
      },
    );

    widget.open();
  });
};

// Backward compatibility - defaults to chat image upload
export const openUploadWidget = openChatImageUploadWidget;

// Optimized profile picture URL with face detection and rounded corners
export const getOptimizedProfilePictureUrl = (publicId, size = 200) => {
  // Ensure publicId includes the duet-dp folder if not already
  const fullPublicId = publicId.startsWith('duet-dp/') 
    ? publicId 
    : publicId.includes('/') 
      ? publicId // If it already has a folder, use as is
      : `duet-dp/${publicId}`;
  
  return `https://res.cloudinary.com/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload/w_${size},h_${size},c_fill,g_face,q_auto,f_auto,r_max/${fullPublicId}`;
};

// Optimized chat image URL
export const getOptimizedImageUrl = (publicId, width = 400, height = 400) => {
  // Ensure publicId includes the duet-chat folder if not already
  const fullPublicId = publicId.startsWith('duet-chat/') 
    ? publicId 
    : publicId.includes('/') 
      ? publicId // If it already has a folder, use as is
      : `duet-chat/${publicId}`;
  
  return `https://res.cloudinary.com/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload/w_${width},h_${height},c_fill,q_auto,f_auto/${fullPublicId}`;
};

// Helper to check if a Cloudinary URL is from duet-dp folder
export const isProfilePictureUrl = (url) => {
  const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
  const profilePattern = new RegExp(`https://res\\.cloudinary\\.com/${cloudName}/image/upload/.+duet-dp/`);
  return profilePattern.test(url);
};

// Helper to extract public ID from Cloudinary URL
export const extractPublicIdFromUrl = (url) => {
  if (!url) return null;
  
  const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
  const pattern = new RegExp(`https://res\\.cloudinary\\.com/${cloudName}/[^/]+/upload/(?:v\\d+/)?(.+)$`);
  const match = url.match(pattern);
  
  return match ? match[1] : null;
};