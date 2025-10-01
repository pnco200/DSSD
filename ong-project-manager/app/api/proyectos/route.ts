import { NextResponse } from "next/server"
import { bonitaLogin } from "../bonita/bonitaService"
import { getProcessId } from "../bonita/bonitaService"
import { instantiateProcess } from "../bonita/bonitaService"
import { setProcessVariable } from "../bonita/bonitaService"
import {  findTasksByCaseId } from "../bonita/bonitaService"
import { executeTask } from "../bonita/bonitaService"
import { assignTask } from "../bonita/bonitaService"
//import { getCurrentUserId } from "../bonita/bonitaService"

const BONITA_URL = "http://localhost:8080/bonita"
const BONITA_USER = "walter.bates"
const BONITA_PASS = "bpm"
const PROCESS_ID = "7482078796860500853" // tu processId real



export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log("[API] Proyecto recibido:", body)

    // 1. Login en Bonita
    const { cookies, token } = await bonitaLogin()

    // 2. Obtener el ID del proceso
    const processId = await getProcessId("Proceso Project Planning", cookies, token)

    // 3. Preparar datos del proyecto
    const proyectoData = {
      nombre: body.nombre,
      fechaInicio: body.fecha_inicio,
      fechaFin: body.fecha_fin,
      
    }

    // 4. INSTANCIAR PROCESO CON LAS VARIABLES INCLUIDAS
    const caseId = await instantiateProcess(
      processId, 
      cookies, 
      token, 
      
    )

    console.log(`📂 Nuevo Case ID creado: ${caseId}`)
     
     // 5. SET VARIABLE - Guardar como string JSON
    await setProcessVariable(
      caseId, 
      "proyectoNuevo", 
      body.nombre, // ← CONVERTIR A STRING
      cookies, 
      token
    )

    // 5. Buscar y ejecutar tarea inicial (si existe)
    try {
      const tasks = await findTasksByCaseId(caseId, cookies, token);
      const task = tasks[0]; // Primera tarea del caso
       const taskId = task.id;
      //const userId= await getCurrentUserId(cookies,token)
      await assignTask(taskId, '4', cookies, token);
      await executeTask(taskId, cookies, token)
      console.log("✅ Tarea inicial ejecutada")
    } catch (error) {
      console.log("ℹ️ No hay tarea inicial para ejecutar:", error)
    }

    return NextResponse.json({
      success: true,
      message: "Proceso iniciado y proyecto creado exitosamente",
      caseId: caseId,
      processId: processId,
      data: proyectoData
    })

  } catch (error: any) {
    console.error("[API] Error completo:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message
      },
      { status: 500 }
    )
  }
}


