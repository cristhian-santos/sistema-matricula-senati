const test = require('node:test');
const assert = require('node:assert/strict');
const errorHandler = require('../src/middlewares/errorHandler');

function invokeHandler(error, nodeEnv) {
  const previousEnv = process.env.NODE_ENV;
  const previousConsoleError = console.error;
  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;
  console.error = () => {};
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  try {
    errorHandler(error, {}, response, () => {});
    return response;
  } finally {
    console.error = previousConsoleError;
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
  }
}

test('production error responses do not leak SQL details or stack traces', () => {
  const response = invokeHandler(Object.assign(new Error('SELECT * FROM private_table'), {
    code: 'ER_DUP_ENTRY',
    sql: 'INSERT INTO private_table'
  }), 'production');

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, 'Conflicto de duplicidad: ya existe un registro con esos datos únicos.');
  assert.equal('error' in response.body, false);
  assert.equal('stack' in response.body, false);
});

test('unexpected production errors are returned as a generic server error', () => {
  const response = invokeHandler(new Error('private database connection string'), 'production');

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.message, 'Error interno del servidor.');
  assert.equal('stack' in response.body, false);
});

test('development errors preserve diagnostic stack information', () => {
  const response = invokeHandler(Object.assign(new Error('Bad request.'), { statusCode: 400 }), 'development');

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, 'Bad request.');
  assert.match(response.body.stack, /Error: Bad request\./);
});
