-- ==============================================================================
-- PROYECTO: SISTEMA DE GESTION DE MATRICULA ACADEMICA - SENATI
-- ARCHIVO: 02_insertar_datos.sql
-- DESCRIPCION: Insercion de catalogos y datos institucionales SENATI (DML).
-- ORDEN DE EJECUCION: 2 de 2 (Ejecutar despues de 01_crear_tablas.sql)
-- ==============================================================================

USE bd_matricula;

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------------------------
-- 1. CATALOGOS BASE: CICLOS Y MODALIDADES
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO ciclos (numero, nombre) VALUES 
  (1, 'I Ciclo'),
  (2, 'II Ciclo'),
  (3, 'III Ciclo'),
  (4, 'IV Ciclo'),
  (5, 'V Ciclo'),
  (6, 'VI Ciclo');

INSERT IGNORE INTO modalidades (nombre, descripcion) VALUES 
  ('Presencial', 'Clases presenciales en campus y talleres'),
  ('Virtual', 'Clases remotas en plataforma virtual'),
  ('Semipresencial', 'Modalidad combinada aula y campus virtual');

-- ------------------------------------------------------------------------------
-- 2. PERIODOS ACADEMICOS
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO periodos_academicos (codigo, nombre, fecha_inicio, fecha_fin, inicio_matricula, fin_matricula, estado) VALUES
  ('2026-I', 'Semestre Académico 2026-I', '2026-03-01', '2026-07-31', '2026-02-01', '2026-03-31', 'Cerrado'),
  ('2026-II', 'Semestre Académico 2026-II', '2026-08-01', '2026-12-31', '2026-07-01', '2026-11-30', 'Matricula abierta'),
  ('2027-I', 'Semestre Académico 2027-I', '2027-03-01', '2027-07-31', '2026-11-01', '2027-02-15', 'Matricula abierta'),
  ('2027-II', 'Semestre Académico 2027-II', '2027-08-01', '2027-12-31', '2027-06-01', '2027-07-15', 'Planificado');

-- ------------------------------------------------------------------------------
-- 3. SEDES Y AULAS
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO sedes (codigo, nombre, direccion, estado) VALUES
  ('SEDE-SUR', 'Sede Sur - Lima', 'Av. Pedro Miotta 450, San Juan de Miraflores, Lima', 'Activo'),
  ('SEDE-NORTE', 'Sede Norte - Independencia', 'Av. Alfredo Mendiola 3520, Los Olivos, Lima', 'Activo');

INSERT IGNORE INTO aulas (id_sede, codigo, nombre, tipo, capacidad, estado) VALUES
  (1, 'AUL-101', 'Aula Teórica 101', 'Aula', 30, 'Activo'),
  (1, 'LAB-102', 'Laboratorio de Cómputo 102', 'Laboratorio', 24, 'Activo'),
  (1, 'TAL-103', 'Taller Mecatrónica 103', 'Taller', 20, 'Activo'),
  (1, 'AUL-104', 'Aula Teórica 104', 'Aula', 30, 'Activo'),
  (1, 'LAB-105', 'Laboratorio de Redes 105', 'Laboratorio', 24, 'Activo'),
  (1, 'TAL-106', 'Taller Electricidad 106', 'Taller', 20, 'Activo'),
  (2, 'AUL-201', 'Aula Teórica 201', 'Aula', 30, 'Activo'),
  (2, 'LAB-202', 'Laboratorio de Cómputo 202', 'Laboratorio', 24, 'Activo'),
  (2, 'TAL-203', 'Taller de Sistemas 203', 'Taller', 20, 'Activo'),
  (2, 'AUL-204', 'Aula Teórica 204', 'Aula', 30, 'Activo'),
  (2, 'LAB-205', 'Laboratorio Ciberseguridad 205', 'Laboratorio', 24, 'Activo'),
  (2, 'TAL-206', 'Taller Automatización 206', 'Taller', 20, 'Activo');

