import { avatarSrc } from "../avatar";

export const AVATAR_PRESETS = [
  { id: "oak", label: "Oak" },
  { id: "gym", label: "Gym" },
  { id: "book", label: "Book" },
  { id: "dorm", label: "Dorm" },
  { id: "bus", label: "Bus" },
  { id: "night", label: "Night" },
];

export function Avatar({ avatar, size = 32, className = "" }) {
  return (
    <img
      src={avatarSrc(avatar)}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 bg-[#D6DEEE] object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
