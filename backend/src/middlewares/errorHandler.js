// Middleware para manejo centralizado de errores
const errorHandler = (err, req, res, next) => {
  console.error('Error capturado por errorHandler:', err);
  const production = process.env.NODE_ENV === 'production';

  // Errores de MySQL
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({
      success: false,
      message: 'Conflicto de duplicidad: ya existe un registro con esos datos únicos.'
    });
  }

  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(400).json({
      success: false,
      message: 'Restricción de integridad referencial: el registro está asociado a otros datos.'
    });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      message: 'Una de las referencias seleccionadas no existe.'
    });
  }

  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    message: statusCode >= 500 && production ? 'Error interno del servidor.' : err.message || 'Error interno del servidor'
  };
  if (!production && err.stack) response.stack = err.stack;
  return res.status(statusCode).json(response);
};

module.exports = errorHandler;
