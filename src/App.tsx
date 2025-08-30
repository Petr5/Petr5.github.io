// ... existing code ...
import React, { useEffect, useCallback, useState } from 'react';
import { useTelegram } from './telegram/useTelegram';
import './index.css';
import ChessLobby from './ChessLobby'; // Убедимся, что ChessLobby импортирован

const App: React.FC = () => {
    // Деструктурируем все необходимые свойства из useTelegram
    const {
        init,
        showAlert,
        expand,
        isTelegramApp,
        showMainButton,
        close,
        startParam,
        backgroundColor,
        textColor,
        showBackButton,
        openTelegramLink,
        user // Добавлен user для получения данных профиля
    } = useTelegram();

    const [roomId, setRoomId] = useState<string | null>(null);

    useEffect(() => {
        init();
        expand(); // Expand the app to full screen on load
    }, [init, expand]);

    // Обработка настройки UI, специфичного для приложения Telegram
    useEffect(() => {
        if (isTelegramApp) {
            // Устанавливаем цвета в соответствии с темой Telegram
            if (backgroundColor) {
                document.body.style.backgroundColor = backgroundColor;
            }
            if (textColor) {
                document.body.style.color = textColor;
            }

            // Показываем главную кнопку для новой игры
            showMainButton('Начать новую игру', () => {
                const newRoomId = typeof crypto !== 'undefined'
                    ? crypto.randomUUID().slice(0, 8)
                    : Math.random().toString(36).slice(2, 10);
                setRoomId(newRoomId); // Устанавливаем новый roomId для начала новой игры
            });

            // Показываем кнопку "Назад"
            showBackButton(() => {
                close();
            });
        }
    }, [isTelegramApp, backgroundColor, textColor, showMainButton, close, showBackButton, setRoomId, roomId]);

    // Проверяем наличие roomId в URL или startParam
    useEffect(() => {
        const urlRoom = new URLSearchParams(window.location.search).get('room');
        if (urlRoom) {
            setRoomId(urlRoom);
        } else if (startParam) {
            setRoomId(startParam);
        }
    }, [startParam]);

    // Утилитарная функция для генерации deeplink
    const generateDeepLink = useCallback((id: string) => {
        const botUsername = (import.meta as any).env?.VITE_TG_BOT_USERNAME || '';
        return botUsername
            ? `https://t.me/${botUsername}?startapp=${id}`
            : `${window.location.origin}?room=${id}`;
    }, []);

    const handleInviteFriend = useCallback(() => {
        const newRoomId = typeof crypto !== 'undefined'
            ? crypto.randomUUID().slice(0, 8)
            : Math.random().toString(36).slice(2, 10);

        const deepLink = generateDeepLink(newRoomId);
        const shareText = "Присоединяйся ко мне в шахматы!";

        // Формируем URL для нативной кнопки "Поделиться" Telegram
        const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(shareText)}`;

        // Открываем ссылку в новом окне, чтобы инициировать шаринг через Telegram
        openTelegramLink(telegramShareUrl);

        // Важно: теперь мы устанавливаем roomId для приглашающего пользователя, чтобы он сам начал игру
        setRoomId(newRoomId);
    }, [generateDeepLink, setRoomId, openTelegramLink]);


    const handleMyGames = () => {
        showAlert('Мои партии - функционал пока не реализован!');
    };

    if (roomId) {
        return <ChessLobby roomId={roomId} onBackToMain={() => setRoomId(null)} />;
    }

    return (
        <div className="flex flex-col h-screen w-screen justify-between items-center bg-gray-100 p-4 relative">
            {user && ( // Отображаем иконку профиля, только если данные пользователя доступны
                <div className="absolute top-4 right-4 flex items-center bg-gray-200 p-2 rounded-lg shadow-md">
                    {user.photo_url && (
                        <img
                            src={user.photo_url}
                            alt="Profile"
                            className="w-8 h-8 rounded-full mr-2"
                        />
                    )}
                    <span className="text-gray-800 font-semibold text-sm">
                        {user.username || user.first_name}
                    </span>
                </div>
            )}

            <h1 className="text-2xl font-bold text-center text-gray-800 mb-4 mt-20">Добро пожаловать шахматы в Телеграмм</h1> {/* Увеличен mt-20 для отступа от иконки */}

            {/* Контейнер для кнопок: занимает всю доступную высоту и распределяет кнопки равномерно */}
            <div className="flex flex-col w-full flex-grow justify-between items-center">
                <button
                    onClick={handleInviteFriend}
                    className="w-full flex-grow py-4 bg-slate-800 hover:bg-slate-900 bg-opacity-40 text-white font-bold shadow-none text-lg"
                >
                    Пригласить друга
                </button>
                {/* Разделительная полоска между кнопками */}
                <div className="w-full h-px bg-gray-600 my-1"></div>
                <button
                    onClick={handleMyGames}
                    className="w-full flex-grow py-4 bg-slate-800 hover:bg-slate-900 bg-opacity-40 text-white font-bold shadow-none text-lg"
                >
                    Мои партии
                </button>
            </div>
            {/* Кнопка "Поделиться ссылкой" удалена */}
        </div>
    );
};

export default App;