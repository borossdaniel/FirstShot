import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

const MODEL = "gpt-5.2";

const ClassificationSchema = z.object({
  label: z.enum(["spam", "ham"]),
});

export async function ask(client, question) {
  const response = await client.responses.create({
    model: MODEL,
    input: question,
  });
  return response.output_text;
}

export async function classify(client, text) {
  const response = await client.responses.parse({
    model: MODEL,
    input: [
      {
        role: "user",
        content: `Classify the following text as spam or ham.\n\n${text}`,
      },
    ],
    text: {
      format: zodTextFormat(ClassificationSchema, "classification"),
    },
  });
  return response.output_parsed;
}
