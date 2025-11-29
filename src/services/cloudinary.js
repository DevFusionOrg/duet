import { Cloudinary } from "@cloudinary/url-gen";

// Configure Cloudinary instance with environment variables
const cld = new Cloudinary({
  cloud: {
    cloudName: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME,
  },
});

export default cld;

// Upload image using Cloudinary Upload Widget
export const openUploadWidget = () => {
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

// Generate optimized image URL
export const getOptimizedImageUrl = (publicId, width = 400, height = 400) => {
  return `https://res.cloudinary.com/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload/w_${width},h_${height},c_fill,q_auto,f_auto/${publicId}`;
};
