import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { authUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await authUser();
    if (!user || !user.es_gerente) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const conn = await pool.getConnection();

    // Consulta: Selecciona proyectos de la ONG lider y cuenta sus etapas totales vs completadas
    const [rows] = await conn.query(
      `SELECT 
        p.id_proyecto, 
        p.nombre, 
        p.descripcion,
        COUNT(e.id_etapa) as total_etapas,
        SUM(CASE WHEN e.is_completed = 1 THEN 1 ELSE 0 END) as etapas_completadas
      FROM proyectos p
      LEFT JOIN etapas e ON p.id_proyecto = e.id_proyecto
      WHERE p.id_ong_lider = ?
      GROUP BY p.id_proyecto`,
      [user.id_ong]
    );
conn.release()
    return NextResponse.json({ projects: rows });
  } catch (error: any) {
    console.error("Error fetching report projects:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}