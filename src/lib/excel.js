import * as XLSX from "xlsx";
import { clean, cleanAmount, makeLead, classifyLead } from "./utils";

export const parseExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to array of arrays
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        resolve(rawRows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

export const mapExcelRowsToLeads = (rawRows, defaults) => {
  if (!rawRows || rawRows.length === 0) return [];
  
  // Clean empty lines
  const rows = rawRows.filter(row => row && row.some(cell => String(cell).trim() !== ""));
  if (rows.length === 0) return [];

  // Identify header row. Usually index 0, but scan just in case.
  const headers = rows[0].map(h => String(h).toLowerCase().trim());
  
  // Find indices for fields
  let nameIndex = headers.findIndex(h => /nombre|cliente|completo|client|name/i.test(h));
  let phoneIndex = headers.findIndex(h => /teléfono|telefono|celular|tel|cel|phone|mobile|whatsapp/i.test(h));
  let emailIndex = headers.findIndex(h => /email|mail|correo|electronic/i.test(h));
  let productIndex = headers.findIndex(h => /producto|product|oportunidad/i.test(h));
  let amountIndex = headers.findIndex(h => /monto|capital|inversion|inversión|amount|value/i.test(h));
  let notesIndex = headers.findIndex(h => /nota|observacion|observación|comentario|coment|notes|comment/i.test(h));

  // Fallback indices if headers are completely missing (map to columns 0, 1, 2, 3, 4 sequentially)
  if (nameIndex === -1 && rows[0].length > 0) nameIndex = 0;
  if (phoneIndex === -1 && rows[0].length > 1) phoneIndex = 1;
  if (emailIndex === -1 && rows[0].length > 2) emailIndex = 2;
  if (productIndex === -1 && rows[0].length > 3) productIndex = 3;
  if (amountIndex === -1 && rows[0].length > 4) amountIndex = 4;
  if (notesIndex === -1 && rows[0].length > 5) notesIndex = 5;

  const results = [];
  const startRow = (nameIndex === 0 && headers[0] === "") ? 0 : 1; // skip header row if found headers

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    const name = nameIndex !== -1 && nameIndex < row.length ? clean(row[nameIndex]) : "";
    
    // Skip empty names
    if (!name || /^(nombre|cliente|client|name)$/i.test(name)) continue;

    const phone = phoneIndex !== -1 && phoneIndex < row.length ? clean(row[phoneIndex]) : "";
    const email = emailIndex !== -1 && emailIndex < row.length ? clean(row[emailIndex]) : "";
    const product = productIndex !== -1 && productIndex < row.length ? clean(row[productIndex]) : defaults.product;
    const amount = amountIndex !== -1 && amountIndex < row.length ? clean(row[amountIndex]) : "";
    const notes = notesIndex !== -1 && notesIndex < row.length ? clean(row[notesIndex]) : "";

    const lead = makeLead({
      name,
      phone,
      email,
      product: product || defaults.product,
      amount: cleanAmount(amount),
      channel: defaults.channel,
      followUpDate: defaults.followUpDate,
      notes: notes || "Importado desde Excel",
    });

    results.push({
      lead,
      source: row.join(" | "),
      ...classifyLead(lead)
    });
  }

  return results;
};
