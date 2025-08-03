import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import './index.css';

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

const App: React.FC = () => {
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

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLImageElement>, row: number, col: number) => {
    const piece = board[row][col];
    if (!piece.piece || piece.color !== currentTurn) return;
    
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
  }, [board, currentTurn, showPossibleMoves]);

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
            setWinner(currentTurn);
          }
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
    const piece = board[row][col];
    if (!piece.piece || piece.color !== currentTurn) return;
    
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
  }, [board, currentTurn, showPossibleMoves]);

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
            setWinner(currentTurn);
          }
        }
      }
    }
    
    setSelectedPiece(null);
  }, [selectedPiece, board, currentTurn, isCheckmate, clearPossibleMoves]);

  const handleCastling = (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    const isKingSide = toCol > fromCol;
    const rookFromCol = isKingSide ? 7 : 0;
    const rookToCol = isKingSide ? toCol - 1 : toCol + 1;
    
    const newBoard = [...board];
    newBoard[toRow][rookToCol] = board[fromRow][rookFromCol];
    newBoard[fromRow][rookFromCol] = { piece: null, color: null };
    newBoard[toRow][rookToCol].hasMoved = true;
    setBoard(newBoard);
  };

  const renderCell = (piece: ChessPiece, row: number, col: number) => {
    const isDark = (row + col) % 2 === 1;
    const possibleMove = possibleMoves.find(move => move.row === row && move.col === col);
    
    return (
      <div
        key={`${row}-${col}`}
        className={`relative flex items-center justify-center w-[63px] h-[63px] md:w-[84px] md:h-[84px] lg:w-[100px] lg:h-[100px] ${
          isDark ? 'bg-black' : 'bg-white'
        } touch-none`}
        data-row={row}
        data-col={col}
      >
        {possibleMove && (
          <div 
            className={`absolute ${
              possibleMove.type === 'attack' 
                ? 'w-[63px] h-[63px] md:w-[84px] md:h-[84px] lg:w-[100px] lg:h-[100px] rounded-full border-3 border-gray-500 opacity-50' 
                : 'w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 rounded-full bg-gray-500 opacity-50'
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
            className="w-[50px] h-[50px] md:w-[67px] md:h-[67px] lg:w-[80px] lg:h-[80px] object-contain cursor-pointer select-none piece"
            onMouseDown={(e) => handleMouseDown(e, row, col)}
            onTouchStart={(e) => handleTouchStart(e, row, col)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-screen w-screen bg-gray-200 overflow-hidden">
      {winner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-lg text-center">
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
      <div className="grid grid-cols-8 border-4 border-gray-800 bg-white min-w-[504px] min-h-[504px] md:min-w-[672px] md:min-h-[672px] lg:min-w-[800px] lg:min-h-[800px] touch-none">
        {board.map((row, rowIndex) =>
          row.map((piece, colIndex) => renderCell(piece, rowIndex, colIndex))
        )}
      </div>
    </div>
  );
};

export default App; 