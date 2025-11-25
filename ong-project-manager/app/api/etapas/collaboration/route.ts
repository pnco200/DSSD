import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { authUser, getTokenJWT } from "@/lib/auth"
import {
  assignTask,
  completeTask,
  getBonitaAuth,
  getCaseVarJsonString,
  getUserPendingTasks,
  setCaseVarInteger,
  setCaseVarJsonString,
} from "@/lib/bonita-utils"

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
  en_ejecucion: number | boolean | null
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
        p.fecha_fin,
        p.en_ejecucion
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
      en_ejecucion: String(row.en_ejecucion).toLowerCase() === "true" || row.en_ejecucion === 1,
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

    const [rowsEtapa] = await pool.query(
      `SELECT id_proyecto FROM etapas WHERE id_etapa = ? AND id_ong_ejecutora = ? LIMIT 1`,
      [id_etapa, user.id_ong],
    )
    const etapaRow = Array.isArray(rowsEtapa) && rowsEtapa.length ? (rowsEtapa as any)[0] : null
    if (!etapaRow?.id_proyecto) {
      return NextResponse.json({ error: "Etapa no encontrada o no pertenece a tu ONG" }, { status: 404 })
    }
    const id_proyecto = Number(etapaRow.id_proyecto)

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

    const bonitaAuth = await getBonitaAuth()
    const tokenJWT = await getTokenJWT()
    const nameMatches = (task: any) => {
      const name = `${task.name ?? ""}`.toLowerCase()
      const displayName = `${task.displayName ?? ""}`.toLowerCase()
      return name.includes("ejecutar etapa adjudicada") || displayName.includes("ejecutar etapa adjudicada")
    }

    const pendingTasks = await getUserPendingTasks(bonitaAuth)
    console.log("[Collaboration][PATCH] Tareas pendientes READY 'Ejecutar etapa adjudicada':",
      pendingTasks.filter(nameMatches).filter((t: any) => `${t.state ?? ""}`.toLowerCase() === "ready")
        .map((t: any) => ({ id: t.id, name: t.name, state: t.state, caseId: t.rootCaseId ?? t.caseId ?? t.processInstanceId })))
    const ejecutaEtapaTasks = pendingTasks
      .filter(nameMatches)
      .filter((task: any) => `${task.state ?? ""}`.toLowerCase() === "ready")

    let targetTask: any = null
    let targetCaseId: string | null = null

    if (ejecutaEtapaTasks.length) {
      for (const task of ejecutaEtapaTasks) {
        const candidateCaseId = String(task.rootCaseId ?? task.caseId ?? task.processInstanceId ?? "")
        if (!candidateCaseId) continue
        try {
          const idProyectoCase = await getCaseVarJsonString({
            cookies: bonitaAuth.cookies,
            token: bonitaAuth.token,
            caseId: candidateCaseId,
            varName: "id_proyecto_local",
          })
          console.log("[Collaboration][PATCH] Check case", candidateCaseId, "id_proyecto_local =", idProyectoCase, "vs etapa id_proyecto", id_proyecto)
          if (Number(idProyectoCase) === id_proyecto) {
            targetTask = task
            targetCaseId = candidateCaseId
            break
          }
        } catch (err) {
          console.warn("[Collaboration][PATCH] No se pudo leer id_proyecto_local del case", candidateCaseId, err)
        }
      }
      if (!targetTask) {
        const task = ejecutaEtapaTasks[0]
        targetTask = task
        targetCaseId = String(task.rootCaseId ?? task.caseId ?? task.processInstanceId ?? "")
      }
    }

    if (!targetTask || !targetCaseId) {
      return NextResponse.json(
        { error: "No se encontro una tarea 'Ejecutar etapa adjudicada' en estado READY" },
        { status: 404 },
      )
    }

    const etapasNoCompletadasRaw = await getCaseVarJsonString({
      cookies: bonitaAuth.cookies,
      token: bonitaAuth.token,
      caseId: targetCaseId,
      varName: "etapasNoCompletadas",
    })
    console.log("[Collaboration][PATCH] Variable Bonita leida: etapasNoCompletadas =", etapasNoCompletadasRaw, "caseId:", targetCaseId)

    const etapasNoCompletadas = Number(etapasNoCompletadasRaw)
    if (Number.isNaN(etapasNoCompletadas)) {
      throw new Error("La variable 'etapasNoCompletadas' no es numerica en Bonita")
    }

    await setCaseVarJsonString({
      cookies: bonitaAuth.cookies,
      token: bonitaAuth.token,
      caseId: targetCaseId,
      varName: "etapaIdCompletada",
      value: String(id_etapa),
    })
    console.log("[Collaboration][PATCH] Variable Bonita seteada: etapaIdCompletada =", String(id_etapa), "caseId:", targetCaseId)
    if (tokenJWT) {
      await setCaseVarJsonString({
        cookies: bonitaAuth.cookies,
        token: bonitaAuth.token,
        caseId: targetCaseId,
        varName: "tokenJWT",
        value: tokenJWT,
      })
      console.log("[Collaboration][PATCH] Variable Bonita seteada: tokenJWT actualizado para usuario actual")
    }

    await setCaseVarInteger({
      cookies: bonitaAuth.cookies,
      token: bonitaAuth.token,
      caseId: targetCaseId,
      varName: "etapasNoCompletadas",
      value: Math.max(0, etapasNoCompletadas - 1),
    })
    console.log("[Collaboration][PATCH] Variable Bonita seteada: etapasNoCompletadas =", Math.max(0, etapasNoCompletadas - 1), "caseId:", targetCaseId)

    await assignTask({
      cookies: bonitaAuth.cookies,
      token: bonitaAuth.token,
      taskId: targetTask.id,
      userId: bonitaAuth.session.user_id,
    })
    await completeTask({ cookies: bonitaAuth.cookies, token: bonitaAuth.token, taskId: targetTask.id })

    console.log("[Collaboration][PATCH] Etapa completada en Bonita", {
      caseId: targetCaseId,
      taskId: targetTask.id,
      etapaId: id_etapa,
    })

    return NextResponse.json({ success: true, id_etapa, caseId: targetCaseId, taskId: targetTask.id })
  } catch (error: any) {
    console.error("[Collaboration][PATCH] Error:", error)
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 })
  }
}
