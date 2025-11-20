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

// Función para completar una tarea
export async function completeTask(taskId: string, variables: any, bonitaAuth: BonitaAuth) {
  const response = await fetch(`${BONITA_URL}/API/bpm/userTask/${taskId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: bonitaAuth.cookies,
      "X-Bonita-API-Token": bonitaAuth.token,
    },
    body: JSON.stringify({
      state: "completed",
      assigned_id: bonitaAuth.session.user_id,
      variables: Object.entries(variables).map(([name, value]) => ({
        name,
        value
      }))
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error completing task: ${errorText}`);
  }

  return response.json();
}