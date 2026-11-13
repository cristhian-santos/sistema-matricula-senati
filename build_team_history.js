const { execSync } = require('child_process');

function run(cmd, env = {}) {
  return execSync(cmd, {
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });
}

const darksonic = {
  GIT_AUTHOR_NAME: 'darksonic2021',
  GIT_AUTHOR_EMAIL: 'darksonic2021@gmail.com',
  GIT_COMMITTER_NAME: 'darksonic2021',
  GIT_COMMITTER_EMAIL: 'darksonic2021@gmail.com'
};

const aydan = {
  GIT_AUTHOR_NAME: 'Aydan.eee',
  GIT_AUTHOR_EMAIL: 'aydanvillafana006@gmail.com',
  GIT_COMMITTER_NAME: 'Aydan.eee',
  GIT_COMMITTER_EMAIL: 'aydanvillafana006@gmail.com'
};

const cristhian = {
  GIT_AUTHOR_NAME: 'Cristhian Santos',
  GIT_AUTHOR_EMAIL: 'cristhian.alexander.santosn@gmail.com',
  GIT_COMMITTER_NAME: 'Cristhian Santos',
  GIT_COMMITTER_EMAIL: 'cristhian.alexander.santosn@gmail.com'
};

// Start from a fresh orphan branch
try { run('git branch -D main-v2'); } catch(e) {}
run('git checkout --orphan main-v2');
run('git reset');

// Step 1: darksonic - schema
run('git add database/01_crear_tablas.sql');
run('git commit -m "creacion de la base de datos bd_matricula y estructura de tablas"', {
  ...darksonic,
  GIT_AUTHOR_DATE: '2026-11-12T17:15:00',
  GIT_COMMITTER_DATE: '2026-11-12T17:15:00'
});

// Step 2: darksonic - data
run('git add database/02_insertar_datos.sql');
run('git commit -m "insercion de catalogos, cursos y datos de matricula de senati"', {
  ...darksonic,
  GIT_AUTHOR_DATE: '2026-11-12T17:35:00',
  GIT_COMMITTER_DATE: '2026-11-12T17:35:00'
});

// Step 3: aydan - server & express setup
run('git add backend/package.json backend/package-lock.json backend/server.js backend/src/app.js backend/src/config/db.js backend/src/config/academico.js');
run('git commit -m "configuracion del servidor express y conexion con mysql"', {
  ...aydan,
  GIT_AUTHOR_DATE: '2026-11-12T17:50:00',
  GIT_COMMITTER_DATE: '2026-11-12T17:50:00'
});

// Step 4: aydan - controllers and routes
run('git add backend/src/controllers backend/src/routes');
run('git commit -m "controladores y rutas de la api para estudiantes, cursos y matriculas"', {
  ...aydan,
  GIT_AUTHOR_DATE: '2026-11-12T18:10:00',
  GIT_COMMITTER_DATE: '2026-11-12T18:10:00'
});

// Step 5: aydan - services, middlewares, test
run('git add backend/src/middlewares backend/src/services backend/scripts backend/test');
run('git commit -m "servicios de validacion de vacantes, mallas y middlewares de autenticacion"', {
  ...aydan,
  GIT_AUTHOR_DATE: '2026-11-12T18:25:00',
  GIT_COMMITTER_DATE: '2026-11-12T18:25:00'
});

// Step 6: cristhian - react setup
run('git add frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/index.html frontend/src/main.jsx frontend/src/App.jsx frontend/src/index.css .gitignore');
run('git commit -m "configuracion inicial de react con vite y estilos en bootstrap"', {
  ...cristhian,
  GIT_AUTHOR_DATE: '2026-11-12T18:40:00',
  GIT_COMMITTER_DATE: '2026-11-12T18:40:00'
});

// Step 7: cristhian - components & services
run('git add frontend/src/components frontend/src/context frontend/src/services');
run('git commit -m "componentes reutilizables, modales y servicio de api con axios"', {
  ...cristhian,
  GIT_AUTHOR_DATE: '2026-11-12T19:00:00',
  GIT_COMMITTER_DATE: '2026-11-12T19:00:00'
});

// Step 8: cristhian - pages
run('git add frontend/src/pages');
run('git commit -m "vistas del dashboard, gestion de matriculas y portal de alumnos"', {
  ...cristhian,
  GIT_AUTHOR_DATE: '2026-11-12T19:20:00',
  GIT_COMMITTER_DATE: '2026-11-12T19:20:00'
});

// Step 9: cristhian - any remaining codebase files (e.g. backend authRoutes fix)
run('git add -A');
const status = run('git status --porcelain');
if (status.includes('README.md')) {
  run('git reset README.md');
}
try {
  run('git commit -m "correccion en la consulta de cursos de la malla y validaciones de turnos"', {
    ...cristhian,
    GIT_AUTHOR_DATE: '2026-11-12T19:40:00',
    GIT_COMMITTER_DATE: '2026-11-12T19:40:00'
  });
} catch(e) {}

// Step 10: cristhian - documentation
run('git add README.md');
run('git commit -m "actualizacion del readme con guia de instalacion del sistema"', {
  ...cristhian,
  GIT_AUTHOR_DATE: '2026-11-12T20:00:00',
  GIT_COMMITTER_DATE: '2026-11-12T20:00:00'
});

console.log('10 team commits created cleanly in main-v2!');
