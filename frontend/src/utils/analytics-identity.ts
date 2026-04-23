// utils/analytics-identity.ts
export const getAnonymousId = () => {
  const key = "soundwave_anon_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `guest_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
};
