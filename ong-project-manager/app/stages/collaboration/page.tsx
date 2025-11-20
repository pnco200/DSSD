"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

type StageItem = {
  id_proyecto: number
  nombre_proyecto: string
  descripcion_proyecto: string
  fecha_inicio: string
  fecha_fin: string
  id_etapa: number
  nombre: string
  descripcion: string
  is_completed: boolean
}

type DashboardUser = {
  id_usuario: number
  username: string
  id_ong: number | null
  es_gerente: number | boolean
}

export default function CollaborationStagesPage() {
  const router = useRouter()
  const [user, setUser] = useState<DashboardUser | null>(null)
  const [stages, setStages] = useState<StageItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<number | null>(null)

  useEffect(() => {
    const storedUser = localStorage.getItem("user")
    const token = localStorage.getItem("token")
    if (!storedUser || !token) {
      router.push("/")
      return
    }

    try {
      const parsed = JSON.parse(storedUser) as DashboardUser
      setUser(parsed)
    } catch {
      router.push("/")
    }
  }, [router])

  useEffect(() => {
    if (!user) return

    const controller = new AbortController()
    const fetchStages = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/etapas/collaboration`, {
          signal: controller.signal,
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? "No se pudieron obtener las etapas.")
        }
        const data = await res.json()
        setStages(data?.etapas ?? [])
      } catch (err: any) {
        if (err.name === "AbortError") return
        setError(err?.message ?? "Error desconocido al consultar.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchStages()
    return () => controller.abort()
  }, [user])

  const formatDate = (value?: string) => {
    if (!value) return "—"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const completeStage = async (id_etapa: number) => {
    setError(null)
    setCompletingId(id_etapa)
    try {
      const res = await fetch("/api/etapas/collaboration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_etapa }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.success) {
        throw new Error(body?.error ?? "No se pudo marcar la etapa como completada.")
      }
      setStages((prev) =>
        prev.map((stage) => (stage.id_etapa === id_etapa ? { ...stage, is_completed: true } : stage)),
      )
    } catch (err: any) {
      setError(err?.message ?? "Error al completar la etapa.")
    } finally {
      setCompletingId(null)
    }
  }

  const completedCount = useMemo(() => stages.filter((stage) => stage.is_completed).length, [stages])

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground uppercase tracking-wide">Panel de colaboracion</p>
          <h1 className="text-3xl font-bold text-gray-900">Etapas en las que colaboro</h1>
          <p className="text-gray-600">Visualiza todas las etapas donde tu ONG es colaboradora.</p>
          <div className="flex flex-wrap gap-3">
            <Badge variant="secondary" className="text-sm">
              Total: {stages.length}
            </Badge>
            <Badge variant="outline" className="text-sm">
              Completadas: {completedCount}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline">
            <Link href="/dashboard">Volver al panel</Link>
          </Button>
          {user?.username && (
            <Badge variant="secondary" className="text-sm">
              Sesion de: {user.username}
            </Badge>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Ocurrio un problema</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((index) => (
              <Card key={`skeleton-${index}`} className="border-2 border-dashed border-primary/40">
                <CardHeader>
                  <Skeleton className="h-6 w-1/3" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : stages.length === 0 ? (
          <Card className="border-2 border-dashed border-primary/50">
            <CardHeader>
              <CardTitle className="text-xl">No tienes etapas asignadas</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              No hay etapas registradas en las que tu ONG sea colaboradora actualmente.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {stages.map((stage) => (
              <Card key={`${stage.id_etapa}-${stage.nombre}`} className="border-2 border-primary/60">
                <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-xl text-primary">{stage.nombre}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Proyecto: <span className="font-medium text-foreground">{stage.nombre_proyecto}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={stage.is_completed ? "secondary" : "outline"}>
                      {stage.is_completed ? "Completada" : "Pendiente"}
                    </Badge>
                    {!stage.is_completed && (
                      <Button
                        size="sm"
                        onClick={() => completeStage(stage.id_etapa)}
                        disabled={completingId === stage.id_etapa}
                      >
                        {completingId === stage.id_etapa ? "Marcando..." : "Marcar etapa como completada"}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Inicio del proyecto</p>
                      <p className="font-medium">{formatDate(stage.fecha_inicio)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Fin estimado</p>
                      <p className="font-medium">{formatDate(stage.fecha_fin)}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Descripcion de la etapa</p>
                    <p className="text-sm text-foreground">{stage.descripcion || "Sin descripcion"}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Descripcion del proyecto</p>
                    <p className="text-sm text-foreground">{stage.descripcion_proyecto || "Sin descripcion"}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
