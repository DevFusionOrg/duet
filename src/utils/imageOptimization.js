export const getOptimizedImageUrl = (url, width = 100, height = 100, quality = 'auto:low') => {
  if (!url) return '/default-avatar.png';
  
  if (url.includes('cloudinary.com')) {
    return `${url}?w=${width}&h=${height}&c=thumb&q=${quality}`;
  }
  
  if (url.includes('lh3.googleusercontent.com')) {
    return `${url}=s${width}`;
  }
  
  return url;
};

export const getOptimizedCoverImageUrl = (url, width = 400, height = 200) => {
  if (!url) return null;
  
  if (url.includes('cloudinary.com')) {
    return `${url}?w=${width}&h=${height}&c=fill&q=auto:good`;
  }
  
  return url;
};

export const preloadImage = (src) => {
  if (!src) return;
  const img = new Image();
  img.src = src;
};
