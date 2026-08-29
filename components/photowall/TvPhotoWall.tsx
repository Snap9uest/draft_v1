"use client";

import React, { useState, useEffect } from 'react';
import { PhotoItem } from '../../types/photowall';
import { seedPhotos } from '../../data/seed-photos';
import HostReactionBanner from './HostReactionBanner';
import { presetReactions } from '../../data/preset-reactions';

export default function TvPhotoWall() {
  const [photos, setPhotos] = useState<PhotoItem[]>(seedPhotos);
  const [visiblePhotos, setVisiblePhotos] = useState<PhotoItem[]>([]);
  const [newPhotoPopup, setNewPhotoPopup] = useState<PhotoItem | null>(null);

  // Mock preset reactions for display
  const mockReactions = presetReactions.slice(0, 5).map((r, i) => ({
    ...r,
    id: `mock-${i}`,
    createdAt: Date.now()
  }));

  useEffect(() => {
    // Filter hidden photos and sort by timestamp desc (newest first for standard masonry, though order depends on design)
    // We'll just show them as they are for masonry.
    setVisiblePhotos(photos.filter(p => !p.isHidden));
  }, [photos]);

  // Simulate a new photo arriving for testing the popup animation
  useEffect(() => {
    // Just a demonstration: if we wanted to test popup, we could uncomment this
    /*
    const timer = setTimeout(() => {
      setNewPhotoPopup(seedPhotos[0]);
      setTimeout(() => setNewPhotoPopup(null), 4000);
    }, 2000);
    return () => clearTimeout(timer);
    */
  }, []);

  return (
    <div className="h-screen w-full bg-neutral-900 text-white flex flex-col overflow-hidden">
      {/* Top Banner */}
      <HostReactionBanner reactions={mockReactions} />

      {/* Main Photowall */}
      <div className="flex-1 p-8 overflow-y-auto">
        {visiblePhotos.length > 0 ? (
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-6 space-y-6">
            {visiblePhotos.map(photo => (
              <div 
                key={photo.id} 
                className="break-inside-avoid bg-neutral-800 rounded-2xl overflow-hidden shadow-2xl animate-fade-in"
              >
                <img 
                  src={photo.photoUrl} 
                  alt={photo.caption} 
                  className="w-full object-cover" 
                  loading="lazy"
                />
                <div className="p-5">
                  <p className="text-xl font-bold mb-3">{photo.caption}</p>
                  <div className="flex items-center text-base text-neutral-300">
                    {photo.participantAvatar ? (
                      <img 
                        src={photo.participantAvatar} 
                        alt={photo.participantName} 
                        className="w-8 h-8 rounded-full mr-3 border border-neutral-600"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center mr-3 text-sm font-bold">
                        {photo.participantName.charAt(0)}
                      </div>
                    )}
                    <span className="font-semibold">{photo.participantName}</span>
                    {photo.missionTitle && (
                      <>
                        <span className="mx-2 text-neutral-500">•</span>
                        <span className="text-indigo-400 font-medium">{photo.missionTitle}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-neutral-400 py-32">
            <div className="text-6xl mb-6">📸</div>
            <p className="text-3xl font-bold mb-4 text-white">아직 업로드된 사진이 없습니다.</p>
            <p className="text-xl">QR 코드를 스캔하고 첫 번째 사진을 올려보세요!</p>
          </div>
        )}
      </div>

      {/* New Photo Popup */}
      {newPhotoPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm">
          <div className="bg-neutral-800 rounded-3xl p-6 max-w-4xl w-full mx-6 shadow-2xl animate-pop-in border border-neutral-700">
            <img 
              src={newPhotoPopup.photoUrl} 
              alt={newPhotoPopup.caption} 
              className="w-full h-auto rounded-2xl max-h-[70vh] object-contain"
            />
            <div className="mt-8 text-center">
              <h2 className="text-4xl font-extrabold mb-4">{newPhotoPopup.caption}</h2>
              <div className="flex items-center justify-center text-2xl text-indigo-400 font-semibold">
                {newPhotoPopup.participantAvatar && (
                  <img 
                    src={newPhotoPopup.participantAvatar} 
                    alt={newPhotoPopup.participantName} 
                    className="w-10 h-10 rounded-full mr-3 border-2 border-indigo-400"
                  />
                )}
                <span>{newPhotoPopup.participantName}</span>
                {newPhotoPopup.missionTitle && (
                  <>
                    <span className="mx-3 text-neutral-500">•</span>
                    <span>{newPhotoPopup.missionTitle}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
