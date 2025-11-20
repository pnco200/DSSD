"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type Observacion = {
  id_observacion: number
  titulo: string
  comentario: string
  respondida: boolean
  respuesta: string
  fecha_observacion: string
  fecha_fin_observacion: string
  id_etapa: number
  nombre_etapa: string
  id_proyecto: number
  nombre_proyecto: string
}

type DashboardUser = {
  id_usuario: number
  username: string
  id_ong: number | null
  es_gerente: number | boolean
}

export default function ObservacionesPage() {
  const router = useRouter()
  const [user, setUser] = useState<DashboardUser | null>(null)
  const [observaciones, setObservaciones] = useState<Observacion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [respondiendoId, setRespondiendoId] = useState<number | null>(null)
  const [respuestas, setRespuestas] = useState<Record<number, string>>({})

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
      if (!parsed.es_gerente) {
        router.push("/dashboard")
      }
    } catch {
      router.push("/")
    }
  }, [router])

  useEffect(() => {
    if (!user || !user.es_gerente) return
    const controller = new AbortController()

    const fetchObservaciones = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/observaciones", { signal: controller.signal })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(body?.error ?? "No se pudieron obtener las observaciones.")
        }
        setObservaciones(body.observaciones ?? [])
      } catch (err: any) {
        if (err.name === "AbortError") return
        setError(err?.message ?? "Error desconocido al consultar.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchObservaciones()
    return () => controller.abort()
  }, [user])

  const responder = async (id_observacion: number) => {
    const respuesta = respuestas[id_observacion]?.trim() ?? ""
    if (!respuesta) {
      setError("Debes ingresar una respuesta.")
      return
    }
    setError(null)
    setRespondiendoId(id_observacion)
    try {
      const res = await fetch("/api/observaciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_observacion, respuesta }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.success) {
        throw new Error(body?.error ?? "No se pudo responder la observacion.")
      }
      setObservaciones((prev) => prev.filter((o) => o.id_observacion !== id_observacion))
    } catch (err: any) {
      setError(err?.message ?? "Error al responder la observacion.")
    } finally {
      setRespondiendoId(null)
    }
  }

  const formatDateTime = (value?: string) => {
    if (!value) return "—"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground uppercase tracking-wide">Panel de observaciones</p>
          <h1 className="text-3xl font-bold text-gray-900">Observaciones pendientes</h1>
          <p className="text-gray-600">
            Observaciones de etapas donde tu ONG es colaboradora. Solo se muestran las pendientes de respuesta.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="text-sm">
              Pendientes: {observaciones.length}
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
            {[1, 2, 3].map((idx) => (
              <Card key={`skeleton-${idx}`} className="border-2 border-dashed border-primary/40">
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
        ) : observaciones.length === 0 ? (
          <Card className="border-2 border-dashed border-primary/50">
            <CardHeader>
              <CardTitle className="text-xl">No hay observaciones pendientes</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              No hay observaciones sin responder asociadas a etapas de tu ONG.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {observaciones.map((obs) => (
              <Card key={obs.id_observacion} className="border-2 border-primary/60">
                <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-xl text-primary">{obs.titulo}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Etapa: <span className="font-medium text-foreground">{obs.nombre_etapa}</span> · Proyecto:{" "}
                      <span className="font-medium text-foreground">{obs.nombre_proyecto}</span>
                    </p>
                  </div>
                  <Badge variant="outline">Recibida: {formatDateTime(obs.fecha_observacion)}</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Comentario</p>
                    <p className="text-sm text-foreground">{obs.comentario || "Sin comentario"}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase text-muted-foreground">Respuesta</p>
                    <Textarea
                      placeholder="Escribe tu respuesta..."
                      value={respuestas[obs.id_observacion] ?? ""}
                      onChange={(e) =>
                        setRespuestas((prev) => ({ ...prev, [obs.id_observacion]: e.target.value }))
                      }
                      disabled={respondiendoId === obs.id_observacion}
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => responder(obs.id_observacion)}
                        disabled={respondiendoId === obs.id_observacion}
                      >
                        {respondiendoId === obs.id_observacion ? "Enviando..." : "Responder observacion"}
                      </Button>
                    </div>
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
