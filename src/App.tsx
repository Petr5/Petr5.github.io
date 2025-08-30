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
        openTelegramLink
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
    }, [isTelegramApp, backgroundColor, textColor, showMainButton, close, showBackButton]);

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
        // if (isTelegramApp) {
        //     openTelegramLink(`https://google.com`);
        // } else {
        //     window.open(telegramShareUrl, '_blank');
        // }

        // Важно: теперь мы устанавливаем roomId для приглашающего пользователя, чтобы он сам начал игру
        setRoomId(newRoomId);
    }, [showAlert, generateDeepLink]);

    const handleMyGames = () => {
        showAlert('Мои партии - функционал пока не реализован!');
    };

    if (roomId) {
        return <ChessLobby roomId={roomId} />;
    }

    return (
        <div className="flex flex-col h-screen w-screen justify-between items-center bg-gray-100 p-4">
            <h1 className="text-2xl font-bold text-center text-gray-800 mb-4">Добро пожаловать шахматы в Телеграмм</h1>

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
            {/* Кнопка "Поделиться ссылкой" удалена */}
        </div>
    );
};

export default App;