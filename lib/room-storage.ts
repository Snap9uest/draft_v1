const HOST_TOKEN_KEY_PREFIX = 'snapquest_host_token_';

export const roomStorage = {
  saveHostToken: (roomId: string, token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${HOST_TOKEN_KEY_PREFIX}${roomId}`, token);
  },

  getHostToken: (roomId: string): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(`${HOST_TOKEN_KEY_PREFIX}${roomId}`);
  },

  clearHostToken: (roomId: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`${HOST_TOKEN_KEY_PREFIX}${roomId}`);
  },

  verifyHostToken: (roomId: string, tokenToVerify: string): boolean => {
    const storedToken = roomStorage.getHostToken(roomId);
    return storedToken === tokenToVerify;
  }
};
