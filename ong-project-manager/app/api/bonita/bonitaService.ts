import { NextResponse } from "next/server"

const BONITA_URL = "http://localhost:8080/bonita"
const BONITA_USER = "walter.bates"
const BONITA_PASS = "bpm"

// Helper para login en Bonita y obtener cookies + token
export async function bonitaLogin() {
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
export async function getProcessId(processName: string, cookies: string, token: string) {
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
export async function setProcessVariable(caseId: string, variableName: string, value: any, cookies: string, token: string) {
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
export async function executeTask(taskId: string, cookies: string, token: string) {
  try {
    console.log(`🚀 Ejecutando tarea ${taskId}...`);
    
    const executeResponse = await fetch(
      `${BONITA_URL}/API/bpm/userTask/${taskId}/execution`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": cookies,
          "X-Bonita-API-Token": token,
        },
        body: JSON.stringify({}) // Body vacío o con variables si las necesitas
      }
    );

    if (!executeResponse.ok) {
      const errTxt = await executeResponse.text();
      throw new Error(`Error ejecutando tarea: ${executeResponse.status} - ${errTxt}`);
    }

    console.log(`✅ Tarea ${taskId} ejecutada correctamente`);
    
    // Manejar respuesta vacía
    const contentType = executeResponse.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await executeResponse.json();
    } else {
      return { success: true };
    }
  } catch (error) {
    console.error(`❌ Error en executeTask:`, error);
    throw error;
  }
}

export async function findTasksByCaseId(caseId: string, cookies: string, token: string) {
  console.log(`🔍 Buscando tareas para case: ${caseId}`);
  
  const response = await fetch(
    `${BONITA_URL}/API/bpm/userTask?f=caseId=${caseId}`,
    {
      headers: {
        "Cookie": cookies,
        "X-Bonita-API-Token": token,
      }
    }
  );
  
  const tasks = await response.json();
  console.log(`📋 Tareas encontradas:`, tasks);
  return tasks;
}


 export async function instantiateProcess(processId: string, cookies: string, token: string, variables?: any) {
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
/*
async function getCurrentUserSession(cookies: string, token: string) {
  console.log('🔍 Obteniendo sesión de usuario actual...');
  
  const response = await fetch(
    `${BONITA_URL}/API/system/session`, // ← CORREGIDO: /API/ no /APIToolkit/
    {
      method: "GET",
      headers: {
        "Cookie": cookies,
        "X-Bonita-API-Token": token,
      }
    }
  );

  if (!response.ok) {
    const errTxt = await response.text();
    throw new Error(`Error obteniendo sesión: ${response.status} - ${errTxt}`);
  }

  const session = await response.json();
  console.log('👤 Sesión obtenida:', {
    userId: session.user_id,
    userName: session.user_name,
    isTechnical: session.is_technical_user
  });
  
  return session;
}
*/
//Obtengo el id del usuario actual de la sesion
/*
export async function getCurrentUserId(cookies: string, token: string) {
  const session = await getCurrentUserSession(cookies, token);
  return session.user_id;
}
*/
export async function assignTask(taskId: string, userId: string, cookies: string, token: string) {
  console.log(`🔧 Asignando tarea ${taskId} al usuario ${userId}...`);
  
  const assignBody = {
    "assigned_id": userId
  };

  console.log('📤 Assign Request Body:', JSON.stringify(assignBody));

  const response = await fetch(
    `${BONITA_URL}/API/bpm/userTask/${taskId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookies,
        "X-Bonita-API-Token": token,
      },
      body: JSON.stringify(assignBody)
    }
  );

  if (!response.ok) {
    const errTxt = await response.text();
    throw new Error(`Error asignando tarea: ${response.status} - ${errTxt}`);
  }

  //  MANEJAR RESPUESTA VACÍA
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  } else {
    // Respuesta vacía - solo retornar éxito
    return { success: true, message: 'Tarea asignada' };
  }
}



