
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const connection = await pool.getConnection();
    
    // Crear la tabla si no existe
    await connection.query(`
      CREATE TABLE IF NOT EXISTS proyectos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        descripcion TEXT,
        fecha_inicio DATE,
        fecha_fin DATE,
        estado VARCHAR(50)
      );
    `);

    // Opcional: Limpiar la tabla antes de insertar para evitar duplicados en cada llamada
    await connection.query('TRUNCATE TABLE proyectos');

    // Insertar datos de ejemplo
    const insertQuery = `
      INSERT INTO proyectos (nombre, descripcion, fecha_inicio, fecha_fin, estado) VALUES
      ('Proyecto Alpha', 'Descripción del Proyecto Alpha', '2024-01-15', '2024-06-30', 'En curso'),
      ('Iniciativa Beta', 'Descripción de la Iniciativa Beta', '2024-03-01', '2024-09-15', 'Planificado'),
      ('Campaña Gamma', 'Descripción de la Campaña Gamma', '2023-11-10', '2024-02-20', 'Completado');
    `;
    await connection.query(insertQuery);

    connection.release();

    return NextResponse.json({ message: 'Base de datos configurada exitosamente.' });
  } catch (error) {
    console.error(error);
    // Asegurarse de que el error sea un objeto Error
    const errorMessage = error instanceof Error ? error.message : 'Un error desconocido ocurrió';
    return NextResponse.json({ error: 'Error al configurar la base de datos', details: errorMessage }, { status: 500 });
  }
}
