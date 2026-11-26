import { createApp } from "./solution.mjs";

const app = createApp();
const server = app.listen(3917, () => {
  console.log("listening");
});

process.on("SIGTERM", () => server.close());
