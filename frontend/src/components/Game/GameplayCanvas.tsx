import React, { useEffect, useRef, useState } from 'react';
import { ThreeGameEngine, InteractionPrompt, MinimapData } from '../../game/GameEngine3D';
import { useGameStore } from '../../store/gameStore';

const LEGEND = [
  { icon: '💬', label: 'Talk', color: '#3f8bff' },
  { icon: '⚔️', label: 'Fight', color: '#e0574a' },
  { icon: '🪙', label: 'Loot', color: '#e2b653' },
  { icon: '🚪', label: 'Exit', color: '#b07bff' },
];

const MINI = 116; // minimap canvas size (px)

const OBJECT_COLORS: Record<string, string> = {
  npc: '#3f8bff',
  monster: '#e0574a',
  chest: '#e2b653',
  exit: '#b07bff',
};

const Minimap: React.FC<{ data: MinimapData | null }> = ({ data }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rows = data.grid.length;
    const cols = data.grid[0]?.length || 1;
    const cell = MINI / Math.max(rows, cols);
    const ox = (MINI - cols * cell) / 2;
    const oy = (MINI - rows * cell) / 2;

    ctx.clearRect(0, 0, MINI, MINI);

    // Tiles.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = data.grid[r][c];
        ctx.fillStyle = ch === '#' ? 'rgba(20,22,34,0.9)' : 'rgba(120,110,80,0.35)';
        ctx.fillRect(ox + c * cell, oy + r * cell, cell - 0.5, cell - 0.5);
      }
    }

    // Objects.
    for (const o of data.objects) {
      if (o.claimed) continue;
      ctx.fillStyle = OBJECT_COLORS[o.kind] || '#ffffff';
      ctx.beginPath();
      ctx.arc(ox + o.c * cell + cell / 2, oy + o.r * cell + cell / 2, Math.max(1.6, cell * 0.28), 0, Math.PI * 2);
      ctx.fill();
    }

    // Player.
    const px = ox + data.player.c * cell + cell / 2;
    const py = oy + data.player.r * cell + cell / 2;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e2b653';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(2.2, cell * 0.34), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }, [data]);

  return <canvas ref={ref} width={MINI} height={MINI} className="block" />;
};

const GameplayCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ThreeGameEngine | null>(null);

  const character = useGameStore((s) => s.character);
  const regions = useGameStore((s) => s.regions);
  const region = regions.find((r) => r.name === character?.current_region);

  const [prompt, setPrompt] = useState<InteractionPrompt | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [minimap, setMinimap] = useState<MinimapData | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (containerRef.current && !engineRef.current) {
      engineRef.current = new ThreeGameEngine(containerRef.current, {
        onPrompt: (p) => setPrompt(p),
        onNotice: (msg) => {
          setNotice(msg);
          window.clearTimeout(noticeTimer.current);
          noticeTimer.current = window.setTimeout(() => setNotice(null), 2200);
        },
        onMinimap: (d) => setMinimap(d),
      });
    }

    return () => {
      window.clearTimeout(noticeTimer.current);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-full h-full rounded-lg border border-elyndor-border/20 overflow-hidden">
      <div ref={containerRef} className="w-full h-full bg-[#06070a]" />

      {/* Region banner (top-center) */}
      {region && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none select-none text-center">
          <div className="bg-[#0c0d15]/80 border border-elyndor-border/30 rounded-md px-5 py-1.5 backdrop-blur-sm">
            <h3 className="font-cinzel text-sm font-bold text-elyndor-gold tracking-widest uppercase">
              {region.name}
            </h3>
            <p className="text-[9px] font-mono tracking-[0.25em] text-[#8a8da3] uppercase">
              Difficulty Tier {region.difficulty_level}
            </p>
          </div>
        </div>
      )}

      {/* Controls + legend (top-left) */}
      <div className="absolute top-3 left-3 flex flex-col gap-2 pointer-events-none select-none">
        <div className="bg-[#0c0d15]/85 border border-elyndor-border/30 rounded-md px-3 py-2 backdrop-blur-sm">
          <p className="text-[9px] font-mono tracking-widest text-[#5b5e70] uppercase mb-1">Move / Camera</p>
          <div className="flex items-center gap-2 text-elyndor-gold">
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#1a1c28] border border-elyndor-border/40 rounded">WASD</span>
            <span className="text-[10px] text-zinc-500">·</span>
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#1a1c28] border border-elyndor-border/40 rounded">↑↓←→</span>
          </div>
          <p className="text-[8px] font-mono text-[#5b5e70] mt-1 tracking-wider">DRAG to orbit · SCROLL to zoom</p>
        </div>
        <div className="bg-[#0c0d15]/85 border border-elyndor-border/30 rounded-md px-3 py-2 backdrop-blur-sm flex flex-col gap-1.5">
          {LEGEND.map((l) => (
            <div key={l.label} className="flex items-center gap-2 text-[10px]">
              <span>{l.icon}</span>
              <span className="font-mono uppercase tracking-wider" style={{ color: l.color }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Minimap (top-right) */}
      <div className="absolute top-3 right-3 pointer-events-none select-none">
        <div className="bg-[#0c0d15]/85 border border-elyndor-border/40 rounded-md p-1.5 backdrop-blur-sm shadow-lg">
          <Minimap data={minimap} />
          <p className="text-center text-[8px] font-mono tracking-[0.25em] text-[#8a8da3] uppercase mt-0.5">Map</p>
        </div>
      </div>

      {/* Contextual interaction prompt (bottom-center) */}
      {prompt && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none animate-fade-in">
          <div className="flex items-center gap-3 bg-[#0c0d15]/90 border rounded-lg px-5 py-3 backdrop-blur-sm shadow-2xl"
               style={{ borderColor: 'rgba(226, 182, 83, 0.5)' }}>
            <span className="text-2xl drop-shadow">{prompt.icon}</span>
            <div className="flex flex-col">
              <span className="font-cinzel text-sm font-bold text-elyndor-gold uppercase tracking-wide">{prompt.title}</span>
              <span className="text-[11px] text-[#a3a5be]">{prompt.hint}</span>
            </div>
          </div>
        </div>
      )}

      {/* Transient toast notice (top-center, below banner) */}
      {notice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none animate-fade-in">
          <div className="bg-black/80 border border-elyndor-gold/50 rounded-md px-4 py-2 backdrop-blur-sm">
            <span className="font-cinzel text-xs text-elyndor-gold tracking-wide">{notice}</span>
          </div>
        </div>
      )}

      {/* Subtle vignette for depth */}
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 140px 40px rgba(0,0,0,0.55)' }} />
    </div>
  );
};

export default GameplayCanvas;
