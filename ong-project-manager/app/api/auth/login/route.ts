import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Usuario y contraseña son requeridos' },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();
    
    try {
      // Busca usuario en la base de datos
      const [users] = await connection.execute(
        'SELECT id_usuario, username, password, email, id_ong, es_gerente FROM usuarios WHERE username = ?',
        [username]
      );

      const userArray = users as any[];

      if (userArray.length === 0) {
        return NextResponse.json(
          { error: 'Usuario no encontrado' },
          { status: 401 }
        );
      }

      const user = userArray[0];

      if (user.password !== password) {
        return NextResponse.json(
          { error: 'Contraseña incorrecta' },
          { status: 401 }
        );
      }

      // Eliminar la contraseña del objeto de respuesta
      const { password: _, ...userWithoutPassword } = user;

      // En producción, generar un JWT token aquí
      const token = 'mock-jwt-token-' + Date.now();

      return NextResponse.json({
        message: 'Login exitoso',
        token,
        user: userWithoutPassword
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error en login:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}