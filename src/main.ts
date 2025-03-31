import "./index.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.classList.add("flex", "justify-center", "items-center", "h-screen", "bg-gray-200");

  app.innerHTML = `
    <div class="grid grid-cols-8 border-4 border-gray-800">
      ${Array.from({ length: 64 })
        .map(
          (_, i) => `
            <div style="width: 40px; height: 40px; display: inline-block;"
              class="${(Math.floor(i / 8) + (i % 8)) % 2 === 0 ? "bg-white" : "bg-black"}">
            </div>
          `
        )
        .join("")}
    </div>
  `;
  console.log("Added chessboard to #app");
} else {
  console.error("Элемент #app не найден!");
}
