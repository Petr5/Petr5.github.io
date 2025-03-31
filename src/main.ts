import "./index.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.innerHTML = `
    <div class="flex justify-center items-center h-screen bg-gray-200">
      <div class="grid grid-cols-8 w-64 h-64 border-4 border-gray-800">
        ${Array.from({ length: 64 })
          .map(
            (_, i) => `
            <div class="w-8 h-8 ${
              (Math.floor(i / 8) + (i % 8)) % 2 === 0 ? "bg-white" : "bg-gray-800"
            }"></div>
          `
          )
          .join("")}
      </div>
    </div>
  `;
} else {
  console.error("Элемент #app не найден!");
}
