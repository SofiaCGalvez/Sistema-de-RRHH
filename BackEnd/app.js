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

app.get('/employees/:id', (req, res) => {
  const { id } = req.params;

  connection.query(
    'SELECT emp_no, first_name, last_name FROM employees WHERE emp_no = ? LIMIT 1',
    [id],
    (err, results) => {
      if (err) {
        console.log(err);
        return res.status(500).json(err);
      }

      if (!results.length) {
        return res.status(404).json({
          error: 'Empleado no encontrado'
        });
      }

      res.json(results[0]);
    }
  );
});

app.get('/directory/employees', (req, res) => {
  const query = `
    SELECT
      e.emp_no,
      e.first_name,
      e.last_name,
      e.hire_date,
      COALESCE((
        SELECT t.title
        FROM titles t
        WHERE t.emp_no = e.emp_no
        ORDER BY t.to_date DESC, t.from_date DESC
        LIMIT 1
      ), 'Sin puesto') AS title,
      COALESCE((
        SELECT d.dept_name
        FROM dept_emp de
        INNER JOIN departments d ON d.dept_no = de.dept_no
        WHERE de.emp_no = e.emp_no
        ORDER BY de.to_date DESC, de.from_date DESC
        LIMIT 1
      ), 'Sin departamento') AS department,
      COALESCE((
        SELECT s.salary
        FROM salaries s
        WHERE s.emp_no = e.emp_no
        ORDER BY s.to_date DESC, s.from_date DESC
        LIMIT 1
      ), 0) AS salary
    FROM employees e
    ORDER BY e.emp_no ASC
    LIMIT 300
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json(err);
    }

    res.json(results);
  });
});

app.get('/incidents', (req, res) => {
  const query = `
    SELECT
      i.incident_id,
      i.employee_id,
      CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
      i.incident_type,
      i.priority,
      i.status,
      i.description,
      i.incident_date
    FROM incidents i
    INNER JOIN employees e ON e.emp_no = i.employee_id
    ORDER BY i.incident_id DESC
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json(err);
    }

    res.json(results);
  });
});

