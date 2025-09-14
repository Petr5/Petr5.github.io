import React, { useState, useEffect } from 'react';
import { useTelegram } from './telegram/useTelegram';
import './index.css';

interface Game {
  id: string;
  players: {
    white?: string;
    black?: string;
  };
  player_names?: {
    white?: string;
    black?: string;
  };
  current_turn: string;
  last_id: number;
  created_at?: string;
  status: 'active' | 'finished';
  winner?: 'white' | 'black';
}

interface MyGamesProps {
  onBackToMain: () => void;
  onJoinGame: (roomId: string) => void;
}

const MyGames: React.FC<MyGamesProps> = ({ onBackToMain, onJoinGame }) => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const telegram = useTelegram();

  useEffect(() => {
    if (telegram.user?.id) {
      fetchMyGames();
    }
  }, [telegram.user?.id]);

  // Настройка кнопки "Назад" в Telegram
  useEffect(() => {
    if (telegram.isTelegramApp) {
      telegram.showBackButton(() => {
        onBackToMain();
      });
    }

    return () => {
      if (telegram.isTelegramApp) {
        telegram.hideBackButton();
      }
    };
  }, [telegram, onBackToMain]);

  const fetchMyGames = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const userId = String(telegram.user?.id);
      console.log('Telegram user:', telegram.user);
      console.log('User ID:', userId);
      if (!userId || userId === 'undefined') {
        setError('Не удалось получить ID пользователя из Telegram');
        return;
      }
      
      console.log(`Загрузка партий для игрока: ${userId}`);
      const apiBase = (import.meta as any).env?.VITE_API_BASE || 'https://chess-events.fly.dev';
      const cleanApiBase = apiBase.trim();
      const requestUrl = `${cleanApiBase}/api/games/${userId}`;
      console.log(`API Base: "${apiBase}"`);
      console.log(`Clean API Base: "${cleanApiBase}"`);
      console.log(`Запрос отправлен по адресу: ${requestUrl}`);
      
      const response = await fetch(requestUrl);
      console.log(`Получен ответ:`, {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Ошибка при загрузке партий для игрока: ${userId}`, {
          requestUrl: requestUrl,
          status: response.status,
          statusText: response.statusText,
          errorText: errorText
        });
        throw new Error(`Ошибка при загрузке партий: ${response.status} ${response.statusText}\nURL: ${requestUrl}\nОтвет: ${errorText}`);
      }

      const data = await response.json();
      console.log('Получены данные партий:', data);
      setGames(data.games || []);
    } catch (err) {
      console.error('Error fetching games:', err);
      const errorMessage = err instanceof Error ? err.message : 'Произошла ошибка';
      const userId = telegram.user?.id ? String(telegram.user.id) : 'неизвестен';
      const apiBase = (import.meta as any).env?.VITE_API_BASE || 'https://chess-events.fly.dev';
      const cleanApiBase = apiBase.trim();
      const requestUrl = `${cleanApiBase}/api/games/${userId}`;
      setError(`Ошибка при загрузке партий для игрока: ${userId}\n\nURL запроса: ${requestUrl}\n\n${errorMessage}\n\nAPI Base: ${apiBase}`);
    } finally {
      setLoading(false);
    }
  };

  const getGameStatus = (game: Game) => {
    if (game.status === 'finished') {
      return game.winner ? `Победил: ${game.winner === 'white' ? 'Белые' : 'Черные'}` : 'Завершена';
    }
    
    const hasWhite = game.players.white;
    const hasBlack = game.players.black;
    
    if (!hasWhite || !hasBlack) {
      return 'Ожидает игроков';
    }
    
    return `Ход: ${game.current_turn === 'white' ? 'Белые' : 'Черные'}`;
  };

  const getPlayerColor = (game: Game) => {
    const userId = String(telegram.user?.id);
    if (game.players.white === userId) return 'white';
    if (game.players.black === userId) return 'black';
    return null;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Неизвестно';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!telegram.user?.id) {
    return (
      <div className="flex flex-col h-screen w-screen justify-center items-center bg-gray-100 p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка данных пользователя...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen w-screen justify-center items-center bg-gray-100 p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка партий...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen w-screen justify-center items-center bg-gray-100 p-4">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Ошибка</h2>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-left">
            <p className="text-red-800 font-semibold mb-2">Детали ошибки:</p>
            <pre className="text-sm text-red-700 whitespace-pre-wrap break-words">{error}</pre>
          </div>
          <div className="space-x-2">
            <button
              onClick={fetchMyGames}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            >
              Попробовать снова
            </button>
            <button
              onClick={onBackToMain}
              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
            >
              Назад
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 flex items-center justify-between">
        <button
          onClick={onBackToMain}
          className="text-blue-500 hover:text-blue-700 font-semibold"
        >
          ← Назад
        </button>
        <h1 className="text-xl font-bold text-gray-800">Мои партии</h1>
        <button
          onClick={fetchMyGames}
          className="text-blue-500 hover:text-blue-700 font-semibold"
        >
          Обновить
        </button>
      </div>

      {/* Games List */}
      <div className="flex-1 overflow-y-auto p-4">
        {games.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">♟️</div>
            <h2 className="text-xl font-bold text-gray-600 mb-2">Партий пока нет</h2>
            <p className="text-gray-500 mb-4">Создайте новую игру или присоединитесь к существующей</p>
            <button
              onClick={onBackToMain}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            >
              Создать игру
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {games.map((game) => {
              const playerColor = getPlayerColor(game);
              const isMyTurn = game.current_turn === playerColor && game.status === 'active';
              
              return (
                <div
                  key={game.id}
                  className={`bg-white rounded-lg shadow-md p-4 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                    isMyTurn ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                  }`}
                  onClick={() => onJoinGame(game.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm text-gray-500">#{game.id}</span>
                      {isMyTurn && (
                        <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                          Ваш ход
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(game.created_at)}
                    </div>
                  </div>
                  
                  <div className="mb-2">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-white border border-gray-300 rounded"></div>
                        <span className="text-sm">
                          {game.players.white ? 
                            (game.players.white === String(telegram.user?.id) ? 'Вы' : 
                             (game.player_names?.white || `Игрок ${game.players.white}`)) 
                            : 'Ожидает игрока'}
                        </span>
                      </div>
                      <div className="text-gray-400">vs</div>
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-gray-800 border border-gray-300 rounded"></div>
                        <span className="text-sm">
                          {game.players.black ? 
                            (game.players.black === String(telegram.user?.id) ? 'Вы' : 
                             (game.player_names?.black || `Игрок ${game.players.black}`)) 
                            : 'Ожидает игрока'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      {getGameStatus(game)}
                    </div>
                    {playerColor && (
                      <div className="text-sm text-gray-500">
                        Вы играете: {playerColor === 'white' ? 'Белые' : 'Черные'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyGames;