-- ------------------------------------------------------------------------------
-- 4. CARRERAS PROFESIONALES
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO carreras (codigo, nombre, descripcion, duracion_ciclos, estado) VALUES
  ('SOF-01', 'Ingeniería de Software con Inteligencia Artificial', 'Carrera técnica profesional líder en desarrollo de software web, móvil y computación en la nube.', 6, 'Activo'),
  ('RED-02', 'Redes y Seguridad Informática', 'Carrera técnica profesional en infraestructura tecnológica, conectividad corporativa y ciberseguridad.', 6, 'Activo'),
  ('MEC-04', 'Mecatrónica Industrial', 'Carrera técnica profesional en automatización, robótica industrial y sistemas electromecánicos.', 6, 'Activo'),
  ('ADM-05', 'Administración Industrial', 'Carrera técnica profesional en gestión de operaciones, logística y optimización de procesos productivos.', 6, 'Activo'),
  ('ELE-06', 'Electricidad Industrial', 'Carrera técnica profesional en diseño, instalación y mantenimiento de redes e instalaciones eléctricas industriales.', 6, 'Activo');

-- ------------------------------------------------------------------------------
-- 5. CURSOS INSTITUCIONALES
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO cursos (id_curso, codigo, nombre, creditos, horas, vacantes_maximas, estado) VALUES
  (1, 'DEV-201', 'Desarrollo Web Fullstack con React', 4, 80, 25, 'Activo'),
  (2, 'BDS-202', 'Administración y Modelado de Base de Datos', 3, 60, 25, 'Activo'),
  (3, 'SOF-203', 'Ingeniería de Software y Calidad', 3, 60, 25, 'Activo'),
  (4, 'RED-204', 'Redes de Datos y Comunicaciones', 4, 80, 25, 'Activo'),
  (5, 'SEG-205', 'Ciberseguridad y Auditoría de Sistemas', 3, 60, 25, 'Activo'),
  (6, 'DIG-101', 'Fundamentos de Electrónica Digital', 3, 60, 25, 'Activo'),
  (7, 'COM-102', 'Comunicación Efectiva y Liderazgo', 2, 40, 25, 'Activo'),
  (8, 'MAT-103', 'Matemática Aplicada para Tecnología', 3, 60, 25, 'Activo'),
  (9, 'PRJ-104', 'Gestión de Proyectos Tecnológicos', 3, 60, 25, 'Activo'),
  (10, 'SEG-105', 'Seguridad Industrial y Calidad', 3, 60, 25, 'Activo'),
  (11, 'INN-106', 'Proyecto Integrador de Innovación', 4, 80, 25, 'Activo'),
  (12, 'NET-104', 'Administración de Infraestructura de Red', 4, 80, 25, 'Activo'),
  (13, 'MEC-103', 'Sensores y Actuadores Industriales', 4, 80, 25, 'Activo'),
  (14, 'ADM-104', 'Costos y Presupuestos Industriales', 3, 60, 25, 'Activo'),
  (15, 'ELE-105', 'Instalaciones Eléctricas Industriales', 4, 80, 25, 'Activo');

