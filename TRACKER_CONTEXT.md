# Lead Tracker - Contexto y pasos a seguir

Este archivo sirve como memoria del proyecto para retomar trabajo sin perder contexto.

## Links importantes

- App en produccion: https://lead-tracker-khaki.vercel.app
- Repo GitHub: https://github.com/Roccopellegrinoo/lead-tracker
- Rama principal: `main`

## Objetivo del tracker

Crear un CRM liviano para seguimiento de leads:

- Cargar leads manualmente, por lista pegada o desde captura.
- Organizar leads por estado del pipeline.
- Ver tareas del dia, vencidos y contactos pendientes.
- Registrar interacciones.
- Usar acciones rapidas para llamadas, no atendio y seguimiento.
- Mantener datos separados por cuenta/usuario local.

## Stack actual

- Vite
- React 18
- Tesseract.js para OCR
- Persistencia en `localStorage`
- Backup manual JSON con exportacion/importacion desde la UI
- Deploy en Vercel

Archivos principales:

- `src/App.jsx`: contiene practicamente toda la app.
- `src/main.jsx`: monta React.
- `package.json`: scripts y dependencias.
- `README.md`: instrucciones basicas.

## Modelo de datos actual

Los leads se guardan por usuario en `localStorage`.

Campos principales de lead:

- `id`
- `name`
- `phone`
- `email`
- `product`
- `amount`
- `channel`
- `followUpDate`
- `notes`
- `createdAt`
- `stage`
- `attempts`
- `lastContact`
- `closedAt`
- `lostAt`
- `lossReason`

Las interacciones tienen:

- `id`
- `leadId`
- `type`
- `note`
- `date`

## Etapas del pipeline

- `nuevo`
- `contactado`
- `interesado`
- `propuesta`
- `invertido`
- `perdido`

## Productos y canales

Productos:

- Crowdium
- TechFinance

Canales:

- WhatsApp
- Llamada
- Email
- Presencial
- Sendis

## Funcionalidades actuales

- Login/cuentas locales con PIN.
- Vista "Mi dia" con vencidos, hoy, manana y leads sin tocar.
- Kanban por etapas.
- Lista con filtros, paginacion, seleccion multiple y edicion inline.
- Calendario mensual de seguimientos por `followUpDate`.
- Dashboard simple con pipeline, conversion, perdidos y actividad.
- Detalle de lead con historial e interacciones.
- Carga manual de un lead.
- Carga masiva pegando lista.
- Carga desde captura con OCR.

## Estado del OCR

Decision actual: para capturas de tablas, importar solo nombres.

Motivo:

- El OCR mezclaba columnas: etiqueta, email, fecha y telefono terminaban dentro del nombre.
- El usuario pidio explicitamente cargar solo los nombres.

Implementacion actual:

- Lee un recorte izquierdo de la imagen, donde esta la columna `Cliente`.
- Busca nombres en mayusculas antes del id tipo `#201258`.
- Convierte `JUAN CORNALBA` a `Juan Cornalba`.
- Descarta headers, estados, fechas, mails y textos como `No contesta`.
- Los leads importados desde captura entran como listos aunque no tengan email/telefono.

Riesgo:

- Si la captura viene recortada distinto o la columna Cliente no esta a la izquierda, puede detectar menos nombres.
- Si se vuelve a querer email/telefono, conviene hacerlo como segunda pasada, no mezclado con el nombre.

## Problemas conocidos

- `src/App.jsx` esta muy grande y deberia separarse en componentes/helpers.
- Hay textos con caracteres rotos por encoding, por ejemplo `TelÃ©fono`, `MaÃ±ana`, etc.
- La app guarda todo en `localStorage`; no hay backend ni sincronizacion entre equipos.
- No hay tests automatizados.
- El OCR depende mucho de la calidad y el recorte de la captura.
- No hay roles/permisos reales; las cuentas son locales.
- Los datos no se comparten entre dispositivos.
- El calendario usa solo `followUpDate`; todavia no permite crear eventos independientes.
- Para no perder datos entre URLs/navegadores, usar `Exportar` y `Importar backup`.
- El siguiente salto importante es migrar de `localStorage` a una base de datos compartida.

## Prioridades sugeridas

1. Arreglar encoding y textos visibles.
2. Separar `App.jsx` en archivos:
   - `constants`
   - `storage`
   - `ocr`
   - `components`
   - `views`
3. Mejorar UX de importacion:
   - Preview claro de nombres detectados.
   - Boton para borrar todos los importados recientes.
   - Mensaje de "solo nombres" visible.
4. Mejorar calendario:
   - vista semanal
   - drag & drop para mover follow-ups
   - filtros por etapa/responsable
   - crear eventos/tareas sin lead
5. Agregar importacion CSV simple.
6. Agregar tests para parseo/OCR helpers.
7. Agregar exportacion de leads a CSV.
8. Evaluar backend compartido:
   - Supabase
   - Firebase
   - Neon/Postgres
   - Vercel Postgres/Neon
9. Agregar autenticacion real si el equipo lo necesita.
10. Mejorar dashboard con metricas utiles:
   - conversion por etapa
   - leads por responsable
   - llamadas por dia
   - vencidos por antiguedad
11. Mejorar mobile/responsividad.

## Plan recomendado para la proxima sesion

### Paso 1: limpieza tecnica

- Crear carpeta `src/lib`.
- Mover helpers de fechas, storage, OCR y parseo.
- Crear carpeta `src/components`.
- Mantener comportamiento igual mientras se separa codigo.

### Paso 2: corregir texto/encoding

- Reemplazar textos mojibake por espanol correcto o ASCII consistente.
- Revisar botones, labels, estados, mensajes y README.

### Paso 3: mejorar importacion desde captura

- Mostrar claramente cuantos nombres se detectaron.
- Agregar una lista editable solo de nombres.
- Evitar cargar headers aunque el OCR los lea.
- Agregar boton "Limpiar importacion".

### Paso 4: prepararlo para equipo

- Documentar flujo para colaboradores.
- Crear issues en GitHub para mejoras.
- Agregar convenciones basicas:
  - correr `npm run build` antes de push
  - no subir `dist`, `.vercel`, `node_modules`

## Comandos utiles

Instalar:

```bash
npm install
```

Desarrollo:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Commit y push:

```bash
git status
git add .
git commit -m "mensaje"
git push
```

Deploy manual a Vercel:

```bash
npx vercel --prod --yes
```

## Como retomar con Codex

Al empezar una nueva conversacion, pedir:

```text
Lee TRACKER_CONTEXT.md y sigamos desde el plan recomendado.
```

Si el foco es OCR:

```text
Lee TRACKER_CONTEXT.md y mejoremos la importacion desde captura para que solo cargue nombres.
```

Si el foco es refactor:

```text
Lee TRACKER_CONTEXT.md y empecemos separando App.jsx sin cambiar comportamiento.
```
