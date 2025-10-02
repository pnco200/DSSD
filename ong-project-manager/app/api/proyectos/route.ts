

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// GET: Obtener todos los proyectos
export async function GET() {
  try {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM proyectos');
    return NextResponse.json(rows);
  } catch (error) {
    console.error('[API_PROYECTOS_GET] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: 'Error al obtener los proyectos', details: errorMessage }, { status: 500 });
  }
}

// POST: Crear un nuevo proyecto
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nombre, descripcion, fecha_inicio, fecha_fin } = body;

    if (!nombre) {
      return NextResponse.json({ error: "El campo 'nombre' es obligatorio" }, { status: 400 });
    }

    const query = "\n      INSERT INTO proyectos (nombre, descripcion, fecha_inicio, fecha_fin, en_ejecucion)\n      VALUES (?, ?, ?, ?, ?)\n    ";
    
    const [result] = await pool.query(query, [nombre, descripcion, fecha_inicio, fecha_fin, false]);
    
    // mysql2/promise returns an OkPacket which has an insertId property
    const insertId = (result as any).insertId;
    const ong_responsable_id=null

    const newProject = {
      id_proyecto: insertId,
      nombre,
      descripcion,
      fecha_inicio,
      fecha_fin,
      ong_responsable_id,
      en_ejecucion: false};
    

    return NextResponse.json(newProject, { status: 201 });

  } catch (error) {
    console.error('[API_PROYECTOS_POST] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: 'Error al crear el proyecto', details: errorMessage }, { status: 500 });
  }
}
