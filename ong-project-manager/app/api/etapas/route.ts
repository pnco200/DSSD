import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    console.log("[API] Etapas recibidas:", body)

    // Aquí iría la lógica para guardar las etapas en la base de datos
    // Por ahora, simulamos una respuesta exitosa

    const mockResponse = {
      success: true,
      message: "Etapas creadas exitosamente",
      data: body.map((etapa: any, index: number) => ({
        ...etapa,
        id: `etapa-${Date.now()}-${index}`,
      })),
    }

    return NextResponse.json(mockResponse)
  } catch (error) {
    console.error("[API] Error al crear etapas:", error)
    return NextResponse.json({ success: false, error: "Error al crear etapas" }, { status: 500 })
  }
}
