## Skippable Tour Branch

This branch contains an opt-in footer skip button for tours.

- Adds `showButtons: ["skip", "previous", "next"]`
- Adds `skipBtnText` for configuring the skip label
- Adds `onSkipClick` for custom skip behavior
- Keeps forced tours intact by hiding skip when `allowClose: false`
- Documents the new option and adds a local demo example

## StackBlitz

After this branch is pushed to your GitHub fork, open it in StackBlitz with:

```text
https://stackblitz.com/github/<your-github-username>/driver.js/tree/feat/footer-skip-button?file=index.html
```

For the `milkatx` account:

```text
https://stackblitz.com/github/milkatx/driver.js/tree/feat/footer-skip-button?file=index.html
```

This URL works only after `feat/footer-skip-button` exists on the public fork.

## Verification

- `pnpm install --frozen-lockfile`
- `pnpm vitest run`
- `pnpm build`
