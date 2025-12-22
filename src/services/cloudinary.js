import { Cloudinary } from "@cloudinary/url-gen";

const cld = new Cloudinary({
  cloud: {
    cloudName: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME,
  },
});

export default cld;

export const openProfilePictureUploadWidget = (onUploadStart = null) => {
  return new Promise((resolve, reject) => {
    // Create hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg,image/jpg,image/png,image/webp';
    fileInput.style.display = 'none';
    
    fileInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) {
        document.body.removeChild(fileInput);
        reject(new Error("Upload cancelled"));
        return;
      }

      // Check file size (5MB)
      if (file.size > 5000000) {
        document.body.removeChild(fileInput);
        reject(new Error("File size must be less than 5MB"));
        return;
      }

      try {
        // Notify that upload is starting
        if (onUploadStart) onUploadStart();
        
        // Upload directly to Cloudinary
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'duet_dp');
        formData.append('folder', 'duet-dp');

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`,
          {
            method: 'POST',
            body: formData
          }
        );

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const data = await response.json();
        resolve(data);
      } catch (error) {
        reject(error);
      } finally {
        document.body.removeChild(fileInput);
      }
    };

    fileInput.oncancel = () => {
      document.body.removeChild(fileInput);
      reject(new Error("Upload cancelled"));
    };

    document.body.appendChild(fileInput);
    fileInput.click();
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

export const getOptimizedProfilePictureUrl = (publicId, size = 80) => {
  // Optimize for chat list avatar size (80px)
  const fullPublicId = publicId.startsWith('duet-dp/') 
    ? publicId 
    : publicId.includes('/') 
      ? publicId 
      : `duet-dp/${publicId}`;
  
  // q_auto uses best quality, f_auto uses best format (WebP/AVIF), dpr_auto handles high DPI screens
  return `https://res.cloudinary.com/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload/w_${size},h_${size},c_fill,g_face,q_auto,f_auto,dpr_auto/${fullPublicId}`;
};

export const getOptimizedImageUrl = (publicId, width = 400, height = 400) => {
  // Optimize for chat message images
  const fullPublicId = publicId.startsWith('duet-chat/') 
    ? publicId 
    : publicId.includes('/') 
      ? publicId 
      : `duet-chat/${publicId}`;
  
  return `https://res.cloudinary.com/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload/w_${width},h_${height},c_fill,q_auto,f_auto,dpr_auto/${fullPublicId}`;
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
