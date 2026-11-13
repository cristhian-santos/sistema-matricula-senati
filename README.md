# Sistema de Gestion de Matricula Academica - SENATI

Proyecto web desarrollado para la administracion y control de matriculas estudiantiles en SENATI. El sistema permite registrar estudiantes, gestionar cursos y secciones, administrar mallas curriculares con prerrequisitos, registrar notas y asistencias de docentes, y controlar las obligaciones de pago de tesoreria.

---

## Integrantes del Grupo

* **Cristhian Santos** (`@cristhian-santos`) - Desarrollo Frontend (React) y Coordinacion.
* **Aydan Villafana** (`@Aydan.eee`) - Desarrollo Backend (Node.js y Express).
* **darksonic2021** (`@darksonic2021`) - Base de Datos (MySQL y Scripts SQL).

---

## Tecnologias Utilizadas

* **Frontend:** React 18, Vite, React Router DOM, Bootstrap 5, Axios.
* **Backend:** Node.js, Express, mysql2, bcryptjs, dotenv, cors.
* **Base de Datos:** MySQL 8.0 (Motor InnoDB, claves foraneas e integridad referencial).
* **Control de Versiones:** Git y GitHub.

---

## Modulos del Sistema

1. **Matriculas:**
   * Registro de matricula de alumnos por curso y periodo academico.
   * Seleccion de seccion con turno (Manana, Tarde o Noche) y control de vacantes disponibles.
   * Validacion para evitar matriculas duplicadas en un mismo periodo.

2. **Cursos y Secciones:**
   * Catalogo de asignaturas con creditos y horas academicas.
   * Asignacion de turnos, aulas y docentes responsables por seccion.

3. **Mallas Curriculares:**
   * Organizacion de cursos por ciclos academicos (I al VI ciclo).
   * Validacion de prerrequisitos aprobados para la inscripcion de asignaturas.

4. **Portal del Docente:**
   * Registro de evaluaciones continuas y examen final (escala de 0 a 20).
   * Control de asistencia por sesion de clase con calculo de porcentaje.

5. **Tesoreria:**
   * Gestion de planes de pago (al contado, mensual y fraccionado).
   * Registro y seguimiento de pagos de cuotas y derechos academicos.

6. **Seguridad y Usuarios:**
   * Autenticacion de usuarios con contrasenas encriptadas (bcrypt).
   * Control de acceso segun el rol del usuario (Administrador, Docente, Estudiante).

---

## Pasos para la Instalacion y Ejecucion

### 1. Base de Datos (MySQL)

Abrir MySQL Workbench o su gestor de MySQL preferido y ejecutar los dos scripts de la carpeta `database/` en el siguiente orden:

1. Ejecutar `database/01_crear_tablas.sql` (crea la base de datos `bd_matricula` y todas las tablas).
2. Ejecutar `database/02_insertar_datos.sql` (inserta los catalogos, cursos, secciones y usuarios iniciales).

---

### 2. Backend (Servidor API)

1. Abrir una terminal y ubicarse en la carpeta `backend`:
   ```bash
   cd backend
   ```
2. Instalar las librerias necesarias:
   ```bash
   npm install
   ```
3. Verificar la configuracion de conexion en el archivo `backend/.env`:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=tu_password
   DB_NAME=bd_matricula
   DB_PORT=3306
   ```
4. Iniciar el servidor:
   ```bash
   npm start
   ```
   El backend se ejecutara en: `http://localhost:5000`

---

### 3. Frontend (Aplicacion Web)

1. Abrir otra terminal y ubicarse en la carpeta `frontend`:
   ```bash
   cd frontend
   ```
2. Instalar las dependencias:
   ```bash
   npm install
   ```
3. Iniciar el servidor de desarrollo:
   ```bash
   npm run dev
   ```
   La aplicacion estara disponible en: `http://localhost:3000`

---

## Cuentas de Acceso para Pruebas

| Rol | Usuario | Contrasena | Correo |
| :--- | :--- | :--- | :--- |
| Administrador | admin | Password123# | admin@senati.pe |
| Docente | docente.castillo | Password123# | wcastillo@senati.pe |
| Estudiante | estudiante.garcia | Password123# | carlos.garcia@senati.pe |

---

## Rutas Principales de la API

* `GET /api/dashboard/stats` - Estadisticas generales de alumnos y matriculas.
* `GET /api/estudiantes` - Listar estudiantes registrados.
* `POST /api/estudiantes` - Registrar nuevo estudiante.
* `GET /api/cursos` - Listar cursos disponibles.
* `GET /api/matriculas` - Listar todas las matriculas activas.
* `POST /api/matriculas` - Registrar nueva matricula con seccion y turno.
* `DELETE /api/matriculas/:id` - Anular o retirar matricula.
* `GET /api/mallas` - Consultar estructura de malla curricular.
* `GET /api/docentes` - Consultar lista de docentes.
* `GET /api/horarios` - Consultar horarios semanales por seccion y aula.

---

## Ramas del Repositorio Git

* `main` - Rama principal del proyecto integrado.
* `feature/database` - Scripts de base de datos y tablas de matricula.
* `feature/backend-api` - Logica del servidor, controladores y rutas de la API.
* `feature/frontend-ui` - Vistas en React, interfaz de usuario y conexion con la API.
