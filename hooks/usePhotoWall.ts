import { useState, useEffect, useCallback, useRef } from 'react';
import { PhotoItem, ReactionMessage } from '../types/photowall';
import { seedPhotos } from '../data/seed-photos';

interface PhotoWallState {
  photos: PhotoItem[];
  reactions: ReactionMessage[];
}

const initialState: PhotoWallState = {
  photos: seedPhotos,
  reactions: []
};

export function usePhotoWall(roomId: string) {
  const [state, setState] = useState<PhotoWallState>(initialState);
  const stateRef = useRef<PhotoWallState>(state);

  const getStorageKey = useCallback(() => `snapquest_photowall_${roomId}`, [roomId]);

  const loadFromStorage = useCallback(() => {
    const stored = localStorage.getItem(getStorageKey());
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setState(parsed);
        stateRef.current = parsed;
      } catch (e) {
        // fallback
      }
    } else {
      localStorage.setItem(getStorageKey(), JSON.stringify(initialState));
      setState(initialState);
      stateRef.current = initialState;
    }
  }, [getStorageKey]);

  useEffect(() => {
    if (!roomId) return;
    loadFromStorage();
  }, [roomId, loadFromStorage]);

  useEffect(() => {
    if (!roomId) return;
    const channel = new BroadcastChannel(`photowall_${roomId}`);
    channel.onmessage = (event) => {
      if (event.data?.type === 'PHOTOWALL_UPDATE') {
        setState(event.data.payload);
        stateRef.current = event.data.payload;
      }
    };
    return () => {
      channel.close();
    };
  }, [roomId]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadFromStorage();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadFromStorage]);

  const updateStateAndBroadcast = useCallback((newState: PhotoWallState) => {
    setState(newState);
    stateRef.current = newState;
    localStorage.setItem(getStorageKey(), JSON.stringify(newState));
    
    const channel = new BroadcastChannel(`photowall_${roomId}`);
    channel.postMessage({ type: 'PHOTOWALL_UPDATE', payload: newState });
    channel.close();
  }, [getStorageKey, roomId]);

  const addPhoto = useCallback((photo: PhotoItem) => {
    const current = stateRef.current;
    if (current.photos.some(p => p.id === photo.id)) return;
    
    const newState = {
      ...current,
      photos: [photo, ...current.photos]
    };
    updateStateAndBroadcast(newState);
  }, [updateStateAndBroadcast]);

  const toggleHidePhoto = useCallback((photoId: string) => {
    const current = stateRef.current;
    const newState = {
      ...current,
      photos: current.photos.map(p => p.id === photoId ? { ...p, isHidden: !p.isHidden } : p)
    };
    updateStateAndBroadcast(newState);
  }, [updateStateAndBroadcast]);

  const addReaction = useCallback((reaction: ReactionMessage) => {
    const current = stateRef.current;
    const newState = {
      ...current,
      reactions: [reaction, ...current.reactions]
    };
    updateStateAndBroadcast(newState);
  }, [updateStateAndBroadcast]);

  return {
    photos: state.photos,
    reactions: state.reactions,
    addPhoto,
    toggleHidePhoto,
    addReaction
  };
}
