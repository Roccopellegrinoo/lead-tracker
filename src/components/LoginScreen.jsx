import { useState } from "react";
import { S } from "../lib/styles";
import { clean } from "../lib/utils";

export default function LoginScreen({ users, onLogin, onCreate, onImportBackup, onConnectCloud, cloudStatus }) {
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
            <div style={{ marginBottom: 8, flex: 1 }}>
              <label style={S.lbl}>Cuenta</label>
              <select style={S.input} value={userId} onChange={e => setUserId(e.target.value)}>
                <option value="">-</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 8, flex: 1 }}>
              <label style={S.lbl}>PIN</label>
              <input style={S.input} type="password" value={pin} onChange={e => setPin(e.target.value)} autoFocus />
            </div>
            {error && <p style={S.errorText}>{error}</p>}
            <button style={{ ...S.priBtn, width: "100%", marginTop: 8 }} onClick={submitLogin} disabled={!userId || !pin}>Entrar</button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 8, flex: 1 }}>
              <label style={S.lbl}>Nombre del usuario</label>
              <input style={S.input} value={name} onChange={e => setName(e.target.value)} autoFocus />
            </div>
            <div style={{ marginBottom: 8, flex: 1 }}>
              <label style={S.lbl}>PIN (mínimo 4 números)</label>
              <input style={S.input} type="password" value={pin} onChange={e => setPin(e.target.value)} />
            </div>
            <button style={{ ...S.priBtn, width: "100%", marginTop: 8 }} onClick={submitCreate} disabled={!canCreate}>Crear y entrar</button>
          </>
        )}
        <div style={{ ...S.buttonRow, justifyContent: "center" }}>
          <button style={S.secBtn} onClick={onConnectCloud}>Conectar nube</button>
          <label style={{ ...S.secBtn, display: "inline-flex", cursor: "pointer" }}>
            Importar backup
            <input style={{ display: "none" }} type="file" accept="application/json,.json" onChange={e => onImportBackup(e.target.files?.[0])} />
          </label>
        </div>
        <p style={{ ...S.help, textAlign: "center", marginTop: 8 }}>Estado: {cloudStatus}</p>
        <p style={{ ...S.help, marginTop: 14 }}>Los datos se guardan localmente en este navegador. Usá backup para moverlos entre URLs o equipos.</p>
      </div>
    </div>
  );
}
