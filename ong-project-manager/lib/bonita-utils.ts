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