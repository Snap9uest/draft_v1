"use client";

import React, { useState } from 'react';
import { PhotoItem } from '../../types/photowall';
import { Eye, EyeOff, Plus, Filter, Image as ImageIcon } from 'lucide-react';

interface HostPhotoWallControlProps {
  photos: PhotoItem[];
  onToggleHide: (id: string) => void;
  onAddTestPhoto: () => void;
}

type FilterType = 'all' | 'visible' | 'hidden';

export default function HostPhotoWallControl({
  photos,
  onToggleHide,
  onAddTestPhoto,
}: HostPhotoWallControlProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredPhotos = photos.filter((photo) => {
    if (filter === 'visible') return !photo.isHidden;
    if (filter === 'hidden') return photo.isHidden;
    return true;
  });

  return (
    <div className="flex flex-col h-[600px] max-h-full bg-gray-50 text-gray-900 rounded-lg shadow border border-gray-200 overflow-hidden">
      {/* Header & Controls */}
      <div className="p-4 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ImageIcon size={20} className="text-blue-500" />
            라이브 포토월 관리
          </h2>
          <button
            onClick={onAddTestPhoto}
            className="flex items-center gap-1 bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            테스트 사진 추가
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <Filter size={16} className="text-gray-400 mr-1" />
          {(['all', 'visible', 'hidden'] as FilterType[]).map((fType) => (
            <button
              key={fType}
              onClick={() => setFilter(fType)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === fType
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {fType === 'all' && `전체 (${photos.length})`}
              {fType === 'visible' && `노출 중 (${photos.filter(p => !p.isHidden).length})`}
              {fType === 'hidden' && `숨김 (${photos.filter(p => p.isHidden).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Photo List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredPhotos.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">
            표시할 사진이 없습니다.
          </div>
        ) : (
          filteredPhotos.map((photo) => (
            <div
              key={photo.id}
              className={`flex gap-3 p-3 rounded-lg border transition-all ${
                photo.isHidden
                  ? 'bg-red-50 border-red-200 opacity-75'
                  : 'bg-white border-gray-200 shadow-sm'
              }`}
            >
              <div className="relative w-20 h-20 shrink-0 rounded-md overflow-hidden bg-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.photoUrl}
                  alt={photo.caption}
                  className="w-full h-full object-cover"
                />
                {photo.isHidden && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <EyeOff size={20} className="text-white" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {photo.participantName}
                    </p>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                      {new Date(photo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {photo.caption || '(캡션 없음)'}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      photo.isHidden
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {photo.isHidden ? '숨김 처리됨' : '노출 중'}
                  </span>
                  
                  <button
                    onClick={() => onToggleHide(photo.id)}
                    className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      photo.isHidden
                        ? 'bg-gray-800 hover:bg-gray-700 text-white'
                        : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                    }`}
                  >
                    {photo.isHidden ? (
                      <>
                        <Eye size={14} /> 복구
                      </>
                    ) : (
                      <>
                        <EyeOff size={14} /> 숨기기
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
