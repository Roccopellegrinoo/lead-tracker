import { uid, clean, dateKey } from "./utils";

export const SK_LEADS = "crm-v2-leads";
export const SK_INTS = "crm-v2-interactions";
export const SK_USERS = "crm-v2-users";
export const SK_SESSION = "crm-v2-current-user";
export const SK_CLOUD_TOKEN = "crm-v2-cloud-token";

export const lsGet = (key) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
};

export const lsSet = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
};

export const crmStorageKeys = () => Object.keys(localStorage).filter(k => k.startsWith("crm-v2") && k !== SK_CLOUD_TOKEN);

export const makeStorageBackup = () => ({
  app: "lead-tracker",
  version: 1,
  exportedAt: new Date().toISOString(),
  data: Object.fromEntries(crmStorageKeys().map(key => [key, localStorage.getItem(key)])),
});

export const downloadStorageBackup = () => {
  const backup = makeStorageBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lead-tracker-backup-${dateKey(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const restoreBackupData = (backup) => {
  const data = backup?.data;
  if (!data || typeof data !== "object") throw new Error("Backup invalido");
  crmStorageKeys().forEach(key => localStorage.removeItem(key));
  Object.entries(data).forEach(([key, value]) => {
    if (key.startsWith("crm-v2") && typeof value === "string") localStorage.setItem(key, value);
  });
};

export const restoreStorageBackup = async (file) => {
  const text = await file.text();
  const backup = JSON.parse(text);
  restoreBackupData(backup);
};

export const getCloudToken = () => localStorage.getItem(SK_CLOUD_TOKEN) || "";
export const setCloudToken = (token) => localStorage.setItem(SK_CLOUD_TOKEN, token);
export const clearCloudToken = () => localStorage.removeItem(SK_CLOUD_TOKEN);

export const cloudRequest = async (method, token, payload) => {
  const response = await fetch("/api/state", {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-tracker-token": token,
    },
    body: method === "PUT" ? JSON.stringify({ payload }) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo sincronizar");
  return data;
};

export const fetchCloudBackup = (token) => cloudRequest("GET", token);
export const saveCloudBackup = (token) => cloudRequest("PUT", token, makeStorageBackup());

export const userLeadsKey = (userId) => `${SK_LEADS}:${userId}`;
export const userIntsKey = (userId) => `${SK_INTS}:${userId}`;

export const makeUser = ({ name, pin }) => ({
  id: uid(),
  name: clean(name),
  pin: clean(pin),
  createdAt: new Date().toISOString(),
});
