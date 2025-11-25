// lib/bonita-utils.ts
import { authUser } from "@/lib/auth";
import { loginToBonita } from "@/lib/bonitaLogin";
import pool from '@/lib/db';

const BONITA_URL = process.env.BONITA_URL ?? "http://localhost:8080/bonita";

// Interfaces compartidas
export interface BonitaAuth {
  cookies: string;
  token: string;
  session: {
    user_id: string;
    user_name: string;
    tenant_id: string;
  };
}

export interface Stage {
  id: string;
  nombre: string;
  descripcion: string;
  requisitos?: string[];
  fechaLimite?: string;
  proyecto?: string;
}

// Función para obtener password del usuario (privada)
async function getUserPassword(userId: number): Promise<string | null> {
  try {
    const [rows] = await pool.query(
      'SELECT password FROM usuarios WHERE id_usuario = ?',
      [userId]
    );
    
    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }
    
    return (rows[0] as any).password;
  } catch (error) {
    console.error("Error al obtener contraseña:", error);
    return null;
  }
}

// Función principal de autenticación Bonita
export async function getBonitaAuth(): Promise<BonitaAuth> {
  const user = await authUser();
  console.log("[Bonita Utils] AUTH USER:", user);

  if (!user) throw new Error("No autenticado");

  const password = await getUserPassword(user.id_usuario);
  if (!password) {
    throw new Error("No se pudo obtener la contraseña del usuario desde la base de datos");
  }

  const bonitaSession = await loginToBonita(user.username, password);
  if (!bonitaSession) {
    throw new Error("Error al iniciar sesión en Bonita");
  }

  return {
    cookies: bonitaSession.cookies,
    token: bonitaSession.token,
    session: {
      user_id: bonitaSession.session.user_id,
      user_name: bonitaSession.session.user_name,
      tenant_id: bonitaSession.session.tenant_id ?? "1",
    },
  };
}

// Función para hacer requests autenticados a Bonita
export async function makeBonitaRequest(endpoint: string, bonitaAuth: BonitaAuth) {
  const response = await fetch(`${BONITA_URL}${endpoint}`, {
    headers: {
      'Cookie': bonitaAuth.cookies,
      'X-Bonita-API-Token': bonitaAuth.token,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bonita API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// Función para obtener tareas pendientes del usuario
export async function getUserPendingTasks(bonitaAuth: BonitaAuth) {
  return makeBonitaRequest(
    `/API/bpm/humanTask?f=user_id=${bonitaAuth.session.user_id}&f=state=ready&p=0&c=100`,
    bonitaAuth
  );
}

// Función para obtener variables de una tarea
export async function getTaskVariables(taskId: string, bonitaAuth: BonitaAuth) {
  return makeBonitaRequest(`/API/bpm/userTask/${taskId}/context`, bonitaAuth);
}

export  async function assignTask({ cookies, token, taskId, userId }: { cookies: string; token: string; taskId: string; userId: string }) {
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
export async function setCaseVarInteger({
  cookies, token, caseId, varName, value,
}: { cookies: string; token: string; caseId: string; varName: string; value: number }) {
  
  const res = await fetch(`${BONITA_URL}/API/bpm/caseVariable/${caseId}/${encodeURIComponent(varName)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookies,
      "X-Bonita-API-Token": token,
    },
    body: JSON.stringify({ 
      type: "java.lang.Integer",
      value: value 
    }),
  })
  
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`No pude setear la variable numérica '${varName}': ${err}`)
  }
}

export async function getCaseVarJsonString({
  cookies,
  token,
  caseId,
  varName
}: {
  cookies: string;
  token: string;
  caseId: string;
  varName: string;
}) {
  const response = await fetch(
    `${process.env.BONITA_URL}/API/bpm/caseVariable/${caseId}/${encodeURIComponent(varName)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookies,
        "X-Bonita-API-Token": token,
      },
    }
  );
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`No pude obtener la variable '${varName}': ${err}`);
  }
  
  const data = await response.json();
  return data.value; // Retorna el valor de la variable
}

// Función para completar una tarea
export async function completeTask({ cookies, token, taskId }: { cookies: string; token: string; taskId: string }) {
  const res = await fetch(`${BONITA_URL}/API/bpm/userTask/${taskId}/execution`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookies,
      "X-Bonita-API-Token": token,
    },
    body: JSON.stringify({}), 
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`No pude completar la task: ${err}`)
  }
}


