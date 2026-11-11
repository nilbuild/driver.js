<br /><br />

<h1 align="center"><img height="150" src="https://driverjs.com/mascot-head.png?v=1" /><br> Driver.js</h1>

<p align="center">
  <a href="https://github.com/nilbuild/driver.js/blob/master/license">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" />
  </a>
  <a href="https://www.jsdelivr.com/package/npm/driver.js">
    <img src="https://data.jsdelivr.com/v1/package/npm/driver.js/badge?style=rounded" alt="jsdelivr hits" />
  </a>
  <a href="https://npmjs.org/package/driver.js">
    <img src="https://img.shields.io/npm/dm/driver.js" alt="downloads" />
  </a>
</p>

<p align="center">
  <b>Product tours, highlights, hints and onboarding checklists for the web</b><br>
  <sub>No dependencies, written in TypeScript, works with any framework</sub>
</p>

<br />

- **Tours**: walk users through your app step by step
- **Action-driven steps**: wait for the user to click, type or pick, and give feedback on wrong actions
- **Highlights**: dim the page around any element, with or without a popover
- **Hints**: pulsing beacons that open a popover on click, without blocking the page
- **Checklists**: an onboarding widget whose items start tours and tick themselves off
- **Accessible**: keyboard control, focus management and screen reader announcements
- **Themeable**: plain CSS classes and variables
- **MIT licensed**: free for personal and commercial use

## Install

```sh
npm install driver.js
```

## Usage

```js
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const driverObj = driver({
  showProgress: true,
  steps: [
    { element: "#search", popover: { title: "Search", description: "Find anything from here." } },
    { element: "#new-project", popover: { title: "New project", description: "Start your first project." } },
  ],
});

driverObj.drive();
```

Highlight a single element:

```js
driverObj.highlight({
  element: "#search",
  popover: { title: "Search", description: "Find anything from here." },
});
```

Make a step wait for the user:

```js
const driverObj = driver({
  steps: [
    {
      element: "#new-project",
      advanceOn: "click",
      popover: { title: "Start a project", instruction: "Click <b>New project</b>." },
    },
    {
      element: "#project-name",
      waitForElement: 3000,
      popover: { title: "Name it", description: "Give your project a name." },
    },
  ],
});
```

Hints and checklists are separate entries: `driver.js/hints` and `driver.js/checklist`.

## Documentation

Guides, live demos and the full reference are on [driverjs.com](https://driverjs.com/docs/installation).

## Developing locally

This is a pnpm monorepo. The library is in `packages/driver`, the playground in `apps/playground` and the docs site in `apps/docs`. Both apps import the library from source, so changes show up right away.

```sh
pnpm install
pnpm dev        # Playground
pnpm docs:dev   # Docs site
pnpm test       # Unit tests, in watch mode
pnpm test:e2e   # Playwright tests against the playground
pnpm build
```

Playground examples live in `apps/playground/src/examples`.

## Contributions

Pull requests and issues are welcome.

## License

MIT &copy; [Kamran Ahmed](https://twitter.com/nilbuild)
