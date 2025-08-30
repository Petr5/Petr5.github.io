import "./index.css";


// Добавляем интерфейс для координат клетки
interface CellPosition {
  x: number;
  y: number;
}

// Добавляем интерфейс для touch событий
interface TouchHandlers {
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: (e: TouchEvent) => void;
}

// Утилита для определения типа устройства
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Добавляем интерфейс для фигуры с отслеживанием первого хода
interface ChessPiece {
  piece: string | null;
  color: 'black' | 'white' | null;
  hasMoved?: boolean; // Для отслеживания первого хода короля и ладьи
}

// Кэш координат центров клеток
const cellCenters: CellPosition[][] = Array(8).fill(null).map(() => 
  Array(8).fill(null).map(() => ({ x: 0, y: 0 }))
);

let selectedPiece: HTMLElement | null = null;
let selectedRow: number | null = null;
let selectedCol: number | null = null;
let currentTurn: "white" | "black" = "white";

// Добавляем флаг для отслеживания текущего типа взаимодействия
let isTouchInteraction = false;

// Обновляем тип доски
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

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.classList.add(
    "flex",
    "justify-center",
    "items-center",
    "min-h-screen",
    "w-screen",
    "bg-gray-200",
    "overflow-hidden"
  );
  initBoard();
} else {
  console.error("Элемент #app не найден!");
}

function calculateCellCenters() {
  const board = document.querySelector('.grid') as HTMLElement;
  if (!board) return;

  const cells = Array.from(board.querySelectorAll('[data-row][data-col]')) as HTMLElement[];

  cells.forEach((cell) => {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const rect = cell.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();

    cellCenters[row][col] = {
      x: rect.left - boardRect.left + rect.width / 2,
      y: rect.top - boardRect.top + rect.height / 2
    };
  });
}

function getPointerPosition(event: MouseEvent | TouchEvent): { clientX: number; clientY: number } {
  if (event instanceof TouchEvent) {
    const touch = event.touches[0] || event.changedTouches[0];
    return {
      clientX: touch.clientX,
      clientY: touch.clientY
    };
  }
  return {
    clientX: event.clientX,
    clientY: event.clientY
  };
}

function initBoard() {
  if (!app) return;

  // Добавляем класс для отключения масштабирования на мобильных
  app.classList.add('touch-none');

  app.innerHTML = `
    <div class="grid grid-cols-8 border-4 border-gray-800 bg-white min-w-[504px] min-h-[504px] touch-none">
      ${initialBoard
        .flatMap((row, rowIndex) =>
          row.map(
            ({ piece, color }, colIndex) => `
              <div class="relative flex items-center justify-center w-[63px] h-[63px]
                ${(rowIndex + colIndex) % 2 === 0 ? "bg-white" : "bg-black"}
                touch-none"
                data-row="${rowIndex}" data-col="${colIndex}">
                ${piece ? renderCell(piece, color) : ""}
              </div>`
          )
        )
        .join("")}
    </div>
  `;

  // Добавляем обработчики событий для всей доски
  const board = app.querySelector('.grid') as HTMLElement;
  if (board) {
    // Предотвращаем прокрутку на мобильных устройствах
    board.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    
    // Отключаем контекстное меню на мобильных
    board.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Устанавливаем CSS переменную для viewport height
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
  }

  bindBoardEvents();
  calculateCellCenters();
}

// Устанавливаем CSS переменную для корректной высоты на мобильных
function setViewportHeight() {
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
}

function bindBoardEvents() {
  document.querySelectorAll("[data-row][data-col]").forEach((cell) => {
    const piece = cell.querySelector(".piece") as HTMLElement;
    if (piece) {
      if (isMobileDevice()) {
        // Для мобильных устройств
        piece.addEventListener("touchstart", onPointerDown, { passive: false });
      } else {
        // Для десктопов
        piece.addEventListener("mousedown", onPointerDown);
      }
    }
  });
}

function renderCell(piece: string | null, color: "white" | "black" | null) {
  if (!piece || !color) return "";

  const imgSrc = `/img/${piece}-${color}.webp`;
  return `<img
    src="${imgSrc}"
    alt="${color} ${piece}"
    class="w-[50px] h-[50px] object-contain cursor-pointer select-none piece"
    data-piece="${piece}"
  />`;
}