-- ------------------------------------------------------------------------------
-- 6. DOCENTES INSTITUCIONALES (SENATI)
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO docentes (id_docente, codigo_docente, dni, nombres, apellidos, email, telefono, especialidad, tipo_contrato, fecha_ingreso, estado) VALUES
  (1, 'DOC-01', '78000001', 'Walter', 'Castillo Peña', 'wcastillo@senati.pe', '971000001', 'Desarrollo de Software', 'Tiempo completo', '2024-01-15', 'Activo'),
  (2, 'DOC-02', '78000002', 'Rosa Elena', 'Cárdenas Silva', 'rcardenas@senati.pe', '971000002', 'Bases de Datos', 'Tiempo completo', '2024-01-15', 'Activo'),
  (3, 'DOC-03', '78000003', 'Marco Antonio', 'Ríos Vega', 'mrios@senati.pe', '971000003', 'Ingeniería de Software', 'Tiempo completo', '2024-01-15', 'Activo'),
  (4, 'DOC-04', '78000004', 'Carlos Enrique', 'Mendoza Prado', 'cmendoza@senati.pe', '971000004', 'Redes de Datos', 'Tiempo completo', '2024-01-15', 'Activo'),
  (5, 'DOC-05', '78000005', 'Jorge Luis', 'Alarcón Valdivia', 'jalarcon@senati.pe', '971000005', 'Ciberseguridad', 'Tiempo completo', '2024-01-15', 'Activo'),
  (6, 'DOC-06', '78000006', 'Víctor Manuel', 'Salazar Bravo', 'vsalazar@senati.pe', '971000006', 'Mecatrónica', 'Tiempo completo', '2024-01-15', 'Activo'),
  (7, 'DOC-07', '78000007', 'Patricia Elena', 'Flores Guzmán', 'pflores@senati.pe', '971000007', 'Administración Industrial', 'Tiempo completo', '2024-01-15', 'Activo'),
  (8, 'DOC-08', '78000008', 'Fernando José', 'Quispe Tapia', 'fquispe@senati.pe', '971000008', 'Electricidad Industrial', 'Tiempo completo', '2024-01-15', 'Activo'),
  (9, 'DOC-09', '78000009', 'Daniel Alberto', 'Chávez Navarro', 'dchavez@senati.pe', '971000009', 'Soporte de TI', 'Tiempo parcial', '2024-01-15', 'Activo'),
  (10, 'DOC-10', '78000010', 'Mónica Cecilia', 'Paredes Soto', 'mparedes@senati.pe', '971000010', 'Calidad de Software', 'Tiempo parcial', '2024-01-15', 'Activo'),
  (11, 'DOC-11', '78000011', 'Christian David', 'Barrientos Meza', 'cbarrientos@senati.pe', '971000011', 'Desarrollo Web', 'Tiempo completo', '2024-01-15', 'Activo'),
  (12, 'DOC-12', '78000012', 'Luis Guillermo', 'Huamán Benites', 'lhuaman@senati.pe', '971000012', 'Infraestructura de Redes', 'Tiempo completo', '2024-01-15', 'Activo'),
  (13, 'DOC-13', '78000013', 'Sandra Milagros', 'Cabrera Campos', 'scabrera@senati.pe', '971000013', 'Seguridad Informática', 'Tiempo completo', '2024-01-15', 'Activo'),
  (14, 'DOC-14', '78000014', 'César Augusto', 'Morales Fuentes', 'cmorales@senati.pe', '971000014', 'Automatización', 'Tiempo completo', '2024-01-15', 'Activo'),
  (15, 'DOC-15', '78000015', 'Evelyn Paola', 'Zavaleta Cruz', 'ezavaleta@senati.pe', '971000015', 'Gestión de Operaciones', 'Tiempo parcial', '2024-01-15', 'Activo'),
  (16, 'DOC-16', '78000016', 'Roberto Carlos', 'Tello Miranda', 'rtello@senati.pe', '971000016', 'Instalaciones Eléctricas', 'Tiempo completo', '2024-01-15', 'Activo'),
  (17, 'DOC-17', '78000017', 'Andrés Felipe', 'Espinoza León', 'aespinoza@senati.pe', '971000017', 'Matemática Aplicada', 'Tiempo completo', '2024-01-15', 'Activo'),
  (18, 'DOC-18', '78000018', 'Gloria Beatriz', 'Rivas Solís', 'grivas@senati.pe', '971000018', 'Comunicación Técnica', 'Tiempo completo', '2024-01-15', 'Activo'),
  (19, 'DOC-19', '78000019', 'Eduardo Martín', 'Cueva Vílchez', 'ecueva@senati.pe', '971000019', 'Proyectos Tecnológicos', 'Tiempo completo', '2024-01-15', 'Activo'),
  (20, 'DOC-20', '78000020', 'Claudia Vanessa', 'Osorio Gálvez', 'cosorio@senati.pe', '971000020', 'Calidad y Seguridad', 'Tiempo parcial', '2024-01-15', 'Activo');

