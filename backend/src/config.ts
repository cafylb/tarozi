import { z } from 'zod';

export const configSchema = z.object({
  SUPABASE_URL: z.url().default('http://127.0.0.1:54321'),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('127.0.0.1'),
  CORS_ORIGINS: z.string().default('http://localhost:4173,http://127.0.0.1:4173,http://localhost:3000,http://localhost:5173'),
  AUTH_REDIRECT_URL: z.url().default('http://localhost:4173/'),
  INCLUDE_DEMO_DATA: z.enum(['true','false']).default('false'),
});
export type Config = z.infer<typeof configSchema>;
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config { return configSchema.parse(env); }