// Функция для рендеринга доски при перемещении фигур
function renderBoard() {
  if (!app) return;

  // Восстановление состояния доски с актуальными фигурами
  app.innerHTML = `
    <div class="grid grid-cols-8 border-4 border-gray-800 bg-white min-w-[504px] min-h-[504px]">
      ${initialBoard
        .flatMap((row, rowIndex) =>
          row.map(
            ({ piece, color }, colIndex) => `
              <div class="relative flex items-center justify-center w-[63px] h-[63px]
                ${(rowIndex + colIndex) % 2 === 0 ? "bg-white" : "bg-black"}"
                data-row="${rowIndex}" data-col="${colIndex}">
                ${
                  piece
                    ? renderCell(piece, color)
                    : ""
                }
              </div>`
          )
        )
        .join("")}
    </div>
  `;
    
  // Повторно вешаем события после рендера
  document.querySelectorAll("[data-row][data-col]").forEach((cell) => {
    const element = cell as HTMLElement;
    element.addEventListener("mousedown", onPointerDown);
    element.addEventListener("touchstart", onPointerDown, { passive: false });
  });

  // Обновляем центры клеток
  calculateCellCenters();

  // Добавляем обработчик события для mousedown
  document.querySelectorAll("[data-row][data-col]").forEach((cell) => {
    (cell as HTMLElement).addEventListener("mousedown", onPointerDown);
  });
}


function bindPointerEvents() {
  document.querySelectorAll("[data-row][data-col]").forEach((cell) => {
    const piece = cell.querySelector(".piece");
    if (piece) {
      piece.addEventListener("mousedown", (e: Event) => onPointerDown(e as MouseEvent));
      piece.addEventListener("touchstart", (e: Event) => onPointerDown(e as TouchEvent), { passive: false });
    }
  });
}



// Добавляем интерфейс для атакующей фигуры
interface AttackingPiece {
  piece: string;
  color: "white" | "black";
  row: number;
  col: number;
}

// Функция для получения позиции короля
function getKingPosition(color: "white" | "black"): { row: number; col: number } | null {
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      if (initialBoard[i][j].piece === "king" && initialBoard[i][j].color === color) {
        return { row: i, col: j };
      }
    }
  }
  return null;
}

// Функция для проверки, находится ли клетка под атакой
function isSquareUnderAttack(row: number, col: number, defendingColor: "white" | "black"): boolean {
  const attackingColor = defendingColor === "white" ? "black" : "white";
  
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const attackingPiece = initialBoard[i][j];
      if (attackingPiece.piece && attackingPiece.color === attackingColor) {
        if (isValidMove(attackingPiece.piece, i, j, row, col, attackingColor)) {
          return true;
        }
      }
    }
  }
  return false;
}

