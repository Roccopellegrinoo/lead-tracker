import { useState, useEffect, useMemo } from "react";
import { createWorker } from "tesseract.js";
import { S } from "../lib/styles";
import { PRODUCTS, CHANNELS, FOLLOW_UP_PRESETS, LOSS_REASONS } from "../lib/constants";
import { dateInDays, cleanAmount, makeLead, classifyLead, loadImageMeta } from "../lib/utils";
import { classifyBulk, namesOnlyFromOcrData, namesOnlyFromOcrText, namesToBulkText } from "../lib/ocr";
import { parseExcelFile, mapExcelRowsToLeads } from "../lib/excel";

export function AccountModal({ onCreate, onClose }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const canSave = name.trim() && pin.trim().length >= 4;

  const submit = () => {
    if (!canSave) return;
    onCreate({ name, pin });
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h2 style={S.mTitle}>Nueva cuenta del equipo</h2>
        <p style={S.help}>Cada cuenta tendrá sus propios leads, interacciones, métricas y pipeline.</p>
        
        <div style={{ marginBottom: 8, flex: 1 }}>
          <label style={S.lbl}>Nombre</label>
          <input style={S.input} value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>

        <div style={{ marginBottom: 8, flex: 1 }}>
          <label style={S.lbl}>PIN (mínimo 4 números)</label>
          <input style={S.input} type="password" value={pin} onChange={e => setPin(e.target.value)} />
        </div>

        <div style={S.modalActions}>
          <button style={S.secBtn} onClick={onClose}>Cancelar</button>
          <button style={S.priBtn} onClick={submit} disabled={!canSave}>Crear cuenta</button>
        </div>
      </div>
    </div>
  );
}

