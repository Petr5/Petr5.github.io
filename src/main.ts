import "./index.css";

const figures = {
  pawn: "♙",
  rook: "♖",
  knight: "♘",
  bishop: "♗",
  queen: "♕",
  king: "♔",
};

let selectedPiece: HTMLElement | null = null;
let selectedRow: number | null = null;
let selectedCol: number | null = null;
let offsetX = 0;
let offsetY = 0;
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
  app.classList.add("flex", "justify-center", "items-center", "h-screen", "bg-gray-200");
  initBoard(); // Инициализация доски при загрузке
} else {
  console.error("Элемент #app не найден!");
}

// Функция для начальной инициализации доски и размещения фигур
function initBoard() {
  if (!app) return;

  app.innerHTML = `
    <div class="grid grid-cols-8 border-4 border-gray-800">
      ${initialBoard
        .flatMap((row, rowIndex) =>
          row.map(
            ({ piece, color }, colIndex) => `
              <div class="relative flex items-center justify-center w-10 h-10
                ${(rowIndex + colIndex) % 2 === 0 ? "bg-white" : "bg-black"}"
                data-row="${rowIndex}" data-col="${colIndex}">
                ${
                  piece
                    ? `<span class="text-xl cursor-pointer select-none piece"
                        style="color: ${piece && color ? pieceColors[color] : "#444"}"
                        data-piece="${piece}">
                        ${figures[piece as keyof typeof figures]}
                      </span>`
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

// Функция для рендеринга доски при перемещении фигур
function renderBoard() {
  if (!app) return;

  // Восстановление состояния доски с актуальными фигурами
  app.innerHTML = `
    <div class="grid grid-cols-8 border-4 border-gray-800">
      ${initialBoard
        .flatMap((row, rowIndex) =>
          row.map(
            ({ piece, color }, colIndex) => `
              <div class="relative flex items-center justify-center w-10 h-10
                ${(rowIndex + colIndex) % 2 === 0 ? "bg-white" : "bg-black"}"
                data-row="${rowIndex}" data-col="${colIndex}">
                ${
                  piece
                    ? `<span class="text-xl cursor-pointer select-none piece"
                        style="color: ${piece && color ? pieceColors[color] : "#444"}"
                        data-piece="${piece}">
                        ${figures[piece as keyof typeof figures]}
                      </span>`
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

function onMouseDown(event: MouseEvent) {
  const target = event.target as HTMLElement;
  const cell = target.closest("[data-row][data-col]") as HTMLElement;
  if (!cell) return;

  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  const { piece } = initialBoard[row][col];
  if (!piece) return;

  console.log(`Piece selected: ${piece} at [${row}, ${col}]`);

  selectedPiece = target;
  selectedRow = row;
  selectedCol = col;

  // Вычисляем смещение от верхнего левого угла клетки
  const rect = cell.getBoundingClientRect();
  offsetX = event.clientX - rect.left;
  offsetY = event.clientY - rect.top;

  // Устанавливаем фигуру в позицию absolute
  selectedPiece.style.position = "absolute";
  selectedPiece.style.zIndex = "1000";
  selectedPiece.style.left = `${event.clientX - offsetX}px`;
  selectedPiece.style.top = `${event.clientY - offsetY}px`;

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

function onMouseMove(event: MouseEvent) {
  if (!selectedPiece) return;

  // Перемещаем фигуру в новое место, с учётом смещения
  selectedPiece.style.left = `${event.clientX - offsetX}px`;
  selectedPiece.style.top = `${event.clientY - offsetY}px`;
}

function onMouseUp(event: MouseEvent) {
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", onMouseUp);

  if (!selectedPiece || selectedRow === null || selectedCol === null) return;

  const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement;
  const cell = target.closest("[data-row][data-col]") as HTMLElement;
  if (!cell) return;

  const newRow = Number(cell.dataset.row);
  const newCol = Number(cell.dataset.col);

  console.log(`Moving piece from [${selectedRow}, ${selectedCol}] to [${newRow}, ${newCol}]`);

  initialBoard[newRow][newCol] = initialBoard[selectedRow][selectedCol];
  initialBoard[selectedRow][selectedCol] = { piece: null, color: null };

  console.log("Updated board state:", initialBoard);

  // Возвращаем фигуру на её новое место
  selectedPiece.style.position = "static";
  selectedPiece.style.left = "";
  selectedPiece.style.top = "";

  renderBoard(); // Обновляем доску после перемещения фигуры

  selectedPiece = null;
  selectedRow = null;
  selectedCol = null;
}
