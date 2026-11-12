-- ==============================================================================
-- PROYECTO: SISTEMA DE GESTION DE MATRICULA ACADEMICA - SENATI
-- ARCHIVO: 01_crear_tablas.sql
-- DESCRIPCION: Creacion de la base de datos bd_matricula y su estructura (DDL).
-- ORDEN DE EJECUCION: 1 de 2 (Ejecutar primero)
-- ==============================================================================

DROP DATABASE IF EXISTS bd_matricula;
CREATE DATABASE bd_matricula CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bd_matricula;

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------------------------
-- 1. TABLAS PRINCIPALES Y ACADEMICAS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS carreras (
  id_carrera INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT,
  duracion_ciclos TINYINT NOT NULL DEFAULT 6,
  estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ciclos (
  id_ciclo INT AUTO_INCREMENT PRIMARY KEY,
  numero TINYINT NOT NULL UNIQUE,
  nombre VARCHAR(30) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS modalidades (
  id_modalidad INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL UNIQUE,
  descripcion VARCHAR(150),
  estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS periodos_academicos (
  id_periodo INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL UNIQUE,
  nombre VARCHAR(80) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  inicio_matricula DATE NOT NULL,
  fin_matricula DATE NOT NULL,
  estado ENUM('Planificado','Matricula abierta','En curso','Cerrado') NOT NULL DEFAULT 'Planificado',
  CHECK (fecha_fin >= fecha_inicio),
  CHECK (fin_matricula >= inicio_matricula)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sedes (
  id_sede INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  direccion VARCHAR(200),
  estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS aulas (
  id_aula INT AUTO_INCREMENT PRIMARY KEY,
  id_sede INT NOT NULL,
  codigo VARCHAR(20) NOT NULL,
  nombre VARCHAR(80) NOT NULL,
  tipo ENUM('Aula','Laboratorio','Taller') NOT NULL DEFAULT 'Aula',
  capacidad INT NOT NULL DEFAULT 30,
  estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  UNIQUE KEY uk_sede_aula (id_sede, codigo),
  FOREIGN KEY (id_sede) REFERENCES sedes(id_sede) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS estudiantes (
  id_estudiante INT AUTO_INCREMENT PRIMARY KEY,
  dni VARCHAR(8) NOT NULL UNIQUE,
  nombres VARCHAR(50) NOT NULL,
  apellidos VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  telefono VARCHAR(15),
  direccion VARCHAR(150),
  fecha_nacimiento DATE,
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  estado ENUM('Activo','Inactivo') DEFAULT 'Activo'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cursos (
  id_curso INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  creditos INT NOT NULL,
  horas INT NOT NULL,
  vacantes_maximas INT NOT NULL DEFAULT 30,
  estado ENUM('Activo','Inactivo') DEFAULT 'Activo',
  CHECK (creditos > 0),
  CHECK (horas > 0),
  CHECK (vacantes_maximas > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS docentes (
  id_docente INT AUTO_INCREMENT PRIMARY KEY,
  codigo_docente VARCHAR(20) NOT NULL UNIQUE,
  dni VARCHAR(8) NOT NULL UNIQUE,
  nombres VARCHAR(50) NOT NULL,
  apellidos VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  telefono VARCHAR(15),
  especialidad VARCHAR(100),
  tipo_contrato ENUM('Tiempo completo','Tiempo parcial') NOT NULL DEFAULT 'Tiempo completo',
  fecha_ingreso DATE NOT NULL,
  estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS secciones (
  id_seccion INT AUTO_INCREMENT PRIMARY KEY,
  id_curso INT NOT NULL,
  id_periodo INT NOT NULL,
  id_modalidad INT NOT NULL,
  codigo VARCHAR(30) NOT NULL,
  turno ENUM('Mañana','Tarde','Noche') NOT NULL,
  capacidad INT NOT NULL,
  estado ENUM('Abierta','Cerrada','Cancelada','Finalizada') NOT NULL DEFAULT 'Abierta',
  UNIQUE KEY uk_periodo_seccion (id_periodo, codigo),
  FOREIGN KEY (id_curso) REFERENCES cursos(id_curso) ON DELETE RESTRICT,
  FOREIGN KEY (id_periodo) REFERENCES periodos_academicos(id_periodo) ON DELETE RESTRICT,
  FOREIGN KEY (id_modalidad) REFERENCES modalidades(id_modalidad) ON DELETE RESTRICT,
  CHECK (capacidad > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS docentes_secciones (
  id_asignacion INT AUTO_INCREMENT PRIMARY KEY,
  id_docente INT NOT NULL,
  id_seccion INT NOT NULL,
  rol_docente VARCHAR(50) NOT NULL DEFAULT 'Titular',
  estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  UNIQUE KEY uk_docente_seccion (id_docente, id_seccion),
  FOREIGN KEY (id_docente) REFERENCES docentes(id_docente) ON DELETE RESTRICT,
  FOREIGN KEY (id_seccion) REFERENCES secciones(id_seccion) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS seccion_horarios (
  id_horario INT AUTO_INCREMENT PRIMARY KEY,
  id_seccion INT NOT NULL,
  id_aula INT NOT NULL,
  dia_semana ENUM('Lunes','Martes','Miércoles','Jueves','Viernes','Sábado') NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  FOREIGN KEY (id_seccion) REFERENCES secciones(id_seccion) ON DELETE RESTRICT,
  FOREIGN KEY (id_aula) REFERENCES aulas(id_aula) ON DELETE RESTRICT,
  CHECK (hora_fin > hora_inicio)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS matriculas (
  id_matricula INT AUTO_INCREMENT PRIMARY KEY,
  id_estudiante INT NOT NULL,
  id_curso INT NOT NULL,
  id_seccion INT NULL,
  periodo VARCHAR(10) NOT NULL,
  fecha_matricula DATE NOT NULL,
  estado ENUM('Matriculado','Retirado','Completado') DEFAULT 'Matriculado',
  observaciones TEXT,
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_estudiante_curso_periodo (id_estudiante, id_curso, periodo),
  INDEX idx_matricula_estudiante (id_estudiante),
  INDEX idx_matricula_curso (id_curso),
  INDEX idx_matricula_periodo (periodo),
  FOREIGN KEY (id_estudiante) REFERENCES estudiantes(id_estudiante) ON DELETE RESTRICT,
  FOREIGN KEY (id_curso) REFERENCES cursos(id_curso) ON DELETE RESTRICT,
  FOREIGN KEY (id_seccion) REFERENCES secciones(id_seccion) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS evaluaciones (
  id_evaluacion INT AUTO_INCREMENT PRIMARY KEY,
  id_seccion INT NOT NULL,
  nombre VARCHAR(80) NOT NULL,
  tipo ENUM('Examen','Practica','Proyecto','Oral') NOT NULL DEFAULT 'Practica',
  peso_porcentaje DECIMAL(5,2) NOT NULL,
  fecha_limite DATE NOT NULL,
  estado ENUM('Abierta','Cerrada') NOT NULL DEFAULT 'Abierta',
  FOREIGN KEY (id_seccion) REFERENCES secciones(id_seccion) ON DELETE RESTRICT,
  CHECK (peso_porcentaje > 0 AND peso_porcentaje <= 100)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS calificaciones (
  id_calificacion INT AUTO_INCREMENT PRIMARY KEY,
  id_evaluacion INT NOT NULL,
  id_matricula INT NOT NULL,
  nota DECIMAL(4,2) NOT NULL,
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_evaluacion_matricula (id_evaluacion, id_matricula),
  FOREIGN KEY (id_evaluacion) REFERENCES evaluaciones(id_evaluacion) ON DELETE RESTRICT,
  FOREIGN KEY (id_matricula) REFERENCES matriculas(id_matricula) ON DELETE RESTRICT,
  CHECK (nota >= 0 AND nota <= 20)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sesiones_clase (
  id_sesion INT AUTO_INCREMENT PRIMARY KEY,
  id_seccion INT NOT NULL,
  fecha DATE NOT NULL,
  tema VARCHAR(150) NOT NULL,
  FOREIGN KEY (id_seccion) REFERENCES secciones(id_seccion) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS asistencias (
  id_asistencia INT AUTO_INCREMENT PRIMARY KEY,
  id_sesion INT NOT NULL,
  id_matricula INT NOT NULL,
  estado ENUM('Presente','Falta','Tardanza','Justificado') NOT NULL DEFAULT 'Presente',
  observacion VARCHAR(150),
  UNIQUE KEY uk_sesion_matricula (id_sesion, id_matricula),
  FOREIGN KEY (id_sesion) REFERENCES sesiones_clase(id_sesion) ON DELETE RESTRICT,
  FOREIGN KEY (id_matricula) REFERENCES matriculas(id_matricula) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 2. TABLAS DE AUTENTICACION, USUARIOS Y ROLES
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS roles (
  id_rol INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  descripcion VARCHAR(200),
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  id_estudiante INT NULL UNIQUE,
  id_docente INT NULL UNIQUE,
  usuario VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  debe_cambiar_password TINYINT(1) NOT NULL DEFAULT 1,
  estado ENUM('Activo','Inactivo','Bloqueado') NOT NULL DEFAULT 'Activo',
  ultimo_login DATETIME NULL,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_estudiante) REFERENCES estudiantes(id_estudiante) ON DELETE SET NULL,
  FOREIGN KEY (id_docente) REFERENCES docentes(id_docente) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuario_roles (
  id_usuario INT NOT NULL,
  id_rol INT NOT NULL,
  fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario, id_rol),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  FOREIGN KEY (id_rol) REFERENCES roles(id_rol) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sesiones_usuario (
  id_sesion VARCHAR(128) PRIMARY KEY,
  id_usuario INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  ip_origen VARCHAR(45),
  user_agent VARCHAR(255),
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_expiracion DATETIME NOT NULL,
  revocada TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_sesion_usuario (id_usuario),
  INDEX idx_sesion_expiracion (fecha_expiracion),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS intentos_login (
  id_intento INT AUTO_INCREMENT PRIMARY KEY,
  usuario_o_email VARCHAR(100) NOT NULL,
  ip_origen VARCHAR(45) NOT NULL,
  exitoso TINYINT(1) NOT NULL DEFAULT 0,
  fecha_intento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_intentos_ip_fecha (ip_origen, fecha_intento),
  INDEX idx_intentos_user_fecha (usuario_o_email, fecha_intento)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 3. TABLAS DE TESORERIA, PLANES DE PAGO Y BENEFICIOS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conceptos_pago (
  id_concepto INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE,
  descripcion VARCHAR(200),
  monto_base DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  CHECK (monto_base >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS planes_pago (
  id_plan_pago INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  modalidad ENUM('Unico','Mensual','Fraccionado','Personalizado') NOT NULL DEFAULT 'Mensual',
  numero_cuotas SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  moneda VARCHAR(3) NOT NULL DEFAULT 'PEN',
  monto_total DECIMAL(10,2) NOT NULL,
  id_carrera INT NULL,
  id_periodo INT NULL,
  descripcion VARCHAR(255) NULL,
  estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  creado_por INT NULL,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_plan_pago_carrera FOREIGN KEY (id_carrera) REFERENCES carreras(id_carrera) ON DELETE SET NULL,
  CONSTRAINT fk_plan_pago_periodo FOREIGN KEY (id_periodo) REFERENCES periodos_academicos(id_periodo) ON DELETE RESTRICT,
  CONSTRAINT fk_plan_pago_usuario FOREIGN KEY (creado_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  CHECK (numero_cuotas > 0),
  CHECK (monto_total >= 0),
  CHECK (moneda = 'PEN')
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS plan_pago_cuotas (
  id_plan_pago_cuota INT AUTO_INCREMENT PRIMARY KEY,
  id_plan_pago INT NOT NULL,
  numero_cuota SMALLINT UNSIGNED NOT NULL,
  porcentaje_monto DECIMAL(5,2) NULL,
  monto_sugerido DECIMAL(10,2) NOT NULL,
  dias_vencimiento_sugeridos SMALLINT NULL,
  id_concepto INT NOT NULL,
  CONSTRAINT fk_plan_cuota_plan FOREIGN KEY (id_plan_pago) REFERENCES planes_pago(id_plan_pago) ON DELETE CASCADE,
  CONSTRAINT fk_plan_cuota_concepto FOREIGN KEY (id_concepto) REFERENCES conceptos_pago(id_concepto) ON DELETE RESTRICT,
  CONSTRAINT uq_plan_cuota_numero UNIQUE (id_plan_pago, numero_cuota),
  CHECK (numero_cuota > 0),
  CHECK (monto_sugerido >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS becas (
  id_beca INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  tipo ENUM('Porcentaje','MontoFijo') NOT NULL DEFAULT 'Porcentaje',
  valor DECIMAL(10,2) NOT NULL,
  descripcion VARCHAR(255) NULL,
  fecha_inicio DATE NULL,
  fecha_fin DATE NULL,
  estado ENUM('Activa','Inactiva') NOT NULL DEFAULT 'Activa',
  creado_por INT NULL,
  CONSTRAINT fk_beca_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  CHECK (valor >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS descuentos (
  id_descuento INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  tipo ENUM('Porcentaje','MontoFijo') NOT NULL DEFAULT 'Porcentaje',
  valor DECIMAL(10,2) NOT NULL,
  descripcion VARCHAR(255) NULL,
  fecha_inicio DATE NULL,
  fecha_fin DATE NULL,
  estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  creado_por INT NULL,
  CONSTRAINT fk_descuento_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  CHECK (valor >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS estudiante_planes_pago (
  id_estudiante_plan INT AUTO_INCREMENT PRIMARY KEY,
  id_estudiante INT NOT NULL,
  id_plan_pago INT NOT NULL,
  id_periodo INT NOT NULL,
  asignado_por INT NULL,
  fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  estado ENUM('Vigente','Finalizado','Cancelado') NOT NULL DEFAULT 'Vigente',
  CONSTRAINT fk_estudiante_plan_estudiante FOREIGN KEY (id_estudiante) REFERENCES estudiantes(id_estudiante) ON DELETE RESTRICT,
  CONSTRAINT fk_estudiante_plan_plan FOREIGN KEY (id_plan_pago) REFERENCES planes_pago(id_plan_pago) ON DELETE RESTRICT,
  CONSTRAINT fk_estudiante_plan_periodo FOREIGN KEY (id_periodo) REFERENCES periodos_academicos(id_periodo) ON DELETE RESTRICT,
  CONSTRAINT fk_estudiante_plan_usuario FOREIGN KEY (asignado_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS obligaciones_pago (
  id_obligacion INT AUTO_INCREMENT PRIMARY KEY,
  id_estudiante INT NOT NULL,
  id_periodo INT NOT NULL,
  id_concepto INT NOT NULL,
  monto_nominal DECIMAL(10,2) NOT NULL,
  monto_descuento DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  monto_neto DECIMAL(10,2) NOT NULL,
  monto_pagado DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  saldo DECIMAL(10,2) NOT NULL,
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  estado ENUM('Pendiente','Parcial','Pagado','Vencido','Anulado') NOT NULL DEFAULT 'Pendiente',
  FOREIGN KEY (id_estudiante) REFERENCES estudiantes(id_estudiante),
  FOREIGN KEY (id_periodo) REFERENCES periodos_academicos(id_periodo),
  FOREIGN KEY (id_concepto) REFERENCES conceptos_pago(id_concepto),
  CHECK (monto_nominal >= 0),
  CHECK (monto_neto >= 0),
  CHECK (monto_pagado >= 0),
  CHECK (saldo >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS plan_cuota_obligaciones (
  id_plan_cuota_obligacion INT AUTO_INCREMENT PRIMARY KEY,
  id_estudiante_plan INT NOT NULL,
  id_plan_pago_cuota INT NOT NULL,
  id_obligacion INT NOT NULL,
  CONSTRAINT fk_pco_estudiante_plan FOREIGN KEY (id_estudiante_plan) REFERENCES estudiante_planes_pago(id_estudiante_plan) ON DELETE CASCADE,
  CONSTRAINT fk_pco_plan_cuota FOREIGN KEY (id_plan_pago_cuota) REFERENCES plan_pago_cuotas(id_plan_pago_cuota) ON DELETE RESTRICT,
  CONSTRAINT fk_pco_obligacion FOREIGN KEY (id_obligacion) REFERENCES obligaciones_pago(id_obligacion) ON DELETE RESTRICT,
  CONSTRAINT uq_pco_obligacion UNIQUE (id_obligacion)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pagos (
  id_pago INT AUTO_INCREMENT PRIMARY KEY,
  id_estudiante INT NOT NULL,
  fecha_pago DATETIME NOT NULL,
  metodo VARCHAR(60) NOT NULL,
  referencia VARCHAR(80),
  monto DECIMAL(10,2) NOT NULL,
  estado ENUM('Registrado','Anulado') NOT NULL DEFAULT 'Registrado',
  FOREIGN KEY (id_estudiante) REFERENCES estudiantes(id_estudiante),
  CHECK (monto > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pago_detalles (
  id_pago_detalle INT AUTO_INCREMENT PRIMARY KEY,
  id_pago INT NOT NULL,
  id_obligacion INT NOT NULL,
  monto_aplicado DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (id_pago) REFERENCES pagos(id_pago) ON DELETE CASCADE,
  FOREIGN KEY (id_obligacion) REFERENCES obligaciones_pago(id_obligacion),
  CHECK (monto_aplicado > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS historial_movimientos_pago (
  id_movimiento INT AUTO_INCREMENT PRIMARY KEY,
  id_obligacion INT NOT NULL,
  id_pago INT NULL,
  tipo_movimiento ENUM('EMISION','PAGO','REAJUSTE','ANULACION') NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  saldo_anterior DECIMAL(10,2) NOT NULL,
  saldo_nuevo DECIMAL(10,2) NOT NULL,
  motivo VARCHAR(255) NULL,
  registrado_por INT NULL,
  fecha_movimiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mov_obligacion FOREIGN KEY (id_obligacion) REFERENCES obligaciones_pago(id_obligacion) ON DELETE CASCADE,
  CONSTRAINT fk_mov_pago FOREIGN KEY (id_pago) REFERENCES pagos(id_pago) ON DELETE SET NULL,
  CONSTRAINT fk_mov_usuario FOREIGN KEY (registrado_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS estudiante_cuentas (
  id_cuenta INT AUTO_INCREMENT PRIMARY KEY,
  id_estudiante INT NOT NULL UNIQUE,
  total_cargos DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_pagos DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_descuentos DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  saldo_actual DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cuenta_estudiante FOREIGN KEY (id_estudiante) REFERENCES estudiantes(id_estudiante) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 4. TABLAS DE GESTION DE MALLAS CURRICULARES
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS planes_estudio (
  id_plan INT AUTO_INCREMENT PRIMARY KEY,
  id_carrera INT NOT NULL,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  version VARCHAR(20) NOT NULL,
  fecha_vigencia DATE NOT NULL,
  estado ENUM('Borrador','Activo','Historico') NOT NULL DEFAULT 'Borrador',
  FOREIGN KEY (id_carrera) REFERENCES carreras(id_carrera) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS plan_cursos (
  id_plan_curso INT AUTO_INCREMENT PRIMARY KEY,
  id_plan INT NOT NULL,
  id_curso INT NOT NULL,
  id_ciclo INT NOT NULL,
  tipo_curso ENUM('Obligatorio','Electivo') NOT NULL DEFAULT 'Obligatorio',
  creditos INT NOT NULL,
  horas_teoria INT NOT NULL DEFAULT 0,
  horas_practica INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_plan_curso (id_plan, id_curso),
  FOREIGN KEY (id_plan) REFERENCES planes_estudio(id_plan) ON DELETE CASCADE,
  FOREIGN KEY (id_curso) REFERENCES cursos(id_curso) ON DELETE RESTRICT,
  FOREIGN KEY (id_ciclo) REFERENCES ciclos(id_ciclo) ON DELETE RESTRICT,
  CHECK (creditos > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS curso_prerrequisitos (
  id_prerrequisito INT AUTO_INCREMENT PRIMARY KEY,
  id_plan_curso INT NOT NULL,
  id_curso_requisito INT NOT NULL,
  tipo_requisito ENUM('Aprobado','Simultaneo') NOT NULL DEFAULT 'Aprobado',
  UNIQUE KEY uk_plan_curso_requisito (id_plan_curso, id_curso_requisito),
  FOREIGN KEY (id_plan_curso) REFERENCES plan_cursos(id_plan_curso) ON DELETE CASCADE,
  FOREIGN KEY (id_curso_requisito) REFERENCES cursos(id_curso) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS estudiante_planes_estudio (
  id_estudiante_plan INT AUTO_INCREMENT PRIMARY KEY,
  id_estudiante INT NOT NULL,
  id_plan INT NOT NULL,
  fecha_asignacion DATE NOT NULL,
  estado ENUM('Activo','Historico') NOT NULL DEFAULT 'Activo',
  UNIQUE KEY uk_estudiante_plan_activo (id_estudiante, id_plan),
  FOREIGN KEY (id_estudiante) REFERENCES estudiantes(id_estudiante) ON DELETE RESTRICT,
  FOREIGN KEY (id_plan) REFERENCES planes_estudio(id_plan) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS plan_estudio_control (
  id_plan INT PRIMARY KEY,
  nota_minima_aprobatoria DECIMAL(4,2) NOT NULL DEFAULT 11.00,
  max_creditos_por_periodo INT NOT NULL DEFAULT 22,
  permite_subsanacion TINYINT(1) NOT NULL DEFAULT 1,
  creado_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id_plan) REFERENCES planes_estudio(id_plan) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS plan_curso_control (
  id_plan_curso INT PRIMARY KEY,
  es_revisable_correquisito TINYINT(1) NOT NULL DEFAULT 1,
  permite_convalidacion TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (id_plan_curso) REFERENCES plan_cursos(id_plan_curso) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS historial_cambios_malla (
  id_cambio INT AUTO_INCREMENT PRIMARY KEY,
  id_plan INT NOT NULL,
  id_usuario INT NULL,
  accion VARCHAR(50) NOT NULL,
  detalle JSON NOT NULL,
  fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_plan) REFERENCES planes_estudio(id_plan) ON DELETE CASCADE,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS historial_calificaciones (
  id_historial INT AUTO_INCREMENT PRIMARY KEY,
  id_calificacion INT NOT NULL,
  id_evaluacion INT NOT NULL,
  id_matricula INT NOT NULL,
  nota_anterior DECIMAL(4,2) NOT NULL,
  nota_nueva DECIMAL(4,2) NOT NULL,
  motivo_cambio VARCHAR(255) NOT NULL,
  cambiado_por INT NULL,
  fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_calificacion) REFERENCES calificaciones(id_calificacion) ON DELETE CASCADE,
  FOREIGN KEY (id_evaluacion) REFERENCES evaluaciones(id_evaluacion) ON DELETE RESTRICT,
  FOREIGN KEY (id_matricula) REFERENCES matriculas(id_matricula) ON DELETE RESTRICT,
  FOREIGN KEY (cambiado_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Estructura de base de datos bd_matricula creada exitosamente.' AS Resultado;
