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

    // Crear tabla proyectos - ahora con id_externa opcional
    await connection.query(`
      CREATE TABLE IF NOT EXISTS proyectos (
        id_proyecto INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        descripcion TEXT,
        id_externa VARCHAR(255) NULL,
        id_ong_lider INT NULL ,
        fecha_inicio DATE,
        fecha_fin DATE,
        en_ejecucion BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (id_ong_lider) REFERENCES ongs(id_ong)
      );
    `);

    // Crear tabla etapas - ahora con id_externa opcional
    await connection.query(`
      CREATE TABLE IF NOT EXISTS etapas (
        id_etapa INT PRIMARY KEY AUTO_INCREMENT,
        id_proyecto INT NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        descripcion TEXT,
        is_completed BOOLEAN,
        id_externa VARCHAR(255) NULL,
        id_ong_ejecutora INT NULL,
        FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto),
        FOREIGN KEY (id_ong_ejecutora) REFERENCES ongs(id_ong)
      );
    `);

    // Crear tabla observaciones
    await connection.query(`
      CREATE TABLE IF NOT EXISTS observaciones (
        id_observacion INT PRIMARY KEY AUTO_INCREMENT,
        titulo VARCHAR(255) NOT NULL,
        comentario TEXT,
        respondida BOOLEAN DEFAULT FALSE,
        respuesta TEXT,
        fecha_observacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_fin_observacion TIMESTAMP NULL,
        id_etapa INT NOT NULL,
        id_usuario INT NOT NULL,
        FOREIGN KEY (id_etapa) REFERENCES etapas(id_etapa),
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      );
    `);

    // Opcional: Limpiar las tablas antes de insertar (orden para respetar FK)
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('TRUNCATE TABLE observaciones');
    await connection.query('TRUNCATE TABLE etapas');
    await connection.query('TRUNCATE TABLE proyectos');
    await connection.query('TRUNCATE TABLE usuarios');
    await connection.query('TRUNCATE TABLE ongs');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    // Insertar datos de ejemplo en ongs
    await connection.query(`
      INSERT INTO ongs (nombre) VALUES
      ('ONG Lider'),
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
      ('Proyecto Educacion Rural', 'Programa de alfabetizacion en zonas rurales', '2024-01-15', '2024-12-31', true, 1),
      ('Iniciativa Salud Comunitaria', 'Campania de prevencion y salud basica', '2024-03-01', '2024-11-30', true, 1),
      ('Campania Reforestacion', 'Restauracion de areas naturales protegidas', '2024-02-01', '2024-08-31', false, 2);
    `);

    // Insertar datos de ejemplo en etapas
    await connection.query(`
      INSERT INTO etapas (id_proyecto, nombre, descripcion, is_completed, id_ong_ejecutora) VALUES
      (1, 'Diagnostico Comunitario', 'Evaluacion de necesidades educativas', TRUE, 1),
      (1, 'Diseno Curricular', 'Desarrollo de material educativo', FALSE, 1),
      (2, 'Estudio Epidemiologico', 'Analisis de situacion de salud', TRUE, 2),
      (2, 'Capacitacion de Voluntarios', 'Formacion del equipo de trabajo', FALSE, 1),
      (3, 'Identificacion de Areas', 'Seleccion de zonas a reforestar', FALSE, 2);
    `);

    // Insertar datos de ejemplo en observaciones
    await connection.query(`
      INSERT INTO observaciones (titulo, comentario, respondida, respuesta, fecha_observacion, fecha_fin_observacion, id_etapa, id_usuario)
      VALUES
        ('Ajustar cronograma', 'Revisar fechas por superposicion con evento local', FALSE, NULL, NOW(), NULL, 2, 2),
        ('Requiere materiales', 'Solicitar insumos a logistica', TRUE, 'Gestionado con proveedor', NOW(), NOW(), 4, 1);
    `);

    connection.release();

    return NextResponse.json({ message: 'Base de datos configurada exitosamente.' });
  } catch (error) {
    console.error('Error detallado:', error);
    if (connection) connection.release();
    
    const errorMessage = error instanceof Error ? error.message : 'Un error desconocido ocurriA3';
    return NextResponse.json({ 
      error: 'Error al configurar la base de datos', 
      details: errorMessage 
    }, { status: 500 });
  }
}
