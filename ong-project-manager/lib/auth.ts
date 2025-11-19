import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export type AuthPayload = {
  id_usuario: number;
  username: string;
  id_ong: number;
  es_gerente: boolean;
};

export async function authUser(): Promise<AuthPayload | null> {
  const cookieStore = await cookies(); 
  const token = cookieStore.get("auth")?.value;

  if (!token) return null;

  try {
    const data = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    return data;
  } catch (err) {
    return null;
  }
}
