const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// 🔌 Conexión a MySQL
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',        // tu usuario
  password: 'AiDualC2000', // tu contraseña
  database: 'employees'    // nombre de tu BD
});

// Verificar conexión
connection.connect((err) => {
  if (err) {
    console.log('❌ Error de conexión:', err);
    return;
  }
  console.log('✅ Conectado a MySQL');
});

// 📌 Endpoint: obtener empleados
app.get('/employees', (req, res) => {
  connection.query('SELECT * FROM employees', (err, results) => {
    if (err) {
      return res.status(500).json(err);
    }
    res.json(results);
  });
});

app.post('/employees', (req, res) => {
  const {  emp_no, birth_date, first_name, last_name, gender, hire_date  } = req.body;

  // ✅ Validación
  if (! emp_no|| ! birth_date|| ! first_name|| !last_name || !gender || !hire_date) {
    return res.status(400).json({
      error: 'Todos los campos son obligatorios'
    });
  }

  const query = `INSERT INTO employees ( emp_no, birth_date, first_name, last_name, gender, hire_date )
 VALUES (?, ?, ?, ?, ?, ?)`;

  connection.query(query, [ emp_no, birth_date, first_name, last_name, gender, hire_date ], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json(err);
    }

    res.json({
      message: 'Empleado agregado correctamente',
      id: results.insertId
    });
  });
});

// 🚀 Servidor
app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});

//console.log(req.body);