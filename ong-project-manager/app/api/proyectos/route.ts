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

// Obtener el ID del proceso por nombre
async function getProcessId(processName: string, cookies: string, token: string) {
  try {
    console.log(`🔍 Buscando proceso: ${processName}`)
    
    const response = await fetch(
      `${BONITA_URL}/API/bpm/process?p=0&c=100&f=name=${processName}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Cookie": cookies,
          "X-Bonita-API-Token": token,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Error obteniendo procesos: ${response.status}`)
    }

    const processes = await response.json()
    console.log('📋 Procesos encontrados:', processes)

    if (processes.length === 0) {
      throw new Error(`No se encontró el proceso: ${processName}`)
    }

    const processId = processes[0].id
    console.log(`✅ Process ID encontrado: ${processId}`)
    
    return processId
  } catch (error) {
    console.error('❌ Error obteniendo processId:', error)
    throw error
  }
}


// Set Variable by ID 
async function setProcessVariable(caseId: string, variableName: string, value: any, cookies: string, token: string) {
  console.log(`🔄 Set Variable: ${variableName} =`, value)
  
  const requestBody = {
    "type": "java.lang.String",  // ← Tipo requerido
    "value": value.toString()    // ← Valor como string
  }

  console.log('📤 Request Body:', JSON.stringify(requestBody))

  const response = await fetch(
    `${BONITA_URL}/API/bpm/caseVariable/${caseId}/${variableName}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookies,
        "X-Bonita-API-Token": token,
      },
      body: JSON.stringify(requestBody) 
    }
  )

  if (!response.ok) {
    const errTxt = await response.text()
    throw new Error(`Error setting variable: ${response.status} - ${errTxt}`)
  }

  console.log(`✅ Variable ${variableName} actualizada`)
   return { success: true }
}
// Función auxiliar para ejecutar tarea
async function executeTask(taskId: string, cookies: string, token: string) {
  const response = await fetch(
    `${BONITA_URL}/API/bpm/humanTask/${taskId}/execution`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookies,
        "X-Bonita-API-Token": token,
      },
      body: JSON.stringify({}), // Vacío porque no hay contrato
    }
  )

  if (!response.ok) {
    throw new Error(`Error ejecutando tarea: ${response.status}`)
  }
}

// Obtener tarea pendiente por nombre
async function getPendingTask(taskName: string, cookies: string, token: string) {
  try {
    console.log(`🔍 Buscando tarea: "${taskName}"`)
    
    const response = await fetch(
      `${BONITA_URL}/API/bpm/humanTask?p=0&c=10&f=name=${taskName}&f=state=ready`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Cookie": cookies,
          "X-Bonita-API-Token": token,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Error obteniendo tareas: ${response.status}`)
    }

    const tasks = await response.json()
    console.log(`📋 Tareas encontradas para "${taskName}":`, tasks)

    if (tasks.length === 0) {
      // También buscar por displayName
      const responseDisplay = await fetch(
        `${BONITA_URL}/API/bpm/humanTask?p=0&c=10&f=displayName=${taskName}&f=state=ready`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Cookie": cookies,
            "X-Bonita-API-Token": token,
          },
        }
      )
      
      const tasksDisplay = await responseDisplay.json()
      console.log(`🔍 Tareas por displayName "${taskName}":`, tasksDisplay)
      
      if (tasksDisplay.length === 0) {
        throw new Error(`No hay tareas pendientes para: "${taskName}". Verifica el nombre exacto.`)
      }
      
      const taskId = tasksDisplay[0].id
      console.log(`✅ Task ID encontrado (por displayName): ${taskId}`)
      return taskId
    }

    const taskId = tasks[0].id
    console.log(`✅ Task ID encontrado: ${taskId}`)
    return taskId

  } catch (error) {
    console.error('❌ Error obteniendo taskId:', error)
    throw error
  }
}


 async function instantiateProcess(processId: string, cookies: string, token: string, variables?: any) {
  try {
    console.log(`🚀 Instanciando proceso: ${processId}`)
    

    const response = await fetch(
      `${BONITA_URL}/API/bpm/process/${processId}/instantiation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": cookies,
          "X-Bonita-API-Token": token,
        },
       
      }
    )

    if (!response.ok) {
      const errTxt = await response.text()
      throw new Error(`Error instanciando proceso: ${response.status} - ${errTxt}`)
    }

    const caseData = await response.json()
    console.log(`✅ Proceso instanciado. Case ID: ${caseData.caseId}`)
    
    return caseData.caseId

  } catch (error) {
    console.error('❌ Error instanciando proceso:', error)
    throw error
  }
}

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
      const taskId = await getPendingTask("Creacion de Proyecto y Definicion de Etapas", cookies, token)
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


