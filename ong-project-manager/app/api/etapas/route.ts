import { NextResponse } from "next/server";
import pool from '@/lib/db';
import { authUser, getTokenJWT } from "@/lib/auth";
import { getBonitaAuth, setCaseVarInteger, setCaseVarJsonString } from "@/lib/bonita-utils";

const BONITA_URL = process.env.BONITA_URL ?? "http://localhost:8080/bonita"
// 🔁 Now we resolve the process by NAME, not fixed ID
const PROCESS_NAME = process.env.BONITA_PROCESS_NAME ?? "MiProceso"
const TASK_NAME = process.env.BONITA_TASK_NAME ?? "tarea1"



/**
 * Devuelve el processId (deployment id) de la última versión ENABLED
 * del proceso cuyo `name` coincide exactamente con PROCESS_NAME.
 */
async function getProcessIdByName({
  cookies, token, processName,
}: { cookies: string; token: string; processName: string }) {
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

  type Proc = { id: string; name: string; version: string; activationState?: string }
  const procs = (await res.json()) as Proc[]
  if (!procs.length) {
    throw new Error(`No encontré procesos ENABLED con name='${processName}'. Verificá el nombre y la activación.`)
  }

  // Tomo el primero (mayor versión por el orden aplicado)
  const chosen = procs[0]
  return chosen.id
}

async function startCaseByProcessName({
  cookies, token, processName,
}: { cookies: string; token: string; processName: string }) {
  const processId = await getProcessIdByName({ cookies, token, processName })

  const res = await fetch(`${BONITA_URL}/API/bpm/process/${processId}/instantiation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookies,
      "X-Bonita-API-Token": token,
    },
    body: JSON.stringify({}), // sin variables ni contracts
  })
  if (!res.ok) throw new Error("Error al instanciar proceso")
  return res.json()
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function findTaskByNameLoose({
  cookies, token, caseId, name, requireReady = true, retries = 8, delayMs = 250
}: {
  cookies: string; token: string; caseId: string; name: string; requireReady?: boolean; retries?: number; delayMs?: number
}) {
  const target = name.trim().toLowerCase()
  for (let i = 0; i <= retries; i++) {
    const urlAll = `${BONITA_URL}/API/bpm/humanTask?f=caseId=${caseId}&p=0&c=200`
    const resAll = await fetch(urlAll, { headers: { Cookie: cookies, "X-Bonita-API-Token": token } })
    if (!resAll.ok) throw new Error("No pude listar human tasks del case")
    const tasks: Array<{ id: string; name: string; displayName?: string; state: string }> = await resAll.json()
    console.log("[Bonita] Tasks del case:", tasks.map(t => ({
      id: t.id, name: t.name, displayName: t.displayName, state: t.state
    })))
    const pool = requireReady ? tasks.filter(t => t.state === "ready") : tasks
    const tMatch = pool.find(t =>
      (t.name?.toLowerCase() === target) || (t.displayName?.toLowerCase() === target)
    )
    if (tMatch) return tMatch
    if (i < retries) await sleep(delayMs)
  }
  throw new Error(`No encontré la task '${name}'${requireReady ? " en estado 'ready'" : ""} para el case ${caseId}`)
}



async function assignTask({ cookies, token, taskId, userId }: { cookies: string; token: string; taskId: string; userId: string }) {
  const res = await fetch(`${BONITA_URL}/API/bpm/userTask/${taskId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookies,
      "X-Bonita-API-Token": token,
    },
    body: JSON.stringify({ assigned_id: userId }),
  })
  if (!res.ok) throw new Error("No pude asignar la task al usuario")
}

async function completeTask({ cookies, token, taskId }: { cookies: string; token: string; taskId: string }) {
  const res = await fetch(`${BONITA_URL}/API/bpm/userTask/${taskId}/execution`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookies,
      "X-Bonita-API-Token": token,
    },
    body: JSON.stringify({}), // sin contracts ni operations
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`No pude completar la task: ${err}`)
  }
}

