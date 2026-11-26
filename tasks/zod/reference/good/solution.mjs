import { z } from 'zod';

export const UserSchema = z.object({
  email: z.email(),
  age: z.int().min(13),
  tags: z.array(z.string()).default([]),
});

export function parseUser(input) {
  const r = UserSchema.safeParse(input);
  if (r.success) return { ok: true, user: r.data };
  const fields = z.flattenError(r.error).fieldErrors;
  const errors = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v[0]]));
  return { ok: false, errors };
}
