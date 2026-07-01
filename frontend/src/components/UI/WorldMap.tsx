import React from 'react';
import { useGameStore, Region } from '../../store/gameStore';

const WorldMap: React.FC = () => {
  const { regions, character, setScreen, isMockMode } = useGameStore();

  const handleTravel = async (region: Region) => {
    if (!character) return;
    
    // Check level locks
    if (character.level < region.difficulty_level) return;
    
    if (isMockMode) {
      // Offline transition
      useGameStore.setState({
        character: { ...character, current_region: region.name }
      });
      setScreen('GAMEPLAY');
      return;
    }
    
    // Save region shift to backend
    try {
      // Quick backend character sync or local mutation and load
      character.current_region = region.name;
      useGameStore.setState({ character });
      setScreen('GAMEPLAY');
    } catch (e) {
      console.error(e);
    }
  };

  const regionMetadata = {
    "Eldergate": { emoji: "🌲", bg: "from-green-950/40 to-[#0b0c10]" },
    "Shadow Vale": { emoji: "💀", bg: "from-purple-950/40 to-[#0b0c10]" },
    "Crystal Peaks": { emoji: "❄️", bg: "from-sky-950/40 to-[#0b0c10]" },
    "Ember Desert": { emoji: "🔥", bg: "from-orange-950/40 to-[#0b0c10]" }
  };

  return (
    <div className="glass-panel max-w-5xl w-full p-6 rounded-lg flex flex-col gap-6 relative max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-elyndor-border/20 pb-4">
        <div>
          <span className="text-[10px] text-[#5b5e70] uppercase tracking-widest font-bold font-mono">CHOOSE DESTINATION</span>
          <h1 className="font-cinzel text-2xl font-bold text-elyndor-gold uppercase">
            Elyndor Continental Map
          </h1>
        </div>
        <button
          onClick={() => setScreen('DASHBOARD')}
          className="p-2.5 px-5 rounded border border-elyndor-border/30 text-xs font-cinzel tracking-wider uppercase font-semibold hover:bg-elyndor-ash/40"
        >
          Back to Dashboard
        </button>
      </div>

      {/* World regions container grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {regions.map((reg) => {
          const meta = regionMetadata[reg.name as keyof typeof regionMetadata] || { emoji: "🗺️", bg: "from-zinc-950/40 to-[#0b0c10]" };
          const isLocked = !!(character && character.level < reg.difficulty_level);

          return (
            <div 
              key={reg.id} 
              className={`rounded-lg border p-5 flex flex-col justify-between gap-4 transition-all relative overflow-hidden bg-gradient-to-br ${meta.bg} ${
                isLocked 
                  ? 'border-elyndor-blood/10 opacity-60' 
                  : 'border-elyndor-border/15 hover:border-elyndor-gold/50 hover:shadow-premium'
              }`}
            >
              {/* Lock Indicator overlays */}
              {isLocked && (
                <div className="absolute top-3 right-3 bg-elyndor-blood/20 border border-elyndor-blood/30 text-red-400 font-mono text-[9px] font-bold p-1 px-2 rounded uppercase tracking-widest">
                  🔒 Locked (Lvl {reg.difficulty_level})
                </div>
              )}
              {!isLocked && (
                <div className="absolute top-3 right-3 bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 font-mono text-[9px] font-bold p-1 px-2 rounded uppercase tracking-widest">
                  🔓 Unlocked
                </div>
              )}

              <div className="flex items-center gap-4 relative z-10">
                <span className="text-4xl">{meta.emoji}</span>
                <div>
                  <h3 className="font-cinzel text-base font-bold text-white uppercase tracking-wider">{reg.name}</h3>
                  <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider font-cinzel">
                    Difficulty: Level {reg.difficulty_level} Threat
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 relative z-10 flex-1 justify-center">
                <p className="text-xs text-[#a3a5be] leading-relaxed">
                  {reg.description}
                </p>
                {reg.lore && (
                  <p className="text-[10px] text-[#6f738a] leading-relaxed italic border-t border-elyndor-ash/40 pt-2 mt-1">
                    "{reg.lore}"
                  </p>
                )}
              </div>

              <button
                disabled={isLocked}
                onClick={() => handleTravel(reg)}
                className={`w-full p-3 rounded mt-2 font-cinzel text-xs uppercase font-bold tracking-widest transition-all ${
                  isLocked 
                    ? 'bg-[#151722] border border-[#232534] text-[#4f526b] cursor-not-allowed' 
                    : 'btn-gold cursor-pointer'
                }`}
              >
                {isLocked ? `Requires Hero Level ${reg.difficulty_level}` : `Travel to ${reg.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorldMap;
