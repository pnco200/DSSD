import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    console.log("[API] Proyecto recibido:", body)

    // Aquí iría la lógica para guardar en la base de datos
    // Por ahora, simulamos una respuesta exitosa

    const mockResponse = {
      success: true,
      id: `proyecto-${Date.now()}`,
      message: "Proyecto creado exitosamente",
      data: body,
    }

    return NextResponse.json(mockResponse)
  } catch (error) {
    console.error("[API] Error al crear proyecto:", error)
    return NextResponse.json({ success: false, error: "Error al crear proyecto" }, { status: 500 })
  }
}