// ---------- Tipos/normalización (idénticos a tu versión anterior) ----------
type EtapaIn = {
  id_etapa: number
  ong_responsable_id: number | null
  nombre: string
  descripcion: string
  is_completed: boolean | "true" | "false"
}
type ProyectoIn = {
  id_proyecto: number
  nombre: string,
  descripcion: string,
  fecha_inicio: string
  fecha_fin: string
  ong_responsable_id: number
  etapas: EtapaIn[]
}
function toBool(v: boolean | "true" | "false"): boolean {
  if (typeof v === "boolean") return v
  return String(v).toLowerCase() === "true"
}
function normalizeProyecto(input: any): ProyectoIn {
  if (!input || typeof input !== "object") throw new Error("Payload inválido: se esperaba un objeto")
  const { id_proyecto, nombre, fecha_inicio, fecha_fin, ong_responsable_id, etapas, descripcion } = input
  if (!id_proyecto) throw new Error("Falta 'id_proyecto' - el proyecto debe estar creado primero")
  if (!nombre) throw new Error("Falta 'nombre'")
  if (!descripcion) throw new Error("Falta 'descripcion'")
  if (!fecha_inicio) throw new Error("Falta 'fecha_inicio'")
  if (!fecha_fin) throw new Error("Falta 'fecha_fin'")
  if (typeof ong_responsable_id !== "number") throw new Error("'ong_responsable_id' debe ser número")
  if (!Array.isArray(etapas)) throw new Error("'etapas' debe ser un array")

  const etapasOut: EtapaIn[] = etapas.map((e: any, idx: number) => {
    if (typeof e !== "object") throw new Error(`'etapas[${idx}]' inválida`)
    if (e.ong_responsable_id !== null && typeof e.ong_responsable_id !== "number") {
      throw new Error(`'etapas[${idx}].ong_responsable_id' debe ser número o null`)
    }
    if (!e.nombre) throw new Error(`Falta 'etapas[${idx}].nombre'`)
    if (!e.descripcion) throw new Error(`Falta 'etapas[${idx}].descripcion'`)
    if (e.is_completed === undefined) throw new Error(`Falta 'etapas[${idx}].is_completed'`)
    return {
      id_etapa: e.id || null,
      ong_responsable_id: e.ong_responsable_id ?? null,
      nombre: e.nombre,
      descripcion: e.descripcion,
      is_completed: toBool(e.is_completed),
    }
  })

  return { id_proyecto, nombre, descripcion, fecha_inicio, fecha_fin, ong_responsable_id, etapas: etapasOut }
}

// ---------- Handler ----------
export async function POST(request: Request) {
  let connection;
  try {
    const body = await request.json()
    const usuario = await authUser();
    if (!usuario) throw new Error("No autenticado");
    // Sobrescribir el ong_responsable_id con el del usuario logueado
    body.ong_responsable_id = usuario.id_ong;
    const proyecto = normalizeProyecto(body)

    // 1. GUARDAR SOLO LAS ETAPAS en MySQL (el proyecto ya existe)
    connection = await pool.getConnection();
    // Guardar las etapas
    const etapasGuardadas = [];
    for (const etapa of proyecto.etapas) {
      const [etapaResult] = await connection.query(
        `INSERT INTO etapas (id_proyecto, nombre, descripcion, is_completed, id_ong_ejecutora) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          proyecto.id_proyecto,
          etapa.nombre,
          etapa.descripcion,
          etapa.is_completed,
          etapa.ong_responsable_id
        ]
      );

      const etapaId = (etapaResult as any).insertId;
      etapasGuardadas.push({
        id_etapa: etapaId,
        nombre: etapa.nombre,
        id_ong_ejecutora: etapa.ong_responsable_id
      });
      etapa.id_etapa = etapaId; // Actualizar el id_etapa en el objeto etapa
    }

    connection.release();


    const bonitaAuth = await getBonitaAuth();



    if (!bonitaAuth.token) {
      throw new Error("Bonita API token no disponible. El usuario debe iniciar sesión.");
    }

    if (!bonitaAuth.session.user_id) {
      throw new Error("No se encontró el user_id de Bonita. El usuario debe iniciar sesión.");
    }

    const tokenJWT = await getTokenJWT()
    // 🔁 Instanciar el case resolviendo el proceso por NOMBRE
    const inst = await startCaseByProcessName({ cookies: bonitaAuth.cookies, token: bonitaAuth.token, processName: PROCESS_NAME })
    const caseId = inst.caseId ?? inst.id ?? inst?.value ?? inst?.case_id
    if (!caseId) throw new Error("No obtuve caseId al instanciar")
    await setCaseVarJsonString({
      cookies: bonitaAuth.cookies,
      token: bonitaAuth.token,
      caseId: caseId,
      varName: "tokenJWT",
      value: tokenJWT,
    })
    await setCaseVarJsonString({ cookies: bonitaAuth.cookies, token: bonitaAuth.token, caseId, varName: "proyectoNuevo", value: proyecto })
    await setCaseVarInteger({ cookies: bonitaAuth.cookies, token: bonitaAuth.token, caseId, varName: "etapasNoAdjudicadas", value: proyecto.etapas.length })
    await setCaseVarInteger({ cookies: bonitaAuth.cookies, token: bonitaAuth.token, caseId, varName: "etapasNoCompletadas", value: proyecto.etapas.length })
    await setCaseVarInteger({ cookies: bonitaAuth.cookies, token: bonitaAuth.token, caseId, varName: "id_proyecto_local", value: proyecto.id_proyecto })
    const task = await findTaskByNameLoose({
      cookies: bonitaAuth.cookies, token: bonitaAuth.token, caseId: String(caseId), name: TASK_NAME, requireReady: true, retries: 8, delayMs: 250
    })

    await assignTask({ cookies: bonitaAuth.cookies, token: bonitaAuth.token, taskId: task.id, userId: bonitaAuth.session.user_id })
    await completeTask({ cookies: bonitaAuth.cookies, token: bonitaAuth.token, taskId: task.id })

    return NextResponse.json({
      success: true,
      message: `Case ${caseId} creado desde proceso '${PROCESS_NAME}' (última versión ENABLED), 'proyectoNuevo' seteado y task '${TASK_NAME}' completada.`,
      data: { caseId, taskId: task.id, assignedTo: bonitaAuth.session.user_id },
    })
  } catch (err: any) {
    console.error("[Bonita][API] Error:", err)
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 })
  }
}
