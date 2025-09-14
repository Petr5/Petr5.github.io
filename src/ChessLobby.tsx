import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import './index.css';
import { useTelegram } from './telegram';
import { LobbyClient, MovePayload, PlayerColor } from './net';

interface ChessPiece {
  piece: string | null;
  color: 'black' | 'white' | null;
  hasMoved?: boolean;
}


// Определяем initialBoard до его использования
const initialBoard: ChessPiece[][] = [
  [
    { piece: "rook", color: 'black', hasMoved: false },
    { piece: "knight", color: 'black' },
    { piece: "bishop", color: 'black' },
    { piece: "queen", color: 'black' },
    { piece: "king", color: 'black', hasMoved: false },
    { piece: "bishop", color: 'black' },
    { piece: "knight", color: 'black' },
    { piece: "rook", color: 'black', hasMoved: false }
  ],
  Array(8).fill({ piece: "pawn", color: 'black' }),
  Array(8).fill({ piece: null, color: null }),
  Array(8).fill({ piece: null, color: null }),
  Array(8).fill({ piece: null, color: null }),
  Array(8).fill({ piece: null, color: null }),
  Array(8).fill({ piece: "pawn", color: 'white' }),
  [
    { piece: "rook", color: 'white', hasMoved: false },
    { piece: "knight", color: 'white' },
    { piece: "bishop", color: 'white' },
    { piece: "queen", color: 'white' },
    { piece: "king", color: 'white', hasMoved: false },
    { piece: "bishop", color: 'white' },
    { piece: "knight", color: 'white' },
    { piece: "rook", color: 'white', hasMoved: false }
  ]
];

// Добавляем функцию isPathClear
function isPathClear(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  board: ChessPiece[][]
): boolean {
  const rowStep = Math.sign(toRow - fromRow);
  const colStep = Math.sign(toCol - fromCol);
  let currentRow = fromRow + rowStep;
  let currentCol = fromCol + colStep;

  while (currentRow !== toRow || currentCol !== toCol) {
    if (board[currentRow][currentCol].piece) return false;
    currentRow += rowStep;
    currentCol += colStep;
  }

  return true;
}

// Добавляем функцию для проверки, не открывает ли ход шах своему королю
function moveExposesKingToCheck(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  color: "white" | "black",
  board: ChessPiece[][]
): boolean {
  // Создаем временную копию доски с выполненным ходом
  const tempBoard = board.map(row => [...row]);
  tempBoard[toRow][toCol] = tempBoard[fromRow][fromCol];
  tempBoard[fromRow][fromCol] = { piece: null, color: null };

  // Находим позицию своего короля
  const kingPos = getKingPosition(color, tempBoard);
  if (!kingPos) return true; // Если король не найден, считаем ход невалидным

  // Проверяем, не находится ли король под шахом после хода
  return isSquareUnderAttack(kingPos.row, kingPos.col, color, tempBoard);
}

// Обновляем функцию isValidMove
function isValidMove(
  piece: string,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  color: "white" | "black",
  board: ChessPiece[][]
): boolean {
  // Базовые проверки
  if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;
  
  const deltaRow = toRow - fromRow;
  const deltaCol = toCol - fromCol;
  const absRow = Math.abs(deltaRow);
  const absCol = Math.abs(deltaCol);
  
  const targetCell = board[toRow][toCol];
  
  // Нельзя бить свою фигуру
  if (targetCell.color === color) return false;

  // Базовая проверка хода для каждой фигуры
  let basicMoveValid = false;

  switch (piece) {
    case "pawn": {
      const direction = color === "white" ? -1 : 1;
      const startRow = color === "white" ? 6 : 1;

      // Движение вперёд на 1
      if (deltaCol === 0 && deltaRow === direction && !targetCell.piece) {
        basicMoveValid = true;
      }
      // Первый ход на 2
      else if (
        deltaCol === 0 &&
        fromRow === startRow &&
        deltaRow === direction * 2 &&
        !board[fromRow + direction][fromCol].piece &&
        !targetCell.piece
      ) {
        basicMoveValid = true;
      }
      // Атака по диагонали
      else if (
        absCol === 1 &&
        deltaRow === direction &&
        targetCell.piece &&
        targetCell.color !== color
      ) {
        basicMoveValid = true;
      }
      break;
    }

    case "rook":
      if ((fromRow === toRow || fromCol === toCol) && 
          isPathClear(fromRow, fromCol, toRow, toCol, board)) {
        basicMoveValid = true;
      }
      break;

    case "bishop":
      if (absRow === absCol && 
          isPathClear(fromRow, fromCol, toRow, toCol, board)) {
        basicMoveValid = true;
      }
      break;

    case "queen":
      if ((fromRow === toRow || fromCol === toCol || absRow === absCol) && 
          isPathClear(fromRow, fromCol, toRow, toCol, board)) {
        basicMoveValid = true;
      }
      break;

    case "knight":
      if ((absRow === 2 && absCol === 1) || (absRow === 1 && absCol === 2)) {
        basicMoveValid = true;
      }
      break;

    case "king": {
      // Проверка на рокировку
      if (absRow === 0 && absCol === 2 && !board[fromRow][fromCol].hasMoved) {
        const isKingSide = toCol > fromCol;
        const rookCol = isKingSide ? 7 : 0;
        if (canCastle(fromRow, fromCol, rookCol, color, board)) {
          basicMoveValid = true;
        }
      }
      // Обычный ход короля
      else if (absRow <= 1 && absCol <= 1) {
        basicMoveValid = true;
      }
      break;
    }
  }

  if (!basicMoveValid) return false;

  // Проверяем, не открывает ли ход шах своему королю
  if (moveExposesKingToCheck(fromRow, fromCol, toRow, toCol, color, board)) {
    return false;
  }

  return true;
}