-- ------------------------------------------------------------------------------
-- 7. ESTUDIANTES INSTITUCIONALES (SENATI)
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO estudiantes (id_estudiante, dni, nombres, apellidos, email, telefono, direccion, fecha_nacimiento, estado) VALUES
  (1, '71234567', 'Carlos Alberto', 'García Mendoza', 'carlos.garcia@senati.pe', '987654321', 'Av. Brasil 1420, Jesús María, Lima', '2004-05-12', 'Activo'),
  (2, '72345678', 'María Elena', 'Quispe Flores', 'maria.quispe@senati.pe', '987654322', 'Jr. Lampa 840, Cercado de Lima', '2004-08-23', 'Activo'),
  (3, '73456789', 'Juan Diego', 'Rojas Torres', 'juan.rojas@senati.pe', '987654323', 'Av. Benavides 2150, Miraflores, Lima', '2003-11-30', 'Activo'),
  (4, '74567890', 'Ana Lucia', 'Pérez Morales', 'ana.perez@senati.pe', '987654324', 'Av. Arequipa 3210, San Isidro, Lima', '2004-02-14', 'Activo'),
  (5, '75678901', 'Luis Fernando', 'Vargas Castro', 'luis.vargas@senati.pe', '987654325', 'Av. Javier Prado Este 4500, Surco, Lima', '2003-07-19', 'Activo'),
  (6, '79000001', 'Javier Alejandro', 'Ramos Benítez', 'jramos@senati.pe', '971000001', 'Av. Colonial 1250, Cercado de Lima', '2004-03-15', 'Activo'),
  (7, '79000002', 'Valeria Sofía', 'Huamán Chávez', 'vhuaman@senati.pe', '971000002', 'Jr. Huancavelica 420, San Miguel, Lima', '2004-06-20', 'Activo'),
  (8, '79000003', 'Rodrigo Alonso', 'Castro Morales', 'rcastro@senati.pe', '971000003', 'Av. Elmer Faucett 780, Callao', '2003-09-10', 'Activo'),
  (9, '79000004', 'Camila Fernanda', 'Romero Díaz', 'cromero@senati.pe', '971000004', 'Av. Universitaria 2100, Los Olivos, Lima', '2004-12-05', 'Activo'),
  (10, '79000005', 'Diego Sebastián', 'Medina Alva', 'dmedina@senati.pe', '971000005', 'Av. Próceres de la Independencia 350, SJL, Lima', '2003-04-25', 'Activo');

-- ------------------------------------------------------------------------------
-- 8. SECCIONES Y ASIGNACIONES
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO secciones (id_seccion, id_curso, id_periodo, id_modalidad, codigo, turno, capacidad, estado) VALUES
  (1, 2, 3, 1, 'SEC-2027-I-BDS-202', 'Tarde', 24, 'Abierta'),
  (2, 2, 2, 1, 'SEC-2026-II-BDS-202', 'Tarde', 24, 'Abierta'),
  (3, 2, 1, 1, 'SEC-2026-I-BDS-202', 'Tarde', 24, 'Finalizada'),
  (4, 1, 3, 1, 'SEC-2027-I-DEV-201', 'Mañana', 24, 'Abierta'),
  (5, 1, 2, 1, 'SEC-2026-II-DEV-201', 'Mañana', 24, 'Abierta'),
  (6, 1, 1, 1, 'SEC-2026-I-DEV-201', 'Mañana', 24, 'Finalizada'),
  (7, 4, 3, 1, 'SEC-2027-I-RED-204', 'Mañana', 20, 'Abierta'),
  (8, 4, 2, 1, 'SEC-2026-II-RED-204', 'Mañana', 20, 'Abierta'),
  (9, 4, 1, 1, 'SEC-2026-I-RED-204', 'Mañana', 20, 'Finalizada'),
  (10, 5, 3, 1, 'SEC-2027-I-SEG-205', 'Tarde', 20, 'Abierta'),
  (11, 5, 2, 1, 'SEC-2026-II-SEG-205', 'Tarde', 20, 'Abierta'),
  (12, 5, 1, 1, 'SEC-2026-I-SEG-205', 'Tarde', 20, 'Finalizada'),
  (13, 3, 3, 1, 'SEC-2027-I-SOF-203', 'Noche', 24, 'Abierta'),
  (14, 3, 2, 1, 'SEC-2026-II-SOF-203', 'Noche', 24, 'Abierta'),
  (15, 3, 1, 1, 'SEC-2026-I-SOF-203', 'Noche', 24, 'Finalizada'),
  -- Secciones para cursos DIG, COM, MAT, PRJ, SEG, INN, NET, MEC, ADM, ELE en 2026-II y 2027-I
  (16, 6, 2, 1, 'SEC-2026-II-DIG-101', 'Mañana', 25, 'Abierta'),
  (17, 7, 2, 1, 'SEC-2026-II-COM-102', 'Tarde', 25, 'Abierta'),
  (18, 8, 2, 1, 'SEC-2026-II-MAT-103', 'Noche', 25, 'Abierta'),
  (19, 9, 2, 1, 'SEC-2026-II-PRJ-104', 'Mañana', 25, 'Abierta'),
  (20, 10, 2, 1, 'SEC-2026-II-SEG-105', 'Tarde', 25, 'Abierta'),
  (21, 11, 2, 1, 'SEC-2026-II-INN-106', 'Noche', 25, 'Abierta'),
  (22, 12, 2, 1, 'SEC-2026-II-NET-104', 'Mañana', 25, 'Abierta'),
  (23, 13, 2, 1, 'SEC-2026-II-MEC-103', 'Tarde', 25, 'Abierta'),
  (24, 14, 2, 1, 'SEC-2026-II-ADM-104', 'Mañana', 25, 'Abierta'),
  (25, 15, 2, 1, 'SEC-2026-II-ELE-105', 'Noche', 25, 'Abierta'),
  (26, 6, 3, 1, 'SEC-2027-I-DIG-101', 'Mañana', 25, 'Abierta'),
  (27, 7, 3, 1, 'SEC-2027-I-COM-102', 'Tarde', 25, 'Abierta'),
  (28, 8, 3, 1, 'SEC-2027-I-MAT-103', 'Noche', 25, 'Abierta'),
  (29, 9, 3, 1, 'SEC-2027-I-PRJ-104', 'Mañana', 25, 'Abierta'),
  (30, 10, 3, 1, 'SEC-2027-I-SEG-105', 'Tarde', 25, 'Abierta');

