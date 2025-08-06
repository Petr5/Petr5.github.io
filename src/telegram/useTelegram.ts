import { useState, useEffect, useCallback } from 'react';
import TelegramApi, { TelegramUser, TelegramThemeParams } from './telegramApi';

export interface UseTelegramReturn {
  // Состояние
  isInitialized: boolean;
  isTelegramApp: boolean;
  user: TelegramUser | null;
  themeParams: TelegramThemeParams;
  backgroundColor: string;
  textColor: string;
  version: string;
  platform: string;

  // Методы
  init: () => void;
  showMainButton: (text: string, callback?: () => void) => void;
  hideMainButton: () => void;
  showPopup: (title: string, message: string, buttons?: Array<{
    id?: string;
    type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
    text: string;
  }>) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  close: () => void;
  expand: () => void;
  setBackgroundColor: (color: string) => void;
  setTextColor: (color: string) => void;
  setHeaderColor: (color: string) => void;
  setBackButtonColor: (color: string) => void;
  showBackButton: (callback?: () => void) => void;
  hideBackButton: () => void;
  onThemeChanged: (callback: () => void) => void;
  onViewportChanged: (callback: () => void) => void;
  onMainButtonClicked: (callback: () => void) => void;
  onBackButtonClicked: (callback: () => void) => void;
}

export const useTelegram = (): UseTelegramReturn => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [themeParams, setThemeParams] = useState<TelegramThemeParams>({});
  const [backgroundColor, setBackgroundColorState] = useState('#ffffff');
  const [textColor, setTextColorState] = useState('#000000');
  const [version, setVersion] = useState('');
  const [platform, setPlatform] = useState('');
  const [isTelegramApp, setIsTelegramApp] = useState(false);

  const telegramApi = TelegramApi.getInstance();

  // Инициализация
  const init = useCallback(() => {
    try {
      telegramApi.init();
      setIsInitialized(true);
      
      // Получаем данные пользователя
      const userData = telegramApi.getUser();
      setUser(userData);
      
      // Получаем параметры темы
      const theme = telegramApi.getThemeParams();
      setThemeParams(theme);
      
      // Получаем цвета
      const bgColor = telegramApi.getBackgroundColor();
      const txtColor = telegramApi.getTextColor();
      setBackgroundColorState(bgColor);
      setTextColorState(txtColor);
      
      // Получаем версию и платформу
      setVersion(telegramApi.getVersion());
      setPlatform(telegramApi.getPlatform());
      
      // Проверяем, запущено ли в Telegram
      setIsTelegramApp(telegramApi.isTelegramApp());
      
      // Устанавливаем обработчики событий
      telegramApi.onThemeChanged(() => {
        const newTheme = telegramApi.getThemeParams();
        const newBgColor = telegramApi.getBackgroundColor();
        const newTextColor = telegramApi.getTextColor();
        
        setThemeParams(newTheme);
        setBackgroundColorState(newBgColor);
        setTextColorState(newTextColor);
      });
      
      telegramApi.onViewportChanged(() => {
        // Можно добавить логику для обработки изменения размера окна
        console.log('Viewport changed');
      });
      
    } catch (error) {
      console.error('Ошибка инициализации Telegram:', error);
    }
  }, [telegramApi]);

  // Автоматическая инициализация при монтировании компонента
  useEffect(() => {
    init();
  }, [init]);

  // Методы для работы с главной кнопкой
  const showMainButton = useCallback((text: string, callback?: () => void) => {
    telegramApi.showMainButton(text, callback);
  }, [telegramApi]);

  const hideMainButton = useCallback(() => {
    telegramApi.hideMainButton();
  }, [telegramApi]);

  // Методы для показа диалогов
  const showPopup = useCallback((title: string, message: string, buttons?: Array<{
    id?: string;
    type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
    text: string;
  }>) => {
    telegramApi.showPopup(title, message, buttons);
  }, [telegramApi]);

  const showAlert = useCallback((message: string, callback?: () => void) => {
    telegramApi.showAlert(message, callback);
  }, [telegramApi]);

  const showConfirm = useCallback((message: string, callback?: (confirmed: boolean) => void) => {
    telegramApi.showConfirm(message, callback);
  }, [telegramApi]);

  // Методы управления приложением
  const close = useCallback(() => {
    telegramApi.close();
  }, [telegramApi]);

  const expand = useCallback(() => {
    telegramApi.expand();
  }, [telegramApi]);

  // Методы для установки цветов
  const setBackgroundColor = useCallback((color: string) => {
    telegramApi.setBackgroundColor(color);
    setBackgroundColorState(color);
  }, [telegramApi]);

  const setTextColor = useCallback((color: string) => {
    telegramApi.setTextColor(color);
    setTextColorState(color);
  }, [telegramApi]);

  const setHeaderColor = useCallback((color: string) => {
    telegramApi.setHeaderColor(color);
  }, [telegramApi]);

  const setBackButtonColor = useCallback((color: string) => {
    telegramApi.setBackButtonColor(color);
  }, [telegramApi]);

  // Методы для работы с кнопкой "Назад"
  const showBackButton = useCallback((callback?: () => void) => {
    telegramApi.showBackButton(callback);
  }, [telegramApi]);

  const hideBackButton = useCallback(() => {
    telegramApi.hideBackButton();
  }, [telegramApi]);

  // Методы для установки обработчиков событий
  const onThemeChanged = useCallback((callback: () => void) => {
    telegramApi.onThemeChanged(callback);
  }, [telegramApi]);

  const onViewportChanged = useCallback((callback: () => void) => {
    telegramApi.onViewportChanged(callback);
  }, [telegramApi]);

  const onMainButtonClicked = useCallback((callback: () => void) => {
    telegramApi.onMainButtonClicked(callback);
  }, [telegramApi]);

  const onBackButtonClicked = useCallback((callback: () => void) => {
    telegramApi.onBackButtonClicked(callback);
  }, [telegramApi]);

  return {
    // Состояние
    isInitialized,
    isTelegramApp,
    user,
    themeParams,
    backgroundColor,
    textColor,
    version,
    platform,

    // Методы
    init,
    showMainButton,
    hideMainButton,
    showPopup,
    showAlert,
    showConfirm,
    close,
    expand,
    setBackgroundColor,
    setTextColor,
    setHeaderColor,
    setBackButtonColor,
    showBackButton,
    hideBackButton,
    onThemeChanged,
    onViewportChanged,
    onMainButtonClicked,
    onBackButtonClicked,
  };
}; 