'use client';

import { useState, useEffect } from 'react';
import { PRESET_FRAMES } from '../../data/preset-frames';
import { TicketCompositionData } from '../../types/ticket';
import { composeTicketCanvas } from '../../lib/ticket-composer';
import { Download, Sparkles } from 'lucide-react';

const DUMMY_PHOTOS = [
  'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=500&auto=format&fit=crop&q=60',
];

export function TicketCustomizer() {
  const [selectedFrame, setSelectedFrame] = useState(PRESET_FRAMES[0].id);
  const [participantName, setParticipantName] = useState('지민');
  const [titleText, setTitleText] = useState('K-케미장인');
  const [composedUrl, setComposedUrl] = useState<string | null>(null);

  const generateTicket = async () => {
    try {
      const data: TicketCompositionData = {
        roomId: 'demo-party',
        roomCode: 'DEMO01',
        participantName,
        titleText,
        photoUrls: DUMMY_PHOTOS,
        frameId: selectedFrame,
        dateStr: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      };
      const dataUrl = await composeTicketCanvas(data);
      setComposedUrl(dataUrl);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    generateTicket();
  }, [selectedFrame, participantName, titleText]);

  const handleDownload = () => {
    if (!composedUrl) return;
    const a = document.createElement('a');
    a.href = composedUrl;
    a.download = `snapquest-ticket-${participantName}.png`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col items-center justify-center">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-pink-400" />
          나만의 네컷 전리품 커스텀
        </h1>
        <input
          type="text"
          value={participantName}
          onChange={(e) => setParticipantName(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
        />
        {composedUrl && (
          <img src={composedUrl} alt="Composed Ticket" className="w-full rounded-xl shadow-lg" />
        )}
        <button
          onClick={handleDownload}
          className="w-full py-3 bg-pink-600 hover:bg-pink-500 font-bold rounded-xl flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" /> 티켓 이미지 저장 (PNG)
        </button>
      </div>
    </div>
  );
}