export async function setCaseVarJsonString({
  cookies, token, caseId, varName, value,
}: { cookies: string; token: string; caseId: string; varName: string; value: unknown }) {
  let parsedValue = varName == 'proyectoNuevo' ? JSON.stringify(value) : value
  const res = await fetch(`${BONITA_URL}/API/bpm/caseVariable/${caseId}/${encodeURIComponent(varName)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookies,
      "X-Bonita-API-Token": token,
    },
    body: JSON.stringify({ type: "java.lang.String", value: parsedValue }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`No pude setear la variable '${varName}': ${err}`)
  }
}

// Agregar al final de lib/bonita-utils.ts

// Busca un caso activo de Bonita que tenga la variable id_proyecto_local igual al id buscado
export async function findCaseByLocalId(bonitaAuth: BonitaAuth, processName: string, localId: number) {
  // 1. Obtener Process ID
  const resProc = await fetch(`${process.env.BONITA_URL}/API/bpm/process?f=name=${encodeURIComponent(processName)}&o=version DESC&c=1`, {
    headers: { Cookie: bonitaAuth.cookies, "X-Bonita-API-Token": bonitaAuth.token }
  });
  const procs = await resProc.json();
  if (!procs.length) throw new Error("Proceso no encontrado");
  const processId = procs[0].id;

  // 2. Buscar cases activos
  const resCases = await fetch(`${process.env.BONITA_URL}/API/bpm/case?f=processId=${processId}&p=0&c=100`, {
    headers: { Cookie: bonitaAuth.cookies, "X-Bonita-API-Token": bonitaAuth.token }
  });
  const cases = await resCases.json();

  // 3. Filtrar manualmente por variable (Bonita Community no deja filtrar por valor de variable en la API de búsqueda fácilmente)
  for (const c of cases) {
    try {
      const val = await getCaseVarJsonString({
        cookies: bonitaAuth.cookies,
        token: bonitaAuth.token,
        caseId: c.id,
        varName: "id_proyecto_local"
      });
      // Comparamos string vs number
      if (String(val) === String(localId)) return c.id;
    } catch (e) { continue; }
  }
  return null;
}

// Helper para obtener, parsear, agregar info y guardar variable JSON
export async function appendToInfoReporte({
  bonitaAuth, caseId, logEntry
}: { bonitaAuth: BonitaAuth, caseId: string, logEntry: any }) {
  
  let currentInfo = [];
  try {
    // Intentar leer variable existente
    const raw = await getCaseVarJsonString({
      cookies: bonitaAuth.cookies,
      token: bonitaAuth.token,
      caseId,
      varName: "info_reporte"
    });
    if (raw) {
      currentInfo = typeof raw === 'string' ? JSON.parse(raw) : raw;
    }
  } catch (e) {
    console.log("Variable info_reporte no existía, se creará nueva.");
  }

  if (!Array.isArray(currentInfo)) currentInfo = [];
  
  currentInfo.push({
    timestamp: new Date().toISOString(),
    ...logEntry
  });

  // Guardar
  await setCaseVarJsonString({
    cookies: bonitaAuth.cookies,
    token: bonitaAuth.token,
    caseId,
    varName: "info_reporte",
    value: currentInfo // setCaseVarJsonString ya hace el JSON.stringify si es objeto
  });
}

// ---------------------------------------------------------------------------
// 1. Buscar un caso ARCHIVADO (finalizado) por ID local - CON VALIDACIONES
// ---------------------------------------------------------------------------
export async function findArchivedCaseByLocalId(bonitaAuth: BonitaAuth, processName: string, localId: number) {
  try {
    // 1. Obtener Process ID
    const resProc = await fetch(`${process.env.BONITA_URL}/API/bpm/process?f=name=${encodeURIComponent(processName)}&o=version%20DESC&c=1`, {
      headers: { Cookie: bonitaAuth.cookies, "X-Bonita-API-Token": bonitaAuth.token }
    });
    
    if (!resProc.ok) {
        console.error("[Bonita] Error buscando proceso:", await resProc.text());
        return null;
    }

    const procs = await resProc.json();
    if (!Array.isArray(procs) || procs.length === 0) return null;
    
    const processId = procs[0].id;
    console.log("PROCESS ID ENCONTRADO ", processId);
    // 2. Buscar cases archivados
    // CORRECCIÓN AQUÍ: Usamos %20 en lugar de espacio
    const urlCases = `${process.env.BONITA_URL}/API/bpm/archivedCase?processDefinitionId=${processId}&archivedDate=DESC`;
    
    const resCases = await fetch(urlCases, {
      headers: { Cookie: bonitaAuth.cookies, "X-Bonita-API-Token": bonitaAuth.token }
    });

    if (!resCases.ok) {
        console.error("[Bonita] Error buscando archivedCases:", resCases.status);
        return null;
    }

    const cases = await resCases.json();
    console.log(cases)
    // Validación de seguridad para evitar "cases is not iterable"
    if (!Array.isArray(cases)) {
        console.error("[Bonita] Respuesta inválida de archivedCases (no es array):", cases);
        return null;
    }
    console.log("Local ID", localId)
    // 3. Filtrar manualmente
    for (const c of cases) {
      try {
        const val = await getArchivedCaseVarJsonString({
          bonitaAuth,
          caseId: c.sourceObjectId, 
          varName: "info_reporte",
          localId: localId
        });
        if(val){
          return val
        }
      } catch (e) { 
          continue; 
      }
    }
    
    return null;

  } catch (err) {
      console.error("[Bonita Utils] Error crítico en findArchivedCaseByLocalId:", err);
      return null;
  }
}

// ---------------------------------------------------------------------------
// 2. Obtener variable de un caso ARCHIVADO - CON VALIDACIONES
// ---------------------------------------------------------------------------
export async function getArchivedCaseVarJsonString({
  bonitaAuth, caseId, varName, localId
}: { bonitaAuth: BonitaAuth, caseId: string, varName: string, localId:number }) {
  try {
    const res = await fetch(`${process.env.BONITA_URL}/API/bpm/archivedCaseVariable?f=case_id=${caseId}&p=0&c=100`, {
        headers: { Cookie: bonitaAuth.cookies, "X-Bonita-API-Token": bonitaAuth.token }
    });
    
    if (!res.ok) return null;
    
    const vars = await res.json();
    // La API de archivados devuelve una lista (historial). Validamos que sea array.
    if (Array.isArray(vars) && vars.length > 0) {
      let elementToreturn;
        for (let index = 0; index < vars.length; index++) {
          const element = vars[index];
          if(element.name == varName ){
            elementToreturn = element.value
          }
        }
        for (let index = 0; index < vars.length; index++) {
          const element = vars[index];
          if(element.name == "id_proyecto_local" && Number(element.value) == localId  ){
            return elementToreturn
          }
        }
    }
    return null;
  } catch (error) {
    console.error(`[Bonita] Error leyendo variable archivada ${varName}:`, error);
    return null;
  }
}