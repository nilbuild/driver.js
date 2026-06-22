export type Example = {
  // Unique slug, used as the example's URL (/highlight-simple) and DOM hook.
  id: string;
  // Sidebar label.
  title: string;
  // One-line explanation shown above the stage.
  description: string;
  // Runs the example against the shared demo stage.
  run: () => void;
};

export type ExampleGroup = {
  title: string;
  examples: Example[];
};
