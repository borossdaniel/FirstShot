import { z } from 'zod';
export const UserSchema = z.object({ email: z.email(), age: z.int().min(13), tags: z.array(z.string()).default([]) });
// Returns Zod's raw arrays instead of one message per field.
export function parseUser(input) {
  const r = UserSchema.safeParse(input);
  if (r.success) return { ok: true, user: r.data };
  return { ok: false, errors: z.flattenError(r.error).fieldErrors };
}