-- Asignacion de docentes a secciones
INSERT IGNORE INTO docentes_secciones (id_docente, id_seccion, rol_docente, estado) VALUES
  (1, 4, 'Titular', 'Activo'),
  (1, 5, 'Titular', 'Activo'),
  (1, 6, 'Titular', 'Activo'),
  (2, 1, 'Titular', 'Activo'),
  (2, 2, 'Titular', 'Activo'),
  (2, 3, 'Titular', 'Activo'),
  (3, 13, 'Titular', 'Activo'),
  (3, 14, 'Titular', 'Activo'),
  (3, 15, 'Titular', 'Activo'),
  (4, 7, 'Titular', 'Activo'),
  (4, 8, 'Titular', 'Activo'),
  (4, 9, 'Titular', 'Activo'),
  (5, 10, 'Titular', 'Activo'),
  (5, 11, 'Titular', 'Activo'),
  (5, 12, 'Titular', 'Activo'),
  (6, 16, 'Titular', 'Activo'),
  (7, 17, 'Titular', 'Activo'),
  (8, 18, 'Titular', 'Activo'),
  (9, 19, 'Titular', 'Activo'),
  (10, 20, 'Titular', 'Activo'),
  (11, 21, 'Titular', 'Activo'),
  (12, 22, 'Titular', 'Activo'),
  (13, 23, 'Titular', 'Activo'),
  (14, 24, 'Titular', 'Activo'),
  (15, 25, 'Titular', 'Activo');

-- Horarios de secciones
INSERT IGNORE INTO seccion_horarios (id_seccion, id_aula, dia_semana, hora_inicio, hora_fin) VALUES
  (5, 1, 'Lunes', '08:00:00', '10:00:00'),
  (2, 4, 'Martes', '14:00:00', '16:00:00'),
  (14, 7, 'Miércoles', '19:00:00', '21:00:00'),
  (8, 8, 'Jueves', '08:00:00', '10:00:00'),
  (11, 11, 'Viernes', '14:00:00', '16:00:00'),
  (16, 1, 'Lunes', '08:00:00', '10:00:00'),
  (17, 4, 'Martes', '14:00:00', '16:00:00'),
  (18, 7, 'Miércoles', '18:30:00', '20:30:00'),
  (19, 8, 'Jueves', '08:00:00', '10:00:00'),
  (20, 11, 'Viernes', '14:00:00', '16:00:00'),
  (21, 9, 'Sábado', '08:00:00', '12:00:00'),
  (22, 5, 'Lunes', '10:00:00', '12:00:00'),
  (23, 3, 'Martes', '16:00:00', '18:00:00'),
  (24, 10, 'Miércoles', '10:00:00', '12:00:00'),
  (25, 6, 'Jueves', '18:30:00', '20:30:00');