// Добавляем функцию для проверки возможности рокировки
function canCastle(
  kingRow: number,
  kingCol: number,
  rookCol: number,
  color: "white" | "black",
  board: ChessPiece[][]
): boolean {
  const king = board[kingRow][kingCol];
  const rook = board[kingRow][rookCol];

  // Проверяем, что король и ладья не двигались
  if (!king || !rook || king.hasMoved || rook.hasMoved) {
    return false;
  }

  // Проверяем, что путь между королем и ладьей свободен
  const start = Math.min(kingCol, rookCol) + 1;
  const end = Math.max(kingCol, rookCol);
  for (let col = start; col < end; col++) {
    if (board[kingRow][col].piece) {
      return false;
    }
  }

  // Проверяем, не находится ли король под шахом
  if (isSquareUnderAttack(kingRow, kingCol, color, board)) {
    return false;
  }

  // Проверяем, не проходит ли король через атакованные поля
  const direction = rookCol < kingCol ? -1 : 1;
  for (let col = kingCol + direction; col !== rookCol; col += direction) {
    if (isSquareUnderAttack(kingRow, col, color, board)) {
      return false;
    }
  }

  return true;
}

// Добавляем функцию для проверки, находится ли клетка под атакой
function isSquareUnderAttack(
  row: number,
  col: number,
  defendingColor: "white" | "black",
  board: ChessPiece[][]
): boolean {
  const attackingColor = defendingColor === "white" ? "black" : "white";
  
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const attackingPiece = board[i][j];
      if (attackingPiece.piece && attackingPiece.color === attackingColor) {
        if (isValidMove(attackingPiece.piece, i, j, row, col, attackingColor, board)) {
          return true;
        }
      }
    }
  }
  return false;
}

// Добавляем функцию для получения позиции короля
function getKingPosition(color: "white" | "black", board: ChessPiece[][]): { row: number; col: number } | null {
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      if (board[i][j].piece === "king" && board[i][j].color === color) {
        return { row: i, col: j };
      }
    }
  }
  return null;
}

// Добавляем функцию для получения атакующих фигур
function getCheckingPieces(kingColor: "white" | "black", board: ChessPiece[][]): Array<{
  piece: string;
  color: "white" | "black";
  row: number;
  col: number;
}> {
  const kingPos = getKingPosition(kingColor, board);
  if (!kingPos) return [];

  const attackingPieces = [];
  const oppositeColor = kingColor === "white" ? "black" : "white";

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const piece = board[i][j];
      if (piece.piece && piece.color === oppositeColor) {
        if (isValidMove(piece.piece, i, j, kingPos.row, kingPos.col, oppositeColor, board)) {
          attackingPieces.push({
            piece: piece.piece,
            color: piece.color,
            row: i,
            col: j
          });
        }
      }
    }
  }
  return attackingPieces;
}

// Добавляем функцию для проверки, может ли ход блокировать шах
function canBlockCheck(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  attackingPiece: { row: number; col: number },
  kingPos: { row: number; col: number },
  board: ChessPiece[][]
): boolean {
  // Создаем временную копию доски для проверки
  const tempBoard = board.map(row => [...row]);
  
  // Делаем ход на временной доске
  tempBoard[toRow][toCol] = tempBoard[fromRow][fromCol];
  tempBoard[fromRow][fromCol] = { piece: null, color: null };

  // Проверяем, остается ли король под шахом после этого хода
  return !isValidMove(
    board[attackingPiece.row][attackingPiece.col].piece!,
    attackingPiece.row,
    attackingPiece.col,
    kingPos.row,
    kingPos.col,
    board[attackingPiece.row][attackingPiece.col].color!,
    tempBoard
  );
}
interface ChessLobbyProps {
  roomId: string;
  onBackToMain: () => void; 
}


