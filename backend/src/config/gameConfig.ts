import { z } from "zod";

export const crashDistributionBucketSchema = z.object({
  weight: z.number().positive(),
  minMultiplier: z.string(),
  maxMultiplier: z.string()
});

export const crashConfigSchema = z.object({
  gameKey: z.literal("crash"),
  houseEdgeBps: z.number().int().min(0).max(10_000),
  minBetMinor: z.string(),
  maxBetMinor: z.string(),
  bettingWindowMs: z.number().int().positive(),
  tickIntervalMs: z.number().int().positive(),
  crashDistribution: z.array(crashDistributionBucketSchema).min(1)
});

export const appConfigSchema = z.object({
  crash: crashConfigSchema
});

export type CrashConfig = z.infer<typeof crashConfigSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;

export const defaultCrashConfig: CrashConfig = {
  gameKey: "crash",
  houseEdgeBps: 100,
  minBetMinor: "100",
  maxBetMinor: "100000000",
  bettingWindowMs: 8_000,
  tickIntervalMs: 100,
  crashDistribution: [
    { weight: 60, minMultiplier: "1.00", maxMultiplier: "2.00" },
    { weight: 25, minMultiplier: "2.00", maxMultiplier: "5.00" },
    { weight: 10, minMultiplier: "5.00", maxMultiplier: "20.00" },
    { weight: 4, minMultiplier: "20.00", maxMultiplier: "100.00" },
    { weight: 1, minMultiplier: "100.00", maxMultiplier: "1000.00" }
  ]
};

export const defaultAppConfig: AppConfig = {
  crash: defaultCrashConfig
};

export function loadConfig(input: unknown = defaultAppConfig): AppConfig {
  return appConfigSchema.parse(input);
}