app.get('/dashboard/summary', async (req, res) => {
  const runQuery = (sql) => new Promise((resolve, reject) => {
    connection.query(sql, (err, results) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(results);
    });
  });

  const tableExists = async (tableName) => {
    const results = await runQuery(`
      SELECT COUNT(*) AS total
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      AND table_name = '${tableName}'
    `);

    return results[0]?.total > 0;
  };

  try {
    const [hasDeptEmpTable, hasSalariesTable, hasIncidentsTable] = await Promise.all([
      tableExists('dept_emp'),
      tableExists('salaries'),
      tableExists('incidents')
    ]);

    const employeeResult = await runQuery('SELECT COUNT(*) AS totalEmployees FROM employees');
    const recentHireResult = await runQuery(`
      SELECT COUNT(*) AS recentHires
      FROM employees
      WHERE hire_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
    `);

    const departmentResult = hasDeptEmpTable
      ? await runQuery(`
          SELECT COUNT(DISTINCT de.dept_no) AS activeDepartments
          FROM dept_emp de
          WHERE de.to_date = '9999-01-01'
        `)
      : [{ activeDepartments: 0 }];

    const salaryResult = hasSalariesTable
      ? await runQuery(`
          SELECT ROUND(AVG(s.salary), 0) AS averageSalary
          FROM salaries s
          WHERE s.to_date = '9999-01-01'
        `)
      : [{ averageSalary: 0 }];

    const incidentsResult = hasIncidentsTable
      ? await runQuery(`
          SELECT COUNT(*) AS pendingIncidents
          FROM incidents
          WHERE status = 'pending'
        `)
      : [{ pendingIncidents: 0 }];

    res.json({
      totalEmployees: employeeResult[0]?.totalEmployees ?? 0,
      activeDepartments: departmentResult[0]?.activeDepartments ?? 0,
      averageSalary: salaryResult[0]?.averageSalary ?? 0,
      recentHires: recentHireResult[0]?.recentHires ?? 0,
      pendingIncidents: incidentsResult[0]?.pendingIncidents ?? 0
    });
  } catch (error) {
    console.log('Error al obtener resumen del dashboard:', error);
    res.status(500).json({
      error: 'No se pudo obtener el resumen del dashboard'
    });
  }
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

app.post('/incidents', (req, res) => {
  const { employee_id, incident_type, priority, status, description, incident_date } = req.body;

  if (!employee_id || !incident_type || !priority || !status || !description || !incident_date) {
    return res.status(400).json({
      error: 'Todos los campos son obligatorios'
    });
  }

  connection.query(
    'SELECT emp_no FROM employees WHERE emp_no = ? LIMIT 1',
    [employee_id],
    (employeeErr, employeeResults) => {
      if (employeeErr) {
        console.log(employeeErr);
        return res.status(500).json({
          error: employeeErr.sqlMessage || employeeErr.message || 'Error al validar el empleado'
        });
      }

      if (!employeeResults.length) {
        return res.status(400).json({
          error: 'El empleado seleccionado no existe en la tabla employees'
        });
      }

      const query = `
        INSERT INTO incidents (employee_id, incident_type, priority, status, description, incident_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      connection.query(
        query,
        [employee_id, incident_type, priority, status, description, incident_date],
        (err, results) => {
          if (err) {
            console.log(err);
            return res.status(500).json({
              error: err.sqlMessage || err.message || 'No se pudo registrar la incidencia'
            });
          }

          res.status(201).json({
            message: 'Incidencia agregada correctamente',
            incident_id: results.insertId
          });
        }
      );
    }
  );
});

app.patch('/incidents/:id', (req, res) => {
  const { id } = req.params;
  const { employee_id, incident_type, priority, description } = req.body;

  if (!employee_id || !incident_type || !priority || !description) {
    return res.status(400).json({
      error: 'Todos los campos son obligatorios'
    });
  }

  connection.query(
    'SELECT emp_no FROM employees WHERE emp_no = ? LIMIT 1',
    [employee_id],
    (employeeErr, employeeResults) => {
      if (employeeErr) {
        console.log(employeeErr);
        return res.status(500).json({
          error: employeeErr.sqlMessage || employeeErr.message || 'Error al validar el empleado'
        });
      }

      if (!employeeResults.length) {
        return res.status(400).json({
          error: 'El empleado seleccionado no existe en la tabla employees'
        });
      }

      const query = `
        UPDATE incidents
        SET employee_id = ?, incident_type = ?, priority = ?, description = ?
        WHERE incident_id = ?
      `;

      connection.query(
        query,
        [employee_id, incident_type, priority, description, id],
        (err, results) => {
          if (err) {
            console.log(err);
            return res.status(500).json({
              error: err.sqlMessage || err.message || 'No se pudo actualizar la incidencia'
            });
          }

          if (!results.affectedRows) {
            return res.status(404).json({
              error: 'Incidencia no encontrada'
            });
          }

          res.json({
            message: 'Incidencia actualizada correctamente'
          });
        }
      );
    }
  );
});

app.patch('/incidents/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({
      error: 'El estado es obligatorio'
    });
  }

  const query = 'UPDATE incidents SET status = ? WHERE incident_id = ?';

  connection.query(query, [status, id], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json(err);
    }

    if (!results.affectedRows) {
      return res.status(404).json({
        error: 'Incidencia no encontrada'
      });
    }

    res.json({
      message: 'Estado actualizado correctamente'
    });
  });
});


app.delete('/incidents/:id', (req, res) => {
  const { id } = req.params;

  connection.query('DELETE FROM incidents WHERE incident_id = ?', [id], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({
        error: err.sqlMessage || err.message || 'No se pudo eliminar la incidencia'
      });
    }

    if (!results.affectedRows) {
      return res.status(404).json({
        error: 'Incidencia no encontrada'
      });
    }

    res.json({
      message: 'Incidencia eliminada correctamente'
    });
  });
});

console.log("🔥 ESTE ES EL ARCHIVO CORRECTO");
// endpoint para sacar numero de empleados por departamentos
app.get("/api/departments", (req, res) => {
  const query = `
    SELECT
      d.dept_no,
      d.dept_name,
      (
        SELECT COUNT(*)
        FROM dept_emp de
        WHERE de.dept_no = d.dept_no
        AND de.to_date = '9999-01-01'
      ) AS total,
      (
        SELECT COUNT(*)
        FROM dept_emp de
        WHERE de.dept_no = d.dept_no
        AND de.to_date = '9999-01-01'
      ) AS total_employees,
      COALESCE((
        SELECT CONCAT(e.first_name, ' ', e.last_name)
        FROM dept_manager dm
        INNER JOIN employees e ON e.emp_no = dm.emp_no
        WHERE dm.dept_no = d.dept_no
        ORDER BY dm.to_date DESC, dm.from_date DESC
        LIMIT 1
      ), 'Sin gerente asignado') AS current_manager,
      COALESCE((
        SELECT ROUND(AVG(s.salary), 0)
        FROM dept_emp de2
        INNER JOIN salaries s
          ON s.emp_no = de2.emp_no
          AND s.to_date = '9999-01-01'
        WHERE de2.dept_no = d.dept_no
        AND de2.to_date = '9999-01-01'
      ), 0) AS average_salary
    FROM departments d
    ORDER BY total_employees DESC, d.dept_name ASC;
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.log("ERROR SQL:", err);
      return res.status(500).json(err);
    }

    res.json(results);
  });
});




