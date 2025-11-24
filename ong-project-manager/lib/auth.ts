import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export type AuthPayload = {
  id_usuario: number;
  userId?: number; // alias para compatibilidad
  username: string;
  id_ong: number | null;
  ong_id?: number | null; // alias para compatibilidad
  ong_nombre?: string | null;
  es_gerente: boolean;
};

export async function authUser(): Promise<AuthPayload | null> {
  const cookieStore = await cookies(); 
  const token = cookieStore.get("auth")?.value;

  if (!token) return null;

  try {
    const data = jwt.verify(token, "gastondev") as AuthPayload;
    return data;
  } catch (err) {
    return null;
  }
}

export async function getTokenJWT(): Promise<String | null> {
  const cookieStore = await cookies(); 
  const token = cookieStore.get("auth")?.value;

  if (!token) return null;

  return token
}