-- ------------------------------------------------------------------------------
-- 9. MATRICULAS REGISTRADAS
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO matriculas (id_matricula, id_estudiante, id_curso, id_seccion, periodo, fecha_matricula, estado, observaciones) VALUES
  (1, 1, 1, 5, '2026-II', '2026-08-05', 'Matriculado', 'Matrícula regular confirmada - Turno Mañana'),
  (2, 1, 2, 2, '2026-II', '2026-08-05', 'Matriculado', 'Matrícula regular confirmada - Turno Tarde'),
  (3, 2, 1, 5, '2026-II', '2026-08-06', 'Matriculado', 'Matrícula regular confirmada - Turno Mañana'),
  (4, 2, 3, 14, '2026-II', '2026-08-06', 'Matriculado', 'Matrícula regular confirmada - Turno Noche'),
  (5, 3, 4, 8, '2026-II', '2026-08-07', 'Matriculado', 'Matrícula regular confirmada - Turno Mañana'),
  (6, 4, 5, 11, '2026-II', '2026-08-07', 'Matriculado', 'Matrícula regular confirmada - Turno Tarde'),
  (7, 5, 1, 5, '2026-II', '2026-08-08', 'Matriculado', 'Matrícula regular confirmada - Turno Mañana'),
  (8, 6, 1, 5, '2026-II', '2026-08-08', 'Matriculado', 'Matrícula regular confirmada - Turno Mañana'),
  (9, 6, 2, 2, '2026-II', '2026-08-08', 'Matriculado', 'Matrícula regular confirmada - Turno Tarde'),
  (10, 7, 3, 14, '2026-II', '2026-08-09', 'Matriculado', 'Matrícula regular confirmada - Turno Noche'),
  (11, 8, 4, 8, '2026-II', '2026-08-09', 'Matriculado', 'Matrícula regular confirmada - Turno Mañana'),
  (12, 9, 5, 11, '2026-II', '2026-08-10', 'Matriculado', 'Matrícula regular confirmada - Turno Tarde'),
  (13, 10, 1, 5, '2026-II', '2026-08-10', 'Matriculado', 'Matrícula regular confirmada - Turno Mañana');

-- ------------------------------------------------------------------------------
-- 10. EVALUACIONES, CALIFICACIONES, SESIONES Y ASISTENCIAS
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO evaluaciones (id_evaluacion, id_seccion, nombre, tipo, peso_porcentaje, fecha_limite, estado) VALUES
  (1, 5, 'Evaluación Continua 1', 'Practica', 40.00, '2026-09-30', 'Cerrada'),
  (2, 5, 'Evaluación Final', 'Examen', 60.00, '2026-11-25', 'Abierta'),
  (3, 2, 'Evaluación Continua 1', 'Practica', 40.00, '2026-09-30', 'Cerrada'),
  (4, 2, 'Evaluación Final', 'Examen', 60.00, '2026-11-25', 'Abierta'),
  (5, 14, 'Evaluación Continua 1', 'Practica', 40.00, '2026-09-30', 'Cerrada'),
  (6, 14, 'Evaluación Final', 'Examen', 60.00, '2026-11-25', 'Abierta');

INSERT IGNORE INTO calificaciones (id_evaluacion, id_matricula, nota) VALUES
  (1, 1, 16.50),
  (1, 3, 17.00),
  (1, 7, 15.00),
  (1, 8, 18.00),
  (1, 13, 16.00),
  (3, 2, 17.50),
  (3, 9, 16.00),
  (5, 4, 15.50),
  (5, 10, 18.50);

