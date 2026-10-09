export const DEFAULT_CJ_COLOR = "#1A4FBF";
export const FIXED_PERIODS = new Set([1, 7, 8]);

export function courseColor(subject, period) {
  if (!subject || FIXED_PERIODS.has(Number(period))) return DEFAULT_CJ_COLOR;
  return subject.color || DEFAULT_CJ_COLOR;
}

export function colorTint(color, strength = 0.18) {
  const value = String(color || DEFAULT_CJ_COLOR).replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return "rgb(214, 225, 247)";
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  const mix = (channel) => Math.round(255 - ((255 - channel) * strength));
  return `rgb(${mix(red)}, ${mix(green)}, ${mix(blue)})`;
}
