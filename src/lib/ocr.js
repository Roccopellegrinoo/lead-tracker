import { PRODUCTS, NAME_STOPWORDS } from "./constants";
import { clean, cleanAmount, titleName, extractEmailValue, extractPhoneValue, makeLead, classifyLead } from "./utils";

export function getOcrWordBox(word) {
  const box = word?.bbox || word || {};
  const x0 = Number(box.x0 ?? box.left ?? box.x ?? 0);
  const y0 = Number(box.y0 ?? box.top ?? box.y ?? 0);
  const x1 = Number(box.x1 ?? (box.left ?? box.x ?? 0) + (box.width ?? 0));
  const y1 = Number(box.y1 ?? (box.top ?? box.y ?? 0) + (box.height ?? 0));
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, h: Math.max(1, y1 - y0) };
}

export function getOcrWords(data) {
  if (Array.isArray(data?.words)) return data.words;
  return (data?.blocks || [])
    .flatMap(block => block.paragraphs || [])
    .flatMap(paragraph => paragraph.lines || [])
    .flatMap(line => line.words || []);
}

export function buildOcrRows(data) {
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

export function cleanOcrNameToken(token) {
  const text = clean(token).replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  const lower = text.toLowerCase();
  if (!text || text.length < 2) return "";
  if (/^#?\d+$/.test(token)) return "";
  if (NAME_STOPWORDS.includes(lower)) return "";
  if (/^(no|a|e|o|de|del|la|el|los|las|com|con)$/i.test(text)) return "";
  if (/(gmail|hotmail|yahoo|outlook|icloud)/i.test(text)) return "";
  return text;
}

export function extractClientNameFromText(text) {
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

export function namesOnlyFromOcrText(text) {
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

export function namesOnlyFromOcrData(data) {
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

export function namesToBulkText(names) {
  return names.map(name => [name, "", "", "", "", "Nombre detectado desde captura"].join("\t")).join("\n");
}

export function extractOcrName(words, rowText, maxX) {
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

export function extractOcrEmail(words, rowText, maxX) {
  const emailZone = words.filter(word => word.cx >= maxX * 0.24 && word.cx <= maxX * 0.55).map(word => word.text).join(" ");
  return extractEmailValue(emailZone) || extractEmailValue(rowText);
}

export function extractOcrPhone(words, rowText, maxX) {
  const phoneZone = words.filter(word => word.cx >= maxX * 0.72).map(word => word.text).join(" ");
  return extractPhoneValue(phoneZone);
}

export function ocrDataToBulkText(data, defaults) {
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

export function extractName(original, { email, phone, amountRaw, product }) {
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

export function leadFromTextLine(line, defaults) {
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

export function parseBulk(text, defaults) {
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

export function classifyBulk(text, defaults) {
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
