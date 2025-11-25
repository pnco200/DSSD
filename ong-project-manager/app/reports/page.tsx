"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, FileText, CheckCircle2, Loader2 } from "lucide-react"
// Importar Dialog components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ProjectStatus {
  id_proyecto: number
  nombre: string
  descripcion: string
  total_etapas: number
  etapas_completadas: number
}

export default function ReportsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingId, setGeneratingId] = useState<number | null>(null)
  
  // Estado para el reporte
  const [reportData, setReportData] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch("/api/reports/projects")
        if (res.status === 401) return router.push("/")
        const data = await res.json()
        setProjects(data.projects || [])
      } catch (error) {
        console.error("Error cargando proyectos", error)
      } finally {
        setLoading(false)
      }
    }
    fetchProjects()
  }, [router])

  const handleGenerarReporte = async (id_proyecto: number) => {
    setGeneratingId(id_proyecto)
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_proyecto })
      })
      
      const data = await res.json()
      
      if (data.success || data.reporte) {
        setReportData(data.reporte)
        setIsModalOpen(true)
      } else {
        alert("Error: " + (data.error || "No se pudo generar el reporte"))
      }
    } catch (e) {
      alert("Error de conexión al generar reporte")
    } finally {
      setGeneratingId(null)
    }
  }

  if (loading) return <div className="p-8 text-center">Cargando reportes...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-primary">Reportes Gerenciales</h1>
            <p className="text-muted-foreground">Estado de cumplimiento de proyectos</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver
            </Link>
          </Button>
        </div>

        <div className="grid gap-4">
          {projects.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No tienes proyectos registrados.
              </CardContent>
            </Card>
          ) : (
            projects.map((project) => {
              const total = project.total_etapas || 0
              const completadas = Number(project.etapas_completadas) || 0
              const percentage = total > 0 ? (completadas / total) * 100 : 0
              const isFinished = total > 0 && completadas === total

              return (
                <Card key={project.id_proyecto} className={isFinished ? "border-green-500/50 bg-green-50/30" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl">{project.nombre}</CardTitle>
                        <CardDescription>{project.descripcion || "Sin descripción"}</CardDescription>
                      </div>
                      {isFinished && (
                        <Badge className="bg-green-600 hover:bg-green-700">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Completado
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm font-medium">
                        <span>Progreso de Etapas</span>
                        <span>{completadas} / {total}</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>

                    <div className="flex justify-end pt-2">
                      {isFinished ? (
                        <Button 
                          onClick={() => handleGenerarReporte(project.id_proyecto)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          disabled={generatingId === project.id_proyecto}
                        >
                          {generatingId === project.id_proyecto ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="mr-2 h-4 w-4" />
                          )}
                          Ver / Generar Reporte Final
                        </Button>
                      ) : (
                        <Button variant="secondary" disabled className="opacity-50 cursor-not-allowed">
                          Faltan etapas por completar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        {/* Modal del Reporte */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Informe de Proyecto Finalizado</DialogTitle>
              <DialogDescription>
                Historial de eventos registrados en Bonita BPM (Variable: info_reporte)
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[400px] w-full rounded-md border p-4">
              {reportData && Array.isArray(reportData) ? (
                <div className="space-y-4">
                  {reportData.map((item: any, index: number) => (
                    <div key={index} className="flex flex-col gap-1 border-b pb-3 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-primary">{item.evento || "Evento"}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.timestamp ? new Date(item.timestamp).toLocaleString() : "-"}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 pl-2">
                        {/* Renderizado dinámico de propiedades extras */}
                        {Object.entries(item).map(([key, val]) => {
                          if (key === 'evento' || key === 'timestamp') return null;
                          return (
                            <div key={key}>
                              <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span> {String(val)}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  No hay datos históricos disponibles o el formato es incorrecto.
                  <pre className="mt-2 text-xs text-left">{JSON.stringify(reportData, null, 2)}</pre>
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  )
}