// Функция для получения всех атакующих фигур, создающих шах
function getCheckingPieces(kingColor: "white" | "black"): AttackingPiece[] {
  const kingPos = getKingPosition(kingColor);
  if (!kingPos) return [];

  const attackingPieces: AttackingPiece[] = [];
  const oppositeColor = kingColor === "white" ? "black" : "white";

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const piece = initialBoard[i][j];
      if (piece.piece && piece.color === oppositeColor) {
        if (isValidMove(piece.piece, i, j, kingPos.row, kingPos.col, oppositeColor)) {
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

// Функция для проверки, может ли фигура блокировать линию атаки
function canBlockCheck(
  attackingPiece: AttackingPiece,
  kingPos: { row: number; col: number },
  defendingColor: "white" | "black"
): boolean {
  // Получаем все клетки между атакующей фигурой и королем
  const deltaRow = Math.sign(kingPos.row - attackingPiece.row);
  const deltaCol = Math.sign(kingPos.col - attackingPiece.col);
  let row = attackingPiece.row + deltaRow;
  let col = attackingPiece.col + deltaCol;

  while (row !== kingPos.row || col !== kingPos.col) {
    // Проверяем, может ли какая-либо фигура защищающейся стороны достичь этой клетки
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = initialBoard[i][j];
        if (piece.piece && piece.color === defendingColor && piece.piece !== "king") {
          if (isValidMove(piece.piece, i, j, row, col, defendingColor)) {
            return true;
          }
        }
      }
    }
    row += deltaRow;
    col += deltaCol;
  }
  return false;
}

// Функция для проверки возможности хода с учетом шаха
function isMoveLegal(fromRow: number, fromCol: number, toRow: number, toCol: number, movingColor: "white" | "black"): boolean {
  // Сохраняем текущее состояние
  const originalPiece = initialBoard[toRow][toCol];
  const movingPiece = initialBoard[fromRow][fromCol];

  // Временно делаем ход
  initialBoard[toRow][toCol] = initialBoard[fromRow][fromCol];
  initialBoard[fromRow][fromCol] = { piece: null, color: null };

  // Проверяем, не находится ли король под шахом после хода
  const kingPos = getKingPosition(movingColor);
  let isLegal = true;

  if (kingPos) {
    isLegal = !isSquareUnderAttack(kingPos.row, kingPos.col, movingColor);
  }

  // Возвращаем доску в исходное состояние
  initialBoard[fromRow][fromCol] = movingPiece;
  initialBoard[toRow][toCol] = originalPiece;

  return isLegal;
}

// Обновляем функцию isValidMove для учета шаха
function isValidMove(
  piece: string,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  color: "white" | "black"
): boolean {
  // Сначала проверяем базовую валидность хода
  const basicValid = isBasicValidMove(piece, fromRow, fromCol, toRow, toCol, color);
  if (!basicValid) return false;

  // Затем проверяем легальность хода с учетом шаха
  return isMoveLegal(fromRow, fromCol, toRow, toCol, color);
}

// Переименовываем оригинальную функцию isValidMove в isBasicValidMove
function isBasicValidMove(
  piece: string,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  color: "white" | "black"
): boolean {
  const deltaRow = toRow - fromRow;
  const deltaCol = toCol - fromCol;

  const absRow = Math.abs(deltaRow);
  const absCol = Math.abs(deltaCol);

  const targetCell = initialBoard[toRow][toCol];

  // Нельзя бить свою фигуру
  if (targetCell.color === color) return false;

  switch (piece) {
    case "pawn":
      const direction = color === "white" ? -1 : 1;
      const startRow = color === "white" ? 6 : 1;

      // Движение вперёд на 1
      if (deltaCol === 0 && deltaRow === direction && !targetCell.piece) return true;

      // Первый ход на 2
      if (
        deltaCol === 0 &&
        fromRow === startRow &&
        deltaRow === direction * 2 &&
        !initialBoard[fromRow + direction][fromCol].piece &&
        !targetCell.piece
      ) {
        return true;
      }

      // Атака по диагонали
      if (
        absCol === 1 &&
        deltaRow === direction &&
        targetCell.piece &&
        targetCell.color !== color
      ) {
        return true;
      }

      return false;

    case "rook":
      if (fromRow !== toRow && fromCol !== toCol) return false;
      return isPathClear(fromRow, fromCol, toRow, toCol);

    case "bishop":
      if (absRow !== absCol) return false;
      return isPathClear(fromRow, fromCol, toRow, toCol);

    case "queen":
      if (fromRow === toRow || fromCol === toCol || absRow === absCol) {
        return isPathClear(fromRow, fromCol, toRow, toCol);
      }
      return false;

    case "knight":
      return (
        (absRow === 2 && absCol === 1) || (absRow === 1 && absCol === 2)
      );

    case "king":
      // Проверка на рокировку
      if (absRow === 0 && absCol === 2 && !initialBoard[fromRow][fromCol].hasMoved) {
        const isKingSide = toCol > fromCol;
        const rookCol = isKingSide ? 7 : 0;
        return canCastle(fromRow, fromCol, rookCol, color);
      }
      return absRow <= 1 && absCol <= 1;

    default:
      return false;
  }
}

// Проверка, что путь между from и to свободен (для ладьи, ферзя, слона)
function isPathClear(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): boolean {
  const rowStep = Math.sign(toRow - fromRow);
  const colStep = Math.sign(toCol - fromCol);
  let currentRow = fromRow + rowStep;
  let currentCol = fromCol + colStep;

  while (currentRow !== toRow || currentCol !== toCol) {
    if (initialBoard[currentRow][currentCol].piece) return false;
    currentRow += rowStep;
    currentCol += colStep;
  }

  return true;
}

function showPossibleMoves(row: number, col: number, piece: string, color: "white" | "black") {
  console.log("showPossibleMoves started");
  // Удаляем предыдущие точки и круги, если они есть
  document.querySelectorAll('.possible-move, .possible-attack').forEach(el => el.remove());

  // Проверяем каждую клетку на доске
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      // Пропускаем текущую позицию фигуры
      if (i === row && j === col) continue;

      // Проверяем, является ли ход допустимым
      if (isValidMove(piece, row, col, i, j, color)) {
        console.log("isValidMove true");
        const targetCell = initialBoard[i][j];
        console.log("targetCell", targetCell, "i", i, "j", j);
        const cell = document.querySelector(`[data-row="${i}"][data-col="${j}"]`);
        
        if (cell) {
          console.log("cell found");
          if (targetCell.piece && targetCell.color !== color) {
            console.log("targetCell.piece && targetCell.color !== color");
            // Если в клетке есть вражеская фигура - рисуем круг вокруг нее
            const circle = document.createElement('div');
            circle.className = 'possible-attack absolute w-[63px] h-[63px] rounded-full border-2 border-gray-500 opacity-50';
            circle.style.top = '0';
            circle.style.left = '0';
            cell.appendChild(circle);
          } else if (!targetCell.piece) {
            console.log("!targetCell.piece");
            // Если клетка пустая - рисуем точку
            const dot = document.createElement('div');
            dot.className = 'possible-move absolute w-4 h-4 rounded-full bg-gray-500 opacity-50';
            dot.style.top = '50%';
            dot.style.left = '50%';
            dot.style.transform = 'translate(-50%, -50%)';
            console.log("dot", dot);
            cell.appendChild(dot);
          }
        }
      }
    }
  }
}

