'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem('user')
    const token = localStorage.getItem('token')

    if (!userData || !token) {
      router.push('/')
      return
    }

    setUser(JSON.parse(userData))
  }, [router])

  const handleLogout = () => {
    // Limpiar localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Limpiar cookies (para el middleware)
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    
    // Redirigir al login
    router.push('/');
  };




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
            
            {/* Botón de Logout */}
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors font-medium"
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

          <Link
            href="/stages/collaboration"
            className="bg-card rounded-lg border shadow-sm p-6 hover:shadow-md transition-shadow"
          >
            <h3 className="text-xl font-semibold mb-2">Etapas en las que colaboro</h3>
            <p className="text-muted-foreground">
              Ver y gestionar etapas en las que soy colaborador
            </p>
          </Link>

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
