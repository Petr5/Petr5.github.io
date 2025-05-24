import "./index.css";

const figures = {
  pawn: "♙",
  rook: "♖",
  knight: "♘",
  bishop: "♗",
  queen: "♕",
  king: "♔",
};

// Добавляем интерфейс для координат клетки
interface CellPosition {
  x: number;
  y: number;
}

// Кэш координат центров клеток
const cellCenters: CellPosition[][] = Array(8).fill(null).map(() => 
  Array(8).fill(null).map(() => ({ x: 0, y: 0 }))
);

let selectedPiece: HTMLElement | null = null;
let selectedRow: number | null = null;
let selectedCol: number | null = null;
let offsetX = 0;
let offsetY = 0;
let currentTurn: "white" | "black" = "white";


// Определяем цвета фигур
const pieceColors = {
  black: "#DAA520",
  white: "#444",
};

// Структура доски изменена для хранения цвета фигуры
const initialBoard: { piece: string | null, color: 'black' | 'white' | null }[][] = [
  [
    { piece: "rook", color: 'black' }, { piece: "knight", color: 'black' }, { piece: "bishop", color: 'black' },
    { piece: "queen", color: 'black' }, { piece: "king", color: 'black' }, { piece: "bishop", color: 'black' },
    { piece: "knight", color: 'black' }, { piece: "rook", color: 'black' }
  ], // Чёрные фигуры
  Array(8).fill({ piece: "pawn", color: 'black' }), // Чёрные пешки
  Array(8).fill({ piece: null, color: null }), // Пустые клетки
  Array(8).fill({ piece: null, color: null }),
  Array(8).fill({ piece: null, color: null }),
  Array(8).fill({ piece: null, color: null }),
  Array(8).fill({ piece: "pawn", color: 'white' }), // Белые пешки
  [
    { piece: "rook", color: 'white' }, { piece: "knight", color: 'white' }, { piece: "bishop", color: 'white' },
    { piece: "queen", color: 'white' }, { piece: "king", color: 'white' }, { piece: "bishop", color: 'white' },
    { piece: "knight", color: 'white' }, { piece: "rook", color: 'white' }
  ], // Белые фигуры
];

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.classList.add(
    "flex",
    "justify-center",
    "items-center",
    "h-screen",
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

// Функция для начальной инициализации доски и размещения фигур
function initBoard() {
  if (!app) return;

  app.innerHTML = `
    <div class="grid grid-cols-8 border-4 border-gray-800 bg-white min-w-[360px] min-h-[360px]">
      ${initialBoard
        .flatMap((row, rowIndex) =>
          row.map(
            ({ piece, color }, colIndex) => `
              <div class="relative flex items-center justify-center w-[45px] h-[45px]
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

  document.querySelectorAll("[data-row][data-col]").forEach((cell) => {
    (cell as HTMLElement).addEventListener("mousedown", onMouseDown);
  });

  // Рассчитываем координаты центров клеток после создания доски
  calculateCellCenters();
}

function renderCell(piece: string | null, color: "white" | "black" | null) {
  if (!piece || !color) return "";

  const imgSrc = `/img/${piece}-${color}.png`;
  return `<img
    src="${imgSrc}"
    alt="${color} ${piece}"
    class="w-[36px] h-[36px] object-contain cursor-pointer select-none piece"
    data-piece="${piece}"
  />`;
}


// Функция для рендеринга доски при перемещении фигур
function renderBoard() {
  if (!app) return;

  // Восстановление состояния доски с актуальными фигурами
  app.innerHTML = `
    <div class="grid grid-cols-8 border-4 border-gray-800 bg-white min-w-[360px] min-h-[360px]">
      ${initialBoard
        .flatMap((row, rowIndex) =>
          row.map(
            ({ piece, color }, colIndex) => `
              <div class="relative flex items-center justify-center w-[45px] h-[45px]
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

  // Добавляем обработчик события для mousedown
  document.querySelectorAll("[data-row][data-col]").forEach((cell) => {
    (cell as HTMLElement).addEventListener("mousedown", onMouseDown);
  });
}



function isValidMove(
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


function movePieceToPosition(event: MouseEvent) {
  if (!selectedPiece) return;

  // Перемещаем фигуру точно за курсором
  selectedPiece.style.position = 'fixed';
  selectedPiece.style.left = `${event.clientX - 18}px`; // 18 это половина размера фигуры (36/2)
  selectedPiece.style.top = `${event.clientY - 18}px`;
}

function onMouseDown(event: MouseEvent) {
  const target = event.target as HTMLElement;
  
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

  event.preventDefault();
  console.log(`Piece selected: ${piece} at [${row}, ${col}]`);

  selectedPiece = target;
  selectedRow = row;
  selectedCol = col;

  // Устанавливаем стили для перетаскивания
  selectedPiece.style.position = 'fixed';
  selectedPiece.style.zIndex = '1000';
  selectedPiece.style.pointerEvents = 'none';
  selectedPiece.style.width = '36px';
  selectedPiece.style.height = '36px';
  
  // Сразу устанавливаем позицию фигуры под курсором
  movePieceToPosition(event);

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

function onMouseMove(event: MouseEvent) {
  movePieceToPosition(event);
}

function onMouseUp(event: MouseEvent) {
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", onMouseUp);

  if (!selectedPiece || selectedRow === null || selectedCol === null) return;

  const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement;
  const cell = target.closest("[data-row][data-col]") as HTMLElement;
  if (!cell) {
    renderBoard();
    selectedPiece = null;
    selectedRow = null;
    selectedCol = null;
    return;
  }

  const newRow = Number(cell.dataset.row);
  const newCol = Number(cell.dataset.col);
  const from = initialBoard[selectedRow][selectedCol];
  const to = initialBoard[newRow][newCol];

  if (!isValidMove(from.piece!, selectedRow, selectedCol, newRow, newCol, from.color!)) {
    console.log("Invalid move");
    renderBoard();
    selectedPiece = null;
    selectedRow = null;
    selectedCol = null;
    return;
  }

  console.log(`Moving piece from [${selectedRow}, ${selectedCol}] to [${newRow}, ${newCol}]`);

  initialBoard[newRow][newCol] = initialBoard[selectedRow][selectedCol];
  initialBoard[selectedRow][selectedCol] = { piece: null, color: null };

  console.log("Updated board state:", initialBoard);

  currentTurn = currentTurn === "white" ? "black" : "white";
  console.log(`Now it's ${currentTurn}'s turn.`);

  renderBoard();

  selectedPiece = null;
  selectedRow = null;
  selectedCol = null;
}

