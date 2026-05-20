import { useCallback, useEffect, useMemo, useState } from "react";
import { S } from "./lib/styles";
import { STAGES, QUICK_ACTIONS, F } from "./lib/constants";
import {
  lsGet,
  lsSet,
  userLeadsKey,
  userIntsKey,
  SK_USERS,
  SK_SESSION,
  getCloudToken,
  setCloudToken,
  clearCloudToken,
  restoreBackupData,
  restoreStorageBackup,
  fetchCloudBackup,
  saveCloudBackup,
  makeUser,
  downloadStorageBackup
} from "./lib/storage";
import {
  uid,
  dateInDays,
  daysAgo,
  isOverdue,
  isToday,
  isTomorrow,
  dateKey,
  getTemp,
  makeLead,
  clean,
  cleanAmount
} from "./lib/utils";

// Component imports
import LoginScreen from "./components/LoginScreen";
import Nav from "./components/Nav";
import MiDia from "./components/MiDia";
import Kanban from "./components/Kanban";
import Lista from "./components/Lista";
import Calendario from "./components/Calendario";
import Dashboard from "./components/Dashboard";
import Detail from "./components/Detail";

// Modals imports
import { AddModal, AccountModal, IntModal, LossModal } from "./components/Modals";

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
  const [cloudStatus, setCloudStatus] = useState(getCloudToken() ? "Nube conectada" : "Local");
  const [dropOverlay, setDropOverlay] = useState(false);

  const loadSessionFromStorage = useCallback(() => {
    const storedUsers = lsGet(SK_USERS) || [];
    setUsers(storedUsers);
    const sessionId = lsGet(SK_SESSION);
    const sessionUser = storedUsers.find(u => u.id === sessionId) || storedUsers[0] || null;
    setCurrentUser(sessionUser);
    if (sessionUser) {
      setLeads(lsGet(userLeadsKey(sessionUser.id)) || []);
      setInts(lsGet(userIntsKey(sessionUser.id)) || []);
      lsSet(SK_SESSION, sessionUser.id);
    } else {
      setLeads([]);
      setInts([]);
    }
    setSel(null);
    setView("midia");
  }, []);

  const syncToCloud = useCallback(async () => {
    const token = getCloudToken();
    if (!token) return;
    try {
      setCloudStatus("Sincronizando...");
      await saveCloudBackup(token);
      setCloudStatus("Nube sincronizada");
    } catch {
      setCloudStatus("Nube sin conexion");
    }
  }, []);

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

  useEffect(() => {
    const token = getCloudToken();
    if (!token) return;
    let cancelled = false;
    setCloudStatus("Conectando nube...");
    fetchCloudBackup(token)
      .then(({ payload }) => {
        if (cancelled) return;
        if (payload?.data) {
          restoreBackupData(payload);
          loadSessionFromStorage();
          setCloudStatus("Nube sincronizada");
        } else {
          syncToCloud();
        }
      })
      .catch(() => {
        if (!cancelled) setCloudStatus("Nube sin conexion");
      });
    return () => {
      cancelled = true;
    };
  }, [loadSessionFromStorage, syncToCloud]);

  const importBackup = async (file) => {
    if (!file) return;
    const ok = window.confirm("Importar este backup reemplaza las cuentas y leads guardados en este navegador. Continuar?");
    if (!ok) return;
    try {
      await restoreStorageBackup(file);
      loadSessionFromStorage();
      window.alert("Backup importado. Tus cuentas y leads fueron restaurados.");
    } catch {
      window.alert("No pude importar el backup. Revisá que sea un archivo JSON exportado desde Lead Tracker.");
    }
  };

  const connectCloud = async () => {
    const token = clean(window.prompt("Clave de equipo para sincronizar en la nube:"));
    if (!token) return;
    try {
      setCloudStatus("Conectando nube...");
      setCloudToken(token);
      const { payload } = await fetchCloudBackup(token);
      if (payload?.data) {
        restoreBackupData(payload);
        loadSessionFromStorage();
      } else {
        await saveCloudBackup(token);
      }
      setCloudStatus("Nube sincronizada");
      window.alert("Nube conectada. Los datos se sincronizan con la base compartida.");
    } catch {
      clearCloudToken();
      setCloudStatus("Local");
      window.alert("No pude conectar la nube. Revisá la clave de equipo o la configuración de Supabase/Vercel.");
    }
  };

  const disconnectCloud = () => {
    clearCloudToken();
    setCloudStatus("Local");
    window.alert("Nube desconectada en este navegador. Tus datos locales siguen guardados.");
  };

  const saveUsers = (nextUsers) => {
    setUsers(nextUsers);
    lsSet(SK_USERS, nextUsers);
    syncToCloud();
  };

  const selectUser = (user) => {
    setCurrentUser(user);
    setLeads(lsGet(userLeadsKey(user.id)) || []);
    setInts(lsGet(userIntsKey(user.id)) || []);
    setSel(null);
    setView("midia");
    lsSet(SK_SESSION, user.id);
    syncToCloud();
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
    syncToCloud();
  }, [currentUser, syncToCloud]);

  const saveI = useCallback((i) => {
    setInts(i);
    if (currentUser) lsSet(userIntsKey(currentUser.id), i);
    syncToCloud();
  }, [currentUser, syncToCloud]);

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

  const handleAppDragOver = (e) => {
    const hasJson = [...(e.dataTransfer.items || [])].some(i => i.type === "application/json" || i.type === "");
    if (hasJson || e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      setDropOverlay(true);
    }
  };

  const handleAppDrop = (e) => {
    e.preventDefault();
    setDropOverlay(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".json"))) importBackup(file);
  };

  if (loading) return <div style={S.loading}><div style={S.spinner} /><p style={{ color: "#667085", marginTop: 16, fontFamily: F }}>Cargando...</p></div>;
  if (!currentUser) return <LoginScreen users={users} onLogin={loginUser} onCreate={createUser} onImportBackup={importBackup} onConnectCloud={connectCloud} cloudStatus={cloudStatus} />;

  return (
    <div
      style={S.app}
      onDragOver={handleAppDragOver}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropOverlay(false); }}
      onDrop={handleAppDrop}
    >
      {dropOverlay && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "#2563eb22", border: "3px dashed #2563eb",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "32px 48px", boxShadow: "0 8px 32px #0002", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📥</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#2563eb" }}>Soltá el backup para importar</div>
            <div style={{ color: "#667085", fontSize: 13, marginTop: 4 }}>Archivo .json exportado desde Lead Tracker</div>
          </div>
        </div>
      )}
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

      <Nav
        view={view}
        setView={setView}
        onAdd={() => setModal("add")}
        overdue={overdue.length}
        todayCount={today.length}
        search={search}
        setSearch={setSearch}
        currentUser={currentUser}
        onNewUser={() => setModal("account")}
        onLogout={logout}
        onExportBackup={downloadStorageBackup}
        onImportBackup={importBackup}
        onConnectCloud={connectCloud}
        onDisconnectCloud={disconnectCloud}
        cloudStatus={cloudStatus}
      />

      <div style={S.body}>
        {view === "midia" && (
          <MiDia
            overdue={overdue}
            today={today}
            tomorrow={tomorrow}
            hotNoAction={hotNoAction}
            fu10d={fu10d}
            untouched={untouched}
            ints={ints}
            onSelect={(l) => { setSel(l); setView("detail"); }}
            onUpdate={updateLead}
            onDelete={deleteLead}
            quickAction={quickAction}
            pipeline$={pipeline$}
            convRate={convRate}
            active={active}
            onAdd={() => setModal("add")}
          />
        )}
        {view === "kanban" && (
          <Kanban
            leads={filtered}
            ints={ints}
            onSelect={(l) => { setSel(l); setView("detail"); }}
            onMove={moveLead}
            dragId={dragId}
            setDragId={setDragId}
            quickAction={quickAction}
          />
        )}
        {view === "lista" && (
          <Lista
            leads={filtered}
            ints={ints}
            onSelect={(l) => { setSel(l); setView("detail"); }}
            onUpdate={updateLead}
            onDelete={deleteLead}
            onBulkDelete={deleteLeads}
            focus={listFocus}
            setFocus={setListFocus}
          />
        )}
        {view === "calendario" && (
          <Calendario
            leads={active}
            ints={ints}
            onSelect={(l) => { setSel(l); setView("detail"); }}
            onUpdate={updateLead}
            quickAction={quickAction}
          />
        )}
        {view === "dashboard" && (
          <Dashboard
            leads={leads}
            ints={ints}
            pipeline$={pipeline$}
            convRate={convRate}
            converted={converted}
            active={active}
          />
        )}
        {view === "detail" && sel && (
          <Detail
            lead={leads.find(l => l.id === sel.id) || sel}
            ints={getLeadInts(sel.id)}
            allInts={ints}
            onBack={() => { setSel(null); setView("midia"); }}
            onUpdate={(u) => updateLead(sel.id, u)}
            onDelete={() => deleteLead(sel.id)}
            onAddInt={() => setModal("interaction")}
            onMove={(s) => moveLead(sel.id, s)}
            quickAction={(a) => quickAction(sel.id, a)}
            setFollowUp={(days) => setFollowUp(sel.id, days)}
          />
        )}
      </div>

      {modal === "add" && (
        <AddModal
          onAdd={addLead}
          onBulkAdd={addBulkLeads}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "account" && (
        <AccountModal
          onCreate={(data) => { createUser(data); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "interaction" && sel && (
        <IntModal
          leadId={sel.id}
          onAdd={addInteraction}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "loss" && (
        <LossModal
          onConfirm={confirmLoss}
          onClose={() => { setModal(null); setLossLeadId(null); }}
        />
      )}
    </div>
  );
}
