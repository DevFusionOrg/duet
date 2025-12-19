import { Cloudinary } from "@cloudinary/url-gen";

const cld = new Cloudinary({
  cloud: {
    cloudName: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME,
  },
});

export default cld;

export const openProfilePictureUploadWidget = (options = {}) => {
  return new Promise((resolve, reject) => {
    if (!window.cloudinary) {
      reject(new Error("Cloudinary widget not loaded"));
      return;
    }

    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME,
        uploadPreset: "duet_dp", 
        sources: ["local", "camera"],
        multiple: false,
        maxFileSize: 5000000,
        clientAllowedFormats: ["jpg", "jpeg", "png", "webp"], 
        folder: "duet-dp", 
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

export const openChatImageUploadWidget = (options = {}) => {
  return new Promise((resolve, reject) => {
    if (!window.cloudinary) {
      reject(new Error("Cloudinary widget not loaded"));
      return;
    }

    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME,
        uploadPreset: "duet_chat", 
        sources: ["local", "camera"],
        multiple: false,
        maxFileSize: 5000000,
        clientAllowedFormats: ["jpg", "jpeg", "png", "gif", "webp"],
        folder: "duet-chat", 
        resourceType: "image", 
        cropping: false, 
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

export const openUploadWidget = openChatImageUploadWidget;

export const getOptimizedProfilePictureUrl = (publicId, size = 200) => {
  
  const fullPublicId = publicId.startsWith('duet-dp/') 
    ? publicId 
    : publicId.includes('/') 
      ? publicId 
      : `duet-dp/${publicId}`;
  
  return `https://res.cloudinary.com/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload/w_${size},h_${size},c_fill,g_face,q_auto,f_auto,r_max/${fullPublicId}`;
};

export const getOptimizedImageUrl = (publicId, width = 400, height = 400) => {
  
  const fullPublicId = publicId.startsWith('duet-chat/') 
    ? publicId 
    : publicId.includes('/') 
      ? publicId 
      : `duet-chat/${publicId}`;
  
  return `https://res.cloudinary.com/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload/w_${width},h_${height},c_fill,q_auto,f_auto/${fullPublicId}`;
};

export const isProfilePictureUrl = (url) => {
  const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
  const profilePattern = new RegExp(`https://res\\.cloudinary\\.com/${cloudName}/image/upload/.+duet-dp/`);
  return profilePattern.test(url);
};

export const extractPublicIdFromUrl = (url) => {
  if (!url) return null;
  
  const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
  const pattern = new RegExp(`https://res\\.cloudinary\\.com/${cloudName}/[^/]+/upload/(?:v\\d+/)?(.+)$`);
  const match = url.match(pattern);
  
  return match ? match[1] : null;
};

export const uploadVoiceNote = async (audioBlob) => {
  return new Promise((resolve, reject) => {
    const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = "duet_voice"; 
    
    const formData = new FormData();
    formData.append('file', audioBlob);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', 'duet-voice');
    formData.append('resource_type', 'video'); 

    fetch(`https://api.cloudinary.com/v1_1/${cloudName}/upload`, {
      method: 'POST',
      body: formData
    })
      .then(response => response.json())
      .then(data => {
        if (data.error) {
          reject(new Error(data.error.message));
        } else {
          resolve({
            url: data.secure_url,
            publicId: data.public_id,
            duration: data.duration,
            format: data.format,
            bytes: data.bytes
          });
        }
      })
      .catch(error => {
        reject(error);
      });
  });
};
