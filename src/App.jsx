import { useCallback, useEffect, useMemo, useState } from "react";
import { createWorker } from "tesseract.js";

const SK_LEADS = "crm-v2-leads";
const SK_INTS = "crm-v2-interactions";
const SK_USERS = "crm-v2-users";
const SK_SESSION = "crm-v2-current-user";

const STAGES = [
  { id: "nuevo", label: "Nuevo", color: "#2563eb", icon: "◉" },
  { id: "contactado", label: "Contactado", color: "#fbbf24", icon: "◆" },
  { id: "interesado", label: "Interesado", color: "#10b981", icon: "▲" },
  { id: "propuesta", label: "Propuesta", color: "#0ea5e9", icon: "■" },
  { id: "invertido", label: "Invertido", color: "#16a34a", icon: "★" },
  { id: "perdido", label: "Perdido", color: "#ef4444", icon: "✕" },
];

const CHANNELS = ["WhatsApp", "Llamada", "Email", "Presencial", "Sendis"];
const PRODUCTS = ["Crowdium", "TechFinance"];
const LOSS_REASONS = ["No interesado", "Fue con la competencia", "No califica", "Sin respuesta", "Timing malo", "Otro"];
const QUICK_ACTIONS = [
  { id: "no_atendio", label: "No atendió", icon: "☎", type: "No atendió" },
  { id: "llamar_despues", label: "Llamar mañana", icon: "↗", type: "Llamar después" },
  { id: "contactado", label: "Contactado", icon: "✓", type: "Contacto realizado" },
];
const FOLLOW_UP_PRESETS = [
  { label: "Hoy", days: 0 },
  { label: "Mañana", days: 1 },
  { label: "+7 días", days: 7 },
  { label: "+10 días", days: 10 },
];

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
const dateInDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const daysAgo = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null;
const isOverdue = (d) => d ? new Date(d) < new Date(new Date().toDateString()) : false;
const isToday = (d) => d ? new Date(d).toDateString() === new Date().toDateString() : false;
const isTomorrow = (d) => {
  if (!d) return false;
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return new Date(d).toDateString() === t.toDateString();
};
const fmt = (d) => d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "";
const fmtFull = (d) => d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";
const fmtMoney = (n) => n ? `$${Number(n).toLocaleString("es-AR")}` : "";
const clean = (v) => (v || "").toString().trim();
const cleanAmount = (v) => clean(v).replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
const titleName = (value) => clean(value)
  .toLowerCase()
  .split(/\s+/)
  .map(word => word ? word[0].toUpperCase() + word.slice(1) : "")
  .join(" ");
const normalizeEmail = (value) => clean(value)
  .toLowerCase()
  .replace(/\s*@\s*/g, "@")
  .replace(/\s*\.\s*/g, ".")
  .replace(/[,;:]+/g, ".")
  .replace(/\.comm\b/g, ".com")
  .replace(/\.con\b/g, ".com")
  .replace(/\.corm\b/g, ".com")
  .replace(/@gmai[il]\./g, "@gmail.")
  .replace(/@hotmai[il]\./g, "@hotmail.");
