// Plain DOM helpers shared by the home-page examples script and the CodeSample
// component. Kept in a framework-free module so it can be imported from vanilla
// Astro <script> tags without pulling in React (which would otherwise trip the
// @vitejs/plugin-react dev preamble guard and crash the script).

export function removeDummyElement() {
  const el = document.querySelector(".dynamic-el");
  if (el) {
    el.remove();
  }
}

export function mountDummyElement() {
  const newDiv = (document.querySelector(".dynamic-el") || document.createElement("div")) as HTMLElement;

  newDiv.innerHTML = "This is a new Element";
  newDiv.style.display = "block";
  newDiv.style.padding = "20px";
  newDiv.style.backgroundColor = "black";
  newDiv.style.color = "white";
  newDiv.style.fontSize = "14px";
  newDiv.style.position = "fixed";
  newDiv.style.top = `${Math.random() * (500 - 30) + 30}px`;
  newDiv.style.left = `${Math.random() * (500 - 30) + 30}px`;
  newDiv.className = "dynamic-el";

  document.body.appendChild(newDiv);
}
