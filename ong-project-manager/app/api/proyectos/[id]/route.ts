import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authUser } from "@/lib/auth";

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { id } = await context.params; // 👈 FIX

    const conn = await pool.getConnection();

    const [result] = await conn.query(
      `UPDATE proyectos
       SET en_ejecucion = TRUE
       WHERE id_proyecto = ?`,
      [id]
    );

    conn.release();

    return NextResponse.json({ status: 201 });

  } catch (error) {
    console.error('[API_PROYECTOS_POST] Error:', error);
    return NextResponse.json({ error: 'Error al actualizar el proyecto' }, { status: 500 });
  }
}