function clearPossibleMoves() {
  document.querySelectorAll('.possible-move, .possible-attack').forEach(el => el.remove());
}

function onPointerDown(event: MouseEvent | TouchEvent) {
  console.log("onPointerDown started");
  
  // Определяем тип взаимодействия
  isTouchInteraction = event instanceof TouchEvent;
  console.log("isTouchInteraction is ", isTouchInteraction);
  if (isTouchInteraction) {
    console.log("isTouchInteraction is true")
    event.preventDefault();
  }

  const pos = getPointerPosition(event);
  const target = document.elementFromPoint(pos.clientX, pos.clientY) as HTMLElement;
  
  if (!target.classList.contains('piece')) return;
  
  const cell = target.closest("[data-row][data-col]") as HTMLElement;
  if (!cell) return;

  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  const { piece, color } = initialBoard[row][col];
  if (!piece) return;

  if (color !== currentTurn) {
    console.log(`It's ${currentTurn}'s turn!`);
    return;
  }

  // Проверяем наличие шаха
  const checkingPieces = getCheckingPieces(color);
  if (checkingPieces.length > 0) {
    if (checkingPieces.length > 1 && piece !== "king") {
      console.log("Double check! Only king can move!");
      return;
    }
    if (checkingPieces.length === 1 && piece !== "king") {
      const kingPos = getKingPosition(color);
      if (!kingPos) return;

      const canBlock = canBlockCheck(checkingPieces[0], kingPos, color);
      const canCapture = isValidMove(piece, row, col, checkingPieces[0].row, checkingPieces[0].col, color);

      if (!canBlock && !canCapture) {
        console.log("This piece cannot defend against check!");
        return;
      }
    }
  }

  console.log(`Piece selected: ${piece} at [${row}, ${col}]`);

  clearPossibleMoves();
  showPossibleMoves(row, col, piece, color);

  selectedPiece = target;
  selectedRow = row;
  selectedCol = col;

  selectedPiece.style.position = 'fixed';
  selectedPiece.style.zIndex = '1000';
  selectedPiece.style.pointerEvents = 'none';
  selectedPiece.style.width = '50px';
  selectedPiece.style.height = '50px';
  
  movePieceToPosition(event);

  if (isTouchInteraction) {
    console.log("touch event");
    document.addEventListener("touchmove", onPointerMove, { passive: false });
    document.addEventListener("touchend", onPointerUp);
  } else {
    console.log("mouse event");
    document.addEventListener("mousemove", onPointerMove);
    document.addEventListener("mouseup", onPointerUp);
  }
}

