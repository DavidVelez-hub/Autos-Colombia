# Autos Colombia – Sistema de parqueadero (Iteraciones 1 y 2)

Gestión de entradas y salidas, usuarios, vehículos, operadores y celdas para un parqueadero por mensualidad.
Hecho en JavaScript sobre Google Apps Script, con Google Sheets como base de datos.

**Aplicación en línea:** https://script.google.com/macros/s/AKfycbwLJSFLFBG6HcqMWdBG2yh97Zs2sVupw_2Q59## Funcionalidades

| Iteración | Requerimiento | Función en el código |
|---|---|---|
| 1 | RF01 Autenticar operador | `iniciarSesion` (Auth.js) |
| 1 | RF02–RF05 Entrada, vehículo nuevo, doble ingreso, celda | `registrarEntrada` (RegistroService.js) |
| 1 | RF06 Salida · RF07 Ocupación · RF08 Historial · RF09 Novedades | `registrarSalida`, `obtenerOcupacion`, `consultarHistorial`, `registrarNovedad` |
| 2 | RF10–RF15 Usuarios del parqueadero y sus vehículos | `guardarUsuario`, `listarUsuarios`, `obtenerUsuario`, `cambiarEstadoUsuario`, `asociarVehiculo`, `desasociarVehiculo` (UsuariosService.js) |
| 2 | RF16–RF17 Operadores | `guardarOperador`, `listarOperadores`, `cambiarEstadoOperador` (OperadoresService.js) |
| 2 | RF18–RF22 Celdas | `listarCeldas`, `crearCeldas`, `actualizarCelda` (CeldasService.js) |
| 2 | RF23 Celda fija en la entrada | `registrarEntrada` (RegistroService.js) |

## Funcionalidades de la iteración 2

| Requerimiento | Función en el código |
|---|---|
| RF10–RF12 Registrar, buscar y actualizar clientes | `guardarCliente`, `listarClientes` (UsuariosService.js) |
| RF13 Activar o inactivar cliente (admin) | `cambiarEstadoCliente` |
| RF14–RF15 Asociar y desasociar vehículos | `asociarVehiculo`, `desasociarVehiculo` |
| RF16 Gestionar operadores (admin) | `listarOperadores`, `guardarOperador`, `cambiarEstadoOperador`, `restablecerClave` (OperadoresService.js) |
| RF17 Registrar celda (admin) | `crearCelda` (CeldasService.js) |
| RF18 Consultar celdas y capacidad | `obtenerOcupacion` |
| RF19–RF20 Cambiar tipo, inhabilitar o habilitar celda (admin) | `cambiarTipoCelda`, `cambiarEstadoCelda` |

## Estructura

```
src/
  Index.html             Presentación: interfaz web (HTML, CSS, JS)
  Code.js                Entrada web (doGet) y setup / migración de la base de datos
  Auth.js                Seguridad: sesiones y contraseñas con SHA-256 + salt
  RegistroService.js     Iteración 1: entrada, salida, ocupación, historial y novedades
  UsuariosService.js     Iteración 2: clientes y sus vehículos
  CeldasService.js       Iteración 2: celdas
  OperadoresService.js   Iteración 2: usuarios del sistema
  Db.js                  Datos: lectura y escritura en Google Sheets
  appsscript.json        Manifiesto del proyecto
Codigo.gs                Todo el servidor en un solo archivo (para pegar en el editor)
pruebas.js               Pruebas de la iteración 1:  node pruebas.js Codigo.gs
pruebas_it2.js           Pruebas de la iteración 2:  node pruebas_it2.js Codigo.gs
gas_mock.js              Simulación de Google Apps Script usada por las pruebas
```

## Modelo físico (hojas de cálculo)

| Hoja | Columnas | Clave |
|---|---|---|
| Operadores | id, usuario, nombre, rol, hash, salt, activo | id |
| Usuarios | id, documento, nombre, telefono, email, estado | id |
| Vehiculos | placa, tipo, marca, color, usuario_id | placa (FK usuario_id) |
| Mensualidades | id, usuario_id, fecha_inicio, fecha_fin, valor, estado | id (FK usuario_id) |
| Celdas | codigo, tipo, estado, usuario_id | codigo (FK usuario_id, celda fija) |
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
git remote add origin https://github.com/DavidVelez-hub/Autos-Colombia.git
git push -u origin main
```

`.clasp.json` (contiene el scriptId) puede subirse. Las credenciales de clasp quedan en tu carpeta personal y no se suben.