INSERT IGNORE INTO sesiones_clase (id_sesion, id_seccion, fecha, tema) VALUES
  (1, 5, '2026-08-11', 'Sesión de Clase 1: Arquitectura Web y Entorno React'),
  (2, 5, '2026-08-18', 'Sesión de Clase 2: Componentes, JSX y Propiedades'),
  (3, 5, '2026-08-25', 'Sesión de Clase 3: Hooks y Manejo de Estado');

INSERT IGNORE INTO asistencias (id_sesion, id_matricula, estado, observacion) VALUES
  (1, 1, 'Presente', 'Asistencia presencial verificada'),
  (1, 3, 'Presente', 'Asistencia presencial verificada'),
  (1, 7, 'Presente', 'Asistencia presencial verificada'),
  (2, 1, 'Presente', 'Asistencia presencial verificada'),
  (2, 3, 'Tardanza', 'Ingreso 10 min tarde'),
  (3, 1, 'Presente', 'Asistencia presencial verificada');

-- ------------------------------------------------------------------------------
-- 11. AUTENTICACION: ROLES Y USUARIOS
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO roles (id_rol, nombre, descripcion) VALUES
  (1, 'Administrador', 'Administración y control total del sistema institucional'),
  (2, 'Docente', 'Registro de notas, asistencias y seguimiento de secciones'),
  (3, 'Estudiante', 'Consulta de notas, horarios y estado de matrícula');

