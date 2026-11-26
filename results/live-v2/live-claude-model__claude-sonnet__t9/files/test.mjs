import { summarize } from "./ai.mjs";

const sample = `The Node.js runtime uses an event-driven, non-blocking I/O model that makes it lightweight and efficient, particularly for data-intensive real-time applications. It is built on Chrome's V8 JavaScript engine and runs JavaScript code outside of a web browser.`;

const result = await summarize(sample);
console.log("SUMMARY:", result);
