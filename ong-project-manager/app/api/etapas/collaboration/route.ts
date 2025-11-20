import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { authUser } from "@/lib/auth"

type EtapaRow = {
  id_etapa: number
  id_proyecto: number
  nombre: string
  descripcion: string
  is_completed: number | boolean | null
  nombre_proyecto: string
  descripcion_proyecto: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
}

export async function GET() {
  try {
    const user = await authUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    if (!user.id_ong) return NextResponse.json({ error: "El usuario no tiene ONG asociada" }, { status: 400 })

    const [rows] = await pool.query(
      `SELECT 
        e.id_etapa,
        e.id_proyecto,
        e.nombre,
        e.descripcion,
        e.is_completed,
        p.nombre AS nombre_proyecto,
        p.descripcion AS descripcion_proyecto,
        p.fecha_inicio,
        p.fecha_fin
      FROM etapas e
      INNER JOIN proyectos p ON p.id_proyecto = e.id_proyecto
      WHERE e.id_ong_ejecutora = ?`,
      [user.id_ong],
    )

    const etapas = (rows as EtapaRow[]).map((row) => ({
      id_etapa: row.id_etapa,
      id_proyecto: row.id_proyecto,
      nombre: row.nombre,
      descripcion: row.descripcion ?? "",
      is_completed: String(row.is_completed).toLowerCase() === "true" || row.is_completed === 1,
      nombre_proyecto: row.nombre_proyecto,
      descripcion_proyecto: row.descripcion_proyecto ?? "",
      fecha_inicio: row.fecha_inicio ?? "",
      fecha_fin: row.fecha_fin ?? "",
    }))

    return NextResponse.json({ etapas })
  } catch (error: any) {
    console.error("[Collaboration][GET] Error:", error)
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await authUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    if (!user.id_ong) return NextResponse.json({ error: "El usuario no tiene ONG asociada" }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const id_etapa = Number(body.id_etapa ?? body.stageId)
    if (!id_etapa || Number.isNaN(id_etapa)) {
      return NextResponse.json({ error: "id_etapa es requerido" }, { status: 400 })
    }

    const [result] = await pool.query(
      `UPDATE etapas 
       SET is_completed = TRUE 
       WHERE id_etapa = ? AND id_ong_ejecutora = ?`,
      [id_etapa, user.id_ong],
    )

    const { affectedRows } = result as any
    if (!affectedRows) {
      return NextResponse.json({ error: "Etapa no encontrada o no pertenece a tu ONG" }, { status: 404 })
    }

    // Placeholder para sincronizar con Bonita (pendiente de implementacion)
    console.log("[Collaboration][PATCH] Etapa marcada como completada. Pendiente de sync Bonita:", id_etapa)

    return NextResponse.json({ success: true, id_etapa })
  } catch (error: any) {
    console.error("[Collaboration][PATCH] Error:", error)
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 })
  }
}
