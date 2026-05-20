import { PRODUCTS, NAME_STOPWORDS } from "./constants";

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

export const dateInDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const daysAgo = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null;

export const isOverdue = (d) => d ? new Date(d) < new Date(new Date().toDateString()) : false;

export const isToday = (d) => d ? new Date(d).toDateString() === new Date().toDateString() : false;

export const isTomorrow = (d) => {
  if (!d) return false;
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return new Date(d).toDateString() === t.toDateString();
};

export const fmt = (d) => d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "";

export const fmtFull = (d) => d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";

export const fmtMoney = (n) => n ? `$${Number(n).toLocaleString("es-AR")}` : "";

export const dateKey = (d) => {
  if (!d) return "";
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const monthLabel = (d) => d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

export const sameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

export const addMonths = (date, count) => new Date(date.getFullYear(), date.getMonth() + count, 1);

export const calendarDays = (monthDate) => {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const mondayIndex = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayIndex);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

export const clean = (v) => (v || "").toString().trim();

export const cleanAmount = (v) => clean(v).replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");

export const titleName = (value) => clean(value)
  .toLowerCase()
  .split(/\s+/)
  .map(word => word ? word[0].toUpperCase() + word.slice(1) : "")
  .join(" ");

export const normalizeEmail = (value) => clean(value)
  .toLowerCase()
  .replace(/\s*@\s*/g, "@")
  .replace(/\s*\.\s*/g, ".")
  .replace(/[,;:]+/g, ".")
  .replace(/\.comm\b/g, ".com")
  .replace(/\.con\b/g, ".com")
  .replace(/\.corm\b/g, ".com")
  .replace(/@gmai[il]\./g, "@gmail.")
  .replace(/@hotmai[il]\./g, "@hotmail.");

export const extractEmailValue = (value) => {
  const text = normalizeEmail(value);
  const direct = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0];
  if (direct) return normalizeEmail(direct);

  const compact = text.replace(/\s+/g, "").replace(/[^a-z0-9._%+-]/g, "");
  const repaired = compact.match(/([a-z0-9._%+-]{2,})(gmail|gmaiil|hotmail|hotmaiil|yahoo|outlook|icloud)(comar|com|net|org|es)$/i);
  if (!repaired) return "";
  const domain = repaired[2].replace("gmaiil", "gmail").replace("hotmaiil", "hotmail");
  const suffix = repaired[3] === "comar" ? "com.ar" : repaired[3];
  return `${repaired[1]}@${domain}.${suffix}`;
};

export const extractPhoneValue = (value) => {
  const matches = clean(value).match(/(?:\+\s*)?(?:\(?\d{1,4}\)?[\s.-]*){3,}\d/g) || [];
  const phones = matches
    .map(v => clean(v).replace(/\s+/g, " "))
    .filter(v => {
      const digits = v.replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 16;
    })
    .sort((a, b) => b.replace(/\D/g, "").length - a.replace(/\D/g, "").length);
  return phones[0] || "";
};

export const loadImageMeta = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const meta = { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
    URL.revokeObjectURL(url);
    resolve(meta);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error("No se pudo leer la imagen"));
  };
  img.src = url;
});

export function getTemp(lead, interactions) {
  if (["invertido", "perdido"].includes(lead.stage)) return null;
  const d = daysAgo(lead.lastContact);
  const intCount = interactions.filter(i => i.leadId === lead.id && daysAgo(i.date) <= 7).length;
  if (lead.stage === "propuesta" || lead.stage === "interesado") {
    if (d !== null && d <= 3) return "hot";
    if (d !== null && d <= 7) return "warm";
    return "cold";
  }
  if (d === null) return daysAgo(lead.createdAt) <= 2 ? "warm" : "cold";
  if (d <= 3 && intCount >= 1) return "hot";
  if (d <= 7) return "warm";
  return "cold";
}

export function makeLead(data) {
  return {
    id: uid(),
    name: clean(data.name),
    phone: clean(data.phone),
    email: clean(data.email),
    product: clean(data.product),
    amount: cleanAmount(data.amount),
    channel: clean(data.channel) || "Sendis",
    followUpDate: data.followUpDate || dateInDays(0),
    notes: clean(data.notes),
    createdAt: new Date().toISOString(),
    stage: data.stage || "nuevo",
    attempts: 0,
  };
}

export function classifyLead(lead) {
  const hasContact = Boolean(lead.phone || lead.email);
  const amount = parseFloat(lead.amount) || 0;
  if (lead.name && /Nombre detectado desde captura/.test(lead.notes || "")) return { bucket: "ready", priority: "Media", reason: "Nombre detectado desde captura" };
  if (!lead.name || !hasContact) return { bucket: lead.name || hasContact ? "review" : "invalid", priority: "Baja", reason: "Faltan datos clave" };
  if (amount >= 250000 || lead.product) return { bucket: "ready", priority: "Alta", reason: "Tiene contacto y oportunidad identificada" };
  return { bucket: "ready", priority: "Media", reason: "Tiene datos suficientes para seguimiento" };
}
