import { NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Usuario y contraseña son requeridos" },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        "SELECT id_usuario, username, password, email, id_ong, es_gerente FROM usuarios WHERE username = ?",
        [username]
      );

      const users = rows as any[];

      if (users.length === 0) {
        return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
      }

      const user = users[0];

      // SIN bcrypt, porque tenés passwords en texto plano
      if (password !== user.password) {
        return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
      }

      // Datos que irán en el JWT (no sensibles)
      const payload = {
        id_usuario: user.id_usuario,
        username: user.username,
        id_ong: user.id_ong,
        es_gerente: !!user.es_gerente,
      };

      // Firmar token
      const token = jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: "2h",
      });

      // Respuesta
      const resp = NextResponse.json({
        message: "Login exitoso",
        user: {
          id_usuario: user.id_usuario,
          username: user.username,
          email: user.email,
          id_ong: user.id_ong,
          es_gerente: !!user.es_gerente,
        },
      });

      // 🔥 Solo cookie HttpOnly — NADA de localStorage ni devolver el token
      resp.cookies.set("auth", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 2, // 2 horas
      });

      return resp;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("Error en login:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

