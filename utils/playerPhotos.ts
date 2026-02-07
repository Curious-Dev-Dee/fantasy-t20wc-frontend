const PLAYER_PHOTO_OVERRIDES: Record<string, string> = {
  "suryakumar-yadav-1":
    "https://upload.wikimedia.org/wikipedia/commons/c/c4/Suryakumar_Yadav_%281%29.jpg",
  "jasprit-bumrah-12":
    "https://upload.wikimedia.org/wikipedia/commons/a/ac/Jasprit_Bumrah.jpg",
  "hardik-pandya-5":
    "https://upload.wikimedia.org/wikipedia/commons/5/5b/Hardik_Pandya_%28cropped%29.jpg",
  "jos-buttler-85":
    "https://upload.wikimedia.org/wikipedia/commons/7/7f/Jos_buttler.JPG",
  "rashid-khan-141":
    "https://upload.wikimedia.org/wikipedia/commons/7/71/Rashid_Khan.jpg",
};

export const getPlayerPhotoUrl = (playerId: string) =>
  PLAYER_PHOTO_OVERRIDES[playerId] ?? null;
