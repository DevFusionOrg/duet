/**
 * Index Status Checker
 * Helps detect and handle index building state
 */

let indexWarningShown = false;

export function handleIndexError(error) {
  const isIndexError = 
    error.code === 'failed-precondition' || 
    error.message?.includes('index') ||
    error.message?.includes('currently building');

  if (isIndexError && !indexWarningShown) {
    console.warn(
      '⚠️ Firestore indexes are still building. Some features may be temporarily limited.\n' +
      'This usually takes 5-10 minutes after deployment.\n' +
      'Check status: https://console.firebase.google.com/project/vibechat-f87fe/firestore/indexes'
    );
    indexWarningShown = true;

    // Show user-friendly notification
    if (typeof window !== 'undefined' && window.alert) {
      // Only show once per session
      const hasShown = sessionStorage.getItem('indexWarningShown');
      if (!hasShown) {
        sessionStorage.setItem('indexWarningShown', 'true');
        // You can replace this with a toast notification
        console.log('💡 Some features are loading... This is normal after an update.');
      }
    }
  }

  return isIndexError;
}

export function isIndexBuilding(error) {
  return (
    error.code === 'failed-precondition' || 
    error.message?.includes('index') ||
    error.message?.includes('currently building')
  );
}

const indexHelper = { handleIndexError, isIndexBuilding };

export default indexHelper;
