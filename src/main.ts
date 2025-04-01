import "./index.css";

const figures = {
  pawn: "♙",
  rook: "♖",
  knight: "♘",
  bishop: "♗",
  queen: "♕",
  king: "♔",
};

const initialBoard: (string | null)[][] = [
  ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"], // Чёрные фигуры
  Array(8).fill("pawn"), // Чёрные пешки
  ...Array(4).fill(Array(8).fill(null)), // Пустые клетки
  Array(8).fill("pawn"), // Белые пешки
  ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"], // Белые фигуры
];

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.classList.add("flex", "justify-center", "items-center", "h-screen", "bg-gray-200");

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
                          rowIndex < 2 ? "#DAA520" : "#444" // Чёрные фигуры - золотые, белые - тёмно-серые
                        }">
                        ${figures[piece as keyof typeof figures]}
                      </span>`
                    : ""
                }
              </div>
            `
          )
        )
        .join("")}
    </div>
  `;


  console.log("Added chessboard with pieces to #app");
} else {
  console.error("Элемент #app не найден!");
}