const extractEmailValue = (value) => {
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
const extractPhoneValue = (value) => {
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
const loadImageMeta = (file) => new Promise((resolve, reject) => {
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
const NAME_STOPWORDS = [
  "nombre", "apellido", "telefono", "teléfono", "tel", "cel", "celular", "whatsapp", "mail", "email",
  "producto", "monto", "capital", "inversion", "inversión", "lead", "cliente", "contacto", "fecha",
  "estado", "origen", "observacion", "observación", "nota", "notas", "nuevo", "interesado",
  "contactado", "propuesta", "crowdium", "techfinance", "sendis", "usd", "ars", "contesta", "alas", "las",
  "vencidos", "contactar", "ya", "sin", "fu"
];

function getTemp(lead, interactions) {
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

const TEMP = {
  hot: { label: "🔥", name: "Caliente", color: "#ef4444", bg: "#ef444415" },
  warm: { label: "🟡", name: "Tibio", color: "#f59e0b", bg: "#f59e0b15" },
  cold: { label: "🧊", name: "Frío", color: "#6366f1", bg: "#6366f115" },
};

const lsGet = (key) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
};
const lsSet = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
};
const userLeadsKey = (userId) => `${SK_LEADS}:${userId}`;
const userIntsKey = (userId) => `${SK_INTS}:${userId}`;
const makeUser = ({ name, pin }) => ({
  id: uid(),
  name: clean(name),
  pin: clean(pin),
  createdAt: new Date().toISOString(),
});

function makeLead(data) {
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

function classifyLead(lead) {
  const hasContact = Boolean(lead.phone || lead.email);
  const amount = parseFloat(lead.amount) || 0;
  if (lead.name && /Nombre detectado desde captura/.test(lead.notes || "")) return { bucket: "ready", priority: "Media", reason: "Nombre detectado desde captura" };
  if (!lead.name || !hasContact) return { bucket: lead.name || hasContact ? "review" : "invalid", priority: "Baja", reason: "Faltan datos clave" };
  if (amount >= 250000 || lead.product) return { bucket: "ready", priority: "Alta", reason: "Tiene contacto y oportunidad identificada" };
  return { bucket: "ready", priority: "Media", reason: "Tiene datos suficientes para seguimiento" };
}

function getOcrWordBox(word) {
  const box = word?.bbox || word || {};
  const x0 = Number(box.x0 ?? box.left ?? box.x ?? 0);
  const y0 = Number(box.y0 ?? box.top ?? box.y ?? 0);
  const x1 = Number(box.x1 ?? (box.left ?? box.x ?? 0) + (box.width ?? 0));
  const y1 = Number(box.y1 ?? (box.top ?? box.y ?? 0) + (box.height ?? 0));
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, h: Math.max(1, y1 - y0) };
}

function getOcrWords(data) {
  if (Array.isArray(data?.words)) return data.words;
  return (data?.blocks || [])
    .flatMap(block => block.paragraphs || [])
    .flatMap(paragraph => paragraph.lines || [])
    .flatMap(line => line.words || []);
}

function buildOcrRows(data) {
  const words = getOcrWords(data)
    .map(word => ({ text: clean(word.text), ...getOcrWordBox(word) }))
    .filter(word => word.text && word.x1 > word.x0 && word.y1 > word.y0)
    .sort((a, b) => a.cy - b.cy || a.x0 - b.x0);

  const rows = [];
  words.forEach(word => {
    const tolerance = Math.max(10, Math.min(24, word.h * 1.2));
    let row = rows.find(item => Math.abs(item.cy - word.cy) <= tolerance);
    if (!row) {
      row = { cy: word.cy, words: [] };
      rows.push(row);
    }
    row.words.push(word);
    row.cy = row.words.reduce((sum, item) => sum + item.cy, 0) / row.words.length;
  });

  return rows
    .map(row => ({ ...row, words: row.words.sort((a, b) => a.x0 - b.x0) }))
    .sort((a, b) => a.cy - b.cy);
}

function cleanOcrNameToken(token) {
  const text = clean(token).replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  const lower = text.toLowerCase();
  if (!text || text.length < 2) return "";
  if (/^#?\d+$/.test(token)) return "";
  if (NAME_STOPWORDS.includes(lower)) return "";
  if (/^(no|a|e|o|de|del|la|el|los|las|com|con)$/i.test(text)) return "";
  if (/(gmail|hotmail|yahoo|outlook|icloud)/i.test(text)) return "";
  return text;
}

function extractClientNameFromText(text) {
  const normalized = clean(text).replace(/\s+/g, " ");
  const withoutHeader = normalized.replace(/\b(cliente|etiqueta|email|fecha|asignacion|monto|responsable|telefono)\b/ig, " ");
  const beforeId = withoutHeader.match(/([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ' -]{2,80})\s+#?\d{4,}/u)?.[1];
  const beforeStatus = withoutHeader.match(/([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ' -]{2,80})\s+(?:No\s+contesta|Contesta)\b/u)?.[1];
  const uppercaseOnly = withoutHeader.match(/\b([A-ZÁÉÍÓÚÜÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÜÑ]{2,}){0,3})\b/u)?.[1];
  const raw = beforeId || beforeStatus || uppercaseOnly || "";
  const words = raw
    .split(/\s+/)
    .map(cleanOcrNameToken)
    .filter(Boolean)
    .filter(word => /^[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ' -]*$/u.test(word));
  return titleName(words.slice(0, 4).join(" ")).slice(0, 48).trim();
}

function namesOnlyFromOcrText(text) {
  const seen = new Set();
  return clean(text)
    .split(/\r?\n/)
    .map(line => extractClientNameFromText(line))
    .filter(Boolean)
    .filter(name => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function namesOnlyFromOcrData(data) {
  const rows = buildOcrRows(data);
  const seen = new Set();
  return rows
    .map(row => row.words.map(word => word.text).join(" "))
    .map(line => extractClientNameFromText(line))
    .filter(Boolean)
    .filter(name => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function namesToBulkText(names) {
  return names.map(name => [name, "", "", "", "", "Nombre detectado desde captura"].join("\t")).join("\n");
}

function extractOcrName(words, rowText, maxX) {
  const leftLimit = maxX * 0.19;
  const leftText = words.filter(word => word.cx <= leftLimit).map(word => word.text).join(" ");
  const nameWithId = extractClientNameFromText(leftText) || extractClientNameFromText(rowText);
  if (nameWithId) return nameWithId;

  const leftWords = words
    .filter(word => word.cx <= leftLimit)
    .map(word => cleanOcrNameToken(word.text))
    .filter(Boolean)
    .filter(word => /^[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ' -]*$/u.test(word));
  if (leftWords.length > 0) return titleName(leftWords.slice(0, 4).join(" ")).slice(0, 48).trim();
  return "";
}

function extractOcrEmail(words, rowText, maxX) {
  const emailZone = words.filter(word => word.cx >= maxX * 0.24 && word.cx <= maxX * 0.55).map(word => word.text).join(" ");
  return extractEmailValue(emailZone) || extractEmailValue(rowText);
}

function extractOcrPhone(words, rowText, maxX) {
  const phoneZone = words.filter(word => word.cx >= maxX * 0.72).map(word => word.text).join(" ");
  return extractPhoneValue(phoneZone);
}

function ocrDataToBulkText(data, defaults) {
  const rows = buildOcrRows(data);
  const maxX = Math.max(...rows.flatMap(row => row.words.map(word => word.x1)), 1);
  const leads = rows.map(row => {
    const rowText = row.words.map(word => word.text).join(" ");
    const lower = rowText.toLowerCase();
    if (/seleccionados|mostrando|pagina|anterior|siguiente|nombre\s+telefono|cliente\s+etiqueta|fecha\s+de\s+asignacion/.test(lower)) return null;

    const name = extractOcrName(row.words, rowText, maxX);
    const email = extractOcrEmail(row.words, rowText, maxX);
    const phone = extractOcrPhone(row.words, rowText, maxX);
    const status = /no\s*contesta/i.test(rowText) ? "No contesta" : /\bcontesta\b/i.test(rowText) ? "Contesta" : "";
    if (!name || (!email && !phone)) return null;

    return [
      name,
      phone,
      email,
      defaults.product || "",
      "",
      [status, `Fila OCR: ${rowText}`].filter(Boolean).join(" - ")
    ].join("\t");
  }).filter(Boolean);

  return leads.join("\n");
}

function extractName(original, { email, phone, amountRaw, product }) {
  const clientName = extractClientNameFromText(original);
  if (clientName) return clientName;
  const labeled = original.match(/(?:nombre|cliente|contacto)\s*[:=-]\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+){0,4})/i);
  if (labeled?.[1]) return titleName(labeled[1]);

  let text = ` ${original} `
    .replace(email, " ")
    .replace(phone, " ")
    .replace(amountRaw, " ")
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ")
    .replace(/\b(?:dni|cuit|id|ref)\s*[:=-]?\s*\d+\b/ig, " ")
    .replace(/\b(?:whatsapp|telefono|teléfono|tel|cel|celular|mail|email|producto|monto|capital|lead|cliente|contacto|estado|origen|nota|notas)\b\s*[:=-]?/ig, " ");

  if (product) text = text.replace(new RegExp(product, "ig"), " ");
  PRODUCTS.forEach(p => { text = text.replace(new RegExp(p, "ig"), " "); });

  text = text
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[0-9$€£+@#%()[\]{}_*"'`~<>]/g, " ")
    .replace(/[|,;:=-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = text
    .split(/\s+/)
    .map(w => w.replace(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+|[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+$/g, ""))
    .filter(w => w.length >= 2)
    .filter(w => !NAME_STOPWORDS.includes(w.toLowerCase()));

  const candidates = [];
  for (let size = Math.min(4, words.length); size >= 1; size--) {
    for (let i = 0; i <= words.length - size; i++) {
      const phrase = words.slice(i, i + size);
      const score = phrase.join("").length + (size >= 2 ? 8 : 0);
      candidates.push({ phrase: phrase.join(" "), score });
    }
  }

  const best = candidates.sort((a, b) => b.score - a.score)[0]?.phrase || "";
  return titleName(best).slice(0, 48).trim();
}

function leadFromTextLine(line, defaults) {
  const original = clean(line);
  if (/^\s*(nombre|cliente|contacto)\s+(tel|teléfono|telefono|cel|email|mail)/i.test(original)) {
    return { lead: makeLead({ name: "", channel: defaults.channel, followUpDate: defaults.followUpDate }), source: original, bucket: "invalid", priority: "Baja", reason: "Encabezado detectado" };
  }
  const email = extractEmailValue(original);
  const phone = extractPhoneValue(original);
  const withoutPhone = phone ? original.replace(phone, " ") : original;
  const amountRaw = withoutPhone.match(/(?:\$|USD|ARS)\s?\d[\d.,]{2,}|\b\d[\d.,]{4,}\b/i)?.[0] || "";
  const product = PRODUCTS.find(p => original.toLowerCase().includes(p.toLowerCase())) || defaults.product;
  const separators = original.split(/[,;\t|]/).map(clean).filter(Boolean);
  const separatedName = separators.find(part => {
    const lower = part.toLowerCase();
    return part !== email && part !== phone && !part.includes("@") && !/\d[\d\s().-]{6,}\d/.test(part) && !PRODUCTS.some(p => lower.includes(p.toLowerCase())) && !NAME_STOPWORDS.includes(lower);
  });
  const name = separatedName ? titleName(separatedName).slice(0, 48).trim() : extractName(original, { email, phone, amountRaw, product });
  const lead = makeLead({
    name,
    phone,
    email,
    product,
    amount: cleanAmount(amountRaw),
    channel: defaults.channel,
    followUpDate: defaults.followUpDate,
    notes: `Detectado desde captura: ${original}`,
  });
  return { lead, source: original, ...classifyLead(lead) };
}

function parseBulk(text, defaults) {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split(/[,;\t|]/).map(clean);
      return makeLead({
        name: parts[0],
        phone: parts[1],
        email: parts[2],
        product: parts[3] || defaults.product,
        amount: parts[4],
        channel: defaults.channel,
        followUpDate: defaults.followUpDate,
        notes: parts.slice(5).join(" - "),
      });
    })
    .filter(l => l.name);
}

function classifyBulk(text, defaults) {
  const seen = new Set();
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 2)
    .map(line => leadFromTextLine(line, defaults))
    .filter(item => {
      const key = `${item.lead.name}|${item.lead.phone}|${item.lead.email}`.toLowerCase();
      if (!item.lead.name && !item.lead.phone && !item.lead.email) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export default function App() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [leads, setLeads] = useState([]);
  const [ints, setInts] = useState([]);
  const [view, setView] = useState("midia");
  const [sel, setSel] = useState(null);
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [listFocus, setListFocus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState(null);
  const [lossLeadId, setLossLeadId] = useState(null);

  useEffect(() => {
    let storedUsers = lsGet(SK_USERS) || [];
    const legacyLeads = lsGet(SK_LEADS) || [];
    const legacyInts = lsGet(SK_INTS) || [];

    if (storedUsers.length === 0 && (legacyLeads.length > 0 || legacyInts.length > 0)) {
      const owner = makeUser({ name: "Equipo", pin: "1234" });
      storedUsers = [owner];
      lsSet(SK_USERS, storedUsers);
      lsSet(userLeadsKey(owner.id), legacyLeads);
      lsSet(userIntsKey(owner.id), legacyInts);
      lsSet(SK_SESSION, owner.id);
    }

    setUsers(storedUsers);
    const sessionId = lsGet(SK_SESSION);
    const sessionUser = storedUsers.find(u => u.id === sessionId) || null;
    setCurrentUser(sessionUser);
    if (sessionUser) {
      setLeads(lsGet(userLeadsKey(sessionUser.id)) || []);
      setInts(lsGet(userIntsKey(sessionUser.id)) || []);
    }
    setLoading(false);
  }, []);

  const saveUsers = (nextUsers) => {
    setUsers(nextUsers);
    lsSet(SK_USERS, nextUsers);
  };

  const selectUser = (user) => {
    setCurrentUser(user);
    setLeads(lsGet(userLeadsKey(user.id)) || []);
    setInts(lsGet(userIntsKey(user.id)) || []);
    setSel(null);
    setView("midia");
    lsSet(SK_SESSION, user.id);
  };

  const createUser = ({ name, pin }) => {
    const user = makeUser({ name, pin });
    const nextUsers = [...users, user];
    saveUsers(nextUsers);
    lsSet(userLeadsKey(user.id), []);
    lsSet(userIntsKey(user.id), []);
    selectUser(user);
  };

  const loginUser = ({ userId, pin }) => {
    const user = users.find(u => u.id === userId && u.pin === clean(pin));
    if (!user) return false;
    selectUser(user);
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    setLeads([]);
    setInts([]);
    setSel(null);
    lsSet(SK_SESSION, null);
  };

  const saveL = useCallback((l) => {
    setLeads(l);
    if (currentUser) lsSet(userLeadsKey(currentUser.id), l);
  }, [currentUser]);
  const saveI = useCallback((i) => {
    setInts(i);
    if (currentUser) lsSet(userIntsKey(currentUser.id), i);
  }, [currentUser]);

  const addLead = (data) => {
    const next = makeLead(data);
    saveL([next, ...leads]);
    setSel(next);
    setView("detail");
    setModal(null);
  };

  const addBulkLeads = (newLeads) => {
    if (!newLeads.length) return;
    saveL([...newLeads, ...leads]);
    setView("lista");
    setModal(null);
  };

  const updateLead = (id, u) => saveL(leads.map(l => l.id === id ? { ...l, ...u } : l));

  const deleteLead = (id) => {
    saveL(leads.filter(l => l.id !== id));
    saveI(ints.filter(i => i.leadId !== id));
    setSel(null);
    setView("midia");
  };

  const deleteLeads = (ids) => {
    const toDelete = new Set(ids);
    saveL(leads.filter(l => !toDelete.has(l.id)));
    saveI(ints.filter(i => !toDelete.has(i.leadId)));
    setSel(null);
  };

  const moveLead = (id, stage) => {
    if (stage === "perdido") {
      setLossLeadId(id);
      setModal("loss");
      return;
    }
    const u = { stage };
    if (stage === "contactado") u.followUpDate = dateInDays(10);
    if (stage === "invertido") u.closedAt = new Date().toISOString();
    updateLead(id, u);
  };

  const confirmLoss = (reason) => {
    if (lossLeadId) updateLead(lossLeadId, { stage: "perdido", lossReason: reason, lostAt: new Date().toISOString() });
    setLossLeadId(null);
    setModal(null);
  };

  const addInteraction = (data) => {
    const ni = { id: uid(), leadId: data.leadId, type: data.type, note: data.note, date: new Date().toISOString() };
    saveI([ni, ...ints]);
    const lead = leads.find(l => l.id === data.leadId);
    const u = { lastContact: new Date().toISOString() };
    if (data.followUpDate) u.followUpDate = data.followUpDate;
    if (lead?.stage === "nuevo") u.stage = "contactado";
    updateLead(data.leadId, u);
    setModal(null);
  };

  const quickAction = (leadId, action) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    const ni = { id: uid(), leadId, type: action.type, note: action.label, date: new Date().toISOString() };
    saveI([ni, ...ints]);
    const u = { lastContact: new Date().toISOString(), attempts: (lead.attempts || 0) + 1 };
    if (action.id === "llamar_despues") u.followUpDate = dateInDays(1);
    if (action.id === "no_atendio") u.followUpDate = dateInDays(2);
    if (action.id === "contactado") {
      u.stage = lead.stage === "nuevo" ? "contactado" : lead.stage;
      u.followUpDate = dateInDays(10);
    }
    updateLead(leadId, u);
  };

  const setFollowUp = (leadId, days) => updateLead(leadId, { followUpDate: dateInDays(days) });
  const getLeadInts = (id) => ints.filter(i => i.leadId === id).sort((a, b) => new Date(b.date) - new Date(a.date));

  const active = leads.filter(l => !["invertido", "perdido"].includes(l.stage));
  const pipeline$ = active.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const converted = leads.filter(l => l.stage === "invertido");
  const convRate = leads.length > 0 ? ((converted.length / leads.length) * 100).toFixed(1) : 0;
  const overdue = active.filter(l => isOverdue(l.followUpDate)).sort((a, b) => new Date(a.followUpDate) - new Date(b.followUpDate));
  const today = active.filter(l => isToday(l.followUpDate));
  const tomorrow = active.filter(l => isTomorrow(l.followUpDate));
  const hotNoAction = active.filter(l => getTemp(l, ints) === "hot" && !l.followUpDate);
  const fu10d = leads.filter(l => l.stage === "contactado" && l.lastContact && daysAgo(l.lastContact) >= 8);
  const untouched = leads.filter(l => l.stage === "nuevo" && !l.lastContact);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return leads.filter(l => {
      const matchesText = !s || [l.name, l.email, l.phone, l.product, l.channel, l.notes].some(v => (v || "").toLowerCase().includes(s));
      if (!matchesText) return false;
      if (listFocus === "overdue") return isOverdue(l.followUpDate) && !["invertido", "perdido"].includes(l.stage);
      if (listFocus === "today") return isToday(l.followUpDate) && !["invertido", "perdido"].includes(l.stage);
      if (listFocus === "untouched") return l.stage === "nuevo" && !l.lastContact;
      if (listFocus === "active") return !["invertido", "perdido"].includes(l.stage);
      return true;
    });
  }, [leads, listFocus, search]);

  if (loading) return <div style={S.loading}><div style={S.spinner} /><p style={{ color: "#667085", marginTop: 16, fontFamily: F }}>Cargando...</p></div>;
  if (!currentUser) return <LoginScreen users={users} onLogin={loginUser} onCreate={createUser} />;

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,500;9..40,700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
        button:hover { filter: brightness(0.98); transform: translateY(-1px); }
        button:disabled { opacity: 0.45; cursor: not-allowed; }
        button { transition: filter 0.15s ease, transform 0.15s ease, border-color 0.15s ease; }
        input:focus, select:focus, textarea:focus { border-color: #2563eb !important; box-shadow: 0 0 0 3px #2563eb18; outline: none; }
      `}</style>

      <Nav view={view} setView={setView} onAdd={() => setModal("add")} overdue={overdue.length} todayCount={today.length} search={search} setSearch={setSearch} currentUser={currentUser} onNewUser={() => setModal("account")} onLogout={logout} />

      <div style={S.body}>
        {view === "midia" && <MiDia overdue={overdue} today={today} tomorrow={tomorrow} hotNoAction={hotNoAction} fu10d={fu10d} untouched={untouched} ints={ints} onSelect={(l) => { setSel(l); setView("detail"); }} onUpdate={updateLead} onDelete={deleteLead} quickAction={quickAction} pipeline$={pipeline$} convRate={convRate} active={active} onAdd={() => setModal("add")} />}
        {view === "kanban" && <Kanban leads={filtered} ints={ints} onSelect={(l) => { setSel(l); setView("detail"); }} onMove={moveLead} dragId={dragId} setDragId={setDragId} quickAction={quickAction} />}
        {view === "lista" && <Lista leads={filtered} ints={ints} onSelect={(l) => { setSel(l); setView("detail"); }} onUpdate={updateLead} onDelete={deleteLead} onBulkDelete={deleteLeads} focus={listFocus} setFocus={setListFocus} />}
        {view === "dashboard" && <Dashboard leads={leads} ints={ints} pipeline$={pipeline$} convRate={convRate} converted={converted} active={active} />}
        {view === "detail" && sel && <Detail lead={leads.find(l => l.id === sel.id) || sel} ints={getLeadInts(sel.id)} allInts={ints} onBack={() => { setSel(null); setView("midia"); }} onUpdate={(u) => updateLead(sel.id, u)} onDelete={() => deleteLead(sel.id)} onAddInt={() => setModal("interaction")} onMove={(s) => moveLead(sel.id, s)} quickAction={(a) => quickAction(sel.id, a)} setFollowUp={(days) => setFollowUp(sel.id, days)} />}
      </div>

      {modal === "add" && <AddModal onAdd={addLead} onBulkAdd={addBulkLeads} onClose={() => setModal(null)} />}
      {modal === "account" && <AccountModal onCreate={(data) => { createUser(data); setModal(null); }} onClose={() => setModal(null)} />}
      {modal === "interaction" && sel && <IntModal leadId={sel.id} onAdd={addInteraction} onClose={() => setModal(null)} />}
      {modal === "loss" && <LossModal onConfirm={confirmLoss} onClose={() => { setModal(null); setLossLeadId(null); }} />}
    </div>
  );
}

function LoginScreen({ users, onLogin, onCreate }) {
  const [mode, setMode] = useState(users.length ? "login" : "create");
  const [userId, setUserId] = useState(users[0]?.id || "");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const canCreate = clean(name) && clean(pin).length >= 4;
  const submitLogin = () => {
    setError("");
    if (!onLogin({ userId, pin })) setError("Usuario o PIN incorrecto.");
  };
  const submitCreate = () => {
    if (!canCreate) return;
    onCreate({ name, pin });
  };

  return (
    <div style={S.loginPage}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,500;9..40,700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        input:focus, select:focus { border-color: #2563eb !important; box-shadow: 0 0 0 3px #2563eb18; outline: none; }
      `}</style>
      <div style={S.loginCard}>
        <div style={{ marginBottom: 18 }}>
          <span style={S.loginMark}>◆</span>
          <h1 style={S.loginTitle}>Lead Tracker</h1>
          <p style={S.help}>Entrá con tu cuenta para ver solo tus clientes y seguimientos.</p>
        </div>
        <div style={{ ...S.segment, marginBottom: 14 }}>
          <button style={mode === "login" ? S.segOn : S.segOff} onClick={() => setMode("login")} disabled={users.length === 0}>Entrar</button>
          <button style={mode === "create" ? S.segOn : S.segOff} onClick={() => setMode("create")}>Crear cuenta</button>
        </div>
        {mode === "login" ? (
          <>
            <Sel label="Cuenta" val={userId} opts={users.map(u => ({ label: u.name, value: u.id }))} set={setUserId} />
            <Inp label="PIN" val={pin} set={setPin} type="password" auto />
            {error && <p style={S.errorText}>{error}</p>}
            <button style={{ ...S.priBtn, width: "100%", marginTop: 8 }} onClick={submitLogin} disabled={!userId || !pin}>Entrar</button>
          </>
        ) : (
          <>
            <Inp label="Nombre del usuario" val={name} set={setName} auto />
            <Inp label="PIN (mínimo 4 números)" val={pin} set={setPin} type="password" />
            <button style={{ ...S.priBtn, width: "100%", marginTop: 8 }} onClick={submitCreate} disabled={!canCreate}>Crear y entrar</button>
          </>
        )}
        {users.length > 0 && <p style={{ ...S.help, marginTop: 14 }}>Los datos se guardan localmente en este navegador.</p>}
      </div>
    </div>
  );
}

function Nav({ view, setView, onAdd, overdue, todayCount, search, setSearch, currentUser, onNewUser, onLogout }) {
  const tabs = [{ id: "midia", label: "Mi día" }, { id: "kanban", label: "Pipeline" }, { id: "lista", label: "Lista" }, { id: "dashboard", label: "Dashboard" }];
  return (
    <div style={S.nav}>
      <div style={S.navTop}>
        <div style={S.brand}>
          <span style={{ fontSize: 20, color: "#2563eb" }}>◆</span>
          <span style={S.brandTitle}>Lead Tracker</span>
          {overdue > 0 && <span style={S.bRed}>{overdue} vencidos</span>}
          {todayCount > 0 && <span style={S.bAmber}>{todayCount} hoy</span>}
        </div>
        <div style={S.navActions}>
          <input style={S.searchBox} placeholder="Buscar lead, teléfono, producto..." value={search} onChange={e => setSearch(e.target.value)} />
          <button style={S.addBtn} onClick={onAdd}>+ Lead</button>
          <span style={S.userBadge}>{currentUser?.name}</span>
          <button style={S.secBtn} onClick={onNewUser}>+ Cuenta</button>
          <button style={S.secBtn} onClick={onLogout}>Salir</button>
        </div>
      </div>
      <div style={S.tabs}>
        {tabs.map(t => <button key={t.id} onClick={() => setView(t.id)} style={view === t.id ? S.tabOn : S.tabOff}>{t.label}</button>)}
      </div>
    </div>
  );
}

function MiDia({ overdue, today, tomorrow, hotNoAction, fu10d, untouched, ints, onSelect, onUpdate, onDelete, quickAction, pipeline$, convRate, active, onAdd }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buen día" : hour < 18 ? "Buenas tardes" : "Buenas noches";
  const totalActions = overdue.length + today.length + untouched.length;
  return (
    <div style={S.fadeStack}>
      <div style={S.heroRow}>
        <div>
          <h2 style={S.h2}>{greeting}</h2>
          <p style={S.muted}>{totalActions > 0 ? `Tenés ${totalActions} acción${totalActions > 1 ? "es" : ""} para empujar hoy` : "Todo al día. Podés cargar nuevos leads o revisar oportunidades calientes."}</p>
        </div>
        <div style={S.statsRow}>
          <MiniStat label="Pipeline" value={`$${(pipeline$ / 1000).toFixed(0)}k`} color="#2563eb" />
          <MiniStat label="Activos" value={active.length} color="#fbbf24" />
          <MiniStat label="Conversión" value={`${convRate}%`} color="#4ade80" />
        </div>
      </div>
      {overdue.length > 0 && <ActionSection title="Vencidos - contactar ya" leads={overdue} color="#f87171" onSelect={onSelect} onUpdate={onUpdate} onDelete={onDelete} quickAction={quickAction} ints={ints} />}
      {today.length > 0 && <ActionSection title="Para hoy" leads={today} color="#fbbf24" onSelect={onSelect} onUpdate={onUpdate} onDelete={onDelete} quickAction={quickAction} ints={ints} />}
      {untouched.length > 0 && <ActionSection title="Sin contactar" leads={untouched} color="#2563eb" onSelect={onSelect} onUpdate={onUpdate} onDelete={onDelete} quickAction={quickAction} ints={ints} />}
      {fu10d.length > 0 && <ActionSection title="Follow-up 10d (contactados)" leads={fu10d} color="#fb923c" onSelect={onSelect} onUpdate={onUpdate} onDelete={onDelete} quickAction={quickAction} ints={ints} showDays />}
      {tomorrow.length > 0 && <ActionSection title="Mañana" leads={tomorrow} color="#667085" onSelect={onSelect} onUpdate={onUpdate} onDelete={onDelete} quickAction={quickAction} ints={ints} />}
      {hotNoAction.length > 0 && <ActionSection title="Calientes sin follow-up agendado" leads={hotNoAction} color="#ef4444" onSelect={onSelect} onUpdate={onUpdate} onDelete={onDelete} quickAction={quickAction} ints={ints} />}
      {overdue.length === 0 && today.length === 0 && untouched.length === 0 && fu10d.length === 0 && (
        <div style={S.empty}>
          <p style={{ fontSize: 14, margin: 0, color: "#667085" }}>No tenés acciones pendientes.</p>
          <button style={{ ...S.priBtn, marginTop: 14 }} onClick={onAdd}>Cargar leads</button>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: FM }}>{value}</div><div style={S.statLabel}>{label}</div></div>;
}

function ActionSection({ title, leads, color, onSelect, onUpdate, onDelete, quickAction, ints, showDays }) {
  return (
    <div>
      <h3 style={{ ...S.secTitle, color }}>{title} <span style={S.count}>{leads.length}</span></h3>
      <div style={S.actionList}>
        {leads.map(l => {
          const temp = getTemp(l, ints);
          const t = temp ? TEMP[temp] : null;
          return <ActionCard key={l.id} lead={l} temp={t} onSelect={onSelect} onUpdate={onUpdate} onDelete={onDelete} quickAction={quickAction} showDays={showDays} />;
        })}
      </div>
    </div>
  );
}

function ActionCard({ lead, temp, onSelect, onUpdate, onDelete, quickAction, showDays }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState(lead);
  useEffect(() => setForm(lead), [lead]);
  const save = () => {
    onUpdate(lead.id, { ...form, amount: cleanAmount(form.amount) });
    setEditing(false);
  };
  if (editing) {
    return (
      <div style={S.actionCardEdit}>
        <div style={S.inlineEditGrid}>
          <input style={{ ...S.gridInput, flex: 2 }} value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nombre" />
          <input style={S.gridInput} value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Teléfono" />
          <input style={{ ...S.gridInput, flex: 1.4 }} value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" />
          <select style={S.gridInput} value={form.product || ""} onChange={e => setForm({ ...form, product: e.target.value })}>
            <option value="">Producto</option>
            {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input style={S.gridInput} value={form.amount || ""} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="Monto" />
          <input style={S.gridInput} type="date" value={form.followUpDate?.slice(0, 10) || ""} onChange={e => setForm({ ...form, followUpDate: e.target.value })} />
        </div>
        <div style={S.quickRow}>
          <button style={S.priBtn} onClick={save}>Guardar</button>
          <button style={S.secBtn} onClick={() => { setForm(lead); setEditing(false); }}>Cancelar</button>
        </div>
      </div>
    );
  }
  return (
    <div style={S.actionCard}>
      <div style={S.actionMain} onClick={() => onSelect(lead)}>
        {temp && <span style={{ fontSize: 14 }} title={temp.name}>{temp.label}</span>}
        <div>
          <span style={S.leadName}>{lead.name}</span>
          <div style={S.chips}>
            {lead.product && <span style={S.chip}>{lead.product}</span>}
            {lead.amount && <span style={S.chip}>{fmtMoney(lead.amount)}</span>}
            {lead.followUpDate && <span style={S.chip}>FU {fmt(lead.followUpDate)}</span>}
            {lead.attempts > 0 && <span style={S.chipWarn}>{lead.attempts} intento{lead.attempts > 1 ? "s" : ""}</span>}
            {showDays && lead.lastContact && <span style={S.chipWarn}>{daysAgo(lead.lastContact)}d sin contacto</span>}
          </div>
        </div>
      </div>
      <div style={S.quickRow}>
        <button style={S.qBtn} onClick={(e) => { e.stopPropagation(); setEditing(true); }}>Editar</button>
        {confirmDelete ? (
          <>
            <button style={S.danBtn} onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }}>Confirmar</button>
            <button style={S.secBtn} onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}>Cancelar</button>
          </>
        ) : (
          <button style={S.qBtn} onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}>Borrar</button>
        )}
        {QUICK_ACTIONS.map(a => <button key={a.id} onClick={(e) => { e.stopPropagation(); quickAction(lead.id, a); }} style={S.qBtn} title={a.label}>{a.icon}</button>)}
      </div>
    </div>
  );
}

function Kanban({ leads, ints, onSelect, onMove, dragId, setDragId, quickAction }) {
  const visible = STAGES.filter(s => s.id !== "perdido");
  const lost = leads.filter(l => l.stage === "perdido");
  return (
    <div style={S.kanbanWrap}>
      <div style={S.kanban}>
        {visible.map(stg => {
          const sl = leads.filter(l => l.stage === stg.id);
          const amt = sl.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
          return (
            <div key={stg.id} style={S.kCol} onDragOver={e => e.preventDefault()} onDrop={() => { if (dragId) { onMove(dragId, stg.id); setDragId(null); } }}>
              <div style={S.kHead}>
                <div style={S.kHeadLeft}><span style={{ color: stg.color, fontSize: 9 }}>{stg.icon}</span><span style={S.kTitle}>{stg.label}</span><span style={S.kBadge}>{sl.length}</span></div>
                {amt > 0 && <span style={S.kAmt}>${(amt / 1000).toFixed(0)}k</span>}
              </div>
              <div style={S.kCards}>{sl.map(l => <KCard key={l.id} lead={l} ints={ints} color={stg.color} onClick={() => onSelect(l)} onDrag={() => setDragId(l.id)} quickAction={quickAction} />)}</div>
            </div>
          );
        })}
      </div>
      {lost.length > 0 && <div style={S.lostBar} onDragOver={e => e.preventDefault()} onDrop={() => { if (dragId) { onMove(dragId, "perdido"); setDragId(null); } }}><span style={S.lostTitle}>✕ Perdidos ({lost.length})</span>{lost.map(l => <span key={l.id} style={S.lostChip} onClick={() => onSelect(l)}>{l.name}{l.lossReason ? ` - ${l.lossReason}` : ""}</span>)}</div>}
    </div>
  );
}

function KCard({ lead, ints, color, onClick, onDrag, quickAction }) {
  const temp = getTemp(lead, ints);
  const t = temp ? TEMP[temp] : null;
  const d = daysAgo(lead.lastContact);
  const od = isOverdue(lead.followUpDate);
  const td = isToday(lead.followUpDate);
  return (
    <div style={{ ...S.card, borderLeft: `3px solid ${color}` }} onClick={onClick} draggable onDragStart={onDrag}>
      <div style={S.cardTop}><div style={S.cardName}>{t && <span>{t.label}</span>}<span>{lead.name}</span></div>{lead.amount && <span style={S.cardAmount}>{fmtMoney(lead.amount)}</span>}</div>
      <div style={S.chips}>
        {lead.product && <span style={S.chip}>{lead.product}</span>}
        {d !== null && <span style={{ ...S.chip, ...(d >= 7 ? { background: "#ef444418", color: "#f87171" } : d >= 3 ? { background: "#f59e0b18", color: "#fbbf24" } : {}) }}>{d}d</span>}
        {lead.attempts > 0 && <span style={S.chipWarn}>{lead.attempts}x</span>}
        {od && <span style={S.chipDanger}>⚠ {fmt(lead.followUpDate)}</span>}
        {td && <span style={S.chipWarn}>hoy</span>}
      </div>
      <div style={S.quickSmallRow}>{QUICK_ACTIONS.map(a => <button key={a.id} onClick={e => { e.stopPropagation(); quickAction(lead.id, a); }} style={S.qBtnSmall} title={a.label}>{a.icon}</button>)}</div>
    </div>
  );
}

function Lista({ leads, ints, onSelect, onUpdate, onDelete, onBulkDelete, focus, setFocus }) {
  const [stgFilter, setStgFilter] = useState("all");
  const [tempFilter, setTempFilter] = useState("all");
  const [editingList, setEditingList] = useState(false);
  const [selected, setSelected] = useState([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const fl = leads.filter(l => {
    if (stgFilter !== "all" && l.stage !== stgFilter) return false;
    if (tempFilter !== "all" && getTemp(l, ints) !== tempFilter) return false;
    return true;
  });
  const focusOpts = [
    ["all", "Todos"],
    ["active", "Activos"],
    ["overdue", "Vencidos"],
    ["today", "Hoy"],
    ["untouched", "Sin contactar"],
  ];
  const totalPages = Math.max(1, Math.ceil(fl.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageLeads = fl.slice((safePage - 1) * pageSize, safePage * pageSize);
  const visibleIds = pageLeads.map(l => l.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.includes(id));
  const toggleLead = (id) => {
    setSelected(curr => curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id]);
    setConfirmBulkDelete(false);
  };
  const toggleAllVisible = () => {
    setSelected(curr => allVisibleSelected ? curr.filter(id => !visibleIds.includes(id)) : Array.from(new Set([...curr, ...visibleIds])));
    setConfirmBulkDelete(false);
  };
  const selectAllFiltered = () => {
    setSelected(curr => Array.from(new Set([...curr, ...fl.map(l => l.id)])));
    setConfirmBulkDelete(false);
  };
  const clearSelected = () => {
    setSelected([]);
    setConfirmBulkDelete(false);
  };
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const bulkDelete = () => {
    onBulkDelete(selected);
    setSelected([]);
    setConfirmBulkDelete(false);
  };
  return (
    <div style={S.fade}>
      <div style={S.listToolbar}>
        <div style={S.filterBar}>{focusOpts.map(([id, label]) => <button key={id} style={focus === id ? S.fOn : S.fOff} onClick={() => setFocus(id)}>{label}</button>)}</div>
        <div style={S.listActions}>
          <label style={S.pageSizeControl}>Mostrar
            <select style={S.pageSizeSelect} value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={Math.max(fl.length, 1)}>Todos</option>
            </select>
          </label>
          <button style={S.secBtn} onClick={toggleAllVisible}>{allVisibleSelected ? "Deseleccionar página" : "Seleccionar página"}</button>
          {fl.length > visibleIds.length && <button style={S.secBtn} onClick={selectAllFiltered}>Seleccionar {fl.length} filtrados</button>}
          {selected.length > 0 && <button style={S.secBtn} onClick={clearSelected}>Limpiar selección</button>}
          <button style={editingList ? S.priBtn : S.secBtn} onClick={() => setEditingList(!editingList)}>{editingList ? "Terminar edición" : "Editar lista"}</button>
          {selected.length > 0 && (confirmBulkDelete ? (
            <>
              <button style={S.danBtn} onClick={bulkDelete}>Confirmar borrar {selected.length}</button>
              <button style={S.secBtn} onClick={() => setConfirmBulkDelete(false)}>Cancelar</button>
            </>
          ) : (
            <button style={S.danBtn} onClick={() => setConfirmBulkDelete(true)}>Borrar seleccionados ({selected.length})</button>
          ))}
        </div>
      </div>
      <div style={S.filterBar}>
        <button style={stgFilter === "all" ? S.fOn : S.fOff} onClick={() => setStgFilter("all")}>Todas las etapas</button>
        {STAGES.map(s => <button key={s.id} style={stgFilter === s.id ? S.fOn : S.fOff} onClick={() => setStgFilter(s.id)}><span style={{ color: s.color }}>{s.icon}</span> {s.label}</button>)}
        <span style={S.divider} />
        {Object.entries(TEMP).map(([k, v]) => <button key={k} style={tempFilter === k ? S.fOn : S.fOff} onClick={() => setTempFilter(tempFilter === k ? "all" : k)} title={v.name}>{v.label}</button>)}
      </div>
      <div style={S.tHead}><span style={{ width: 28 }}><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} /></span><span style={{ flex: 2 }}>Nombre</span><span style={{ flex: 1 }}>Teléfono</span><span style={{ flex: 1.3 }}>Email</span><span style={{ flex: 1 }}>Producto</span><span style={{ flex: 1 }}>Monto</span><span style={{ flex: 1 }}>Estado</span><span style={{ flex: 1 }}>Follow-up</span></div>
      <div style={S.selectionBar}>
        <span>{selected.length} seleccionado{selected.length === 1 ? "" : "s"}</span>
        <span>Mostrando {pageLeads.length} de {fl.length}</span>
        <div style={S.pager}>
          <button style={S.fOff} onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage === 1}>Anterior</button>
          <span>Página {safePage} / {totalPages}</span>
          <button style={S.fOff} onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage === totalPages}>Siguiente</button>
        </div>
      </div>
      {pageLeads.map(l => {
        const stg = STAGES.find(s => s.id === l.stage);
        const od = isOverdue(l.followUpDate) && !["invertido", "perdido"].includes(l.stage);
        if (editingList) {
          return (
            <div key={l.id} style={S.tRowEdit}>
              <input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggleLead(l.id)} />
              <input style={{ ...S.gridInput, flex: 2 }} value={l.name || ""} onChange={e => onUpdate(l.id, { name: e.target.value })} placeholder="Nombre" />
              <input style={S.gridInput} value={l.phone || ""} onChange={e => onUpdate(l.id, { phone: e.target.value })} placeholder="Teléfono" />
              <input style={{ ...S.gridInput, flex: 1.3 }} value={l.email || ""} onChange={e => onUpdate(l.id, { email: e.target.value })} placeholder="Email" />
              <select style={S.gridInput} value={l.product || ""} onChange={e => onUpdate(l.id, { product: e.target.value })}>
                <option value="">Producto</option>
                {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input style={S.gridInput} value={l.amount || ""} onChange={e => onUpdate(l.id, { amount: cleanAmount(e.target.value) })} placeholder="Monto" />
              <select style={S.gridInput} value={l.stage || "nuevo"} onChange={e => onUpdate(l.id, { stage: e.target.value })}>
                {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <input style={S.gridInput} type="date" value={l.followUpDate?.slice(0, 10) || ""} onChange={e => onUpdate(l.id, { followUpDate: e.target.value })} />
            </div>
          );
        }
        return (
          <div key={l.id} style={S.tRow} onClick={() => onSelect(l)}>
            <span style={{ width: 28 }} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggleLead(l.id)} /></span>
            <span style={{ flex: 2, fontWeight: 700, color: "#172033" }}>{l.name}</span>
            <span style={S.tableMuted}>{l.phone || "-"}</span>
            <span style={{ ...S.tableMuted, flex: 1.3 }}>{l.email || "-"}</span>
            <span style={S.tableMuted}>{l.product || "-"}</span>
            <span style={{ flex: 1, color: "#172033", fontFamily: FM }}>{fmtMoney(l.amount) || "-"}</span>
            <span style={{ flex: 1 }}><span style={{ ...S.pill, background: stg?.color + "20", color: stg?.color }}>{stg?.label}</span></span>
            <span style={{ flex: 1, color: od ? "#b91c1c" : "#667085" }}>{l.followUpDate ? fmtFull(l.followUpDate) : "-"}</span>
          </div>
        );
      })}
      {fl.length === 0 && <p style={S.noResults}>Sin resultados</p>}
    </div>
  );
}

function Dashboard({ leads, ints, pipeline$, convRate, converted, active }) {
  const lost = leads.filter(l => l.stage === "perdido");
  const weekInts = ints.filter(i => daysAgo(i.date) <= 7).length;
  const stgData = STAGES.map(s => ({ ...s, count: leads.filter(l => l.stage === s.id).length, amt: leads.filter(l => l.stage === s.id).reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0) }));
  const maxC = Math.max(...stgData.map(s => s.count), 1);
  const lossMap = {};
  lost.forEach(l => { const r = l.lossReason || "Sin motivo"; lossMap[r] = (lossMap[r] || 0) + 1; });
  const prodMap = {};
  leads.forEach(l => { if (l.product) prodMap[l.product] = (prodMap[l.product] || 0) + 1; });
  return (
    <div style={S.fadeStackLg}>
      <div style={S.bigStatsGrid}>
        <BigStat label="Pipeline activo" value={`$${(pipeline$ / 1000).toFixed(0)}k`} sub={`${active.length} leads`} color="#2563eb" />
        <BigStat label="Conversión" value={`${convRate}%`} sub={`${converted.length} invertidos`} color="#4ade80" />
        <BigStat label="Perdidos" value={lost.length} sub={`de ${leads.length}`} color="#f87171" />
        <BigStat label="Actividad 7d" value={weekInts} sub="interacciones" color="#fbbf24" />
      </div>
      <div><h3 style={S.secTitle}>Funnel</h3>{stgData.map(s => <div key={s.id} style={S.funnelRow}><span style={S.funnelLabel}>{s.label}</span><div style={S.funnelTrack}><div style={{ ...S.funnelFill, width: `${(s.count / maxC) * 100}%`, background: s.color, minWidth: s.count > 0 ? 28 : 0 }}><span style={S.funnelCount}>{s.count}</span></div></div><span style={S.funnelAmt}>{fmtMoney(s.amt)}</span></div>)}</div>
      <div style={S.twoCols}>
        <MetricList title="Motivos de pérdida" empty="Sin datos" entries={Object.entries(lossMap).sort((a, b) => b[1] - a[1])} color="#f87171" />
        <MetricList title="Por producto" empty="Sin datos" entries={Object.entries(prodMap)} color="#2563eb" />
      </div>
    </div>
  );
}

function MetricList({ title, empty, entries, color }) {
  return <div><h3 style={S.secTitle}>{title}</h3>{entries.length === 0 ? <p style={S.noData}>{empty}</p> : entries.map(([name, count]) => <div key={name} style={S.metricRow}><span style={S.metricName}>{name}</span><span style={{ ...S.metricCount, color }}>{count}</span></div>)}</div>;
}

function BigStat({ label, value, sub, color }) {
  return <div style={S.bigStat}><span style={S.bigStatLabel}>{label}</span><span style={{ ...S.bigStatValue, color }}>{value}</span><span style={S.bigStatSub}>{sub}</span></div>;
}

function Detail({ lead, ints, allInts, onBack, onUpdate, onDelete, onAddInt, onMove, quickAction, setFollowUp }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(lead);
  const [confirmDel, setConfirmDel] = useState(false);
  const stg = STAGES.find(s => s.id === lead.stage);
  const temp = getTemp(lead, allInts);
  const t = temp ? TEMP[temp] : null;
  useEffect(() => setForm(lead), [lead]);
  const save = () => { onUpdate(form); setEditing(false); };
  return (
    <div style={S.fade}>
      <button style={S.backBtn} onClick={onBack}>← Volver</button>
      <div style={S.detailHead}>
        <div>
          <div style={S.titleRow}><h2 style={S.h2}>{lead.name}</h2>{t && <span style={{ fontSize: 16 }} title={t.name}>{t.label}</span>}</div>
          <div style={S.chips}><span style={{ ...S.pill, background: stg?.color + "20", color: stg?.color }}>{stg?.label}</span>{lead.product && <span style={S.chip}>{lead.product}</span>}{lead.channel && <span style={S.chip}>{lead.channel}</span>}{lead.attempts > 0 && <span style={S.chipWarn}>{lead.attempts} intento{lead.attempts > 1 ? "s" : ""}</span>}</div>
        </div>
        <div style={S.detailActions}>{QUICK_ACTIONS.map(a => <button key={a.id} onClick={() => quickAction(a)} style={S.qBtn} title={a.label}>{a.icon} {a.label}</button>)}<button style={S.secBtn} onClick={() => setEditing(!editing)}>{editing ? "Cancelar" : "Editar"}</button><button style={S.priBtn} onClick={onAddInt}>+ Interacción</button></div>
      </div>
      <div style={S.stageRow}>{STAGES.map(s => <button key={s.id} onClick={() => onMove(s.id)} style={lead.stage === s.id ? { ...S.stgBtn, background: s.color, color: "#fff", borderColor: s.color } : S.stgBtn}>{s.icon} {s.label}</button>)}</div>
      <div style={S.followBar}><span style={S.followLabel}>Próximo seguimiento:</span>{FOLLOW_UP_PRESETS.map(p => <button key={p.label} style={S.fOff} onClick={() => setFollowUp(p.days)}>{p.label}</button>)}{lead.followUpDate && <span style={isOverdue(lead.followUpDate) ? S.followDanger : S.followDate}>{fmtFull(lead.followUpDate)}</span>}</div>
      {lead.lossReason && <div style={S.lossNote}>Motivo de pérdida: <strong>{lead.lossReason}</strong></div>}
      {editing ? (
        <div style={S.editBox}>
          <Inp label="Nombre" val={form.name} set={v => setForm({ ...form, name: v })} />
          <Inp label="Teléfono" val={form.phone} set={v => setForm({ ...form, phone: v })} />
          <Inp label="Email" val={form.email} set={v => setForm({ ...form, email: v })} />
          <div style={S.fRow}><Sel label="Producto" val={form.product} opts={PRODUCTS} set={v => setForm({ ...form, product: v })} /><Inp label="Monto" val={form.amount} set={v => setForm({ ...form, amount: v })} type="number" /></div>
          <div style={S.fRow}><Sel label="Canal" val={form.channel} opts={CHANNELS} set={v => setForm({ ...form, channel: v })} /><Inp label="Follow-up" val={form.followUpDate?.slice(0, 10)} set={v => setForm({ ...form, followUpDate: v })} type="date" /></div>
          <Inp label="Notas" val={form.notes} set={v => setForm({ ...form, notes: v })} multi />
          <div style={S.buttonRow}><button style={S.priBtn} onClick={save}>Guardar</button><button style={S.danBtn} onClick={() => setConfirmDel(true)}>Eliminar</button></div>
          {confirmDel && <div style={S.confirmBox}><span style={{ color: "#f87171", fontSize: 12 }}>¿Seguro?</span><button style={S.danBtn} onClick={onDelete}>Confirmar</button></div>}
        </div>
      ) : (
        <div style={S.infoWrap}>
          <div style={S.infoGrid}><Info label="Teléfono" val={lead.phone} /><Info label="Email" val={lead.email} /><Info label="Monto" val={fmtMoney(lead.amount)} /><Info label="Follow-up" val={lead.followUpDate ? fmtFull(lead.followUpDate) : null} red={isOverdue(lead.followUpDate)} /><Info label="Creado" val={fmtFull(lead.createdAt)} /><Info label="Último contacto" val={lead.lastContact ? fmtFull(lead.lastContact) : "Nunca"} /></div>
          {lead.notes && <p style={S.notes}>{lead.notes}</p>}
        </div>
      )}
      <div style={S.history}><h3 style={S.secTitle}>Historial ({ints.length})</h3>{ints.length === 0 ? <p style={S.noData}>Sin interacciones</p> : <div>{ints.map(i => <div key={i.id} style={S.tlItem}><div style={S.tlDot} /><div style={{ flex: 1 }}><div style={S.tlHead}><span style={S.tlType}>{i.type}</span><span style={S.tlDate}>{fmtFull(i.date)}</span></div><p style={S.tlNote}>{i.note}</p></div></div>)}</div>}</div>
    </div>
  );
}

function Info({ label, val, red }) {
  return <div><span style={S.infoLabel}>{label}</span><p style={{ ...S.infoValue, color: red ? "#b91c1c" : "#172033", fontWeight: red ? 700 : 500 }}>{val || "-"}</p></div>;
}

function AccountModal({ onCreate, onClose }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const canSave = clean(name) && clean(pin).length >= 4;
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h2 style={S.mTitle}>Nueva cuenta del equipo</h2>
        <p style={S.help}>Cada cuenta tendrá sus propios leads, interacciones, métricas y pipeline.</p>
        <Inp label="Nombre" val={name} set={setName} auto />
        <Inp label="PIN (mínimo 4 números)" val={pin} set={setPin} type="password" />
        <div style={S.modalActions}>
          <button style={S.secBtn} onClick={onClose}>Cancelar</button>
          <button style={S.priBtn} onClick={() => canSave && onCreate({ name, pin })} disabled={!canSave}>Crear cuenta</button>
        </div>
      </div>
    </div>
  );
}

function AddModal({ onAdd, onBulkAdd, onClose }) {
  const [mode, setMode] = useState("one");
  const [f, sF] = useState({ name: "", phone: "", email: "", product: "", amount: "", channel: "Sendis", followUpDate: dateInDays(0), notes: "" });
  const [bulk, setBulk] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const classified = useMemo(() => classifyBulk(bulk, f), [bulk, f]);
  const [importItems, setImportItems] = useState([]);
  useEffect(() => setImportItems(classified), [classified]);
  const ready = importItems.filter(item => item.bucket === "ready");
  const review = importItems.filter(item => item.bucket === "review");
  const invalid = importItems.filter(item => item.bucket === "invalid");
  const updateImportItem = (id, patch) => {
    setImportItems(items => items.map(item => {
      if (item.lead.id !== id) return item;
      const lead = { ...item.lead, ...patch };
      return { ...item, lead, ...classifyLead(lead) };
    }));
  };
  const removeImportItem = (id) => setImportItems(items => items.filter(item => item.lead.id !== id));
  const readImage = async (file) => {
    if (!file) return;
    setMode("image");
    setImageUrl(URL.createObjectURL(file));
    setOcrStatus("Leyendo captura...");
    try {
      const imageMeta = await loadImageMeta(file);
      const worker = await createWorker("spa+eng");
      const result = await worker.recognize(file, {
        rectangle: {
          left: 0,
          top: 0,
          width: Math.round(imageMeta.width * 0.24),
          height: imageMeta.height,
        },
      }, { text: true, blocks: true });
      const fullResult = await worker.recognize(file, {}, { text: true, blocks: true });
      await worker.terminate();
      const names = [
        ...namesOnlyFromOcrData(result.data),
        ...namesOnlyFromOcrText(result.data.text || ""),
        ...(fullResult ? namesOnlyFromOcrData(fullResult.data) : []),
        ...(fullResult ? namesOnlyFromOcrText(fullResult.data.text || "") : []),
      ];
      const uniqueNames = [...new Map(names.map(name => [name.toLowerCase(), name])).values()];
      setBulk(namesToBulkText(uniqueNames));
      setOcrStatus("Texto detectado. Revisá la separación antes de cargar.");
      setOcrStatus(uniqueNames.length ? `Detecte ${uniqueNames.length} nombre${uniqueNames.length === 1 ? "" : "s"}. Se importaran solo nombres.` : "No encontre nombres claros. Proba con una captura donde se vea la columna Cliente.");
    } catch {
      setOcrStatus("No pude leer la imagen. Probá con una captura más nítida o pegá el texto manualmente.");
    }
  };
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}><h2 style={S.mTitle}>Nuevo lead</h2><div style={S.segment}><button style={mode === "one" ? S.segOn : S.segOff} onClick={() => setMode("one")}>Uno</button><button style={mode === "bulk" ? S.segOn : S.segOff} onClick={() => setMode("bulk")}>Pegar lista</button><button style={mode === "image" ? S.segOn : S.segOff} onClick={() => setMode("image")}>Captura</button></div></div>
        {mode === "one" ? (
          <>
            <Inp label="Nombre *" val={f.name} set={v => sF({ ...f, name: v })} auto />
            <div style={S.fRow}><Inp label="Teléfono" val={f.phone} set={v => sF({ ...f, phone: v })} /><Inp label="Email" val={f.email} set={v => sF({ ...f, email: v })} /></div>
            <div style={S.fRow}><Sel label="Producto" val={f.product} opts={PRODUCTS} set={v => sF({ ...f, product: v })} /><Inp label="Monto potencial" val={f.amount} set={v => sF({ ...f, amount: v })} type="number" /></div>
            <div style={S.fRow}><Sel label="Canal" val={f.channel} opts={CHANNELS} set={v => sF({ ...f, channel: v })} /><Inp label="Follow-up" val={f.followUpDate} set={v => sF({ ...f, followUpDate: v })} type="date" /></div>
            <Inp label="Notas" val={f.notes} set={v => sF({ ...f, notes: v })} multi />
            <div style={S.modalActions}><button style={S.secBtn} onClick={onClose}>Cancelar</button><button style={S.priBtn} onClick={() => f.name && onAdd(f)} disabled={!f.name}>Agregar</button></div>
          </>
        ) : (
          <>
            {mode === "image" ? (
              <>
                <p style={S.help}>Subí una captura con varios contactos. La app lee el texto, separa posibles leads y marca cuáles están listos o necesitan revisión.</p>
                <label style={S.uploadBox}>
                  <span style={{ fontWeight: 800, color: "#172033" }}>Seleccionar captura</span>
                  <span style={S.help}>PNG, JPG o WEBP. Cuanto más nítida la imagen, mejor el resultado.</span>
                  <input style={{ display: "none" }} type="file" accept="image/*" onChange={e => readImage(e.target.files?.[0])} />
                </label>
                {imageUrl && <img src={imageUrl} alt="Captura cargada" style={S.imagePreview} />}
                {ocrStatus && <p style={S.ocrStatus}>{ocrStatus}</p>}
              </>
            ) : (
              <p style={S.help}>Pegá una línea por lead: Nombre, Teléfono, Email, Producto, Monto, Notas. También podés pegar texto desordenado y la app intentará separarlo.</p>
            )}
            <div style={S.fRow}><Sel label="Producto por defecto" val={f.product} opts={PRODUCTS} set={v => sF({ ...f, product: v })} /><Sel label="Canal por defecto" val={f.channel} opts={CHANNELS} set={v => sF({ ...f, channel: v })} /></div>
            <Inp label="Follow-up inicial" val={f.followUpDate} set={v => sF({ ...f, followUpDate: v })} type="date" />
            <textarea style={{ ...S.input, minHeight: 140, resize: "vertical" }} value={bulk} onChange={e => setBulk(e.target.value)} autoFocus={mode === "bulk"} placeholder={"Juan Perez, 11 5555-5555, juan@email.com, Crowdium, 250000\nMaria Gomez, 11 4444-4444, maria@email.com"} />
            <LeadImportReviewEditable items={importItems} onChange={updateImportItem} onRemove={removeImportItem} />
            <div style={S.modalActions}><button style={S.secBtn} onClick={onClose}>Cancelar</button><button style={S.priBtn} onClick={() => onBulkAdd(ready.map(item => item.lead))} disabled={ready.length === 0}>Cargar listos ({ready.length})</button>{review.length > 0 && <button style={S.secBtn} onClick={() => onBulkAdd([...ready, ...review].map(item => item.lead))}>Cargar listos + revisar ({ready.length + review.length})</button>}</div>
          </>
        )}
      </div>
    </div>
  );
}

function LeadImportReview({ items, onChange, onRemove }) {
  const ready = items.filter(item => item.bucket === "ready");
  const review = items.filter(item => item.bucket === "review");
  const invalid = items.filter(item => item.bucket === "invalid");
  const renderItems = (items) => items.map(item => (
    <div key={`${item.source}-${item.lead.id}`} style={S.importRow}>
      <div>
        <strong>{item.lead.name || "Sin nombre"}</strong>
        <div style={S.importMeta}>{[item.lead.phone, item.lead.email, item.lead.product, fmtMoney(item.lead.amount)].filter(Boolean).join(" · ") || item.source}</div>
      </div>
      <span style={item.priority === "Alta" ? S.priorityHigh : item.priority === "Media" ? S.priorityMid : S.priorityLow}>{item.priority}</span>
    </div>
  ));
  return (
    <div style={S.importReview}>
      <div style={S.importSummary}>
        <span style={S.readyBadge}>{ready.length} listos</span>
        <span style={S.reviewBadge}>{review.length} a revisar</span>
        <span style={S.invalidBadge}>{invalid.length} incompletos</span>
      </div>
      {ready.length > 0 && <div><h3 style={S.importTitle}>Listos para cargar</h3>{renderItems(ready)}</div>}
      {review.length > 0 && <div><h3 style={S.importTitle}>A revisar</h3>{renderItems(review)}</div>}
      {invalid.length > 0 && <p style={S.help}>Hay {invalid.length} línea{invalid.length === 1 ? "" : "s"} incompleta{invalid.length === 1 ? "" : "s"} que no se cargará automáticamente.</p>}
    </div>
  );
}

function LeadImportReviewEditable({ items, onChange, onRemove }) {
  const ready = items.filter(item => item.bucket === "ready");
  const review = items.filter(item => item.bucket === "review");
  const invalid = items.filter(item => item.bucket === "invalid");
  return (
    <div style={S.importReview}>
      <div style={S.importSummary}>
        <span style={S.readyBadge}>{ready.length} listos</span>
        <span style={S.reviewBadge}>{review.length} a revisar</span>
        <span style={S.invalidBadge}>{invalid.length} incompletos</span>
      </div>
      {items.length > 0 && (
        <div>
          <h3 style={S.importTitle}>Editar antes de cargar</h3>
          {items.map(item => (
            <div key={item.lead.id} style={S.importEditRow}>
              <input style={{ ...S.importInput, flex: 1.2 }} value={item.lead.name || ""} onChange={e => onChange(item.lead.id, { name: e.target.value })} placeholder="Nombre" />
              <input style={S.importInput} value={item.lead.phone || ""} onChange={e => onChange(item.lead.id, { phone: e.target.value })} placeholder="Teléfono" />
              <input style={S.importInput} value={item.lead.email || ""} onChange={e => onChange(item.lead.id, { email: e.target.value })} placeholder="Email" />
              <select style={S.importInput} value={item.lead.product || ""} onChange={e => onChange(item.lead.id, { product: e.target.value })}>
                <option value="">Producto</option>
                {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input style={S.importInput} value={item.lead.amount || ""} onChange={e => onChange(item.lead.id, { amount: cleanAmount(e.target.value) })} placeholder="Monto" />
              <span style={item.priority === "Alta" ? S.priorityHigh : item.priority === "Media" ? S.priorityMid : S.priorityLow}>{item.priority}</span>
              <button style={S.qBtnSmall} onClick={() => onRemove(item.lead.id)} title="Quitar">✕</button>
            </div>
          ))}
        </div>
      )}
      {invalid.length > 0 && <p style={S.help}>Los incompletos no se cargan con "Cargar listos", pero podés completarlos acá y pasan a listos automáticamente.</p>}
    </div>
  );
}

function IntModal({ leadId, onAdd, onClose }) {
  const [f, sF] = useState({ type: "Llamada", note: "", followUpDate: dateInDays(10) });
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h2 style={S.mTitle}>Registrar interacción</h2>
        <div style={S.fRow}><Sel label="Tipo" val={f.type} opts={["Llamada", "WhatsApp", "Email", "Presencial", "Otro"]} set={v => sF({ ...f, type: v })} /><Inp label="Próximo follow-up" val={f.followUpDate} set={v => sF({ ...f, followUpDate: v })} type="date" /></div>
        <div style={S.presetRow}>{FOLLOW_UP_PRESETS.map(p => <button key={p.label} style={S.fOff} onClick={() => sF({ ...f, followUpDate: dateInDays(p.days) })}>{p.label}</button>)}</div>
        <Inp label="Nota" val={f.note} set={v => sF({ ...f, note: v })} multi auto />
        <div style={S.modalActions}><button style={S.secBtn} onClick={onClose}>Cancelar</button><button style={S.priBtn} onClick={() => f.note && onAdd({ ...f, leadId })} disabled={!f.note}>Guardar</button></div>
      </div>
    </div>
  );
}

function LossModal({ onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState("");
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h2 style={S.mTitle}>¿Por qué se perdió?</h2>
        <p style={S.help}>Elegí el motivo para poder detectar patrones.</p>
        <div style={S.lossList}>{LOSS_REASONS.map(r => <button key={r} onClick={() => setReason(r)} style={reason === r ? { ...S.lossOpt, background: "#f8717120", borderColor: "#f87171", color: "#f87171" } : S.lossOpt}>{r}</button>)}</div>
        {reason === "Otro" && <Inp label="Motivo" val={custom} set={setCustom} auto />}
        <div style={S.modalActions}><button style={S.secBtn} onClick={onClose}>Cancelar</button><button style={S.danBtn} onClick={() => reason && onConfirm(reason === "Otro" ? custom || "Otro" : reason)} disabled={!reason}>Confirmar pérdida</button></div>
      </div>
    </div>
  );
}

function Inp({ label, val, set, type = "text", multi, auto }) {
  const s = { ...S.input, ...(multi ? { minHeight: 62, resize: "vertical" } : {}) };
  return <div style={{ marginBottom: 8, flex: 1 }}><label style={S.lbl}>{label}</label>{multi ? <textarea style={s} value={val || ""} onChange={e => set(e.target.value)} autoFocus={auto} /> : <input style={s} type={type} value={val || ""} onChange={e => set(e.target.value)} autoFocus={auto} />}</div>;
}

function Sel({ label, val, opts, set }) {
  return <div style={{ marginBottom: 8, flex: 1 }}><label style={S.lbl}>{label}</label><select style={S.input} value={val || ""} onChange={e => set(e.target.value)}><option value="">-</option>{opts.map(o => {
    const option = typeof o === "string" ? { label: o, value: o } : o;
    return <option key={option.value} value={option.value}>{option.label}</option>;
  })}</select></div>;
}

const F = "'DM Sans', system-ui, sans-serif";
const FM = "'DM Mono', 'SF Mono', monospace";

const S = {
  app: { fontFamily: F, background: "#f5f7fb", color: "#172033", minHeight: "100vh", display: "flex", flexDirection: "column" },
  loginPage: { fontFamily: F, background: "#eef4ff", color: "#172033", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  loginCard: { width: "100%", maxWidth: 430, background: "#ffffff", border: "1px solid #dbe5f0", borderRadius: 8, padding: 26, boxShadow: "0 20px 55px rgba(15, 23, 42, 0.12)" },
  loginMark: { display: "inline-flex", color: "#2563eb", fontSize: 22, marginBottom: 8 },
  loginTitle: { fontSize: 24, color: "#172033", margin: "0 0 6px", lineHeight: 1 },
  errorText: { color: "#f87171", fontSize: 12, margin: "0 0 8px" },
  loading: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f5f7fb" },
  spinner: { width: 28, height: 28, border: "3px solid #dbe5f0", borderTop: "3px solid #2563eb", borderRadius: "50%", animation: "spin 0.7s linear infinite" },
  nav: { background: "#ffffff", borderBottom: "1px solid #dbe5f0", padding: "14px 20px 0", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 10px rgba(15, 23, 42, 0.04)" },
  navTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 },
  brand: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  brandTitle: { fontSize: 15, fontWeight: 800, color: "#172033" },
  navActions: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  tabs: { display: "flex", gap: 0, overflowX: "auto" },
  bRed: { fontSize: 10, padding: "3px 8px", borderRadius: 999, background: "#fee2e2", color: "#b91c1c", fontWeight: 700 },
  bAmber: { fontSize: 10, padding: "3px 8px", borderRadius: 999, background: "#fef3c7", color: "#92400e", fontWeight: 700 },
  searchBox: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 6, color: "#172033", padding: "8px 12px", fontSize: 12, fontFamily: F, width: 260, outline: "none" },
  addBtn: { background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: F, boxShadow: "0 6px 14px rgba(37, 99, 235, 0.18)" },
  userBadge: { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, color: "#1d4ed8", padding: "7px 10px", fontSize: 12, fontWeight: 800 },
  tabOff: { background: "none", border: "none", color: "#667085", fontSize: 12, fontWeight: 600, padding: "9px 14px", cursor: "pointer", borderBottom: "2px solid transparent", fontFamily: F, whiteSpace: "nowrap" },
  tabOn: { background: "none", border: "none", color: "#172033", fontSize: 12, fontWeight: 800, padding: "9px 14px", cursor: "pointer", borderBottom: "2px solid #2563eb", fontFamily: F, whiteSpace: "nowrap" },
  body: { flex: 1, padding: 20, overflow: "auto" },
  fade: { animation: "fadeIn 0.3s ease" },
  fadeStack: { animation: "fadeIn 0.3s ease", display: "flex", flexDirection: "column", gap: 20 },
  fadeStackLg: { animation: "fadeIn 0.3s ease", display: "flex", flexDirection: "column", gap: 24 },
  heroRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 },
  h2: { margin: 0, fontSize: 22, fontWeight: 800, color: "#172033" },
  muted: { margin: "4px 0 0", fontSize: 13, color: "#667085" },
  statsRow: { display: "flex", gap: 16 },
  statLabel: { fontSize: 10, color: "#667085", textTransform: "uppercase", letterSpacing: 0.5 },
  secTitle: { fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6, margin: "0 0 10px" },
  count: { fontSize: 11, color: "#667085", fontWeight: 600, marginLeft: 4 },
  actionList: { display: "flex", flexDirection: "column", gap: 5 },
  actionCard: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", border: "1px solid #dbe5f0", borderRadius: 8, padding: "12px 14px", gap: 10, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)" },
  actionCardEdit: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", border: "1px solid #93c5fd", borderRadius: 8, padding: "12px 14px", gap: 10, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)", flexWrap: "wrap" },
  inlineEditGrid: { display: "flex", gap: 6, alignItems: "center", flex: 1, minWidth: 680, overflowX: "auto" },
  actionMain: { flex: 1, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  leadName: { color: "#172033", fontWeight: 800, fontSize: 13 },
  chips: { display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" },
  chip: { fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "#eef2f7", color: "#475467", fontWeight: 600 },
  chipWarn: { fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "#fef3c7", color: "#92400e", fontWeight: 700 },
  chipDanger: { fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "#fee2e2", color: "#b91c1c", fontWeight: 700 },
  quickRow: { display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" },
  qBtn: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 5, color: "#344054", fontSize: 11, padding: "6px 8px", cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" },
  qBtnSmall: { background: "#ffffff", border: "1px solid #dbe5f0", borderRadius: 4, fontSize: 11, cursor: "pointer", padding: "2px 5px", color: "#475467" },
  empty: { textAlign: "center", padding: 42, color: "#667085", background: "#ffffff", border: "1px solid #dbe5f0", borderRadius: 8, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)" },
  kanbanWrap: { display: "flex", flexDirection: "column", gap: 10, height: "100%", animation: "fadeIn 0.3s ease" },
  kanban: { display: "flex", gap: 10, flex: 1, minHeight: 0, overflow: "auto" },
  kCol: { flex: 1, minWidth: 190, background: "#ffffff", border: "1px solid #dbe5f0", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)" },
  kHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "0 4px" },
  kHeadLeft: { display: "flex", alignItems: "center", gap: 5 },
  kTitle: { fontSize: 10, fontWeight: 800, color: "#475467", textTransform: "uppercase", letterSpacing: 0.5 },
  kBadge: { fontSize: 9, color: "#475467", background: "#eef2f7", borderRadius: 10, padding: "1px 6px", fontWeight: 700 },
  kAmt: { fontSize: 10, color: "#667085", fontFamily: FM },
  kCards: { display: "flex", flexDirection: "column", gap: 5, flex: 1, overflow: "auto" },
  card: { background: "#f8fafc", border: "1px solid #e5eaf0", borderRadius: 6, padding: "9px 10px", cursor: "pointer" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 },
  cardName: { display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "#172033" },
  cardAmount: { fontSize: 10, color: "#667085", fontFamily: FM },
  quickSmallRow: { display: "flex", gap: 3, marginTop: 4, justifyContent: "flex-end" },
  lostBar: { background: "#ffffff", border: "1px solid #dbe5f0", borderRadius: 8, padding: "9px 14px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 },
  lostTitle: { fontSize: 10, color: "#b91c1c", fontWeight: 800, marginRight: 10 },
  lostChip: { fontSize: 10, color: "#475467", background: "#eef2f7", padding: "4px 10px", borderRadius: 4, cursor: "pointer" },
  listToolbar: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 10 },
  listActions: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  pageSizeControl: { display: "flex", alignItems: "center", gap: 6, color: "#475467", fontSize: 12, fontWeight: 700 },
  pageSizeSelect: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 6, color: "#172033", padding: "7px 8px", fontSize: 12, fontFamily: F },
  selectionBar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", background: "#ffffff", border: "1px solid #dbe5f0", borderRadius: "8px 8px 0 0", padding: "8px 12px", color: "#475467", fontSize: 12, fontWeight: 700 },
  pager: { display: "flex", alignItems: "center", gap: 8, color: "#667085", fontSize: 11 },
  filterBar: { display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" },
  fOff: { background: "#ffffff", border: "1px solid #dbe5f0", borderRadius: 5, color: "#475467", fontSize: 10, padding: "5px 10px", cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", gap: 4 },
  fOn: { background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 5, color: "#1d4ed8", fontSize: 10, padding: "5px 10px", cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", gap: 4, fontWeight: 800 },
  divider: { width: 1, background: "#dbe5f0", margin: "0 4px" },
  tHead: { display: "flex", padding: "8px 14px", background: "#eef2f7", fontSize: 9, color: "#475467", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 800, minWidth: 760, borderRadius: "8px 8px 0 0" },
  tRow: { display: "flex", padding: "11px 14px", borderBottom: "1px solid #e5eaf0", cursor: "pointer", fontSize: 12, alignItems: "center", minWidth: 760, background: "#ffffff" },
  tRowEdit: { display: "flex", gap: 6, padding: "7px 10px", borderBottom: "1px solid #e5eaf0", fontSize: 12, alignItems: "center", minWidth: 900, background: "#ffffff", overflowX: "auto" },
  gridInput: { flex: 1, minWidth: 115, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 5, color: "#172033", padding: "7px 8px", fontSize: 11, fontFamily: F, outline: "none" },
  tableMuted: { flex: 1, color: "#667085" },
  noResults: { textAlign: "center", color: "#667085", padding: 20, fontSize: 13 },
  pill: { fontSize: 9, padding: "2px 7px", borderRadius: 4, fontWeight: 700 },
  bigStatsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 },
  bigStat: { background: "#ffffff", border: "1px solid #dbe5f0", borderRadius: 8, padding: "15px 18px", display: "flex", flexDirection: "column", gap: 3, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)" },
  bigStatLabel: { fontSize: 10, color: "#667085", textTransform: "uppercase", letterSpacing: 0.8 },
  bigStatValue: { fontSize: 26, fontWeight: 700, fontFamily: FM, lineHeight: 1.1 },
  bigStatSub: { fontSize: 11, color: "#667085" },
  funnelRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6 },
  funnelLabel: { width: 82, fontSize: 11, color: "#475467", textAlign: "right" },
  funnelTrack: { flex: 1, background: "#eef2f7", borderRadius: 4, height: 26, overflow: "hidden" },
  funnelFill: { height: "100%", borderRadius: 4, display: "flex", alignItems: "center", paddingLeft: 8, transition: "width 0.4s" },
  funnelCount: { fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: FM },
  funnelAmt: { fontSize: 10, color: "#667085", width: 55, textAlign: "right", fontFamily: FM },
  twoCols: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 },
  metricRow: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #dbe5f0" },
  metricName: { fontSize: 12, color: "#475467" },
  metricCount: { fontSize: 12, fontWeight: 700, fontFamily: FM },
  noData: { color: "#667085", fontSize: 12 },
  backBtn: { background: "none", border: "none", color: "#2563eb", fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 14, fontFamily: F, fontWeight: 800 },
  detailHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 },
  titleRow: { display: "flex", alignItems: "center", gap: 8 },
  detailActions: { display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" },
  stageRow: { display: "flex", gap: 4, margin: "16px 0 8px", flexWrap: "wrap" },
  stgBtn: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 5, color: "#475467", fontSize: 10, padding: "6px 10px", cursor: "pointer", fontFamily: F, fontWeight: 700 },
  followBar: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 14 },
  followLabel: { fontSize: 11, color: "#667085", fontWeight: 800, textTransform: "uppercase" },
  followDate: { fontSize: 11, color: "#475467", fontFamily: FM },
  followDanger: { fontSize: 11, color: "#b91c1c", fontFamily: FM, fontWeight: 800 },
  lossNote: { background: "#ef444412", border: "1px solid #ef444433", borderRadius: 6, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#f87171" },
  editBox: { marginTop: 12 },
  infoWrap: { marginTop: 16 },
  infoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 14, marginBottom: 14 },
  infoLabel: { fontSize: 10, color: "#667085", textTransform: "uppercase", letterSpacing: 0.5 },
  infoValue: { fontSize: 13, margin: "2px 0 0" },
  notes: { fontSize: 13, color: "#475467", background: "#ffffff", border: "1px solid #dbe5f0", padding: 12, borderRadius: 6, lineHeight: 1.5, margin: 0 },
  history: { marginTop: 24 },
  tlItem: { display: "flex", gap: 10, padding: "7px 0", borderLeft: "2px solid #dbe5f0", marginLeft: 7, paddingLeft: 14, position: "relative" },
  tlDot: { position: "absolute", left: -5, top: 12, width: 7, height: 7, borderRadius: "50%", background: "#2563eb" },
  tlHead: { display: "flex", justifyContent: "space-between", gap: 12 },
  tlType: { fontSize: 10, fontWeight: 800, color: "#1d4ed8", textTransform: "uppercase" },
  tlDate: { fontSize: 10, color: "#667085" },
  tlNote: { fontSize: 12, color: "#475467", margin: "3px 0 0", lineHeight: 1.4 },
  buttonRow: { display: "flex", gap: 8, marginTop: 12 },
  confirmBox: { display: "flex", gap: 10, alignItems: "center", marginTop: 10, padding: 10, background: "#ef444412", borderRadius: 6 },
  overlay: { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.42)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 },
  modal: { background: "#ffffff", border: "1px solid #dbe5f0", borderRadius: 8, padding: 22, width: "100%", maxWidth: 500, maxHeight: "86vh", overflow: "auto", boxShadow: "0 20px 55px rgba(15, 23, 42, 0.18)" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 },
  mTitle: { fontSize: 15, fontWeight: 800, color: "#172033", margin: 0 },
  segment: { display: "flex", background: "#eef2f7", border: "1px solid #dbe5f0", borderRadius: 6, overflow: "hidden" },
  segOn: { background: "#2563eb", color: "#ffffff", border: "none", padding: "7px 11px", fontSize: 11, fontFamily: F, cursor: "pointer", fontWeight: 800 },
  segOff: { background: "transparent", color: "#475467", border: "none", padding: "7px 11px", fontSize: 11, fontFamily: F, cursor: "pointer", fontWeight: 700 },
  help: { fontSize: 12, color: "#667085", margin: "0 0 12px", lineHeight: 1.45 },
  modalActions: { display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" },
  presetRow: { display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" },
  lossList: { display: "flex", flexDirection: "column", gap: 6 },
  lossOpt: { background: "#ffffff", border: "1px solid #dbe5f0", borderRadius: 6, padding: "9px 14px", fontSize: 12, color: "#475467", cursor: "pointer", textAlign: "left", fontFamily: F },
  priBtn: { background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: F, boxShadow: "0 6px 14px rgba(37, 99, 235, 0.16)" },
  secBtn: { background: "#ffffff", color: "#344054", border: "1px solid #cbd5e1", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: F },
  danBtn: { background: "#f8717118", color: "#f87171", border: "1px solid #f8717133", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F },
  lbl: { fontSize: 9, color: "#667085", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4, fontWeight: 800 },
  input: { width: "100%", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 6, color: "#172033", padding: "9px 11px", fontSize: 12, fontFamily: F, outline: "none", boxSizing: "border-box" },
  uploadBox: { display: "flex", flexDirection: "column", gap: 4, border: "1px dashed #93c5fd", background: "#eff6ff", borderRadius: 8, padding: 14, marginBottom: 10, cursor: "pointer" },
  imagePreview: { width: "100%", maxHeight: 180, objectFit: "contain", border: "1px solid #dbe5f0", borderRadius: 8, marginBottom: 10, background: "#f8fafc" },
  ocrStatus: { fontSize: 12, color: "#1d4ed8", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "8px 10px", margin: "0 0 10px" },
  importReview: { display: "flex", flexDirection: "column", gap: 10, marginTop: 10 },
  importSummary: { display: "flex", gap: 6, flexWrap: "wrap" },
  readyBadge: { fontSize: 10, color: "#166534", background: "#dcfce7", border: "1px solid #bbf7d0", borderRadius: 999, padding: "3px 8px", fontWeight: 800 },
  reviewBadge: { fontSize: 10, color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 999, padding: "3px 8px", fontWeight: 800 },
  invalidBadge: { fontSize: 10, color: "#991b1b", background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 999, padding: "3px 8px", fontWeight: 800 },
  importTitle: { fontSize: 10, color: "#667085", textTransform: "uppercase", letterSpacing: 0.5, margin: "2px 0 6px", fontWeight: 800 },
  importRow: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", background: "#f8fafc", border: "1px solid #e5eaf0", borderRadius: 6, padding: "8px 10px", fontSize: 12 },
  importEditRow: { display: "flex", gap: 6, alignItems: "center", background: "#f8fafc", border: "1px solid #e5eaf0", borderRadius: 6, padding: 8, marginBottom: 6, fontSize: 12, overflowX: "auto" },
  importInput: { flex: 1, minWidth: 118, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 5, color: "#172033", padding: "7px 8px", fontSize: 11, fontFamily: F, outline: "none" },
  importMeta: { fontSize: 11, color: "#667085", marginTop: 2 },
  priorityHigh: { fontSize: 10, color: "#166534", background: "#dcfce7", borderRadius: 999, padding: "3px 8px", fontWeight: 800 },
  priorityMid: { fontSize: 10, color: "#1d4ed8", background: "#dbeafe", borderRadius: 999, padding: "3px 8px", fontWeight: 800 },
  priorityLow: { fontSize: 10, color: "#667085", background: "#eef2f7", borderRadius: 999, padding: "3px 8px", fontWeight: 800 },
  fRow: { display: "flex", gap: 8 },
};
