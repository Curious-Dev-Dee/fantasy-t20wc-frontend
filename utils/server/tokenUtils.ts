export const extractBearerToken = (authHeader: string): string => {
  if (!authHeader || typeof authHeader !== "string") {
    return "";
  }
  
  const trimmed = authHeader.trim();
  const bearerPrefix = "Bearer ";
  
  if (!trimmed.startsWith(bearerPrefix)) {
    return "";
  }
  
  const token = trimmed.slice(bearerPrefix.length).trim();
  
  // Basic validation: token should not be empty and not contain whitespace
  if (!token || /\s/.test(token)) {
    return "";
  }
  
  return token;
};
