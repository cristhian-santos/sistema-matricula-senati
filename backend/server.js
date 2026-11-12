const app = require('./src/app');
const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor Backend ejecutándose en http://localhost:${PORT}`);
  console.log(`📡 Endpoints disponibles en http://localhost:${PORT}/api`);
});