const ChessLobby: React.FC<ChessLobbyProps> = ({ roomId, onBackToMain }) => {
  const [board, setBoard] = useState<ChessPiece[][]>(initialBoard);
  const [selectedPiece, setSelectedPiece] = useState<{
    row: number;
    col: number;
    element: HTMLElement | null;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [currentTurn, setCurrentTurn] = useState<'white' | 'black'>('white');
  const [possibleMoves, setPossibleMoves] = useState<{row: number; col: number; type: 'move' | 'attack'}[]>([]);
  const [winner, setWinner] = useState<'white' | 'black' | null>(null);
  const [promotion, setPromotion] = useState<{
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
    color: 'white' | 'black';
  } | null>(null);

  // Сетевое взаимодействие
  // const [roomId, setRoomId] = useState<string>('');
  const [selfColor, setSelfColor] = useState<PlayerColor>('white');
  const lobbyRef = useRef<LobbyClient | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string>('');
  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const applyRemoteMoveRef = useRef<((payload: MovePayload) => void) | null>(null);

  // Инициализация Telegram API
  const telegram = useTelegram();

  // Настройка Telegram приложения
  useEffect(() => {
    if (telegram.isInitialized && telegram.isTelegramApp) {
      // Устанавливаем цвета в соответствии с темой Telegram
      telegram.setBackgroundColor(telegram.backgroundColor);
      telegram.setTextColor(telegram.textColor);

      telegram.expand();
      
      // Показываем главную кнопку для новой игры
      telegram.showMainButton('Новая игра', () => {
        window.location.reload();
      });
      
      // Показываем кнопку "Назад"
      telegram.showBackButton(() => {
        onBackToMain();
      });
      
      console.log('Telegram Web App настроен');
    }

    return () => {
      if (telegram.isTelegramApp) {
        telegram.hideBackButton(); // Скрываем кнопку "Назад" и удаляем ее обработчик
      }
    };
  }, [telegram, onBackToMain]);

  // Инициализация лобби/комнаты
  useEffect(() => {
    if (!telegram.isInitialized || !roomId) return; 

    // const urlRoom = new URLSearchParams(window.location.search).get('room') || undefined;
    // const startParam = telegram.startParam || urlRoom;
    // const createdRoomId = startParam && startParam.length > 0
    //   ? startParam
    //   : (typeof crypto !== 'undefined' ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));
    // setRoomId(createdRoomId);

    const meId = String(telegram.user?.id ?? (typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2)));
    const meName = telegram.user?.username || telegram.user?.first_name || 'Player';

    // Если мы зашли по приглашению (есть start_param) — будем играть чёрными, иначе белыми
    const color: PlayerColor = telegram.startParam === roomId ? 'black' : 'white';
    setSelfColor(color);

    // Создаём клиент лобби (пока транспорт локальный; заменим на WS позже)
    if (lobbyRef.current) {
      lobbyRef.current.dispose();
    }
    lobbyRef.current = new LobbyClient({
      roomId: roomId,
      self: { userId: meId, displayName: meName },
      selfColor: color,
      events: {
        onMove: (_opponent, payload) => {
          // Применяем ход соперника через ref, чтобы не терять актуальное состояние
          applyRemoteMoveRef.current && applyRemoteMoveRef.current(payload);
        },
      },
    });

    // Подготовим ссылку-приглашение в бота
    const botUsername = (import.meta as any).env?.VITE_TG_BOT_USERNAME || '';
    const deepLink = botUsername
      ? `https://t.me/${botUsername}?startapp=${roomId}`
      : `${window.location.origin}?room=${roomId}`;
    setInviteUrl(deepLink);

    return () => {
      lobbyRef.current?.dispose();
      lobbyRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telegram.isInitialized, roomId, telegram.startParam]);

  // Функция для обработки победы
  const handleWin = useCallback((winner: 'white' | 'black') => {
    setWinner(winner);
    
    // Отправляем событие о завершении игры
    if (lobbyRef.current) {
      lobbyRef.current.sendMessage({
        type: 'game_end',
        roomId: roomId,
        senderId: String(telegram.user?.id),
        payload: { winner }
      });
    }
    
    // Показываем уведомление в Telegram
    if (telegram.isTelegramApp) {
      telegram.showAlert(
        `${winner === 'white' ? 'Белые' : 'Черные'} победили! Мат!`,
        () => {
          telegram.hideMainButton();
        }
      );
    }
  }, [telegram, roomId]);

  // Добавляем функцию проверки на мат
  const isCheckmate = useCallback((color: 'white' | 'black'): boolean => {
    const kingPos = getKingPosition(color, board);
    if (!kingPos) return false;

    // Проверяем, находится ли король под шахом
    const checkingPieces = getCheckingPieces(color, board);
    if (checkingPieces.length === 0) return false; // Нет шаха - нет мата

    // Проверяем все возможные ходы всех фигур
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece.piece && piece.color === color) {
          // Для каждой фигуры проверяем все возможные ходы
          for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
              if (isValidMove(piece.piece, row, col, i, j, color, board)) {
                // Пробуем сделать ход и проверяем, спасает ли он от шаха
                const tempBoard = board.map(row => [...row]);
                tempBoard[i][j] = tempBoard[row][col];
                tempBoard[row][col] = { piece: null, color: null };

                const kingPosAfterMove = piece.piece === 'king' 
                  ? { row: i, col: j }
                  : kingPos;

                // Проверяем, остается ли король под шахом после этого хода
                if (!isSquareUnderAttack(kingPosAfterMove.row, kingPosAfterMove.col, color, tempBoard)) {
                  return false; // Нашелся ход, спасающий от шаха
                }
              }
            }
          }
        }
      }
    }

    return true; // Не нашлось ходов, спасающих от шаха
  }, [board]);

  const showPossibleMoves = useCallback((row: number, col: number, piece: string, color: 'white' | 'black') => {
    const moves: {row: number; col: number; type: 'move' | 'attack'}[] = [];
    const kingPos = getKingPosition(color, board);
    if (!kingPos) return;

    // Получаем позицию вражеского короля для проверки
    const enemyKingPos = getKingPosition(color === 'white' ? 'black' : 'white', board);
    if (!enemyKingPos) return;

    // Проверяем, находится ли король под шахом
    const checkingPieces = getCheckingPieces(color, board);
    const isInCheck = checkingPieces.length > 0;

    // Если шах и это не король
    if (isInCheck && piece !== 'king') {
      // При двойном шахе может ходить только король
      if (checkingPieces.length > 1) {
        setPossibleMoves([]);
        return;
      }

      // При одиночном шахе можно:
      // 1. Взять атакующую фигуру
      // 2. Блокировать линию атаки
      const attackingPiece = checkingPieces[0];

      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          // Пропускаем текущую позицию фигуры
          if (i === row && j === col) continue;

          // Проверяем базовую возможность хода
          if (isValidMove(piece, row, col, i, j, color, board)) {
            // Проверяем, является ли это взятием атакующей фигуры
            if (i === attackingPiece.row && j === attackingPiece.col) {
              moves.push({ row: i, col: j, type: 'attack' });
            }
            // Или проверяем, может ли этот ход блокировать шах
            else if (canBlockCheck(row, col, i, j, attackingPiece, kingPos, board)) {
              const targetCell = board[i][j];
              if (targetCell.piece && targetCell.color !== color) {
                moves.push({ row: i, col: j, type: 'attack' });
              } else if (!targetCell.piece) {
                moves.push({ row: i, col: j, type: 'move' });
              }
            }
          }
        }
      }
    }
    // Если это ход королем или нет шаха
    else {
      // Проверяем каждую клетку на доске
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          // Пропускаем текущую позицию фигуры
          if (i === row && j === col) continue;

          // Если это король, проверяем, не находится ли клетка рядом с вражеским королем
          if (piece === 'king') {
            const deltaRow = Math.abs(i - enemyKingPos.row);
            const deltaCol = Math.abs(j - enemyKingPos.col);
            if (deltaRow <= 1 && deltaCol <= 1) continue;
          }

          // Проверяем, является ли ход допустимым
          if (isValidMove(piece, row, col, i, j, color, board)) {
            const targetCell = board[i][j];
            if (targetCell.piece && targetCell.color !== color) {
              moves.push({ row: i, col: j, type: 'attack' });
            } else if (!targetCell.piece) {
              moves.push({ row: i, col: j, type: 'move' });
            }
          }
        }
      }
    }

    setPossibleMoves(moves);
  }, [board]);

  const clearPossibleMoves = useCallback(() => {
    setPossibleMoves([]);
  }, []);

  const handlePromote = useCallback((newPiece: 'queen' | 'rook' | 'bishop' | 'knight') => {
    if (!promotion) return;
    const { fromRow, fromCol, toRow, toCol, color } = promotion;

    const promotedBoard = board.map(r => [...r]);
    promotedBoard[toRow][toCol] = { piece: newPiece, color };
    setBoard(promotedBoard);

    const nextTurn = color === 'white' ? 'black' : 'white';
    setCurrentTurn(nextTurn);
    if (isCheckmate(nextTurn)) {
      handleWin(color);
    }

    // Отправляем информацию о превращении с корректными координатами хода
    lobbyRef.current?.sendMove({
      fromRow,
      fromCol,
      toRow,
      toCol,
      promotion: newPiece,
    });

    setPromotion(null);
  }, [promotion, board, isCheckmate, handleWin]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLImageElement>, row: number, col: number) => {
    if (promotion) return; // Блокируем действия во время выбора превращения
    const piece = board[row][col];
    if (!piece.piece || piece.color !== currentTurn || piece.color !== selfColor) return;
    
    const element = e.currentTarget;
    const rect = element.getBoundingClientRect();
    
    // Вычисляем смещение клика от левого верхнего угла фигуры
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    // Показываем возможные ходы
    showPossibleMoves(row, col, piece.piece, piece.color);
    
    // Сохраняем начальную позицию, элемент и смещения
    setSelectedPiece({ row, col, element, offsetX, offsetY });

    // Добавляем стили для перетаскивания
    element.style.position = 'fixed';
    element.style.zIndex = '1000';
    element.style.pointerEvents = 'none';
    element.style.width = '50px';
    element.style.height = '50px';
    
    // Адаптируем размер для разных экранов
    if (window.innerWidth >= 1024) { // lg
      element.style.width = '80px';
      element.style.height = '80px';
    } else if (window.innerWidth >= 768) { // md
      element.style.width = '67px';
      element.style.height = '67px';
    }
    
    // Позиционируем фигуру, учитывая точку захвата
    element.style.left = `${e.clientX - offsetX}px`;
    element.style.top = `${e.clientY - offsetY}px`;
  }, [board, currentTurn, selfColor, showPossibleMoves]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!selectedPiece || !selectedPiece.element) return;

    clearPossibleMoves();

    const element = document.elementFromPoint(e.clientX, e.clientY);
    const cell = element?.closest('[data-row]');
    
    selectedPiece.element.style.position = '';
    selectedPiece.element.style.zIndex = '';
    selectedPiece.element.style.pointerEvents = '';
    selectedPiece.element.style.width = '';
    selectedPiece.element.style.height = '';
    selectedPiece.element.style.left = '';
    selectedPiece.element.style.top = '';
    
    if (cell) {
      const newRow = parseInt(cell.getAttribute('data-row') || '');
      const newCol = parseInt(cell.getAttribute('data-col') || '');
      
      if (!isNaN(newRow) && !isNaN(newCol)) {
        if (isValidMove(
          board[selectedPiece.row][selectedPiece.col].piece!,
          selectedPiece.row,
          selectedPiece.col,
          newRow,
          newCol,
          currentTurn,
          board
        )) {
          // Проверка на рокировку
          if (board[selectedPiece.row][selectedPiece.col].piece === 'king' &&
              Math.abs(newCol - selectedPiece.col) === 2) {
            handleCastling(selectedPiece.row, selectedPiece.col, newRow, newCol);
          }

          // Обновление доски
          const newBoard = [...board];
          newBoard[newRow][newCol] = board[selectedPiece.row][selectedPiece.col];
          newBoard[selectedPiece.row][selectedPiece.col] = { piece: null, color: null };
          
          // Превращение пешки
          const movedPiece = newBoard[newRow][newCol];
          if (movedPiece.piece === 'pawn') {
            const lastRank = movedPiece.color === 'white' ? 0 : 7;
            if (newRow === lastRank) {
              setBoard(newBoard);
              setPromotion({ fromRow: selectedPiece.row, fromCol: selectedPiece.col, toRow: newRow, toCol: newCol, color: movedPiece.color! });
              setSelectedPiece(null);
              return;
            }
          }

          if (newBoard[newRow][newCol].piece === 'king' || 
              newBoard[newRow][newCol].piece === 'rook') {
            newBoard[newRow][newCol].hasMoved = true;
          }
          
          setBoard(newBoard);
          
          // Меняем ход и проверяем на мат
          const nextTurn = currentTurn === 'white' ? 'black' : 'white';
          setCurrentTurn(nextTurn);
          
          // Проверяем, не поставлен ли мат следующему игроку
          if (isCheckmate(nextTurn)) {
            handleWin(currentTurn);
          }

          // Отправляем ход сопернику
          lobbyRef.current?.sendMove({
            fromRow: selectedPiece.row,
            fromCol: selectedPiece.col,
            toRow: newRow,
            toCol: newCol,
          });
        }
      }
    }
    
    setSelectedPiece(null);
  }, [selectedPiece, board, currentTurn, isCheckmate, clearPossibleMoves]);

  // Добавляем обработчик для глобального mouse move
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (selectedPiece && selectedPiece.element) {
        selectedPiece.element.style.left = `${e.clientX - selectedPiece.offsetX}px`;
        selectedPiece.element.style.top = `${e.clientY - selectedPiece.offsetY}px`;
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (selectedPiece && selectedPiece.element) {
        handleMouseUp(e as unknown as React.MouseEvent<HTMLImageElement>);
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [selectedPiece, handleMouseUp]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLImageElement>, row: number, col: number) => {
    if (promotion) return; // Блокируем действия во время выбора превращения
    const piece = board[row][col];
    if (!piece.piece || piece.color !== currentTurn || piece.color !== selfColor) return;
    
    const touch = e.touches[0];
    const element = e.currentTarget;
    const rect = element.getBoundingClientRect();
    
    // Вычисляем смещение точки касания от левого верхнего угла фигуры
    const offsetX = touch.clientX - rect.left;
    const offsetY = touch.clientY - rect.top;
    
    // Показываем возможные ходы
    showPossibleMoves(row, col, piece.piece, piece.color);
    
    // Сохраняем начальную позицию, элемент и смещения
    setSelectedPiece({ row, col, element, offsetX, offsetY });

    // Добавляем стили для перетаскивания
    element.style.position = 'fixed';
    element.style.zIndex = '1000';
    element.style.pointerEvents = 'none';
    element.style.width = '50px';
    element.style.height = '50px';
    
    // Адаптируем размер для разных экранов
    if (window.innerWidth >= 1024) { // lg
      element.style.width = '80px';
      element.style.height = '80px';
    } else if (window.innerWidth >= 768) { // md
      element.style.width = '67px';
      element.style.height = '67px';
    }
    
    // Позиционируем фигуру, учитывая точку захвата
    element.style.left = `${touch.clientX - offsetX}px`;
    element.style.top = `${touch.clientY - offsetY}px`;
  }, [board, currentTurn, selfColor, showPossibleMoves]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLImageElement>) => {
    e.preventDefault();
    if (!selectedPiece || !selectedPiece.element) return;
    
    const touch = e.touches[0];
    
    // Обновляем позицию, сохраняя точку захвата
    selectedPiece.element.style.left = `${touch.clientX - selectedPiece.offsetX}px`;
    selectedPiece.element.style.top = `${touch.clientY - selectedPiece.offsetY}px`;
  }, [selectedPiece]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLImageElement>) => {
    e.preventDefault();
    if (!selectedPiece || !selectedPiece.element) return;

    clearPossibleMoves();

    const touch = e.changedTouches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const cell = element?.closest('[data-row]');
    
    selectedPiece.element.style.position = '';
    selectedPiece.element.style.zIndex = '';
    selectedPiece.element.style.pointerEvents = '';
    selectedPiece.element.style.width = '';
    selectedPiece.element.style.height = '';
    selectedPiece.element.style.left = '';
    selectedPiece.element.style.top = '';
    
    if (cell) {
      const newRow = parseInt(cell.getAttribute('data-row') || '');
      const newCol = parseInt(cell.getAttribute('data-col') || '');
      
      if (!isNaN(newRow) && !isNaN(newCol)) {
        if (isValidMove(
          board[selectedPiece.row][selectedPiece.col].piece!,
          selectedPiece.row,
          selectedPiece.col,
          newRow,
          newCol,
          currentTurn,
          board
        )) {
          // Проверка на рокировку
          if (board[selectedPiece.row][selectedPiece.col].piece === 'king' &&
              Math.abs(newCol - selectedPiece.col) === 2) {
            handleCastling(selectedPiece.row, selectedPiece.col, newRow, newCol);
          }

          // Обновление доски
          const newBoard = [...board];
          newBoard[newRow][newCol] = board[selectedPiece.row][selectedPiece.col];
          newBoard[selectedPiece.row][selectedPiece.col] = { piece: null, color: null };
          
          // Превращение пешки
          const movedPiece = newBoard[newRow][newCol];
          if (movedPiece.piece === 'pawn') {
            const lastRank = movedPiece.color === 'white' ? 0 : 7;
            if (newRow === lastRank) {
              setBoard(newBoard);
              setPromotion({ fromRow: selectedPiece.row, fromCol: selectedPiece.col, toRow: newRow, toCol: newCol, color: movedPiece.color! });
              setSelectedPiece(null);
              return;
            }
          }

          if (newBoard[newRow][newCol].piece === 'king' || 
              newBoard[newRow][newCol].piece === 'rook') {
            newBoard[newRow][newCol].hasMoved = true;
          }
          
          setBoard(newBoard);
          
          // Меняем ход и проверяем на мат
          const nextTurn = currentTurn === 'white' ? 'black' : 'white';
          setCurrentTurn(nextTurn);
          
          // Проверяем, не поставлен ли мат следующему игроку
          if (isCheckmate(nextTurn)) {
            handleWin(currentTurn);
          }

          // Отправляем ход сопернику
          lobbyRef.current?.sendMove({
            fromRow: selectedPiece.row,
            fromCol: selectedPiece.col,
            toRow: newRow,
            toCol: newCol,
          });
        }
      }
    }
    
    setSelectedPiece(null);
  }, [selectedPiece, board, currentTurn, isCheckmate, clearPossibleMoves]);

  // Рокировка (перестановка ладьи при ходе короля на 2 клетки)
  function handleCastling(fromRow: number, fromCol: number, toRow: number, toCol: number) {
    const isKingSide = toCol > fromCol;
    const rookFromCol = isKingSide ? 7 : 0;
    const rookToCol = isKingSide ? toCol - 1 : toCol + 1;
    
    const newBoard = [...board];
    newBoard[toRow][rookToCol] = board[fromRow][rookFromCol];
    newBoard[fromRow][rookFromCol] = { piece: null, color: null };
    newBoard[toRow][rookToCol].hasMoved = true;
    setBoard(newBoard);
  }

  // Применение хода, полученного по сети
  const applyRemoteMove = useCallback((payload: MovePayload) => {
    const { fromRow, fromCol, toRow, toCol, promotion: promo } = payload;
    const mover = board[fromRow][fromCol];
    if (!mover.piece) return;
    const color = mover.color as 'white' | 'black';
    if (!isValidMove(mover.piece, fromRow, fromCol, toRow, toCol, color, board)) return;

    // Рокировка
    if (mover.piece === 'king' && Math.abs(toCol - fromCol) === 2) {
      handleCastling(fromRow, fromCol, toRow, toCol);
    }

    const newBoard = [...board];
    newBoard[toRow][toCol] = newBoard[fromRow][fromCol];
    newBoard[fromRow][fromCol] = { piece: null, color: null };

    // Превращение пешки (если передано в payload)
    if (promo && newBoard[toRow][toCol].piece === 'pawn') {
      newBoard[toRow][toCol] = { piece: promo, color };
    }

    if (newBoard[toRow][toCol].piece === 'king' || newBoard[toRow][toCol].piece === 'rook') {
      newBoard[toRow][toCol].hasMoved = true;
    }

    setBoard(newBoard);

    const nextTurn = currentTurn === 'white' ? 'black' : 'white';
    setCurrentTurn(nextTurn);
    if (isCheckmate(nextTurn)) {
      handleWin(currentTurn);
    }
  }, [board, currentTurn, handleCastling, isCheckmate, handleWin]);

  // Храним актуальный обработчик применения удалённого хода
  useEffect(() => {
    applyRemoteMoveRef.current = applyRemoteMove;
  }, [applyRemoteMove]);

  const renderCell = (piece: ChessPiece, row: number, col: number) => {
    const isDark = (row + col) % 2 === 1;
    const possibleMove = possibleMoves.find(move => move.row === row && move.col === col);
    // Определяем буквенные и числовые обозначения
    const files = selfColor === 'white'
      ? ['A','B','C','D','E','F','G','H']
      : ['H','G','F','E','D','C','B','A'];
    const ranks = selfColor === 'white'
      ? ['8','7','6','5','4','3','2','1']
      : ['1','2','3','4','5','6','7','8'];

    return (
      <div
        key={`${row}-${col}`}
        className={`relative flex items-center justify-center w-full aspect-square ${
          isDark ? 'bg-black' : 'bg-white'
        } touch-none`}
        data-row={row}
        data-col={col}
      >
        {/* Цифровые метки (ряды) - в верхнем левом углу */}
        {(selfColor === 'white' && col === 0) || (selfColor === 'black' && col === 7) ? (
          <span className="absolute top-0 left-1 text-gray-700 text-xs md:text-sm font-semibold pointer-events-none">
            {ranks[row]}
          </span>
        ) : null}
          
        {/* Буквенные метки (колонки) - в нижнем правом углу */}
        {(selfColor === 'white' && row === 7) || (selfColor === 'black' && row === 0) ? (
          <span className="absolute bottom-0 right-1 text-gray-700 text-xs md:text-sm font-semibold pointer-events-none">
            {files[col]}
          </span>
        ) : null}

        {possibleMove && (
          <div 
            className={`absolute ${
              possibleMove.type === 'attack' 
                ? 'w-full h-full rounded-full border-[3px] border-gray-500 opacity-50' 
                : 'w-3 h-3 md:w-4 md:h-4 lg:w-5 lg:h-5 rounded-full bg-gray-500 opacity-50'
            }`}
            style={{
              top: possibleMove.type === 'attack' ? '0' : '50%',
              left: possibleMove.type === 'attack' ? '0' : '50%',
              transform: possibleMove.type === 'attack' ? 'none' : 'translate(-50%, -50%)'
            }}
          />
        )}
        {piece.piece && (
          <img
            src={`/img/${piece.piece}-${piece.color}.png`}
            alt={`${piece.color} ${piece.piece}`}
            className="w-[80%] h-[80%] object-contain cursor-pointer select-none piece"
            onMouseDown={(e) => handleMouseDown(e, row, col)}
            onTouchStart={(e) => handleTouchStart(e, row, col)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            draggable="false"
          />
        )}
      </div>
    );
  };

  useEffect(() => {
    // Скрипт для подсчёта времени загрузки всех ресурсов
    window.addEventListener('load', () => {
      const resources = window.performance.getEntriesByType('resource');
      let totalTime = 0;
      resources.forEach(res => {
        totalTime += res.duration;
        console.log(`${res.name}: ${res.duration.toFixed(2)} ms`);
      });
      console.log(`Общее время загрузки всех ресурсов: ${totalTime.toFixed(2)} ms`);
    });
  }, []);

  return (
    <div className="flex flex-col justify-center items-center min-h-screen w-screen bg-gray-200 overflow-hidden">
      <div className="w-full max-w-[800px] p-3 text-center">
        {roomId && (
          <div className="mb-3 text-sm text-gray-700 break-words">
            Комната: <span className="font-mono">{roomId}</span>
            {inviteUrl && (
              <div className="mt-2 flex items-center justify-center gap-2">
                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white text-sm py-1 px-3 rounded"
                  onClick={() => navigator.clipboard?.writeText(inviteUrl)}
                >
                  Скопировать приглашение
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {winner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-lg text-center relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl font-bold"
              onClick={() => setWinner(null)}
            >
              &times;
            </button>
            <h2 className="text-3xl font-bold mb-4">
              {winner === 'white' ? 'Белые' : 'Черные'} победили!
            </h2>
            <p className="text-xl mb-4">Мат!</p>
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              onClick={() => window.location.reload()}
            >
              Начать новую игру
            </button>
          </div>
        </div>
      )}
      <div ref={boardContainerRef} className={`relative w-[100vw] max-w-[504px] md:max-w-[672px] lg:max-w-[800px] aspect-square touch-none`}>
        <div className={`grid grid-cols-8 border-4 border-gray-800 bg-white absolute inset-0 ${selfColor === 'black' ? '' : ''}`}>
          {(() => {
            // Определяем порядок строк и столбцов для отрисовки
            // Если игрок белый, идем от 0 до 7
            // Если игрок черный, идем от 7 до 0 (т.е. 7-i)
            const rowsToRender = selfColor === 'white' ? Array.from({ length: 8 }, (_, i) => i) : Array.from({ length: 8 }, (_, i) => 7 - i);
            const colsToRender = selfColor === 'white' ? Array.from({ length: 8 }, (_, i) => i) : Array.from({ length: 8 }, (_, i) => 7 - i);

            return rowsToRender.map((rowIndex) => // rowIndex здесь - это реальный индекс из board (0-7), но порядок итерации задан rowsToRender
              colsToRender.map((colIndex) => { // colIndex здесь - это реальный индекс из board (0-7), но порядок итерации задан colsToRender
                const piece = board[rowIndex][colIndex]; // Получаем фигуру из фактического состояния доски
                return (
                  <div key={`wrap-${rowIndex}-${colIndex}`}> {/* Удален rotate-180 */}
                    {renderCell(piece, rowIndex, colIndex)} {/* Передаем фактические координаты фигуры */}
                  </div>
                );
              })
            );
          })()}
          {promotion && (
          <div className="absolute inset-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-2 flex flex-col items-center gap-2">
              <button className="p-1 hover:bg-gray-100 rounded" onClick={() => handlePromote('queen')}>
                <img src={`/img/queen-${promotion.color}.png`} alt="" className="w-16 h-16 object-contain" />
              </button>
              <button className="p-1 hover:bg-gray-100 rounded" onClick={() => handlePromote('rook')}>
                <img src={`/img/rook-${promotion.color}.png`} alt="" className="w-16 h-16 object-contain" />
              </button>
              <button className="p-1 hover:bg-gray-100 rounded" onClick={() => handlePromote('bishop')}>
                <img src={`/img/bishop-${promotion.color}.png`} alt="" className="w-16 h-16 object-contain" />
              </button>
              <button className="p-1 hover:bg-gray-100 rounded" onClick={() => handlePromote('knight')}>
                <img src={`/img/knight-${promotion.color}.png`} alt="" className="w-16 h-16 object-contain" />
              </button>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChessLobby; 