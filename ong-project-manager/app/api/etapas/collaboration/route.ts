import { NextResponse } from "next/server"

const BONITA_URL = process.env.BONITA_URL ?? "http://localhost:8080/bonita"
const BONITA_USER = process.env.BONITA_USER ?? "walter.bates"
const BONITA_PASS = process.env.BONITA_PASS ?? "bpm"
const PROCESS_NAME = process.env.BONITA_PROCESS_NAME ?? "MiProceso"
const PROJECT_VARIABLE = process.env.BONITA_PROJECT_VARIABLE ?? "proyectoNuevo"

type BonitaSession = { user_id: string; user_name: string; tenant_id: string }

async function bonitaLogin() {
  const res = await fetch(`${BONITA_URL}/loginservice`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `username=${encodeURIComponent(BONITA_USER)}&password=${encodeURIComponent(BONITA_PASS)}`,
  })
  if (!res.ok) throw new Error("Error al autenticar con Bonita")

  const cookies = res.headers.get("set-cookie") ?? ""
  const token = cookies.match(/X-Bonita-API-Token=([^;]+)/)?.[1] ?? ""
  if (!token) throw new Error("No se obtuvo X-Bonita-API-Token")

  const sessionRes = await fetch(`${BONITA_URL}/API/system/session/1`, {
    headers: { Cookie: cookies, "X-Bonita-API-Token": token },
  })
  if (!sessionRes.ok) throw new Error("No se pudo obtener la sesión de Bonita")
  const session = (await sessionRes.json()) as BonitaSession
  return { cookies, token, session }
}

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
    throw new Error(`Error buscando procesos por nombre '${processName}': ${err}`)
  }

  const procs = (await res.json()) as Array<{ id: string }>
  if (!procs.length) throw new Error(`No se encontraron procesos ENABLED con name='${processName}'`)
  return procs[0].id
}

async function listCases({ cookies, token, processId }: { cookies: string; token: string; processId: string }) {
  const casesRes = await fetch(
    `${BONITA_URL}/API/bpm/case?f=processDefinitionId=${processId}&o=startDate%20DESC&p=0&c=200`,
    { headers: { Cookie: cookies, "X-Bonita-API-Token": token } },
  )
  if (!casesRes.ok) {
    const err = await casesRes.text()
    throw new Error(`No se pudieron listar las instancias del proceso: ${err}`)
  }
  return (await casesRes.json()) as Array<{ id: string }>
}

async function getProjectPayload({
  cookies,
  token,
  caseId,
}: {
  cookies: string
  token: string
  caseId: string
}) {
  const url = `${BONITA_URL}/API/bpm/caseVariable/${caseId}/${encodeURIComponent(PROJECT_VARIABLE)}`
  const res = await fetch(url, { headers: { Cookie: cookies, "X-Bonita-API-Token": token } })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`No se pudo leer la variable '${PROJECT_VARIABLE}' del case ${caseId}: ${err}`)
  }

  const payload = await res.json()
  const rawValue = payload?.value
  if (!rawValue) return null

  try {
    return typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue
  } catch {
    return null
  }
}

type StageResult = {
  caseId: string
  projectId: number | null
  projectName: string
  projectDescription: string
  projectStart: string
  projectEnd: string
  stageId: number | null
  stageName: string
  stageDescription: string
  isCompleted: boolean
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ongIdParam = searchParams.get("ongId")
  if (!ongIdParam) {
    return NextResponse.json({ error: "ongId es requerido" }, { status: 400 })
  }

  const ongId = Number(ongIdParam)
  if (Number.isNaN(ongId)) {
    return NextResponse.json({ error: "ongId debe ser numérico" }, { status: 400 })
  }

  try {
    const { cookies, token } = await bonitaLogin()
    const processId = await getProcessIdByName({ cookies, token, processName: PROCESS_NAME })
    const cases = await listCases({ cookies, token, processId })

    const stages: StageResult[] = []

    for (const caseItem of cases) {
      try {
        const project = await getProjectPayload({ cookies, token, caseId: caseItem.id })
        if (!project?.etapas?.length) continue

        for (const etapa of project.etapas) {
          if (Number(etapa?.ong_responsable_id) === ongId) {
            stages.push({
              caseId: caseItem.id,
              projectId: Number(project.id_proyecto) || null,
              projectName: project.nombre ?? "Proyecto sin nombre",
              projectDescription: project.descripcion ?? "",
              projectStart: project.fecha_inicio ?? "",
              projectEnd: project.fecha_fin ?? "",
              stageId: Number(etapa.id_etapa ?? etapa.id) || null,
              stageName: etapa.nombre ?? "Etapa sin nombre",
              stageDescription: etapa.descripcion ?? "",
              isCompleted: String(etapa.is_completed).toLowerCase() === "true",
            })
          }
        }
      } catch (err) {
        console.error(`[Bonita][Collaboration] Error procesando case ${caseItem.id}:`, err)
      }
    }

    return NextResponse.json({ stages })
  } catch (error: any) {
    console.error("[Bonita][Collaboration] Error:", error)
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 })
  }
}
