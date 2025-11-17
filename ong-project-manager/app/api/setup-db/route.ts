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

    // Crear tabla usuarios
    await connection.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id_usuario INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        id_ong INT NULL,
        es_gerente BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (id_ong) REFERENCES ongs(id_ong)
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
    await connection.query('DELETE FROM usuarios');
    await connection.query('DELETE FROM ongs');

    
    // Insertar datos de ejemplo en ongs
    await connection.query(`
      INSERT INTO ongs (nombre) VALUES
      ('ONG Líder'),
      ('ONG Colaboradora');
    `);

    // Insertar datos de ejemplo en usuarios - Usuarios de bonita
    await connection.query(`
      INSERT INTO usuarios (username, password, email, id_ong, es_gerente) VALUES
      ('laura.fernandez', 'password123', 'laura.fernandez@onglider.org', 1, TRUE),
      ('pedro.rodriguez', 'password456', 'pedro.rodriguez@onglider.org', 1, FALSE),
      ('carlos.mendoza', 'password789', 'carlos.mendoza@ongcolaboradora.org', 2, TRUE),
      ('sofia.gutierrez', 'password012', 'sofia.gutierrez@ongcolaboradora.org', 2, FALSE),
      ('roberto.silva', 'password345', 'roberto.silva@onglider.org', 1, TRUE);
    `);

    // Insertar datos de ejemplo en proyectos - AHORA con id_ong_lider
    await connection.query(`
      INSERT INTO proyectos (nombre, descripcion, fecha_inicio, fecha_fin, en_ejecucion, id_ong_lider) VALUES
      ('Proyecto Educación Rural', 'Programa de alfabetización en zonas rurales', '2024-01-15', '2024-12-31', true, 1),
      ('Iniciativa Salud Comunitaria', 'Campaña de prevención y salud básica', '2024-03-01', '2024-11-30', true, 1),
      ('Campaña Reforestación', 'Restauración de áreas naturales protegidas', '2024-02-01', '2024-08-31', false, 2);
    `);

     // Insertar datos de ejemplo en etapas
    await connection.query(`
      INSERT INTO etapas (id_proyecto, nombre, descripcion, is_completed, id_ong_ejecutora) VALUES
      (1, 'Diagnóstico Comunitario', 'Evaluación de necesidades educativas', TRUE, 1),
      (1, 'Diseño Curricular', 'Desarrollo de material educativo', FALSE, 1),
      (2, 'Estudio Epidemiológico', 'Análisis de situación de salud', TRUE, 2),
      (2, 'Capacitación de Voluntarios', 'Formación del equipo de trabajo', FALSE, 1),
      (3, 'Identificación de Áreas', 'Selección de zonas a reforestar', FALSE, 2);
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
