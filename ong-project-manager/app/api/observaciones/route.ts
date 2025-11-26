import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { authUser, getTokenJWT } from "@/lib/auth"
import {
  assignTask,
  completeTask,
  getBonitaAuth,
  getUserPendingTasks,
  setCaseVarJsonString,
} from "@/lib/bonita-utils"

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

const BONITA_URL = process.env.BONITA_URL ?? "http://localhost:8080/bonita"
const MONITOREO_PROCESS_NAME = "Proceso de Monitoreo"
const TASK_EVALUACION = "Evaluacion de Proyecto en Ejecucion"
const TASK_RESOLUCION = "Resolucion de observaciones y aplicacion de mejoras"

async function getProcessIdByName({
  cookies,
  token,
  processName,
}: {
  cookies: string
  token: string
  processName: string
}) {
  const url =
    `${BONITA_URL}/API/bpm/process?` +
    `f=name=${encodeURIComponent(processName)}` +
    `&f=activationState=ENABLED` +
    `&o=version%20DESC&p=0&c=10`

  const res = await fetch(url, { headers: { Cookie: cookies, "X-Bonita-API-Token": token } })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`No pude buscar procesos por nombre '${processName}': ${err}`)
  }

  const procs = (await res.json()) as Array<{ id: string; name: string; version: string }>
  if (!procs.length) {
    throw new Error(`No encontre procesos ENABLED con name='${processName}'. Verificar configuracion en Bonita.`)
  }
  return procs[0].id
}

async function startCaseByProcessName({
  cookies,
  token,
  processName,
}: {
  cookies: string
  token: string
  processName: string
}) {
  const processId = await getProcessIdByName({ cookies, token, processName })
  const res = await fetch(`${BONITA_URL}/API/bpm/process/${processId}/instantiation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookies,
      "X-Bonita-API-Token": token,
    },
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Error al instanciar proceso '${processName}': ${err}`)
  }
  return res.json()
}

