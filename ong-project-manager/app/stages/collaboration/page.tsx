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
  caseId: string
  projectId: number | null
  projectName: string
  projectDescription: string
  projectStart: string
  projectEnd: string
  stageId: number | null
  stageName: string
  stageDescription: string
  isCompleted: boolean
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
    if (user.id_ong === null || user.id_ong === undefined) {
      setError("Tu usuario no tiene una ONG asociada.")
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    const fetchStages = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/etapas/collaboration?ongId=${user.id_ong}`, {
          signal: controller.signal,
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? "No se pudo obtener la información desde Bonita.")
        }
        const data = await res.json()
        setStages(data?.stages ?? [])
      } catch (err: any) {
        if (err.name === "AbortError") return
        setError(err?.message ?? "Error desconocido al consultar Bonita.")
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

  const completedCount = useMemo(() => stages.filter((stage) => stage.isCompleted).length, [stages])

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground uppercase tracking-wide">Panel de colaboración</p>
          <h1 className="text-3xl font-bold text-gray-900">Etapas en las que colaboro</h1>
          <p className="text-gray-600">
            Visualiza todas las etapas asignadas a tu ONG directamente desde Bonita BPM.
          </p>
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
              Sesión de: {user.username}
            </Badge>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Ocurrió un problema</AlertTitle>
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
              Bonita no reporta etapas en las que tu ONG esté participando actualmente. Cuando se te asigne una etapa,
              aparecerá aquí automáticamente.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {stages.map((stage) => (
              <Card key={`${stage.caseId}-${stage.stageId ?? stage.stageName}`} className="border-2 border-primary/60">
                <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-xl text-primary">{stage.stageName}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Proyecto: <span className="font-medium text-foreground">{stage.projectName}</span>
                    </p>
                  </div>
                  <Badge variant={stage.isCompleted ? "secondary" : "outline"}>
                    {stage.isCompleted ? "Completada" : "Pendiente"}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">ID Case</p>
                      <p className="font-medium">{stage.caseId}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Inicio del proyecto</p>
                      <p className="font-medium">{formatDate(stage.projectStart)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Fin estimado</p>
                      <p className="font-medium">{formatDate(stage.projectEnd)}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Descripción de la etapa</p>
                    <p className="text-sm text-foreground">{stage.stageDescription || "Sin descripción"}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Descripción del proyecto</p>
                    <p className="text-sm text-foreground">{stage.projectDescription || "Sin descripción"}</p>
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
