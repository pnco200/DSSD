'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    async function loadUser() {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include' 
      })

      if (res.status === 401) {
        router.push('/')
        return
      }

      const data = await res.json()
      setUser(data.user)
    }

    loadUser()
  }, [router])

 const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });

      // Limpiar estado de usuario
      setUser(null);

      // Redirigir a página pública
      router.push("/");
    } catch (err) {
      console.error("Error al hacer logout:", err);
    }
  };

  if (!user) return <div>No estás logueado</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
      
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Sistema de Gestion</h1>
              <p className="text-gray-600 mt-1">
                Bienvenido, <span className="font-semibold">{user?.username}</span>
              </p>
             
              {user?.es_gerente ? (
                <span className="inline-block mt-2 px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                  Acceso de Gerente
                </span>
              ) : null}
            </div>
            
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Link 
            href="/projects/newProject"
            className="bg-card rounded-lg border shadow-sm p-6 hover:shadow-md transition-shadow"
          >
            <h3 className="text-xl font-semibold mb-2">Crear Proyecto</h3>
            <p className="text-muted-foreground">
              Inicia un nuevo proyecto con sus etapas
            </p>
          </Link>

          <div className="bg-card rounded-lg border shadow-sm p-6">
            <h3 className="text-xl font-semibold mb-2">Mis Proyectos</h3>
            <p className="text-muted-foreground">
              Ver y gestionar proyectos existentes
            </p>
          </div>

          {user?.es_gerente ? (
            <div className="bg-card rounded-lg border shadow-sm p-6 md:col-span-2">
              <h3 className="text-xl font-semibold mb-2">Reportes Gerenciales</h3>
              <p className="text-muted-foreground">
                Acceso a reportes de control y monitoreo
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
