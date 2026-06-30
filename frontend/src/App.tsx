import React, { useEffect } from 'react';
import { useGameStore } from './store/gameStore';

// Import Screens
import LoginScreen from './components/UI/LoginScreen';
import CharacterCreation from './components/UI/CharacterCreation';
import Dashboard from './components/UI/Dashboard';
import WorldMap from './components/UI/WorldMap';
import GameplayUI from './components/UI/GameplayUI';
import SuccessScreen from './components/UI/SuccessScreen';
import FailureScreen from './components/UI/FailureScreen';

const App: React.FC = () => {
  const { currentScreen, fetchRegions, fetchActiveCharacter, token } = useGameStore();

  // Load basic seed data when user is authenticated
  useEffect(() => {
    if (token) {
      fetchRegions();
      fetchActiveCharacter();
    }
  }, [token, fetchRegions, fetchActiveCharacter]);

  // Render screens dynamically with a sleek dark atmosphere
  const renderScreen = () => {
    switch (currentScreen) {
      case 'LOGIN':
        return <LoginScreen />;
      case 'CHARACTER_CREATION':
        return <CharacterCreation />;
      case 'DASHBOARD':
        return <Dashboard />;
      case 'WORLD_MAP':
        return <WorldMap />;
      case 'GAMEPLAY':
        return <GameplayUI />;
      case 'SUCCESS':
        return <SuccessScreen />;
      case 'FAILURE':
        return <FailureScreen />;
      default:
        return <LoginScreen />;
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col justify-between select-none">
      {/* Cinematic dark fog backgrounds */}
      <div className="absolute inset-0 pointer-events-none bg-radial bg-gradient-to-b from-[#0b0c10]/20 via-[#06070a]/90 to-black z-0" />
      
      {/* Main Container */}
      <main className="relative flex-1 w-full h-full flex items-center justify-center z-10 p-4">
        {renderScreen()}
      </main>
    </div>
  );
};

export default App;
