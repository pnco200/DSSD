import { NextResponse } from "next/server"

const BONITA_URL = "http://localhost:8080/bonita"
const BONITA_USER = "walter.bates"
const BONITA_PASS = "bpm"
const PROCESS_ID = "8531611139190718587" // tu processId real

// Helper para login en Bonita y obtener cookies + token
async function bonitaLogin() {
  const res = await fetch(`${BONITA_URL}/loginservice`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `username=${BONITA_USER}&password=${BONITA_PASS}`,
  })

  if (!res.ok) {
    throw new Error("Error al hacer login en Bonita")
  }

  const cookies = res.headers.get("set-cookie") || ""
  const tokenMatch = cookies.match(/X-Bonita-API-Token=([^;]+)/)
  const token = tokenMatch ? tokenMatch[1] : ""

  return { cookies, token }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log("[API] Proyecto recibido:", body)

    // 1. Login en Bonita
    const { cookies, token } = await bonitaLogin()


    // 2. Instanciar proceso con variables
    const bonitaRes = await fetch(
      `${BONITA_URL}/API/bpm/process/${PROCESS_ID}/instantiation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": cookies,
          "X-Bonita-API-Token": token,
        },
        body: JSON.stringify({
  proyectoInput1: {
    nombre: body.nombre ?? "Proyecto mejora de escuela",
    en_ejecucion: body.en_ejecucion ?? false,
    fecha_inicio: new Date(body.fecha_inicio ?? "2025-10-01T00:00:00Z").toISOString(),
    fecha_fin: new Date(body.fecha_fin ?? "2026-01-01T00:00:00Z").toISOString(),
    etapas: [
      {
        nombre: "Compra de materiales",
        descripcion: "Adquisición de ladrillos y cemento"
        // agrega aquí cualquier otro campo obligatorio del BDM Etapa
      }
    ]
  }
        }),
      }
    )

    if (!bonitaRes.ok) {
      const errTxt = await bonitaRes.text()
      throw new Error("Error al instanciar proceso en Bonita: " + errTxt)
    }

    const data = await bonitaRes.json()

    return NextResponse.json({
      success: true,
      message: "Proyecto creado e instanciado en Bonita",
      bonita: data,
    })
  } catch (error: any) {
    console.error("[API] Error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
