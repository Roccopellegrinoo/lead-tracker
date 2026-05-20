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
- Para almacenamiento compartido entre varias personas hace falta conectar una base de datos.
