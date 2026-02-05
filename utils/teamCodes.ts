const teamCodeMap: Record<string, string> = {
  Afghanistan: "AFG",
  Australia: "AUS",
  Bangladesh: "BAN",
  Canada: "CAN",
  England: "ENG",
  India: "IND",
  Ireland: "IRE",
  Italy: "ITA",
  Namibia: "NAM",
  Nepal: "NEP",
  Netherlands: "NED",
  "New Zealand": "NZ",
  Oman: "OMA",
  Pakistan: "PAK",
  Scotland: "SCO",
  "South Africa": "SA",
  "Sri Lanka": "SL",
  "United States of America": "USA",
  "United Arab Emirates": "UAE",
  USA: "USA",
  UAE: "UAE",
  "West Indies": "WI",
  Zimbabwe: "ZIM",
  TBC: "TBC",
};

export const normalizeTeamName = (teamName: string) => {
  if (teamName === "United States of America") return "USA";
  if (teamName === "United Arab Emirates") return "UAE";
  return teamName;
};

export const teamShort = (teamName: string) => {
  const normalized = normalizeTeamName(teamName);
  return teamCodeMap[normalized] || normalized.toUpperCase().slice(0, 3);
};
