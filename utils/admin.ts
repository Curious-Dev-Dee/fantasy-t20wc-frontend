export const getAdminEmails = () => {
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
};

export const isAdminEmail = (email?: string | null) => {
  if (!email) return false;
  const admins = getAdminEmails();
  if (admins.length === 0) return false;
  return admins.includes(email.toLowerCase());
};
