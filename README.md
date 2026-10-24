# Autos Colombia – Sistema de parqueadero (Iteración 1)

Gestión de entrada y salida de vehículos para un parqueadero por mensualidad.
Hecho en JavaScript sobre Google Apps Script, con Google Sheets como base de datos.

**Aplicación en línea:** https://script.google.com/macros/s/AKfycbwLJSFLFBG6HcqMWdBG2yh97Zs2sVupw_2Q59ax7Xp3TH1s5jUOUpncvyI7-QGZWzqS/exec

## Funcionalidades de la iteración 1

| Requerimiento | Función en el código |
|---|---|
| RF01 Autenticar operador | `iniciarSesion` (Auth.js) |
| RF02–RF05 Registrar entrada, registrar vehículo nuevo, evitar doble ingreso, asignar celda | `registrarEntrada` (RegistroService.js) |
| RF06 Registrar salida | `registrarSalida` |
| RF07 Consultar ocupación | `obtenerOcupacion` |
| RF08 Consultar historial (admin) | `consultarHistorial` |
| RF09 Registrar novedad | `registrarNovedad`, `listarNovedades` |

## Estructura

```
src/
  Index.html          Presentación: interfaz web (HTML, CSS, JS)
  Code.js             Entrada web (doGet) y setup de la base de datos
  Auth.js             Seguridad: sesiones y contraseñas con SHA-256 + salt
  RegistroService.js  Negocio: entrada, salida, ocupación, historial y novedades
  Db.js               Datos: lectura y escritura en Google Sheets
  appsscript.json     Manifiesto del proyecto
Codigo.gs             Los cuatro archivos del servidor en uno solo (para pegar en el editor)
pruebas.js            Pruebas automáticas: node pruebas.js Codigo.gs
```

## Modelo físico (hojas de cálculo)

| Hoja | Columnas | Clave |
|---|---|---|
| Operadores | id, usuario, nombre, rol, hash, salt, activo | id |
| Usuarios | id, documento, nombre, telefono, email | id |
| Vehiculos | placa, tipo, marca, color, usuario_id | placa (FK usuario_id) |
| Mensualidades | id, usuario_id, fecha_inicio, fecha_fin, valor, estado | id (FK usuario_id) |
| Celdas | codigo, tipo, estado | codigo |
| Registros | id, placa, celda, fecha_entrada, fecha_salida, operador_entrada, operador_salida, estado | id (FK placa, celda, operadores) |
| Novedades | id, registro_id, placa, descripcion, fecha, operador | id (FK registro_id, operador) |

## Instalación con clasp

1. Instala Node.js y luego clasp: `npm install -g @google/clasp`
2. Activa la API de Apps Script en https://script.google.com/home/usersettings
3. Inicia sesión: `clasp login`
4. Desde la raíz del repositorio, crea el proyecto:
   `clasp create --type standalone --title "Autos Colombia Parqueadero" --rootDir src`
   (en clasp 3 el comando es `clasp create-script`). Si clasp reemplaza `src/appsscript.json`, restáuralo con `git checkout src/appsscript.json`.
5. Sube el código: `clasp push`
6. Abre el editor con `clasp open`, selecciona la función `setup` y ejecútala. Acepta los permisos. En el registro de ejecución aparece el enlace del Spreadsheet creado.
7. Implementar → Nueva implementación → tipo Aplicación web → Implementar. Esa URL es la aplicación corriendo.

## Usuarios iniciales

| Usuario | Contraseña | Rol |
|---|---|---|
| admin | Admin123* | ADMIN (incluye historial) |
| operador | Operador123* | OPERADOR |

## Subir a GitHub

```
git init
git add .
git commit -m "Iteración 1: entrada y salida de vehículos"
git branch -M main
git remote add origin https://github.com/USUARIO/autos-colombia.git
git push -u origin main
```

`.clasp.json` (contiene el scriptId) puede subirse. Las credenciales de clasp quedan en tu carpeta personal y no se suben.
