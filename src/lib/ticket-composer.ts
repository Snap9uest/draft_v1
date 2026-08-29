import { TicketCompositionData } from '../types/ticket';
import { PRESET_FRAMES } from '../data/preset-frames';

export async function composeTicketCanvas(data: TicketCompositionData): Promise<string> {
  const canvas = document.createElement('canvas');
  const width = 1080;
  const height = 1920;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  const frame = PRESET_FRAMES.find(f => f.id === data.frameId) || PRESET_FRAMES[0];

  ctx.fillStyle = frame.bgColor;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = frame.accentColor;
  ctx.lineWidth = 16;
  ctx.strokeRect(32, 32, width - 64, height - 64);

  ctx.fillStyle = frame.textColor;
  ctx.textAlign = 'center';

  ctx.font = 'bold 54px sans-serif';
  ctx.fillText('SNAPQUEST PARTY TICKET', width / 2, 130);

  ctx.font = '32px monospace';
  ctx.fillStyle = frame.accentColor;
  ctx.fillText(`ROOM #${data.roomCode} • ${data.dateStr}`, width / 2, 190);

  ctx.strokeStyle = '#888888';
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 12]);
  ctx.beginPath();
  ctx.moveTo(80, 230);
  ctx.lineTo(width - 80, 230);
  ctx.stroke();
  ctx.setLineDash([]);

  const gridX = 90;
  const gridY = 270;
  const photoW = 430;
  const photoH = 540;
  const gap = 40;

  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = gridX + col * (photoW + gap);
    const y = gridY + row * (photoH + gap);

    ctx.fillStyle = frame.theme === 'receipt' ? '#E5E7EB' : '#1E293B';
    ctx.fillRect(x, y, photoW, photoH);

    const photoUrl = data.photoUrls[i];
    if (photoUrl) {
      try {
        const img = await loadImage(photoUrl);
        ctx.drawImage(img, x, y, photoW, photoH);
      } catch (err) {
        drawCardPlaceholder(ctx, x, y, photoW, photoH, i + 1, data.participantName, frame);
      }
    } else {
      drawCardPlaceholder(ctx, x, y, photoW, photoH, i + 1, data.participantName, frame);
    }

    ctx.strokeStyle = '#FFFFFF33';
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, photoW, photoH);
  }

  const footerY = 1450;
  ctx.strokeStyle = '#888888';
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 12]);
  ctx.beginPath();
  ctx.moveTo(80, footerY);
  ctx.lineTo(width - 80, footerY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = frame.accentColor;
  ctx.roundRect ? ctx.roundRect(140, footerY + 40, width - 280, 160, 24) : ctx.fillRect(140, footerY + 40, width - 280, 160);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(`🎉 [${data.participantName}] 님의 공식 칭호`, width / 2, footerY + 95);

  ctx.font = 'extrabold 52px sans-serif';
  ctx.fillText(`"${data.titleText}"`, width / 2, footerY + 165);

  ctx.fillStyle = frame.textColor;
  ctx.font = '28px monospace';
  ctx.fillText('★ 7 DAYS MEMORY ARCHIVE • INSTAGRAM @SNAPQUEST ★', width / 2, footerY + 280);

  return canvas.toDataURL('image/png');
}

function drawCardPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, index: number, name: string, frame: any) {
  ctx.fillStyle = frame.theme === 'receipt' ? '#D1D5DB' : '#334155';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = frame.theme === 'receipt' ? '#4B5563' : '#94A3B8';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`CUT #${index}`, x + w / 2, y + h / 2 - 20);
  ctx.font = '24px sans-serif';
  ctx.fillText(`${name}의 특별한 순간`, x + w / 2, y + h / 2 + 30);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}
