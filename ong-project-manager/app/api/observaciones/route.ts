import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { authUser } from "@/lib/auth"

type ObservacionRow = {
  id_observacion: number
  titulo: string
  comentario: string | null
  respondida: number | boolean | null
  respuesta: string | null
  fecha_observacion: string | null
  fecha_fin_observacion: string | null
  id_etapa: number
  nombre_etapa: string
  id_proyecto: number
  nombre_proyecto: string
}

export async function GET() {
  try {
    const user = await authUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    if (!user.id_ong) return NextResponse.json({ error: "El usuario no tiene ONG asociada" }, { status: 400 })
    if (!user.es_gerente) return NextResponse.json({ error: "Solo gerentes pueden ver observaciones" }, { status: 403 })

    const [rows] = await pool.query(
      `
      SELECT 
        o.id_observacion,
        o.titulo,
        o.comentario,
        o.respondida,
        o.respuesta,
        o.fecha_observacion,
        o.fecha_fin_observacion,
        e.id_etapa,
        e.nombre AS nombre_etapa,
        p.id_proyecto,
        p.nombre AS nombre_proyecto
      FROM observaciones o
      INNER JOIN etapas e ON e.id_etapa = o.id_etapa
      INNER JOIN proyectos p ON p.id_proyecto = e.id_proyecto
      WHERE o.respondida = FALSE
        AND e.id_ong_ejecutora = ?
      ORDER BY o.fecha_observacion DESC, o.id_observacion DESC
      `,
      [user.id_ong],
    )

    const observaciones = (rows as ObservacionRow[]).map((row) => ({
      id_observacion: row.id_observacion,
      titulo: row.titulo,
      comentario: row.comentario ?? "",
      respondida: String(row.respondida).toLowerCase() === "true" || row.respondida === 1,
      respuesta: row.respuesta ?? "",
      fecha_observacion: row.fecha_observacion ?? "",
      fecha_fin_observacion: row.fecha_fin_observacion ?? "",
      id_etapa: row.id_etapa,
      nombre_etapa: row.nombre_etapa,
      id_proyecto: row.id_proyecto,
      nombre_proyecto: row.nombre_proyecto,
    }))

    return NextResponse.json({ observaciones })
  } catch (error: any) {
    console.error("[Observaciones][GET] Error:", error)
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await authUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    if (!user.id_ong) return NextResponse.json({ error: "El usuario no tiene ONG asociada" }, { status: 400 })
    if (!user.es_gerente) return NextResponse.json({ error: "Solo gerentes pueden responder observaciones" }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const id_observacion = Number(body.id_observacion ?? body.observacionId)
    const respuesta = typeof body.respuesta === "string" ? body.respuesta.trim() : ""

    if (!id_observacion || Number.isNaN(id_observacion)) {
      return NextResponse.json({ error: "id_observacion es requerido" }, { status: 400 })
    }
    if (!respuesta) {
      return NextResponse.json({ error: "La respuesta no puede estar vacia" }, { status: 400 })
    }

    const [result] = await pool.query(
      `
      UPDATE observaciones o
      INNER JOIN etapas e ON e.id_etapa = o.id_etapa
      SET 
        o.respondida = TRUE,
        o.respuesta = ?,
        o.fecha_fin_observacion = NOW()
      WHERE o.id_observacion = ?
        AND o.respondida = FALSE
        AND e.id_ong_ejecutora = ?
      `,
      [respuesta, id_observacion, user.id_ong],
    )

    const { affectedRows } = result as any
    if (!affectedRows) {
      return NextResponse.json({ error: "Observacion no encontrada o ya respondida" }, { status: 404 })
    }

    // Placeholder para sincronizar con Bonita
    console.log("[Observaciones][PATCH] Respuesta registrada. Pendiente sync Bonita:", {
      id_observacion,
      respuesta,
    })

    return NextResponse.json({ success: true, id_observacion })
  } catch (error: any) {
    console.error("[Observaciones][PATCH] Error:", error)
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 })
  }
}
