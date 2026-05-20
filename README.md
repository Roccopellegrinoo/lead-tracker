# Lead Tracker

CRM liviano para cargar leads, gestionar seguimiento y armar pipeline.

## Requisitos

- Node.js 18 o superior
- npm

## Instalacion

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

La app abre en la URL local que indique Vite, normalmente `http://localhost:5173`.

## Build

```bash
npm run build
```

## Notas

- Los datos se guardan en `localStorage` por usuario/cuenta.
- La importacion desde captura usa OCR con Tesseract y, para capturas de tabla, carga solo nombres.
- Usar `Exportar` para descargar un backup JSON de cuentas, leads e interacciones.
- Usar `Importar backup` para restaurar datos si se cambia de navegador, equipo o URL.
- Para almacenamiento compartido, la app puede sincronizar contra Supabase usando la API `/api/state`.

## Sincronizacion en la nube con Supabase

1. Crear un proyecto en Supabase.
2. Abrir el SQL Editor y ejecutar `supabase/schema.sql`.
3. Copiar estos valores:
   - Project URL
   - Service role key
4. Configurar variables en Vercel:

```bash
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add TRACKER_SYNC_TOKEN production
vercel env add TRACKER_WORKSPACE_ID production
```

`TRACKER_SYNC_TOKEN` es la clave privada del equipo. Cada usuario la ingresa con el boton `Conectar nube`.

5. Deploy:

```bash
npx vercel --prod --yes
```

La app sigue funcionando local si no hay nube configurada.
