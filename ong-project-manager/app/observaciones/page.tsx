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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

type EtapaTarget = {
  id_etapa: number
  nombre_etapa: string
  descripcion_etapa: string
  is_completed: boolean
  id_ong_ejecutora: number | null
  nombre_ong_ejecutora: string
  id_proyecto: number
  nombre_proyecto: string
  descripcion_proyecto: string
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
  const [observacionesRecibidas, setObservacionesRecibidas] = useState<Observacion[]>([])
  const [observacionesEnviadas, setObservacionesEnviadas] = useState<Observacion[]>([])
  const [etapasDisponibles, setEtapasDisponibles] = useState<EtapaTarget[]>([])
  const [tab, setTab] = useState<"responder" | "crear" | "respuestas">("responder")
  const [isLoading, setIsLoading] = useState({ recibidas: true, enviadas: true, etapas: true })
  const [error, setError] = useState<string | null>(null)
  const [respondiendoId, setRespondiendoId] = useState<number | null>(null)
  const [respuestas, setRespuestas] = useState<Record<number, string>>({})
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ id_etapa: "", titulo: "", comentario: "" })

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

    const fetchRecibidas = async () => {
      setIsLoading((prev) => ({ ...prev, recibidas: true }))
      try {
        const res = await fetch("/api/observaciones", { signal: controller.signal })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(body?.error ?? "No se pudieron obtener las observaciones.")
        }
        setObservacionesRecibidas(body.observaciones ?? [])
      } catch (err: any) {
        if (err.name === "AbortError") return
        setError(err?.message ?? "Error desconocido al consultar.")
      } finally {
        setIsLoading((prev) => ({ ...prev, recibidas: false }))
      }
    }

    const fetchEtapas = async () => {
      setIsLoading((prev) => ({ ...prev, etapas: true }))
      try {
        const res = await fetch("/api/observaciones?scope=targets", { signal: controller.signal })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(body?.error ?? "No se pudieron obtener las etapas disponibles.")
        }
        setEtapasDisponibles(body.etapas ?? [])
      } catch (err: any) {
        if (err.name === "AbortError") return
        setError(err?.message ?? "Error desconocido al consultar etapas.")
      } finally {
        setIsLoading((prev) => ({ ...prev, etapas: false }))
      }
    }

    const fetchEnviadas = async () => {
      setIsLoading((prev) => ({ ...prev, enviadas: true }))
      try {
        const res = await fetch("/api/observaciones?scope=sent", { signal: controller.signal })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(body?.error ?? "No se pudieron obtener tus observaciones.")
        }
        setObservacionesEnviadas(body.observaciones ?? [])
      } catch (err: any) {
        if (err.name === "AbortError") return
        setError(err?.message ?? "Error desconocido al consultar tus observaciones.")
      } finally {
        setIsLoading((prev) => ({ ...prev, enviadas: false }))
      }
    }

    fetchRecibidas()
    fetchEtapas()
    fetchEnviadas()
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
      setObservacionesRecibidas((prev) => prev.filter((o) => o.id_observacion !== id_observacion))
    } catch (err: any) {
      setError(err?.message ?? "Error al responder la observacion.")
    } finally {
      setRespondiendoId(null)
    }
  }

  const crearObservacion = async () => {
    const id_etapa = Number(form.id_etapa)
    const titulo = form.titulo.trim()
    const comentario = form.comentario.trim()

    if (!id_etapa || Number.isNaN(id_etapa)) {
      setError("Debes seleccionar una etapa valida.")
      return
    }
    if (!titulo) {
      setError("El titulo es obligatorio.")
      return
    }

    setError(null)
    setCreating(true)
    try {
      const res = await fetch("/api/observaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_etapa, titulo, comentario }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.success) {
        throw new Error(body?.error ?? "No se pudo crear la observacion.")
      }
      setForm({ id_etapa: "", titulo: "", comentario: "" })
      setObservacionesEnviadas((prev) => [
        {
          id_observacion: body.id_observacion,
          titulo,
          comentario,
          respondida: false,
          respuesta: "",
          fecha_observacion: new Date().toISOString(),
          fecha_fin_observacion: "",
          id_etapa,
          nombre_etapa: body?.etapa?.nombre_etapa ?? "",
          id_proyecto: body?.etapa?.id_proyecto ?? 0,
          nombre_proyecto: body?.etapa?.nombre_proyecto ?? "",
        },
        ...prev,
      ])
    } catch (err: any) {
      setError(err?.message ?? "Error al crear la observacion.")
    } finally {
      setCreating(false)
    }
  }

  const formatDateTime = (value?: string) => {
    if (!value) return "-"
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
          <h1 className="text-3xl font-bold text-gray-900">Gestiona observaciones</h1>
          <p className="text-gray-600">
            Responde observaciones recibidas, crea nuevas para otras etapas y revisa las respuestas a tus envios.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="text-sm">
              Pendientes: {observacionesRecibidas.length}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              Tus envios: {observacionesEnviadas.length}
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

        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="responder">Responder</TabsTrigger>
            <TabsTrigger value="crear">Hacer observacion</TabsTrigger>
            <TabsTrigger value="respuestas">Ver respuestas</TabsTrigger>
          </TabsList>

          <TabsContent value="responder" className="space-y-4">
            {isLoading.recibidas ? (
              <div className="grid gap-4">
                {[1, 2, 3].map((idx) => (
                  <Card key={`skeleton-recibidas-${idx}`} className="border-2 border-dashed border-primary/40">
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
            ) : observacionesRecibidas.length === 0 ? (
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
                {observacionesRecibidas.map((obs) => (
                  <Card key={obs.id_observacion} className="border-2 border-primary/60">
                    <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <CardTitle className="text-xl text-primary">{obs.titulo}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Etapa: <span className="font-medium text-foreground">{obs.nombre_etapa}</span> - Proyecto:{" "}
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
          </TabsContent>

          <TabsContent value="crear" className="space-y-4">
            <Card className="border-primary/40">
              <CardHeader>
                <CardTitle>Crear nueva observacion</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs uppercase text-muted-foreground">Selecciona etapa</p>
                  <Select
                    value={form.id_etapa}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, id_etapa: value }))}
                    disabled={isLoading.etapas}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoading.etapas ? "Cargando etapas..." : "Elegir etapa"} />
                    </SelectTrigger>
                    <SelectContent>
                      {etapasDisponibles.map((etapa) => (
                        <SelectItem key={etapa.id_etapa} value={String(etapa.id_etapa)}>
                          {etapa.nombre_etapa} - {etapa.nombre_proyecto}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {etapasDisponibles.length === 0 && !isLoading.etapas && (
                    <p className="text-sm text-muted-foreground">
                      No hay etapas de otras ONGs disponibles para observar.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase text-muted-foreground">Titulo</p>
                  <Input
                    placeholder="Ej: Ajustar entregables"
                    value={form.titulo}
                    onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase text-muted-foreground">Comentario</p>
                  <Textarea
                    placeholder="Describe el problema o sugerencia"
                    value={form.comentario}
                    onChange={(e) => setForm((prev) => ({ ...prev, comentario: e.target.value }))}
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={crearObservacion} disabled={creating || isLoading.etapas || !form.id_etapa}>
                    {creating ? "Guardando..." : "Crear observacion"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {!isLoading.etapas && etapasDisponibles.length > 0 && (
              <div className="grid gap-3">
                {etapasDisponibles.map((etapa) => (
                  <Card key={etapa.id_etapa}>
                    <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <CardTitle className="text-lg">{etapa.nombre_etapa}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Proyecto: <span className="font-medium text-foreground">{etapa.nombre_proyecto}</span>
                        </p>
                      </div>
                      <Badge variant="outline">{etapa.nombre_ong_ejecutora}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm text-foreground">{etapa.descripcion_etapa || "Sin descripcion"}</p>
                      <p className="text-xs text-muted-foreground">
                        {etapa.descripcion_proyecto || "Proyecto sin descripcion"}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="respuestas" className="space-y-4">
            {isLoading.enviadas ? (
              <div className="grid gap-4">
                {[1, 2].map((idx) => (
                  <Card key={`skeleton-enviadas-${idx}`} className="border-2 border-dashed border-primary/40">
                    <CardHeader>
                      <Skeleton className="h-6 w-1/3" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : observacionesEnviadas.length === 0 ? (
              <Card className="border-2 border-dashed border-primary/50">
                <CardHeader>
                  <CardTitle className="text-xl">No has creado observaciones</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">
                  Crea una observacion en la pestana anterior para ver aqui su seguimiento.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {observacionesEnviadas.map((obs) => (
                  <Card key={`sent-${obs.id_observacion}`} className="border border-primary/40">
                    <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <CardTitle className="text-lg">{obs.titulo}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Etapa: <span className="font-medium text-foreground">{obs.nombre_etapa}</span> - Proyecto:{" "}
                          <span className="font-medium text-foreground">{obs.nombre_proyecto}</span>
                        </p>
                      </div>
                      <Badge variant={obs.respondida ? "default" : "outline"}>
                        {obs.respondida ? "Respondida" : "Pendiente"}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Comentario enviado</p>
                        <p className="text-sm text-foreground">{obs.comentario || "Sin comentario"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Respuesta</p>
                        <p className="text-sm text-foreground">
                          {obs.respondida ? obs.respuesta || "Sin detalle" : "Aun sin responder"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {obs.respondida
                            ? `Respondida el ${formatDateTime(obs.fecha_fin_observacion)}`
                            : `Enviada el ${formatDateTime(obs.fecha_observacion)}`}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