function onPointerMove(event: MouseEvent | TouchEvent) {
  event.preventDefault();
  movePieceToPosition(event);
}

function onPointerUp(event: MouseEvent | TouchEvent) {
  if (isTouchInteraction) {
    document.removeEventListener("touchmove", onPointerMove);
    document.removeEventListener("touchend", onPointerUp);
  } else {
    document.removeEventListener("mousemove", onPointerMove);
    document.removeEventListener("mouseup", onPointerUp);
  }

  clearPossibleMoves();

  if (!selectedPiece || selectedRow === null || selectedCol === null) return;

  const pos = getPointerPosition(event);
  const target = document.elementFromPoint(pos.clientX, pos.clientY) as HTMLElement;
  const cell = target?.closest("[data-row][data-col]") as HTMLElement;
  
  if (!cell) {
    renderBoard();
    bindPointerEvents();
    selectedPiece = null;
    selectedRow = null;
    selectedCol = null;
    return;
  }

  const newRow = Number(cell.dataset.row);
  const newCol = Number(cell.dataset.col);
  const from = initialBoard[selectedRow][selectedCol];

  if (!isValidMove(from.piece!, selectedRow, selectedCol, newRow, newCol, from.color!)) {
    console.log("Invalid move");
    renderBoard();
    bindPointerEvents();
    selectedPiece = null;
    selectedRow = null;
    selectedCol = null;
    return;
  }

  // Проверяем, является ли ход рокировкой
  if (from.piece === "king" && Math.abs(newCol - selectedCol) === 2) {
    const isKingSide = newCol > selectedCol;
    const rookFromCol = isKingSide ? 7 : 0;
    const rookToCol = isKingSide ? newCol - 1 : newCol + 1;

    // Перемещаем ладью
    initialBoard[newRow][rookToCol] = initialBoard[newRow][rookFromCol];
    initialBoard[newRow][rookFromCol] = { piece: null, color: null };
    initialBoard[newRow][rookToCol].hasMoved = true;
  }

  // Выполняем ход
  initialBoard[newRow][newCol] = initialBoard[selectedRow][selectedCol];
  initialBoard[selectedRow][selectedCol] = { piece: null, color: null };

  // Отмечаем, что фигура сделала ход
  if (from.piece === "king" || from.piece === "rook") {
    initialBoard[newRow][newCol].hasMoved = true;
  }

  currentTurn = currentTurn === "white" ? "black" : "white";
  console.log(`Now it's ${currentTurn}'s turn.`);

  renderBoard();
  bindPointerEvents();

  selectedPiece = null;
  selectedRow = null;
  selectedCol = null;
  isTouchInteraction = false;
}

function movePieceToPosition(event: MouseEvent | TouchEvent) {
  if (!selectedPiece) return;

  const pos = getPointerPosition(event);
  
  // Перемещаем фигуру за курсором/пальцем с учетом центра фигуры
  selectedPiece.style.left = `${pos.clientX}px`;
  selectedPiece.style.top = `${pos.clientY}px`;
}

// Функция для проверки возможности рокировки
function canCastle(
  kingRow: number,
  kingCol: number,
  rookCol: number,
  color: "white" | "black"
): boolean {
  const king = initialBoard[kingRow][kingCol];
  const rook = initialBoard[kingRow][rookCol];

  // Проверяем, что король и ладья не двигались
  if (!king || !rook || king.hasMoved || rook.hasMoved) {
    return false;
  }

  // Проверяем, что путь между королем и ладьей свободен
  const start = Math.min(kingCol, rookCol) + 1;
  const end = Math.max(kingCol, rookCol);
  for (let col = start; col < end; col++) {
    if (initialBoard[kingRow][col].piece) {
      return false;
    }
  }

  // Проверяем, не находится ли король под шахом
  if (isSquareUnderAttack(kingRow, kingCol, color)) {
    return false;
  }

  // Проверяем, не проходит ли король через атакованные поля
  const direction = rookCol < kingCol ? -1 : 1;
  for (let col = kingCol + direction; col !== rookCol; col += direction) {
    if (isSquareUnderAttack(kingRow, col, color)) {
      return false;
    }
  }

  return true;
}