// 🚀 Servidor
app.get('/api/departments/:deptNo/employees', (req, res) => {
  const { deptNo } = req.params;
  const parsedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isNaN(parsedLimit) ? 20 : parsedLimit;

  const query = `
    SELECT
      e.emp_no,
      e.first_name,
      e.last_name,
      COALESCE((
        SELECT t.title
        FROM titles t
        WHERE t.emp_no = e.emp_no
        ORDER BY t.to_date DESC, t.from_date DESC
        LIMIT 1
      ), 'Sin puesto') AS title,
      COALESCE((
        SELECT s.salary
        FROM salaries s
        WHERE s.emp_no = e.emp_no
        ORDER BY s.to_date DESC, s.from_date DESC
        LIMIT 1
      ), 0) AS salary,
      e.gender,
      e.hire_date
    FROM dept_emp de
    INNER JOIN employees e ON e.emp_no = de.emp_no
    WHERE de.dept_no = ?
    AND de.to_date = '9999-01-01'
    ORDER BY e.emp_no ASC
    LIMIT ?
  `;

  connection.query(query, [deptNo, limit], (err, results) => {
    if (err) {
      console.log('ERROR SQL empleados por departamento:', err);
      return res.status(500).json(err);
    }

    res.json(results);
  });
});

app.get('/api/career-history/employees', (req, res) => {
  const parsedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isNaN(parsedLimit) ? 12 : parsedLimit;

  const query = `
    SELECT
      e.emp_no,
      e.first_name,
      e.last_name,
      COALESCE((
        SELECT d.dept_name
        FROM dept_emp de
        INNER JOIN departments d ON d.dept_no = de.dept_no
        WHERE de.emp_no = e.emp_no
        ORDER BY de.to_date DESC, de.from_date DESC
        LIMIT 1
      ), 'Sin departamento') AS department,
      COALESCE((
        SELECT t.title
        FROM titles t
        WHERE t.emp_no = e.emp_no
        ORDER BY t.to_date DESC, t.from_date DESC
        LIMIT 1
      ), 'Sin puesto') AS current_title,
      COALESCE((
        SELECT s.salary
        FROM salaries s
        WHERE s.emp_no = e.emp_no
        ORDER BY s.to_date DESC, s.from_date DESC
        LIMIT 1
      ), 0) AS current_salary,
      (
        SELECT COUNT(DISTINCT t2.title)
        FROM titles t2
        WHERE t2.emp_no = e.emp_no
      ) AS change_records
    FROM employees e
    WHERE (
      SELECT COUNT(DISTINCT t3.title)
      FROM titles t3
      WHERE t3.emp_no = e.emp_no
    ) > 1
    ORDER BY change_records DESC, e.emp_no ASC
    LIMIT ?
  `;

  connection.query(query, [limit], (err, results) => {
    if (err) {
      console.log('ERROR SQL historial laboral:', err);
      return res.status(500).json(err);
    }

    res.json(results);
  });
});

