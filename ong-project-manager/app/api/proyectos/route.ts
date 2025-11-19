

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { authUser } from "@/lib/auth";

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
   
    const usuario = await authUser();

    if (!usuario) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // obtengo el id_ong del usuario logueado
    const ong_responsable_id = usuario.id_ong;

    const body = await request.json();
    const { nombre, descripcion, fecha_inicio, fecha_fin } = body;

    if (!nombre) {
      return NextResponse.json({ error: "El campo 'nombre' es obligatorio" }, { status: 400 });
    }

    
    const query = `
      INSERT INTO proyectos
      (nombre, descripcion, fecha_inicio, fecha_fin, en_ejecucion, id_ong_lider)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query(query, [
      nombre,
      descripcion,
      fecha_inicio,
      fecha_fin,
      false,                 // en_ejecucion
      ong_responsable_id     // ong del usuario autenticado
    ]);

    const insertId = (result as any).insertId;

    const newProject = {
      id_proyecto: insertId,
      nombre,
      descripcion,
      fecha_inicio,
      fecha_fin,
      ong_responsable_id,
      en_ejecucion: false
    };
    console.log("[DEBUG] Body de newProject:", newProject);

    return NextResponse.json(newProject, { status: 201 });

  } catch (error) {
    console.error('[API_PROYECTOS_POST] Error:', error);
    return NextResponse.json({ error: 'Error al crear el proyecto' }, { status: 500 });
  }
}
