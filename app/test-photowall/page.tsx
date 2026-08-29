"use client";

import React from 'react';
import HostPhotoWallControl from '../../components/photowall/HostPhotoWallControl';
import { PhotoItem } from '../../types/photowall';
import { usePhotoWall } from '../../hooks/usePhotoWall';

export default function TestPage() {
  const { photos, addPhoto, toggleHidePhoto } = usePhotoWall('test-room');

  const handleToggleHide = (id: string) => {
    toggleHidePhoto(id);
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
    addPhoto(newPhoto);
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
