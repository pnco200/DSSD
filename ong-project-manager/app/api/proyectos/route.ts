import { NextResponse } from "next/server"

const BONITA_URL = "http://localhost:8080/bonita"
const BONITA_USER = "walter.bates"
const BONITA_PASS = "bpm"
const PROCESS_ID = "7482078796860500853" // tu processId real

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
          variables: [
            {
              name: "proyectoNuevo",
              value: {
  "nombre": "Proyecto mejora de escuela",
  "fecha_inicio": "2025-10-01T00:00:00Z",
  "fecha_fin": "2026-01-01T00:00:00Z",
  "ong_responsable_id": 1,
  "etapas": [
    {
      "nombre": "Compra de materiales",
      "descripcion": "Adquisición de ladrillos y cemento",
      //"is_completed": false,
      //"ong_responsable": { "id": 2, "nombre": "ONG Colaboradora A" }
    }
  ]
}
            },
          ],
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
