// ... existing code ...
import React, { useEffect, useState } from 'react';
import { useTelegram } from './telegram/useTelegram';
import './index.css';

const App: React.FC = () => {
  const { init, showMainButton, hideMainButton, showAlert, user, close, expand } = useTelegram();
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    init();
    expand(); // Expand the app to full screen on load
    setIsExpanded(true); // Update state to reflect expansion
  }, [init, expand]);

  const handleInviteFriend = () => {
    showAlert('Пригласить друга - функционал пока не реализован!');
  };

  const handleMyGames = () => {
    showAlert('Мои партии - функционал пока не реализован!');
  };

  return (
    <div className="flex flex-col h-screen w-screen justify-between items-center bg-gray-100 p-4">
      <h1 className="text-2xl font-bold text-center text-gray-800 mb-4">Добро пожаловать в шахматы Телеграмм</h1>

      <div className="flex flex-col w-full flex-grow space-y-4">
        <button
          onClick={handleInviteFriend}
          className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg shadow-md text-lg"
        >
          Пригласить друга
        </button>
        <button
          onClick={handleMyGames}
          className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg shadow-md text-lg"
        >
          Мои партии
        </button>
      </div>

      {/* Optionally, you can add a footer or other elements here if needed */}
      {/* <div className="text-sm text-gray-600 mt-4">Powered by Telegram</div> */}
    </div>
  );
};

export default App;