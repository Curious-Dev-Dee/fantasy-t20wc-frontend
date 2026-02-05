import { normalizeTeamName } from "./teamCodes";

const flagMap: Record<string, string> = {
  Afghanistan: "🇦🇫",
  Australia: "🇦🇺",
  Bangladesh: "🇧🇩",
  Canada: "🇨🇦",
  England: "🏴",
  India: "🇮🇳",
  Ireland: "🇮🇪",
  Italy: "🇮🇹",
  Namibia: "🇳🇦",
  Nepal: "🇳🇵",
  Netherlands: "🇳🇱",
  "New Zealand": "🇳🇿",
  Oman: "🇴🇲",
  Pakistan: "🇵🇰",
  Scotland: "🏴",
  "South Africa": "🇿🇦",
  "Sri Lanka": "🇱🇰",
  "United States of America": "🇺🇸",
  "United Arab Emirates": "🇦🇪",
  USA: "🇺🇸",
  UAE: "🇦🇪",
  "West Indies": "🏝️",
  Zimbabwe: "🇿🇼",
  TBC: "🌍",
};

export const teamFlag = (teamName: string) => {
  const normalized = normalizeTeamName(teamName);
  return flagMap[normalized] || "🏳️";
};
