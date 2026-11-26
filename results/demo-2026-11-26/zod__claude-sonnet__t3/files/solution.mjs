import { z } from "zod";

export const UserSchema = z.object({
  email: z.email(),
  age: z.int().min(13),
  tags: z.array(z.string()).optional().default([]),
});

export function parseUser(input) {
  const result = UserSchema.safeParse(input);

  if (result.success) {
    return { ok: true, user: result.data };
  }

  const fieldErrors = z.flattenError(result.error).fieldErrors;
  const errors = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    errors[field] = messages[0];
  }

  return { ok: false, errors };
}
