import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';

const CharacterCreation: React.FC = () => {
  const { createCharacter } = useGameStore();
  const [name, setName] = useState('');
  const [selectedClass, setSelectedClass] = useState<'Warrior' | 'Mage' | 'Ranger'>('Warrior');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    await createCharacter(name, selectedClass, "Eldergate");
    setLoading(false);
  };

  // Descriptive class layouts
  const classData = {
    Warrior: {
      emoji: "⚔️",
      desc: "Melee juggernaut clad in heavy iron chainmail. Relies on immense Strength and brute force to shatter enemy armor.",
      stats: { str: 15, dex: 10, int: 8, vit: 14, hp: 150, mp: 30 },
      color: "border-elyndor-blood shadow-blood-glow text-red-500"
    },
    Mage: {
      emoji: "🔮",
      desc: "Arcane scholar channeling primal energy. Manipulates Intelligence to rain dynamic fire spells and vaporize foes from afar.",
      stats: { str: 6, dex: 11, int: 16, vit: 8, hp: 80, mp: 100 },
      color: "border-elyndor-sapphire shadow-sapphire-glow text-blue-400"
    },
    Ranger: {
      emoji: "🏹",
      desc: "Lethal woodland survivalist. Excels at long-range Dexterity, poison arrows, and escaping danger with swift dodging capabilities.",
      stats: { str: 10, dex: 16, int: 10, vit: 11, hp: 110, mp: 50 },
      color: "border-emerald-700 shadow-[0_0_15px_rgba(16,185,129,0.3)] text-emerald-400"
    }
  };

  return (
    <div className="glass-panel max-w-4xl w-full p-8 rounded-lg flex flex-col items-center">
      <h1 className="font-cinzel text-3xl font-bold text-center text-elyndor-gold mb-1 tracking-wider">
        Forge Your Champion
      </h1>
      <p className="text-xs text-[#a3a5be] mb-8 text-center uppercase tracking-widest font-semibold font-cinzel">
        Begin your dynamic adventure in the world of Elyndor
      </p>

      {/* Main Form Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
        {/* Left: Stats & Class Selections */}
        <div className="flex flex-col gap-4">
          <label className="text-sm font-semibold tracking-wider font-cinzel text-elyndor-gold uppercase mb-1">
            Choose Character Class
          </label>
          <div className="flex gap-4">
            {(['Warrior', 'Mage', 'Ranger'] as const).map((cls) => (
              <button
                key={cls}
                onClick={() => setSelectedClass(cls)}
                className={`flex-1 p-4 rounded border cursor-pointer transition-all flex flex-col items-center gap-2 bg-[#0c0d14] ${
                  selectedClass === cls
                    ? classData[cls].color
                    : 'border-elyndor-border/20 text-[#6f738a] hover:border-elyndor-border/60'
                }`}
              >
                <span className="text-2xl">{classData[cls].emoji}</span>
                <span className="font-cinzel font-bold text-xs tracking-wider">{cls}</span>
              </button>
            ))}
          </div>

          <div className="bg-[#07080d] border border-elyndor-border/10 p-5 rounded mt-2 flex-1">
            <h3 className="font-cinzel text-xs font-bold text-elyndor-gold uppercase tracking-widest mb-2 flex justify-between">
              <span>{selectedClass} Attributes</span>
              <span className="text-[10px] text-[#5b5e70]">Starting Stats</span>
            </h3>
            <p className="text-xs text-[#a3a5be] leading-relaxed mb-4">
              {classData[selectedClass].desc}
            </p>

            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs font-mono">
              <div className="flex justify-between border-b border-elyndor-ash/40 pb-1.5">
                <span className="text-[#6f738a]">⚔️ STRENGTH</span>
                <span className="text-elyndor-gold font-bold">{classData[selectedClass].stats.str}</span>
              </div>
              <div className="flex justify-between border-b border-elyndor-ash/40 pb-1.5">
                <span className="text-[#6f738a]">🎯 DEXTERITY</span>
                <span className="text-elyndor-gold font-bold">{classData[selectedClass].stats.dex}</span>
              </div>
              <div className="flex justify-between border-b border-elyndor-ash/40 pb-1.5">
                <span className="text-[#6f738a]">🔮 INTELLIGENCE</span>
                <span className="text-elyndor-gold font-bold">{classData[selectedClass].stats.int}</span>
              </div>
              <div className="flex justify-between border-b border-elyndor-ash/40 pb-1.5">
                <span className="text-[#6f738a]">❤️ VITALITY</span>
                <span className="text-elyndor-gold font-bold">{classData[selectedClass].stats.vit}</span>
              </div>
              <div className="flex justify-between border-b border-elyndor-ash/40 pb-1.5 col-span-2">
                <span className="text-[#6f738a]">❤️ HEALTH POINTS</span>
                <span className="text-red-400 font-bold">{classData[selectedClass].stats.hp} HP</span>
              </div>
              <div className="flex justify-between border-b border-elyndor-ash/40 pb-1.5 col-span-2">
                <span className="text-[#6f738a]">🧪 MANA POINTS</span>
                <span className="text-blue-400 font-bold">{classData[selectedClass].stats.mp} MP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Character Name, Appearance & Region */}
        <div className="flex flex-col gap-6 justify-between">
          <div>
            <label className="block text-sm font-semibold tracking-wider font-cinzel text-elyndor-gold uppercase mb-2">
              Character Name
            </label>
            <input
              type="text"
              className="w-full p-3 rounded input-dark mb-4"
              placeholder="E.g., Corin Elderglow..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
            />

            <label className="block text-sm font-semibold tracking-wider font-cinzel text-elyndor-gold uppercase mb-2">
              Starting Region
            </label>
            <div className="p-4 bg-[#07080d] border border-elyndor-border/15 rounded flex gap-4 items-center">
              <span className="text-2xl">🌲</span>
              <div>
                <h4 className="font-cinzel text-xs font-bold text-elyndor-gold uppercase">Eldergate Sanctuary</h4>
                <p className="text-[10px] text-[#6f738a] leading-relaxed mt-0.5">
                  The peaceful, ancient forest containing the dynamic central trade node. Recommended for level 1.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className={`w-full p-4 rounded btn-gold ${(!name.trim() || loading) && 'opacity-50 cursor-not-allowed'}`}
          >
            {loading ? "Forging Hero..." : "Forge Hero & Enter Elyndor"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CharacterCreation;
