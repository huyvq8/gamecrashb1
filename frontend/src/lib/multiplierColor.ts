export type MultiplierHue = "white" | "green" | "blue" | "yellow" | "orange" | "red" | "purple";

export function getMultiplierColor(value: number): MultiplierHue {
  if (!Number.isFinite(value)) return "white";
  if (value < 1.5) return "white";              // 1.00 - 1.49
  if (value < 2.0) return "green";              // 1.50 - 1.99
  if (value < 5.0) return "blue";               // 2.00 - 4.99
  if (value < 10.0) return "yellow";            // 5.00 - 9.99
  if (value < 25.0) return "orange";            // 10.00 - 24.99
  if (value < 100.0) return "red";              // 25.00 - 99.99
  return "purple";                              // 100.00+
}

