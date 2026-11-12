const express = require('express');
const router = express.Router();
const {
  getMatriculas,
  getMatriculaById,
  createMatricula,
  updateMatricula,
  deleteMatricula
} = require('../controllers/matriculasController');

router.get('/', getMatriculas);
router.get('/:id', getMatriculaById);
router.post('/', createMatricula);
router.put('/:id', updateMatricula);
router.delete('/:id', deleteMatricula);

module.exports = router;

