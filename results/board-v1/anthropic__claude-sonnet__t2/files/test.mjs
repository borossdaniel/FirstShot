import Anthropic from "@anthropic-ai/sdk";
import { weatherAnswer } from "./solution.mjs";

const client = new Anthropic();
const answer = await weatherAnswer(client, "What's the weather like in Paris right now?");
console.log("ANSWER:", answer);
