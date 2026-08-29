import { TicketComposition, TicketFrame } from '../types/ticket';
import { PRESET_FRAMES } from '../data/preset-frames';

const TICKET_WIDTH = 1080;
const TICKET_HEIGHT = 1920;

// Helper to load image securely and handle CORS
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Prevent CORS issues
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn(`Failed to load image: ${src}`);
      // Return a 1x1 transparent image on failure to prevent entire canvas from failing
      const fallback = new Image();
      fallback.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      fallback.onload = () => resolve(fallback);
    };
    img.src = src;
  });
};

// Fill a rounded rectangle path on canvas
const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

export const generateTicketImage = async (
  composition: Omit<TicketComposition, 'id' | 'composedImageUrl' | 'createdAt'>
): Promise<string> => {
  const canvas = document.createElement('canvas');
  canvas.width = TICKET_WIDTH;
  canvas.height = TICKET_HEIGHT;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas 2D context');
  }

  // 1. Find frame
  const frame: TicketFrame = PRESET_FRAMES.find(f => f.id === composition.frameId) || PRESET_FRAMES[0];

  // 2. Draw Background
  ctx.fillStyle = frame.backgroundColor;
  ctx.fillRect(0, 0, TICKET_WIDTH, TICKET_HEIGHT);

  // 3. Draw Border
  ctx.strokeStyle = frame.borderColor;
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, TICKET_WIDTH - 16, TICKET_HEIGHT - 16);

  // 4. Load Photos & Avatars
  const images = await Promise.all(
    Array.from({ length: 4 }).map(async (_, i) => {
      const url = composition.photoUrls[i];
      if (url) {
        return loadImage(url);
      }
      // If photo doesn't exist, load avatar as placeholder
      return loadImage(composition.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=fallback');
    })
  );

  // 5. Draw 2x2 Photo Grid
  // Grid layout parameters
  const padding = 60;
  const gap = 30;
  const topOffset = 250;
  const photoWidth = (TICKET_WIDTH - (padding * 2) - gap) / 2;
  const photoHeight = photoWidth * 1.33; // 3:4 aspect ratio for photos

  images.forEach((img, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const x = padding + (col * (photoWidth + gap));
    const y = topOffset + (row * (photoHeight + gap));

    ctx.save();
    roundRect(ctx, x, y, photoWidth, photoHeight, 20);
    ctx.clip();
    
    // Draw image maintaining aspect ratio and covering the area (object-fit: cover)
    const imgRatio = img.width / img.height;
    const boxRatio = photoWidth / photoHeight;
    
    let renderWidth, renderHeight, offsetX, offsetY;
    if (imgRatio > boxRatio) {
      // Image is wider than box
      renderHeight = photoHeight;
      renderWidth = img.width * (photoHeight / img.height);
      offsetX = x - (renderWidth - photoWidth) / 2;
      offsetY = y;
    } else {
      // Image is taller than box
      renderWidth = photoWidth;
      renderHeight = img.height * (photoWidth / img.width);
      offsetX = x;
      offsetY = y - (renderHeight - photoHeight) / 2;
    }

    ctx.drawImage(img, offsetX, offsetY, renderWidth, renderHeight);
    
    // Add inner shadow/border
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.restore();
  });

  // 6. Draw Top Texts
  ctx.fillStyle = frame.theme === 'dark' ? '#FFFFFF' : '#333333';
  ctx.textAlign = 'center';
  
  // Title (F6 Title / Room Code)
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(composition.titleText || `Room ${composition.roomId}`, TICKET_WIDTH / 2, 130);
  
  // Date
  ctx.font = '32px sans-serif';
  ctx.fillStyle = frame.theme === 'dark' ? '#CCCCCC' : '#666666';
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  ctx.fillText(`${today} | SnapQuest`, TICKET_WIDTH / 2, 190);

  // 7. Draw Bottom Texts
  const bottomOffset = topOffset + (photoHeight * 2) + gap + 120;
  
  // Nickname
  ctx.fillStyle = frame.theme === 'dark' ? '#FFFFFF' : '#333333';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(composition.participantName, TICKET_WIDTH / 2, bottomOffset);

  // D-7 Notice
  ctx.font = '28px sans-serif';
  ctx.fillStyle = frame.theme === 'dark' ? '#FF6B6B' : '#E03131';
  ctx.fillText('※ 링크 및 이미지는 7일 후 만료됩니다.', TICKET_WIDTH / 2, bottomOffset + 70);

  // Bottom Decoration / Logo Space
  ctx.fillStyle = frame.theme === 'dark' ? '#444444' : '#DDDDDD';
  ctx.fillRect(TICKET_WIDTH / 2 - 150, TICKET_HEIGHT - 100, 300, 8);

  // Return as Data URL (PNG)
  return canvas.toDataURL('image/png', 1.0);
};
