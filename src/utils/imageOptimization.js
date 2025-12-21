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

// Enhanced preloading with priority
export const preloadImage = (src, priority = 'low') => {
  if (!src) return;
  
  const img = new Image();
  if (priority === 'high') {
    img.fetchPriority = 'high';
  }
  img.src = src;
  return img;
};

// Batch preload multiple images
export const preloadImages = (urls, priority = 'low') => {
  return urls.map(url => preloadImage(url, priority));
};

// Intersection Observer for lazy loading
export const createImageObserver = (callback) => {
  if (!window.IntersectionObserver) return null;
  
  return new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        callback(entry.target);
      }
    });
  }, {
    rootMargin: '50px'
  });
};
