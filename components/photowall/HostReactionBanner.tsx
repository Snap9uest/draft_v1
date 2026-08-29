import React, { useEffect, useState } from 'react';
import { ReactionMessage } from '../../types/photowall';

interface HostReactionBannerProps {
  reactions: ReactionMessage[];
}

export default function HostReactionBanner({ reactions }: HostReactionBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (reactions.length === 0) return;

    const intervalId = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % reactions.length);
        setIsVisible(true);
      }, 500); // fade out duration
    }, 5000); // 5 seconds per message

    return () => clearInterval(intervalId);
  }, [reactions]);

  if (reactions.length === 0) return null;

  const currentReaction = reactions[currentIndex];

  return (
    <div className="w-full bg-indigo-600/90 text-white py-4 px-6 text-center text-3xl font-bold shadow-lg z-40 relative">
      <div 
        className={`transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      >
        🎙️ {currentReaction.text}
      </div>
    </div>
  );
}
