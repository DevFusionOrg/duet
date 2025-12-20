// Encryption migration utilities removed.
export const hasExistingChats = async () => false;
export const initializeAllChatKeys = async () => ({ success: true, count: 0 });
export const showEncryptionInfo = () => null;
export const getEncryptionStats = async () => ({ total: 0, encrypted: 0, unencrypted: 0 });

export default {
  hasExistingChats,
  initializeAllChatKeys,
  showEncryptionInfo,
  getEncryptionStats,
};
