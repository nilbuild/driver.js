<h1 align="center"><img height="150" src="https://driverjs.com/driver.svg" /><br> Driver.js</h1>

<p align="center">
  <a href="https://github.com/kamranahmedse/driver.js/blob/master/license">
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
  <b>Powerful, highly customizable library for Product Tours and Feature Introductions</b></br>
  <sub>No external dependencies, light-weight, supports all major browsers and highly customizable </sub><br>
</p>

<br />

- **Simple**: is simple to use and has no external dependency at all
- **Light-weight**: is just 5kb gzipped as compared to other libraries which are +12kb gzipped
- **Highly customizable**: has a powerful API and can be used however you want
- **Highlight anything**: highlight any (literally any) element on page
- **Feature introductions**: create powerful feature introductions for your web applications
- **Focus shifters**: add focus shifters for users
- **User friendly**: Everything is controllable by keyboard
- **TypeScript**: Written in TypeScript
- **Consistent behavior**: usable across all browsers
- **MIT Licensed**: free for personal and commercial use

<br />

## Documentation

For demos and documentation, visit [driverjs.com](https://driverjs.com)

<br />

## So, yet another tour library?

**No**, it's more than a tour library. **Tours are just one of the many use-cases**. Driver.js can be used wherever you need some sort of overlay for the page; some common usecases could be: highlighting a page component when user is interacting with it to keep them focused, providing contextual help e.g. popover with dimmed background when user is filling a form, using it as a focus shifter to bring user's attention to some component on page, using it to simulate those "Turn off the Lights" widgets that you might have seen on video players online, usage as a simple modal, and of-course product tours etc.

Driver.js is written in Vanilla TypeScript, has zero dependencies and is highly customizable. It has several options allowing you to change how it behaves and also **provides you the hooks** to manipulate the elements as they are highlighted, about to be highlighted, or deselected.

> Also, comparing the size of Driver.js with other libraries, it's the most light-weight, it is **just ~5kb gzipped** while others are 12kb+.

<br>

## Developing locally

The library lives in `src/`. To try your changes against a set of live examples, run the playground — an Astro app in `playground/` that imports the library straight from source, so edits hot-reload instantly:

```sh
pnpm install                 # install the library's dev dependencies
pnpm run playground:install  # one-time install of the playground's dependencies
pnpm dev                     # start the playground
```

Each example lives in its own file under `playground/src/examples/` and shows up as a page in the sidebar. To add one, drop an entry into the relevant group (`highlight.ts`, `popover.ts`, `tour.ts`, `api.ts`).

Other useful scripts:

```sh
pnpm build   # type-check and build the distributable library into dist/
pnpm test    # run the unit tests (Vitest)
```

## Contributions

Feel free to submit pull requests, create issues or spread the word.

## License

MIT &copy; [Kamran Ahmed](https://twitter.com/kamrify)