-- Contraseñas cifradas con bcrypt (Password123#)
INSERT IGNORE INTO usuarios (id_usuario, id_estudiante, id_docente, usuario, email, password_hash, debe_cambiar_password, estado) VALUES
  (1, NULL, NULL, 'admin', 'admin@senati.pe', '$2b$12$R.O4wJ87Pj9sLhU0K3i2h.K4wVz8v0rI5c6c0bE7p5e6e3c5e9mO2', 0, 'Activo'),
  (2, NULL, 1, 'docente.castillo', 'wcastillo@senati.pe', '$2b$12$R.O4wJ87Pj9sLhU0K3i2h.K4wVz8v0rI5c6c0bE7p5e6e3c5e9mO2', 0, 'Activo'),
  (3, 1, NULL, 'estudiante.garcia', 'carlos.garcia@senati.pe', '$2b$12$R.O4wJ87Pj9sLhU0K3i2h.K4wVz8v0rI5c6c0bE7p5e6e3c5e9mO2', 0, 'Activo');

INSERT IGNORE INTO usuario_roles (id_usuario, id_rol) VALUES
  (1, 1),
  (2, 2),
  (3, 3);

-- ------------------------------------------------------------------------------
-- 12. TESORERIA: CONCEPTOS, PLANES DE PAGO Y BECAS
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO conceptos_pago (id_concepto, nombre, descripcion, monto_base, estado) VALUES
  (1, 'Matrícula Académica Regular', 'Derecho de matrícula para el periodo académico regular.', 120.00, 'Activo'),
  (2, 'Cuota Mensual de Estudios', 'Cuota mensual ordinaria del periodo académico.', 200.00, 'Activo'),
  (3, 'Derecho de Laboratorio y Taller', 'Uso de laboratorios técnicos y equipamiento especializado.', 80.00, 'Activo'),
  (4, 'Pensión Académica Mensual', 'Pensión mensual estándar para carreras técnicas y tecnológicas.', 200.00, 'Activo'),
  (5, 'Cuota de Pago Fraccionado', 'Cuota de financiamiento institucional para planes fraccionados.', 100.00, 'Activo');

INSERT IGNORE INTO planes_pago (id_plan_pago, codigo, nombre, modalidad, numero_cuotas, moneda, monto_total, descripcion, estado) VALUES
  (1, 'PLAN-CONTADO-2026', 'Plan Contado (Cuota Única)', 'Unico', 1, 'PEN', 600.00, 'Pago total anticipado del semestre académico.', 'Activo'),
  (2, 'PLAN-MENSUAL-3C', 'Plan Regular (3 Cuotas)', 'Mensual', 3, 'PEN', 600.00, 'Tres cuotas mensuales regulares sin intereses.', 'Activo'),
  (3, 'PLAN-FRACCIONADO-3C', 'Plan Fraccionado (3 Cuotas)', 'Fraccionado', 3, 'PEN', 300.00, 'Facilidad de pago fraccionado en 3 cuotas.', 'Activo');

INSERT IGNORE INTO plan_pago_cuotas (id_plan_pago, numero_cuota, porcentaje_monto, monto_sugerido, dias_vencimiento_sugeridos, id_concepto) VALUES
  (1, 1, 100.00, 600.00, 30, 4),
  (2, 1, 33.33, 200.00, 30, 4),
  (2, 2, 33.33, 200.00, 60, 4),
  (2, 3, 33.34, 200.00, 90, 4),
  (3, 1, 33.33, 100.00, 30, 5),
  (3, 2, 33.33, 100.00, 60, 5),
  (3, 3, 33.34, 100.00, 90, 5);

INSERT IGNORE INTO becas (codigo, nombre, tipo, valor, descripcion, estado) VALUES
  ('BECA-EXC-20', 'Beca por Excelencia Académica (20%)', 'Porcentaje', 20.00, 'Beneficio otorgado a los estudiantes con alto rendimiento académico.', 'Activa');

INSERT IGNORE INTO descuentos (codigo, nombre, tipo, valor, descripcion, estado) VALUES
  ('DESC-PRONTO-10', 'Descuento por Pronto Pago (10%)', 'Porcentaje', 10.00, 'Descuento aplicado por cancelación anticipada de cuotas.', 'Activo');

-- ------------------------------------------------------------------------------
-- 13. MALLAS CURRICULARES (PLANES DE ESTUDIO)
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO planes_estudio (id_plan, id_carrera, codigo, version, fecha_vigencia, estado) VALUES
  (1, 1, 'PLAN-SOF-2027', 'V-2027', '2026-01-01', 'Activo'),
  (2, 2, 'PLAN-RED-2027', 'V-2027', '2026-01-01', 'Activo'),
  (3, 3, 'PLAN-MEC-2027', 'V-2027', '2026-01-01', 'Activo'),
  (4, 4, 'PLAN-ADM-2027', 'V-2027', '2026-01-01', 'Activo'),
  (5, 5, 'PLAN-ELE-2027', 'V-2027', '2026-01-01', 'Activo');

INSERT IGNORE INTO plan_cursos (id_plan, id_curso, id_ciclo, tipo_curso, creditos, horas_teoria, horas_practica) VALUES
  (1, 1, 2, 'Obligatorio', 4, 30, 50),
  (1, 2, 2, 'Obligatorio', 3, 20, 40),
  (1, 3, 3, 'Obligatorio', 3, 20, 40),
  (2, 4, 2, 'Obligatorio', 4, 30, 50),
  (2, 5, 3, 'Obligatorio', 3, 20, 40),
  (1, 6, 1, 'Obligatorio', 3, 20, 40),
  (1, 7, 1, 'Obligatorio', 2, 20, 20),
  (1, 8, 1, 'Obligatorio', 3, 30, 30),
  (1, 9, 3, 'Obligatorio', 3, 20, 40),
  (1, 10, 3, 'Obligatorio', 3, 20, 40),
  (1, 11, 4, 'Obligatorio', 4, 20, 60);

INSERT IGNORE INTO plan_estudio_control (id_plan, nota_minima_aprobatoria, max_creditos_por_periodo, permite_subsanacion) VALUES
  (1, 11.00, 22, 1),
  (2, 11.00, 22, 1),
  (3, 11.00, 22, 1),
  (4, 11.00, 22, 1),
  (5, 11.00, 22, 1);

INSERT IGNORE INTO estudiante_planes_estudio (id_estudiante, id_plan, fecha_asignacion, estado) VALUES
  (1, 1, '2026-03-01', 'Activo'),
  (2, 1, '2026-03-01', 'Activo'),
  (3, 2, '2026-03-01', 'Activo'),
  (4, 2, '2026-03-01', 'Activo'),
  (5, 1, '2026-03-01', 'Activo'),
  (6, 1, '2026-03-01', 'Activo'),
  (7, 1, '2026-03-01', 'Activo'),
  (8, 2, '2026-03-01', 'Activo'),
  (9, 2, '2026-03-01', 'Activo'),
  (10, 1, '2026-03-01', 'Activo');

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Datos institucionales SENATI insertados exitosamente.' AS Resultado;

