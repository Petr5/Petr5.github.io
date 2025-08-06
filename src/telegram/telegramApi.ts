import WebApp from '@twa-dev/sdk';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

export interface TelegramInitData {
  query_id?: string;
  user?: TelegramUser;
  receiver?: TelegramUser;
  chat?: {
    id: number;
    type: string;
    title?: string;
    username?: string;
    photo_url?: string;
  };
  chat_type?: string;
  chat_instance?: string;
  start_param?: string;
  can_send_after?: number;
  auth_date?: number;
  hash?: string;
}

export class TelegramApi {
  private static instance: TelegramApi;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): TelegramApi {
    if (!TelegramApi.instance) {
      TelegramApi.instance = new TelegramApi();
    }
    return TelegramApi.instance;
  }

  /**
   * Инициализация Telegram Web App
   */
  public init(): void {
    if (this.isInitialized) {
      console.warn('Telegram Web App уже инициализирован');
      return;
    }

    try {
      WebApp.ready();
      this.isInitialized = true;
      console.log('Telegram Web App успешно инициализирован');
    } catch (error) {
      console.error('Ошибка инициализации Telegram Web App:', error);
    }
  }

  /**
   * Получить данные пользователя
   */
  public getUser(): TelegramUser | null {
    try {
      return WebApp.initDataUnsafe?.user || null;
    } catch (error) {
      console.error('Ошибка получения данных пользователя:', error);
      return null;
    }
  }

  /**
   * Получить параметры темы
   */
  public getThemeParams(): TelegramThemeParams {
    try {
      return WebApp.themeParams;
    } catch (error) {
      console.error('Ошибка получения параметров темы:', error);
      return {};
    }
  }

  /**
   * Получить цвет фона
   */
  public getBackgroundColor(): string {
    try {
      return WebApp.backgroundColor;
    } catch (error) {
      console.error('Ошибка получения цвета фона:', error);
      return '#ffffff';
    }
  }

  /**
   * Получить цвет текста
   */
  public getTextColor(): string {
    try {
      return WebApp.themeParams?.text_color || '#000000';
    } catch (error) {
      console.error('Ошибка получения цвета текста:', error);
      return '#000000';
    }
  }

  /**
   * Установить цвет фона
   */
  public setBackgroundColor(color: string): void {
    try {
      WebApp.setBackgroundColor(color as any);
    } catch (error) {
      console.error('Ошибка установки цвета фона:', error);
    }
  }

  /**
   * Установить цвет текста
   */
  public setTextColor(_color: string): void {
    try {
      // setTextColor не существует в текущей версии SDK
      console.warn('setTextColor не поддерживается в текущей версии SDK');
    } catch (error) {
      console.error('Ошибка установки цвета текста:', error);
    }
  }

  /**
   * Показать главную кнопку
   */
  public showMainButton(text: string, callback?: () => void): void {
    try {
      WebApp.MainButton.setText(text);
      if (callback) {
        WebApp.MainButton.onClick(callback);
      }
      WebApp.MainButton.show();
    } catch (error) {
      console.error('Ошибка показа главной кнопки:', error);
    }
  }

  /**
   * Скрыть главную кнопку
   */
  public hideMainButton(): void {
    try {
      WebApp.MainButton.hide();
    } catch (error) {
      console.error('Ошибка скрытия главной кнопки:', error);
    }
  }

  /**
   * Показать всплывающее окно
   */
  public showPopup(title: string, message: string, _buttons?: Array<{
    id?: string;
    type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
    text: string;
  }>): void {
    try {
      // showPopup с тремя параметрами не поддерживается
      WebApp.showPopup({ title, message });
    } catch (error) {
      console.error('Ошибка показа всплывающего окна:', error);
    }
  }

  /**
   * Показать алерт
   */
  public showAlert(message: string, callback?: () => void): void {
    try {
      WebApp.showAlert(message, callback);
    } catch (error) {
      console.error('Ошибка показа алерта:', error);
    }
  }

  /**
   * Показать подтверждение
   */
  public showConfirm(message: string, callback?: (confirmed: boolean) => void): void {
    try {
      WebApp.showConfirm(message, callback);
    } catch (error) {
      console.error('Ошибка показа подтверждения:', error);
    }
  }

  /**
   * Закрыть приложение
   */
  public close(): void {
    try {
      WebApp.close();
    } catch (error) {
      console.error('Ошибка закрытия приложения:', error);
    }
  }

  /**
   * Расширить приложение
   */
  public expand(): void {
    try {
      WebApp.expand();
    } catch (error) {
      console.error('Ошибка расширения приложения:', error);
    }
  }

  /**
   * Проверить, запущено ли приложение в Telegram
   */
  public isTelegramApp(): boolean {
    try {
      return WebApp.isVersionAtLeast('6.0');
    } catch (error) {
      console.error('Ошибка проверки Telegram App:', error);
      return false;
    }
  }

  /**
   * Получить версию Telegram
   */
  public getVersion(): string {
    try {
      return WebApp.version;
    } catch (error) {
      console.error('Ошибка получения версии:', error);
      return '';
    }
  }

  /**
   * Получить платформу
   */
  public getPlatform(): string {
    try {
      return WebApp.platform;
    } catch (error) {
      console.error('Ошибка получения платформы:', error);
      return '';
    }
  }

  /**
   * Получить данные инициализации
   */
  public getInitData(): string {
    try {
      return WebApp.initData;
    } catch (error) {
      console.error('Ошибка получения данных инициализации:', error);
      return '';
    }
  }

  /**
   * Получить небезопасные данные инициализации
   */
  public getInitDataUnsafe(): TelegramInitData {
    try {
      return WebApp.initDataUnsafe;
    } catch (error) {
      console.error('Ошибка получения небезопасных данных инициализации:', error);
      return {};
    }
  }

  /**
   * Установить заголовок
   */
  public setHeaderColor(color: string): void {
    try {
      WebApp.setHeaderColor(color as any);
    } catch (error) {
      console.error('Ошибка установки цвета заголовка:', error);
    }
  }

  /**
   * Установить цвет кнопки "Назад"
   */
  public setBackButtonColor(_color: string): void {
    try {
      // setBackButtonColor не существует в текущей версии SDK
      console.warn('setBackButtonColor не поддерживается в текущей версии SDK');
    } catch (error) {
      console.error('Ошибка установки цвета кнопки "Назад":', error);
    }
  }

  /**
   * Показать кнопку "Назад"
   */
  public showBackButton(callback?: () => void): void {
    try {
      if (callback) {
        WebApp.BackButton.onClick(callback);
      }
      WebApp.BackButton.show();
    } catch (error) {
      console.error('Ошибка показа кнопки "Назад":', error);
    }
  }

  /**
   * Скрыть кнопку "Назад"
   */
  public hideBackButton(): void {
    try {
      WebApp.BackButton.hide();
    } catch (error) {
      console.error('Ошибка скрытия кнопки "Назад":', error);
    }
  }

  /**
   * Установить обработчик события изменения темы
   */
  public onThemeChanged(callback: () => void): void {
    try {
      WebApp.onEvent('themeChanged', callback);
    } catch (error) {
      console.error('Ошибка установки обработчика изменения темы:', error);
    }
  }

  /**
   * Установить обработчик события изменения размера окна
   */
  public onViewportChanged(callback: () => void): void {
    try {
      WebApp.onEvent('viewportChanged', callback);
    } catch (error) {
      console.error('Ошибка установки обработчика изменения размера окна:', error);
    }
  }

  /**
   * Установить обработчик события изменения размера окна
   */
  public onMainButtonClicked(callback: () => void): void {
    try {
      WebApp.MainButton.onClick(callback);
    } catch (error) {
      console.error('Ошибка установки обработчика клика главной кнопки:', error);
    }
  }

  /**
   * Установить обработчик события клика кнопки "Назад"
   */
  public onBackButtonClicked(callback: () => void): void {
    try {
      WebApp.BackButton.onClick(callback);
    } catch (error) {
      console.error('Ошибка установки обработчика клика кнопки "Назад":', error);
    }
  }
}

export default TelegramApi; 