app.get('/api/career-history/employees/:id', (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT
      e.emp_no,
      e.first_name,
      e.last_name,
      e.hire_date,
      COALESCE((
        SELECT d.dept_name
        FROM dept_emp de
        INNER JOIN departments d ON d.dept_no = de.dept_no
        WHERE de.emp_no = e.emp_no
        ORDER BY de.to_date DESC, de.from_date DESC
        LIMIT 1
      ), 'Sin departamento') AS department,
      COALESCE((
        SELECT t.title
        FROM titles t
        WHERE t.emp_no = e.emp_no
        ORDER BY t.to_date DESC, t.from_date DESC
        LIMIT 1
      ), 'Sin puesto') AS current_title,
      COALESCE((
        SELECT s.salary
        FROM salaries s
        WHERE s.emp_no = e.emp_no
        ORDER BY s.to_date DESC, s.from_date DESC
        LIMIT 1
      ), 0) AS current_salary,
      (
        SELECT COUNT(DISTINCT t2.title)
        FROM titles t2
        WHERE t2.emp_no = e.emp_no
      ) AS change_records
    FROM employees e
    WHERE e.emp_no = ?
    LIMIT 1
  `;

  connection.query(query, [id], (err, results) => {
    if (err) {
      console.log('ERROR SQL detalle historial laboral:', err);
      return res.status(500).json(err);
    }

    if (!results.length) {
      return res.status(404).json({
        error: 'Empleado no encontrado'
      });
    }

    res.json(results[0]);
  });
});

app.get('/api/career-history/employees/:id/timeline', (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT
      t.title,
      t.from_date,
      t.to_date,
      COALESCE((
        SELECT d.dept_name
        FROM dept_emp de
        INNER JOIN departments d ON d.dept_no = de.dept_no
        WHERE de.emp_no = t.emp_no
        AND de.from_date <= t.from_date
        AND de.to_date >= t.from_date
        ORDER BY de.from_date DESC
        LIMIT 1
      ), 'Sin departamento') AS department,
      COALESCE((
        SELECT s.salary
        FROM salaries s
        WHERE s.emp_no = t.emp_no
        AND s.from_date <= t.from_date
        AND s.to_date >= t.from_date
        ORDER BY s.from_date DESC
        LIMIT 1
      ), 0) AS salary
    FROM titles t
    WHERE t.emp_no = ?
    ORDER BY t.from_date DESC, t.to_date DESC
  `;

  connection.query(query, [id], (err, results) => {
    if (err) {
      console.log('ERROR SQL timeline historial laboral:', err);
      return res.status(500).json(err);
    }

    const timeline = results.map((item, index) => {
      const previousItem = results[index + 1] || null;
      const salaryDifference = previousItem ? Number(item.salary || 0) - Number(previousItem.salary || 0) : null;
      const isCurrent = item.to_date === '9999-01-01' || item.to_date?.toISOString?.().startsWith('9999-01-01');

      let changeType = 'Contratacion';
      if (index === 0 && previousItem) {
        changeType = 'Promocion';
      } else if (previousItem) {
        changeType = previousItem.department === item.department ? 'Promocion' : 'Transferencia';
      }

      return {
        ...item,
        is_current: isCurrent,
        salary_difference: salaryDifference,
        change_type: index === results.length - 1 ? 'Contratacion' : changeType
      };
    });

    res.json(timeline);
  });
});

app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});

//console.log(req.body);
