import { S } from "../lib/styles";
import { getCloudToken } from "../lib/storage";

export default function Nav({
  view,
  setView,
  onAdd,
  overdue,
  todayCount,
  search,
  setSearch,
  currentUser,
  onNewUser,
  onLogout,
  onExportBackup,
  onImportBackup,
  onConnectCloud,
  onDisconnectCloud,
  cloudStatus
}) {
  const tabs = [
    { id: "midia", label: "Mi día" },
    { id: "kanban", label: "Pipeline" },
    { id: "lista", label: "Lista" },
    { id: "calendario", label: "Calendario" },
    { id: "dashboard", label: "Dashboard" }
  ];

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
          <input
            style={S.searchBox}
            placeholder="Buscar lead, teléfono, producto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button style={S.addBtn} onClick={onAdd}>+ Lead</button>
          <span style={S.userBadge}>{currentUser?.name}</span>
          <span style={S.cloudBadge}>{cloudStatus}</span>
          <button style={S.secBtn} onClick={getCloudToken() ? onDisconnectCloud : onConnectCloud}>
            {getCloudToken() ? "Desconectar nube" : "Conectar nube"}
          </button>
          <button style={S.secBtn} onClick={onExportBackup}>Exportar</button>
          <label style={{ ...S.secBtn, display: "inline-flex", cursor: "pointer" }}>
            Importar
            <input
              style={{ display: "none" }}
              type="file"
              accept="application/json,.json"
              onChange={e => onImportBackup(e.target.files?.[0])}
            />
          </label>
          <button style={S.secBtn} onClick={onNewUser}>+ Cuenta</button>
          <button style={S.secBtn} onClick={onLogout}>Salir</button>
        </div>
      </div>
      <div style={S.tabs}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            style={view === t.id ? S.tabOn : S.tabOff}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
