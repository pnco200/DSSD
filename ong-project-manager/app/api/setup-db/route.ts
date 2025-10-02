import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Crear tabla ongs PRIMERO porque otras tablas dependen de ella
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ongs (
        id_ong INT PRIMARY KEY AUTO_INCREMENT,
        nombre VARCHAR(255) NOT NULL
      );
    `);

    // Crear tabla proyectos - CORREGIDO: usar id_proyecto en lugar de id
    await connection.query(`
      CREATE TABLE IF NOT EXISTS proyectos (
        id_proyecto INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        descripcion TEXT,
        id_ong_lider INT NULL ,
        fecha_inicio DATE,
        fecha_fin DATE,
        en_ejecucion BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (id_ong_lider) REFERENCES ongs(id_ong)
      );
    `);

    // Crear tabla etapas - CORREGIDO: eliminar el ; después de BOOLEAN
    await connection.query(`
      CREATE TABLE IF NOT EXISTS etapas (
        id_etapa INT PRIMARY KEY AUTO_INCREMENT,
        id_proyecto INT NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        descripcion TEXT,
        is_completed BOOLEAN,
        id_ong_ejecutora INT NULL,
        FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto),
        FOREIGN KEY (id_ong_ejecutora) REFERENCES ongs(id_ong)
      );
    `);

    // Opcional: Limpiar las tablas antes de insertar
    await connection.query('DELETE FROM etapas');
    await connection.query('DELETE FROM proyectos');
    await connection.query('DELETE FROM ongs');

    // Insertar datos de ejemplo en ongs PRIMERO
    await connection.query(`
      INSERT INTO ongs (nombre) VALUES
      ('ONG Líder Principal'),
      ('ONG Ejecutora A'),
      ('ONG Ejecutora B');
    `);

    // Insertar datos de ejemplo en proyectos - AHORA con id_ong_lider
    await connection.query(`
      INSERT INTO proyectos (nombre, descripcion, fecha_inicio, fecha_fin, en_ejecucion, id_ong_lider) VALUES
      ('Proyecto Alpha', 'Descripción del Proyecto Alpha', '2024-01-15', '2024-06-30', false, 1),
      ('Iniciativa Beta', 'Descripción de la Iniciativa Beta', '2024-03-01', '2024-09-15', false, 1),
      ('Campaña Gamma', 'Descripción de la Campaña Gamma', '2023-11-10', '2024-02-20', false, 2);
    `);

    // Insertar datos de ejemplo en etapas
    await connection.query(`
      INSERT INTO etapas (id_proyecto, nombre, descripcion, is_completed, id_ong_ejecutora) VALUES
      (1, 'Diagnóstico', 'Evaluación inicial', FALSE, 1),
      (1, 'Planificación', 'Plan detallado', FALSE, 2),
      (2, 'Investigación', 'Estudio de mercado', TRUE, 3);
    `);

    connection.release();

    return NextResponse.json({ message: 'Base de datos configurada exitosamente.' });
  } catch (error) {
    console.error('Error detallado:', error);
    if (connection) connection.release();
    
    const errorMessage = error instanceof Error ? error.message : 'Un error desconocido ocurrió';
    return NextResponse.json({ 
      error: 'Error al configurar la base de datos', 
      details: errorMessage 
    }, { status: 500 });
  }
}
