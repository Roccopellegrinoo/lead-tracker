import { useState, useEffect } from "react";
import { S } from "../lib/styles";
import { STAGES, TEMP, PRODUCTS, FM } from "../lib/constants";
import { getTemp, isOverdue, cleanAmount, fmtMoney, fmtFull } from "../lib/utils";

export default function Lista({ leads, ints, onSelect, onUpdate, onDelete, onBulkDelete, focus, setFocus }) {
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

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const bulkDelete = () => {
    onBulkDelete(selected);
    setSelected([]);
    setConfirmBulkDelete(false);
  };

  return (
    <div style={S.fade}>
      <div style={S.listToolbar}>
        <div style={S.filterBar}>
          {focusOpts.map(([id, label]) => (
            <button key={id} style={focus === id ? S.fOn : S.fOff} onClick={() => setFocus(id)}>
              {label}
            </button>
          ))}
        </div>
        <div style={S.listActions}>
          <label style={S.pageSizeControl}>
            Mostrar
            <select
              style={S.pageSizeSelect}
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={Math.max(fl.length, 1)}>Todos</option>
            </select>
          </label>
          <button style={S.secBtn} onClick={toggleAllVisible}>
            {allVisibleSelected ? "Deseleccionar página" : "Seleccionar página"}
          </button>
          {fl.length > visibleIds.length && (
            <button style={S.secBtn} onClick={selectAllFiltered}>
              Seleccionar {fl.length} filtrados
            </button>
          )}
          {selected.length > 0 && <button style={S.secBtn} onClick={clearSelected}>Limpiar selección</button>}
          <button
            style={editingList ? S.priBtn : S.secBtn}
            onClick={() => setEditingList(!editingList)}
          >
            {editingList ? "Terminar edición" : "Editar lista"}
          </button>
          {selected.length > 0 && (
            confirmBulkDelete ? (
              <>
                <button style={S.danBtn} onClick={bulkDelete}>Confirmar borrar {selected.length}</button>
                <button style={S.secBtn} onClick={() => setConfirmBulkDelete(false)}>Cancelar</button>
              </>
            ) : (
              <button style={S.danBtn} onClick={() => setConfirmBulkDelete(true)}>
                Borrar seleccionados ({selected.length})
              </button>
            )
          )}
        </div>
      </div>
      <div style={S.filterBar}>
        <button style={stgFilter === "all" ? S.fOn : S.fOff} onClick={() => setStgFilter("all")}>
          Todas las etapas
        </button>
        {STAGES.map(s => (
          <button key={s.id} style={stgFilter === s.id ? S.fOn : S.fOff} onClick={() => setStgFilter(s.id)}>
            <span style={{ color: s.color }}>{s.icon}</span> {s.label}
          </button>
        ))}
        <span style={S.divider} />
        {Object.entries(TEMP).map(([k, v]) => (
          <button
            key={k}
            style={tempFilter === k ? S.fOn : S.fOff}
            onClick={() => setTempFilter(tempFilter === k ? "all" : k)}
            title={v.name}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div style={S.tHead}>
        <span style={{ width: 28 }}>
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
        </span>
        <span style={{ flex: 2 }}>Nombre</span>
        <span style={{ flex: 1 }}>Teléfono</span>
        <span style={{ flex: 1.3 }}>Email</span>
        <span style={{ flex: 1 }}>Producto</span>
        <span style={{ flex: 1 }}>Monto</span>
        <span style={{ flex: 1 }}>Estado</span>
        <span style={{ flex: 1 }}>Follow-up</span>
      </div>
      <div style={S.selectionBar}>
        <span>{selected.length} seleccionado{selected.length === 1 ? "" : "s"}</span>
        <span>Mostrando {pageLeads.length} de {fl.length}</span>
        <div style={S.pager}>
          <button style={S.fOff} onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage === 1}>
            Anterior
          </button>
          <span>Página {safePage} / {totalPages}</span>
          <button style={S.fOff} onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage === totalPages}>
            Siguiente
          </button>
        </div>
      </div>
      {pageLeads.map(l => {
        const stg = STAGES.find(s => s.id === l.stage);
        const od = isOverdue(l.followUpDate) && !["invertido", "perdido"].includes(l.stage);
        if (editingList) {
          return (
            <div key={l.id} style={S.tRowEdit}>
              <input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggleLead(l.id)} />
              <input
                style={{ ...S.gridInput, flex: 2 }}
                value={l.name || ""}
                onChange={e => onUpdate(l.id, { name: e.target.value })}
                placeholder="Nombre"
              />
              <input
                style={S.gridInput}
                value={l.phone || ""}
                onChange={e => onUpdate(l.id, { phone: e.target.value })}
                placeholder="Teléfono"
              />
              <input
                style={{ ...S.gridInput, flex: 1.3 }}
                value={l.email || ""}
                onChange={e => onUpdate(l.id, { email: e.target.value })}
                placeholder="Email"
              />
              <select
                style={S.gridInput}
                value={l.product || ""}
                onChange={e => onUpdate(l.id, { product: e.target.value })}
              >
                <option value="">Producto</option>
                {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input
                style={S.gridInput}
                value={l.amount || ""}
                onChange={e => onUpdate(l.id, { amount: cleanAmount(e.target.value) })}
                placeholder="Monto"
              />
              <select
                style={S.gridInput}
                value={l.stage || "nuevo"}
                onChange={e => onUpdate(l.id, { stage: e.target.value })}
              >
                {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <input
                style={S.gridInput}
                type="date"
                value={l.followUpDate?.slice(0, 10) || ""}
                onChange={e => onUpdate(l.id, { followUpDate: e.target.value })}
              />
            </div>
          );
        }
        return (
          <div key={l.id} style={S.tRow} onClick={() => onSelect(l)}>
            <span style={{ width: 28 }} onClick={e => e.stopPropagation()}>
              <input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggleLead(l.id)} />
            </span>
            <span style={{ flex: 2, fontWeight: 700, color: "#172033" }}>{l.name}</span>
            <span style={S.tableMuted}>{l.phone || "-"}</span>
            <span style={{ ...S.tableMuted, flex: 1.3 }}>{l.email || "-"}</span>
            <span style={S.tableMuted}>{l.product || "-"}</span>
            <span style={{ flex: 1, color: "#172033", fontFamily: FM }}>
              {fmtMoney(l.amount) || "-"}
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ ...S.pill, background: stg?.color + "20", color: stg?.color }}>
                {stg?.label}
              </span>
            </span>
            <span style={{ flex: 1, color: od ? "#b91c1c" : "#667085" }}>
              {l.followUpDate ? fmtFull(l.followUpDate) : "-"}
            </span>
          </div>
        );
      })}
      {fl.length === 0 && <p style={S.noResults}>Sin resultados</p>}
    </div>
  );
}