async function findTaskByNameInCase({
  cookies,
  token,
  caseId,
  taskName,
  requireReady = true,
}: {
  cookies: string
  token: string
  caseId: string
  taskName: string
  requireReady?: boolean
}) {
  const url = `${BONITA_URL}/API/bpm/humanTask?f=caseId=${caseId}&p=0&c=200`
  const res = await fetch(url, { headers: { Cookie: cookies, "X-Bonita-API-Token": token } })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`No pude listar tareas del caso ${caseId}: ${err}`)
  }
  const tasks: Array<{ id: string; name: string; displayName?: string; state: string }> = await res.json()
  const normalized = taskName.trim().toLowerCase()
  const poolTasks = requireReady ? tasks.filter((t) => t.state?.toLowerCase() === "ready") : tasks
  const found = poolTasks.find(
    (t) => t.name?.toLowerCase() === normalized || t.displayName?.toLowerCase() === normalized,
  )
  if (!found) {
    throw new Error(`No encontre la tarea '${taskName}' en estado READY para el case ${caseId}`)
  }
  return found
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
        WHERE e.id_ong_ejecutora IS NOT NULL
          AND e.id_ong_ejecutora <> ?
          AND p.en_ejecucion = TRUE
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

    // --- Integracion Bonita: Proceso de Monitoreo (crear observacion) ---
    const bonitaAuth = await getBonitaAuth()
    const tokenJWT = await getTokenJWT()
    const inst = await startCaseByProcessName({
      cookies: bonitaAuth.cookies,
      token: bonitaAuth.token,
      processName: MONITOREO_PROCESS_NAME,
    })
    const caseId = inst.caseId ?? inst.id ?? inst.value ?? inst.case_id
    if (!caseId) throw new Error("No se obtuvo caseId al instanciar Proceso de Monitoreo")

    const varsToSet: Array<[string, string | null]> = [
      ["tokenJWT", tokenJWT ? String(tokenJWT) : null],
      ["idEtapaObservacion", String(id_etapa)],
      ["tituloObservacion", titulo],
      ["comentarioObservacion", comentario],
      ["idLocalObservacion", insertId ? String(insertId) : null],
    ]
    for (const [varName, value] of varsToSet) {
      await setCaseVarJsonString({
        cookies: bonitaAuth.cookies,
        token: bonitaAuth.token,
        caseId,
        varName,
        value: value ?? "",
      })
    }

    const evalTask = await findTaskByNameInCase({
      cookies: bonitaAuth.cookies,
      token: bonitaAuth.token,
      caseId: String(caseId),
      taskName: TASK_EVALUACION,
    })
    await assignTask({
      cookies: bonitaAuth.cookies,
      token: bonitaAuth.token,
      taskId: evalTask.id,
      userId: bonitaAuth.session.user_id,
    })
    await completeTask({ cookies: bonitaAuth.cookies, token: bonitaAuth.token, taskId: evalTask.id })

    console.log("[Observaciones][POST] Proceso de Monitoreo iniciado", {
      caseId,
      taskId: evalTask.id,
      id_etapa,
    })

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

    // Obtener etapa y validar pertenencia antes de responder (necesario para Bonita)
    const [obsRows] = await pool.query(
      `
      SELECT 
        o.id_etapa,
        e.id_ong_ejecutora
      FROM observaciones o
      INNER JOIN etapas e ON e.id_etapa = o.id_etapa
      WHERE o.id_observacion = ?
        AND o.respondida = FALSE
      `,
      [id_observacion],
    )
    if (!(obsRows as any[]).length) {
      return NextResponse.json({ error: "Observacion no encontrada o ya respondida" }, { status: 404 })
    }
    const obsInfo = (obsRows as any)[0] as { id_etapa: number; id_ong_ejecutora: number | null }
    if (!obsInfo.id_ong_ejecutora || obsInfo.id_ong_ejecutora !== user.id_ong) {
      return NextResponse.json({ error: "Observacion no pertenece a tu ONG" }, { status: 403 })
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

    // --- Integracion Bonita: Proceso de Monitoreo (respuesta observacion) ---
    const bonitaAuth = await getBonitaAuth()
    const tokenJWT = await getTokenJWT()

    const pendingTasks = await getUserPendingTasks(bonitaAuth)
    const resolucionTasks = pendingTasks
      .filter((t: any) => {
        const name = `${t.name ?? ""}`.toLowerCase()
        const displayName = `${t.displayName ?? ""}`.toLowerCase()
        return (
          name.includes(TASK_RESOLUCION.toLowerCase()) ||
          displayName.includes(TASK_RESOLUCION.toLowerCase())
        )
      })
      .filter((t: any) => `${t.state ?? ""}`.toLowerCase() === "ready")

    if (!resolucionTasks.length) {
      return NextResponse.json(
        { error: "No se encontro tarea 'Resolucion de observaciones y aplicacion de mejoras' en READY" },
        { status: 404 },
      )
    }

    const targetTask = resolucionTasks[0]
    const caseId = String(targetTask.rootCaseId ?? targetTask.caseId ?? targetTask.processInstanceId ?? "")
    if (!caseId) {
      return NextResponse.json({ error: "No se pudo determinar el caseId de la tarea de resolucion" }, { status: 500 })
    }

    const varsToSet: Array<[string, string | null]> = [
      ["tokenJWT", tokenJWT ? String(tokenJWT) : null],
      ["idEtapaObservacion", String(obsInfo.id_etapa)],
      ["respuestaObservacion", respuesta],
    ]
    for (const [varName, value] of varsToSet) {
      await setCaseVarJsonString({
        cookies: bonitaAuth.cookies,
        token: bonitaAuth.token,
        caseId,
        varName,
        value: value ?? "",
      })
    }

    await assignTask({
      cookies: bonitaAuth.cookies,
      token: bonitaAuth.token,
      taskId: targetTask.id,
      userId: bonitaAuth.session.user_id,
    })
    await completeTask({ cookies: bonitaAuth.cookies, token: bonitaAuth.token, taskId: targetTask.id })

    console.log("[Observaciones][PATCH] Respuesta registrada y sincronizada con Bonita", {
      id_observacion,
      caseId,
      taskId: targetTask.id,
    })

    return NextResponse.json({ success: true, id_observacion })
  } catch (error: any) {
    console.error("[Observaciones][PATCH] Error:", error)
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 })
  }
}
