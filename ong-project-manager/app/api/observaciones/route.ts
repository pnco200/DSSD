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

type EtapaTargetRow = {
  id_etapa: number
  nombre_etapa: string
  descripcion_etapa: string | null
  is_completed: number | boolean | null
  id_ong_ejecutora: number | null
  nombre_ong_ejecutora: string | null
  id_proyecto: number
  nombre_proyecto: string
  descripcion_proyecto: string | null
}

function toBool(value: any): boolean {
  return String(value).toLowerCase() === "true" || value === 1
}

export async function GET(request: Request) {
  try {
    const user = await authUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    if (!user.id_ong) return NextResponse.json({ error: "El usuario no tiene ONG asociada" }, { status: 400 })
    if (!user.es_gerente) return NextResponse.json({ error: "Solo gerentes pueden ver observaciones" }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const scope = (searchParams.get("scope") ?? "received").toLowerCase()

    if (scope === "targets") {
      const [rows] = await pool.query(
        `
        SELECT 
          e.id_etapa,
          e.nombre AS nombre_etapa,
          e.descripcion AS descripcion_etapa,
          e.is_completed,
          e.id_ong_ejecutora,
          ong.nombre AS nombre_ong_ejecutora,
          p.id_proyecto,
          p.nombre AS nombre_proyecto,
          p.descripcion AS descripcion_proyecto
        FROM etapas e
        INNER JOIN proyectos p ON p.id_proyecto = e.id_proyecto
        LEFT JOIN ongs ong ON ong.id_ong = e.id_ong_ejecutora
        WHERE e.id_ong_ejecutora IS NULL OR e.id_ong_ejecutora <> ?
        ORDER BY p.nombre, e.nombre
        `,
        [user.id_ong],
      )

      const etapas = (rows as EtapaTargetRow[]).map((row) => ({
        id_etapa: row.id_etapa,
        nombre_etapa: row.nombre_etapa,
        descripcion_etapa: row.descripcion_etapa ?? "",
        is_completed: toBool(row.is_completed),
        id_ong_ejecutora: row.id_ong_ejecutora,
        nombre_ong_ejecutora: row.nombre_ong_ejecutora ?? "Sin asignar",
        id_proyecto: row.id_proyecto,
        nombre_proyecto: row.nombre_proyecto,
        descripcion_proyecto: row.descripcion_proyecto ?? "",
      }))

      return NextResponse.json({ etapas })
    }

    if (scope === "sent") {
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
        WHERE o.id_usuario = ?
        ORDER BY o.fecha_observacion DESC, o.id_observacion DESC
        `,
        [user.id_usuario],
      )

      const observaciones = (rows as ObservacionRow[]).map((row) => ({
        id_observacion: row.id_observacion,
        titulo: row.titulo,
        comentario: row.comentario ?? "",
        respondida: toBool(row.respondida),
        respuesta: row.respuesta ?? "",
        fecha_observacion: row.fecha_observacion ?? "",
        fecha_fin_observacion: row.fecha_fin_observacion ?? "",
        id_etapa: row.id_etapa,
        nombre_etapa: row.nombre_etapa,
        id_proyecto: row.id_proyecto,
        nombre_proyecto: row.nombre_proyecto,
      }))

      return NextResponse.json({ observaciones })
    }

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
      respondida: toBool(row.respondida),
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

export async function POST(request: Request) {
  try {
    const user = await authUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    if (!user.id_ong) return NextResponse.json({ error: "El usuario no tiene ONG asociada" }, { status: 400 })
    if (!user.es_gerente) return NextResponse.json({ error: "Solo gerentes pueden crear observaciones" }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const id_etapa = Number(body.id_etapa ?? body.etapaId)
    const titulo = typeof body.titulo === "string" ? body.titulo.trim() : ""
    const comentario = typeof body.comentario === "string" ? body.comentario.trim() : ""

    if (!id_etapa || Number.isNaN(id_etapa)) {
      return NextResponse.json({ error: "id_etapa es requerido" }, { status: 400 })
    }
    if (!titulo) {
      return NextResponse.json({ error: "El titulo es requerido" }, { status: 400 })
    }

    const [etapaRows] = await pool.query(
      `
      SELECT 
        e.id_etapa,
        e.id_ong_ejecutora,
        e.nombre AS nombre_etapa,
        p.id_proyecto,
        p.nombre AS nombre_proyecto
      FROM etapas e
      INNER JOIN proyectos p ON p.id_proyecto = e.id_proyecto
      WHERE e.id_etapa = ?
      `,
      [id_etapa],
    )

    if (!(etapaRows as any[]).length) {
      return NextResponse.json({ error: "La etapa no existe" }, { status: 404 })
    }

    const etapa = (etapaRows as any)[0] as {
      id_ong_ejecutora: number | null
      nombre_etapa: string
      nombre_proyecto: string
      id_proyecto: number
    }

    if (etapa.id_ong_ejecutora && etapa.id_ong_ejecutora === user.id_ong) {
      return NextResponse.json(
        { error: "No puedes generar observaciones sobre etapas ejecutadas por tu ONG" },
        { status: 403 },
      )
    }

    const [result] = await pool.query(
      `
      INSERT INTO observaciones (titulo, comentario, respondida, respuesta, fecha_observacion, fecha_fin_observacion, id_etapa, id_usuario)
      VALUES (?, ?, FALSE, NULL, NOW(), NULL, ?, ?)
      `,
      [titulo, comentario || null, id_etapa, user.id_usuario],
    )

    const insertId = (result as any)?.insertId
    return NextResponse.json({
      success: true,
      id_observacion: insertId,
      etapa: {
        id_etapa,
        nombre_etapa: etapa.nombre_etapa,
        id_proyecto: etapa.id_proyecto,
        nombre_proyecto: etapa.nombre_proyecto,
      },
    })
  } catch (error: any) {
    console.error("[Observaciones][POST] Error:", error)
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