export function AddModal({ onAdd, onBulkAdd, onClose }) {
  const [mode, setMode] = useState("one");
  const [f, sF] = useState({
    name: "",
    phone: "",
    email: "",
    product: "",
    amount: "",
    channel: "Sendis",
    followUpDate: dateInDays(0),
    notes: ""
  });
  
  // States for standard bulk text import
  const [bulk, setBulk] = useState("");
  const classified = useMemo(() => classifyBulk(bulk, f), [bulk, f]);
  const [importItems, setImportItems] = useState([]);
  
  useEffect(() => {
    if (mode === "bulk") {
      setImportItems(classified);
    }
  }, [classified, mode]);

  // States for premium OCR import
  const [ocrStatus, setOcrStatus] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [detectedNames, setDetectedNames] = useState([]);

  // States for premium Excel import
  const [excelStatus, setExcelStatus] = useState("");
  const [excelFileName, setExcelFileName] = useState("");

  const ready = importItems.filter(item => item.bucket === "ready");
  const review = importItems.filter(item => item.bucket === "review");

  const updateImportItem = (id, patch) => {
    setImportItems(items => items.map(item => {
      if (item.lead.id !== id) return item;
      const lead = { ...item.lead, ...patch };
      return { ...item, lead, ...classifyLead(lead) };
    }));
  };

  const removeImportItem = (id) => setImportItems(items => items.filter(item => item.lead.id !== id));

  // OCR Worker action
  const readImage = async (file) => {
    if (!file) return;
    setMode("image");
    setImageUrl(URL.createObjectURL(file));
    setOcrStatus("Leyendo captura con OCR...");
    setDetectedNames([]);
    
    try {
      const imageMeta = await loadImageMeta(file);
      const worker = await createWorker("spa+eng");
      
      // Pass 1: read left Cliente column crop
      const result = await worker.recognize(file, {
        rectangle: {
          left: 0,
          top: 0,
          width: Math.round(imageMeta.width * 0.24),
          height: imageMeta.height,
        },
      }, { text: true, blocks: true });
      
      // Pass 2: read whole sheet
      const fullResult = await worker.recognize(file, {}, { text: true, blocks: true });
      await worker.terminate();
      
      const names = [
        ...namesOnlyFromOcrData(result.data),
        ...namesOnlyFromOcrText(result.data.text || ""),
        ...(fullResult ? namesOnlyFromOcrData(fullResult.data) : []),
        ...(fullResult ? namesOnlyFromOcrText(fullResult.data.text || "") : []),
      ];

      // Explicitly reject headers & common table noise
      const headerRegex = /^(cliente|nombre|apellido|telefono|teléfono|email|mail|estado|responsable|monto|monto\s+potencial|producto|fecha|asignacion|total|pág|pag|anterior|siguiente|mostrando|seleccionados|filas|fila|creacion|creación|fecha\s+de\s+asignación|observaciones|detalles|campaña|campana|origen|canal|id|nro|#)$/i;

      const uniqueNames = [...new Map(names.map(name => [name.toLowerCase(), name])).values()]
        .filter(name => name.trim().length >= 3)
        .filter(name => !headerRegex.test(name.trim()));

      setDetectedNames(uniqueNames);
      
      if (uniqueNames.length) {
        setOcrStatus(`¡Éxito! Se detectaron ${uniqueNames.length} nombres de clientes en la captura.`);
      } else {
        setOcrStatus("No encontré nombres claros. Probá con una captura más nítida donde se vea la columna Cliente.");
      }
    } catch (err) {
      setOcrStatus("No pude leer la imagen. Probá con una captura más nítida o cargalos manualmente.");
    }
  };

  const editDetectedName = (index, newName) => {
    setDetectedNames(prev => {
      const copy = [...prev];
      copy[index] = newName;
      return copy;
    });
  };

  const removeDetectedName = (index) => {
    setDetectedNames(prev => prev.filter((_, i) => i !== index));
  };

  const clearOcrImport = () => {
    setImageUrl("");
    setOcrStatus("");
    setDetectedNames([]);
    const fileInput = document.getElementById("ocr-file-input");
    if (fileInput) fileInput.value = "";
  };

  const handleBulkAddOcr = () => {
    const ocrLeads = detectedNames
      .filter(name => name.trim())
      .map(name => makeLead({
        name: name.trim(),
        product: f.product,
        channel: f.channel,
        followUpDate: f.followUpDate,
        notes: "Nombre detectado desde captura OCR"
      }));
    onBulkAdd(ocrLeads);
  };

  // Drag and drop state
  const [draggingExcel, setDraggingExcel] = useState(false);

  const handleExcelDrop = (e) => {
    e.preventDefault();
    setDraggingExcel(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleExcelUpload(file);
  };

  // Excel Loader action
  const handleExcelUpload = async (file) => {
    if (!file) return;
    setExcelFileName(file.name);
    setExcelStatus("Leyendo archivo Excel/CSV...");
    setImportItems([]);

    try {
      const rawRows = await parseExcelFile(file);
      const results = mapExcelRowsToLeads(rawRows, f);
      
      if (results.length > 0) {
        setImportItems(results);
        setExcelStatus(`¡Éxito! Se cargaron ${results.length} leads desde "${file.name}".`);
      } else {
        setExcelStatus("No encontré filas válidas en el archivo Excel. Asegurate de que tenga una fila de encabezados.");
      }
    } catch (err) {
      setExcelStatus("Error al leer el archivo. Asegurate de que sea un archivo .xlsx, .xls o .csv válido.");
    }
  };

  const clearExcelImport = () => {
    setExcelFileName("");
    setExcelStatus("");
    setImportItems([]);
    const fileInput = document.getElementById("excel-file-input");
    if (fileInput) fileInput.value = "";
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: mode === "one" ? 500 : 700 }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}>
          <h2 style={S.mTitle}>Nuevo lead</h2>
          <div style={S.segment}>
            <button style={mode === "one" ? S.segOn : S.segOff} onClick={() => setMode("one")}>Uno</button>
            <button style={mode === "bulk" ? S.segOn : S.segOff} onClick={() => setMode("bulk")}>Pegar lista</button>
            <button style={mode === "image" ? S.segOn : S.segOff} onClick={() => setMode("image")}>Captura</button>
            <button style={mode === "excel" ? S.segOn : S.segOff} onClick={() => setMode("excel")}>Excel</button>
          </div>
        </div>

        {mode === "one" && (
          <>
            <div style={{ marginBottom: 8, flex: 1 }}>
              <label style={S.lbl}>Nombre *</label>
              <input style={S.input} value={f.name} onChange={e => sF({ ...f, name: e.target.value })} autoFocus />
            </div>
            <div style={S.fRow}>
              <div style={{ marginBottom: 8, flex: 1 }}>
                <label style={S.lbl}>Teléfono</label>
                <input style={S.input} value={f.phone} onChange={e => sF({ ...f, phone: e.target.value })} />
              </div>
              <div style={{ marginBottom: 8, flex: 1 }}>
                <label style={S.lbl}>Email</label>
                <input style={S.input} value={f.email} onChange={e => sF({ ...f, email: e.target.value })} />
              </div>
            </div>
            <div style={S.fRow}>
              <div style={{ marginBottom: 8, flex: 1 }}>
                <label style={S.lbl}>Producto</label>
                <select style={S.input} value={f.product} onChange={e => sF({ ...f, product: e.target.value })}>
                  <option value="">-</option>
                  {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 8, flex: 1 }}>
                <label style={S.lbl}>Monto potencial</label>
                <input style={S.input} type="number" value={f.amount} onChange={e => sF({ ...f, amount: e.target.value })} />
              </div>
            </div>
            <div style={S.fRow}>
              <div style={{ marginBottom: 8, flex: 1 }}>
                <label style={S.lbl}>Canal</label>
                <select style={S.input} value={f.channel} onChange={e => sF({ ...f, channel: e.target.value })}>
                  <option value="">-</option>
                  {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 8, flex: 1 }}>
                <label style={S.lbl}>Follow-up</label>
                <input style={S.input} type="date" value={f.followUpDate} onChange={e => sF({ ...f, followUpDate: e.target.value })} />
              </div>
            </div>
            <div style={{ marginBottom: 8, flex: 1 }}>
              <label style={S.lbl}>Notas</label>
              <textarea style={{ ...S.input, minHeight: 62, resize: "vertical" }} value={f.notes} onChange={e => sF({ ...f, notes: e.target.value })} />
            </div>
            <div style={S.modalActions}>
              <button style={S.secBtn} onClick={onClose}>Cancelar</button>
              <button style={S.priBtn} onClick={() => f.name && onAdd(f)} disabled={!f.name}>Agregar</button>
            </div>
          </>
        )}

        {mode === "bulk" && (
          <>
            <p style={S.help}>Pegá una línea por lead: Nombre, Teléfono, Email, Producto, Monto, Notas. También podés pegar texto desordenado y la app intentará separarlo.</p>
            <div style={S.fRow}>
              <div style={{ marginBottom: 8, flex: 1 }}>
                <label style={S.lbl}>Producto por defecto</label>
                <select style={S.input} value={f.product} onChange={e => sF({ ...f, product: e.target.value })}>
                  <option value="">-</option>
                  {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 8, flex: 1 }}>
                <label style={S.lbl}>Canal por defecto</label>
                <select style={S.input} value={f.channel} onChange={e => sF({ ...f, channel: e.target.value })}>
                  <option value="">-</option>
                  {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 8, flex: 1 }}>
              <label style={S.lbl}>Follow-up inicial</label>
              <input style={S.input} type="date" value={f.followUpDate} onChange={e => sF({ ...f, followUpDate: e.target.value })} />
            </div>
            <textarea
              style={{ ...S.input, minHeight: 140, resize: "vertical", marginBottom: 12 }}
              value={bulk}
              onChange={e => setBulk(e.target.value)}
              autoFocus
              placeholder="Juan Perez, 11 5555-5555, juan@email.com, Crowdium, 250000&#10;Maria Gomez, 11 4444-4444, maria@email.com"
            />
            <LeadImportReviewEditable items={importItems} onChange={updateImportItem} onRemove={removeImportItem} />
            <div style={S.modalActions}>
              <button style={S.secBtn} onClick={onClose}>Cancelar</button>
              <button style={S.priBtn} onClick={() => onBulkAdd(ready.map(item => item.lead))} disabled={ready.length === 0}>
                Cargar listos ({ready.length})
              </button>
              {review.length > 0 && (
                <button style={S.secBtn} onClick={() => onBulkAdd([...ready, ...review].map(item => item.lead))}>
                  Cargar listos + revisar ({ready.length + review.length})
                </button>
              )}
            </div>
          </>
        )}

        {mode === "image" && (
          <>
            <p style={S.help}>Subí una captura de tu pipeline de clientes. La app utilizará Tesseract OCR para extraer automáticamente solo la columna de nombres.</p>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <label style={{ ...S.uploadBox, flex: 1, margin: 0 }}>
                <span style={{ fontWeight: 800, color: "#172033" }}>Seleccionar captura</span>
                <span style={{ fontSize: 11, color: "#667085" }}>PNG, JPG o WEBP.</span>
                <input id="ocr-file-input" style={{ display: "none" }} type="file" accept="image/*" onChange={e => readImage(e.target.files?.[0])} />
              </label>
              
              {detectedNames.length > 0 && (
                <button style={{ ...S.danBtn, marginLeft: 10 }} onClick={clearOcrImport}>
                  🧹 Limpiar importación
                </button>
              )}
            </div>

            {imageUrl && (
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <img src={imageUrl} alt="Captura cargada" style={{ ...S.imagePreview, margin: 0, width: "30%", height: 110 }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  {ocrStatus && (
                    <div style={{ ...S.ocrStatus, margin: 0, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>ℹ</span>
                      <span>{ocrStatus}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={S.fRow}>
              <div style={{ marginBottom: 8, flex: 1 }}>
                <label style={S.lbl}>Producto por defecto</label>
                <select style={S.input} value={f.product} onChange={e => sF({ ...f, product: e.target.value })}>
                  <option value="">-</option>
                  {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 8, flex: 1 }}>
                <label style={S.lbl}>Canal por defecto</label>
                <select style={S.input} value={f.channel} onChange={e => sF({ ...f, channel: e.target.value })}>
                  <option value="">-</option>
                  {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 8, flex: 1 }}>
              <label style={S.lbl}>Follow-up inicial</label>
              <input style={S.input} type="date" value={f.followUpDate} onChange={e => sF({ ...f, followUpDate: e.target.value })} />
            </div>

            {detectedNames.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <h3 style={{ ...S.importTitle, display: "flex", justifyContent: "space-between" }}>
                  <span>📋 NOMBRES DETECTADOS ({detectedNames.length})</span>
                  <span style={{ color: "#2563eb", fontWeight: "normal" }}>Hacé click para corregir ortografía</span>
                </h3>
                <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #dbe5f0", borderRadius: 8, padding: 8, background: "#f8fafc" }}>
                  {detectedNames.map((name, index) => (
                    <div key={index} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                      <input
                        style={{ ...S.importInput, flex: 1, padding: "5px 8px" }}
                        value={name}
                        onChange={e => editDetectedName(index, e.target.value)}
                        placeholder="Nombre de cliente"
                      />
                      <button
                        style={{ ...S.qBtnSmall, background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca", padding: "4px 8px", borderRadius: 4, fontWeight: "bold" }}
                        onClick={() => removeDetectedName(index)}
                        title="Quitar"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={S.modalActions}>
              <button style={S.secBtn} onClick={onClose}>Cancelar</button>
              <button style={S.priBtn} onClick={handleBulkAddOcr} disabled={detectedNames.length === 0}>
                Cargar leads ({detectedNames.length})
              </button>
            </div>
          </>
        )}
        {mode === "excel" && (
          <>
            <p style={S.help}>Subí un archivo Excel (.xlsx, .xls) o CSV. La app buscará automáticamente columnas como "Nombre", "Cliente", "Teléfono", "Mail", "Monto" y "Producto".</p>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <label
                style={{
                  ...S.uploadBox,
                  flex: 1,
                  margin: 0,
                  border: draggingExcel ? "2px dashed #2563eb" : "2px dashed #cbd5e1",
                  background: draggingExcel ? "#eff6ff" : "#f8fafc",
                  transition: "border-color 0.15s, background 0.15s",
                  cursor: "pointer",
                }}
                onDragOver={e => { e.preventDefault(); setDraggingExcel(true); }}
                onDragLeave={() => setDraggingExcel(false)}
                onDrop={handleExcelDrop}
              >
                <span style={{ fontWeight: 800, color: draggingExcel ? "#2563eb" : "#172033" }}>
                  {excelFileName ? `Archivo: ${excelFileName}` : draggingExcel ? "Soltá el archivo acá" : "Arrastrá o seleccioná un archivo Excel / CSV"}
                </span>
                <span style={{ fontSize: 11, color: "#667085" }}>.xlsx, .xls o .csv</span>
                <input id="excel-file-input" style={{ display: "none" }} type="file" accept=".xlsx,.xls,.csv" onChange={e => handleExcelUpload(e.target.files?.[0])} />
              </label>

              {excelFileName && (
                <button style={{ ...S.danBtn, marginLeft: 10 }} onClick={clearExcelImport}>
                  Limpiar
                </button>
              )}
            </div>

            {excelStatus && (
              <div style={{ ...S.ocrStatus, margin: "0 0 12px", background: "#ecfdf3", borderColor: "#bbf7d0", color: "#166534" }}>
                <span>ℹ</span>
                <span>{excelStatus}</span>
              </div>
            )}

            <div style={S.fRow}>
              <div style={{ marginBottom: 8, flex: 1 }}>
                <label style={S.lbl}>Producto por defecto</label>
                <select style={S.input} value={f.product} onChange={e => sF({ ...f, product: e.target.value })}>
                  <option value="">-</option>
                  {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 8, flex: 1 }}>
                <label style={S.lbl}>Canal por defecto</label>
                <select style={S.input} value={f.channel} onChange={e => sF({ ...f, channel: e.target.value })}>
                  <option value="">-</option>
                  {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 8, flex: 1 }}>
              <label style={S.lbl}>Follow-up inicial</label>
              <input style={S.input} type="date" value={f.followUpDate} onChange={e => sF({ ...f, followUpDate: e.target.value })} />
            </div>

            <LeadImportReviewEditable items={importItems} onChange={updateImportItem} onRemove={removeImportItem} />

            <div style={S.modalActions}>
              <button style={S.secBtn} onClick={onClose}>Cancelar</button>
              <button style={S.priBtn} onClick={() => onBulkAdd(ready.map(item => item.lead))} disabled={ready.length === 0}>
                Cargar listos ({ready.length})
              </button>
              {review.length > 0 && (
                <button style={S.secBtn} onClick={() => onBulkAdd([...ready, ...review].map(item => item.lead))}>
                  Cargar listos + revisar ({ready.length + review.length})
                </button>
              )}
            </div>
          </>
        )}
      </div>
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
              <input
                style={{ ...S.importInput, flex: 1.2 }}
                value={item.lead.name || ""}
                onChange={e => onChange(item.lead.id, { name: e.target.value })}
                placeholder="Nombre"
              />
              <input
                style={S.importInput}
                value={item.lead.phone || ""}
                onChange={e => onChange(item.lead.id, { phone: e.target.value })}
                placeholder="Teléfono"
              />
              <input
                style={S.importInput}
                value={item.lead.email || ""}
                onChange={e => onChange(item.lead.id, { email: e.target.value })}
                placeholder="Email"
              />
              <select
                style={S.importInput}
                value={item.lead.product || ""}
                onChange={e => onChange(item.lead.id, { product: e.target.value })}
              >
                <option value="">Producto</option>
                {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input
                style={S.importInput}
                value={item.lead.amount || ""}
                onChange={e => onChange(item.lead.id, { amount: cleanAmount(e.target.value) })}
                placeholder="Monto"
              />
              <span style={item.priority === "Alta" ? S.priorityHigh : item.priority === "Media" ? S.priorityMid : S.priorityLow}>
                {item.priority}
              </span>
              <button style={S.qBtnSmall} onClick={() => onRemove(item.lead.id)} title="Quitar">✕</button>
            </div>
          ))}
        </div>
      )}
      {invalid.length > 0 && (
        <p style={S.help}>
          Los incompletos no se cargan con "Cargar listos", pero podés completarlos acá y pasan a listos automáticamente.
        </p>
      )}
    </div>
  );
}

export function IntModal({ leadId, onAdd, onClose }) {
  const [f, sF] = useState({ type: "Llamada", note: "", followUpDate: dateInDays(10) });

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h2 style={S.mTitle}>Registrar interacción</h2>
        <div style={S.fRow}>
          <div style={{ marginBottom: 8, flex: 1 }}>
            <label style={S.lbl}>Tipo</label>
            <select style={S.input} value={f.type} onChange={e => sF({ ...f, type: e.target.value })}>
              {["Llamada", "WhatsApp", "Email", "Presencial", "Otro"].map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 8, flex: 1 }}>
            <label style={S.lbl}>Próximo follow-up</label>
            <input style={S.input} type="date" value={f.followUpDate} onChange={e => sF({ ...f, followUpDate: e.target.value })} />
          </div>
        </div>
        <div style={S.presetRow}>
          {FOLLOW_UP_PRESETS.map(p => (
            <button
              key={p.label}
              style={S.fOff}
              onClick={() => sF({ ...f, followUpDate: dateInDays(p.days) })}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ marginBottom: 8, flex: 1 }}>
          <label style={S.lbl}>Nota</label>
          <textarea
            style={{ ...S.input, minHeight: 62, resize: "vertical" }}
            value={f.note}
            onChange={e => sF({ ...f, note: e.target.value })}
            autoFocus
          />
        </div>
        <div style={S.modalActions}>
          <button style={S.secBtn} onClick={onClose}>Cancelar</button>
          <button style={S.priBtn} onClick={() => f.note && onAdd({ ...f, leadId })} disabled={!f.note}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

export function LossModal({ onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState("");

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h2 style={S.mTitle}>¿Por qué se perdió?</h2>
        <p style={S.help}>Elegí el motivo para poder detectar patrones.</p>
        <div style={S.lossList}>
          {LOSS_REASONS.map(r => (
            <button
              key={r}
              onClick={() => setReason(r)}
              style={
                reason === r
                  ? { ...S.lossOpt, background: "#f8717120", borderColor: "#f87171", color: "#f87171" }
                  : S.lossOpt
              }
            >
              {r}
            </button>
          ))}
        </div>
        {reason === "Otro" && (
          <div style={{ marginBottom: 8, flex: 1, marginTop: 8 }}>
            <label style={S.lbl}>Motivo</label>
            <input style={S.input} value={custom} onChange={e => setCustom(e.target.value)} autoFocus />
          </div>
        )}
        <div style={S.modalActions}>
          <button style={S.secBtn} onClick={onClose}>Cancelar</button>
          <button
            style={S.danBtn}
            onClick={() => reason && onConfirm(reason === "Otro" ? custom || "Otro" : reason)}
            disabled={!reason}
          >
            Confirmar pérdida
          </button>
        </div>
      </div>
    </div>
  );
}
