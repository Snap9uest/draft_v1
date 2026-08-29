"use client";

import React, { useState } from 'react';
import HostPhotoWallControl from '../../components/photowall/HostPhotoWallControl';
import { PhotoItem } from '../../types/photowall';
import { seedPhotos } from '../../data/seed-photos';

export default function TestPage() {
  const [photos, setPhotos] = useState<PhotoItem[]>(seedPhotos);

  const handleToggleHide = (id: string) => {
    setPhotos(prev => 
      prev.map(p => p.id === id ? { ...p, isHidden: !p.isHidden } : p)
    );
  };

  const handleAddTestPhoto = () => {
    const newPhoto: PhotoItem = {
      id: `test-${Date.now()}`,
      roomId: 'test-room',
      photoUrl: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&q=80',
      caption: '테스트용 추가 사진입니다',
      participantName: '테스터',
      timestamp: Date.now(),
      isHidden: false,
    };
    setPhotos(prev => [newPhoto, ...prev]);
  };

  return (
    <div className="p-4 bg-gray-200 min-h-screen">
      <div className="max-w-md mx-auto h-[800px]">
        <HostPhotoWallControl 
          photos={photos}
          onToggleHide={handleToggleHide}
          onAddTestPhoto={handleAddTestPhoto}
        />
      </div>
    </div>
  );
}
