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
let offsetY = 0; // Сдвиг фигуры от курсора

const initialBoard: (string | null)[][] = [
  ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"], // Чёрные фигуры
  Array(8).fill("pawn"), // Чёрные пешки
  Array(8).fill(null), // Пустые клетки
  Array(8).fill(null),
  Array(8).fill(null),
  Array(8).fill(null),
  Array(8).fill("pawn"), // Белые пешки
  ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"], // Белые фигуры
];

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.classList.add("flex", "justify-center", "items-center", "h-screen", "bg-gray-200");
  renderBoard();
} else {
  console.error("Элемент #app не найден!");
}

function renderBoard() {
  if (!app) return;

  app.innerHTML = `
    <div class="grid grid-cols-8 border-4 border-gray-800">
      ${initialBoard
        .flatMap((row, rowIndex) =>
          row.map(
            (piece, colIndex) => `
              <div class="relative flex items-center justify-center w-10 h-10
                ${(rowIndex + colIndex) % 2 === 0 ? "bg-white" : "bg-black"}"
                data-row="${rowIndex}" data-col="${colIndex}">
                ${
                  piece
                    ? `<span class="text-xl cursor-pointer select-none"
                        style="color: ${
                          rowIndex < 2 ? "#DAA520" : "#444"
                        }">
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

  // Добавляем обработчик события для мousedown
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
  const piece = initialBoard[row][col];
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
  initialBoard[selectedRow][selectedCol] = null;

  console.log("Updated board state:", initialBoard);

  // Возвращаем фигуру на её новое место
  selectedPiece.style.position = "static";
  selectedPiece.style.left = "";
  selectedPiece.style.top = "";

  renderBoard(); // Можно будет обновить доску (если нужно)

  selectedPiece = null;
  selectedRow = null;
  selectedCol = null;
}
