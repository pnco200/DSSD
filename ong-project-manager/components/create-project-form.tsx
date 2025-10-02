"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2 } from "lucide-react"

interface ProjectData {
  nombre: string
  fecha_inicio: string
  fecha_fin: string
}

interface EtapaData {
  nombre: string
  descripcion: string
}

export default function CreateProjectForm() {
  const [step, setStep] = useState<"project" | "stages">("project")
  const [projectData, setProjectData] = useState<ProjectData>({
    nombre: "",
    fecha_inicio: "",
    fecha_fin: "",
  })
  const [projectId, setProjectId] = useState<string | null>(null)
  const [etapas, setEtapas] = useState<EtapaData[]>([{ nombre: "", descripcion: "" }])
  const [isLoading, setIsLoading] = useState(false)

  // Simular obtención del token JWT (en producción vendría del contexto de autenticación)
  const getOngIdFromToken = () => {
    // Aquí deberías decodificar el JWT real
    return "ong-id-from-jwt-token"
  }

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const ongId = getOngIdFromToken()
    const payload = {
      ...projectData,
      ong_responsable: ongId,
    }

    console.log(" Enviando proyecto al backend:", payload)

    try {
      // Simular llamada al backend
      const response = await fetch("/api/proyectos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      console.log(" Respuesta del backend:", data)

    
      setProjectId(data.id_proyecto)
      setStep("stages")
    } catch (error) {
      console.error(" Error al crear proyecto:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddEtapa = () => {
    setEtapas([...etapas, { nombre: "", descripcion: "" }])
  }

  const handleRemoveEtapa = (index: number) => {
    if (etapas.length > 1) {
      setEtapas(etapas.filter((_, i) => i !== index))
    }
  }

  const handleEtapaChange = (index: number, field: keyof EtapaData, value: string) => {
    const newEtapas = [...etapas]
    newEtapas[index][field] = value
    setEtapas(newEtapas)
  }

  const handleStagesSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const ongId = getOngIdFromToken()
    const parsedEtapas = etapas.map((etapa) => ({
      ...etapa,
      ong_responsable_id: null,
      is_completed: false,
    }))

    const payload = { nombre: projectData.nombre, etapas: parsedEtapas, ong_responsable_id: 1, fecha_inicio: projectData.fecha_inicio, fecha_fin: projectData.fecha_fin, id_proyecto: projectId }

    console.log(" Enviando etapas al backend:", payload)

    try {
      const response = await fetch("/api/etapas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      console.log(" Respuesta del backend (etapas):", data)

      // Resetear formulario
      alert("¡Proyecto y etapas creados exitosamente!")
      setStep("project")
      setProjectData({ nombre: "", fecha_inicio: "", fecha_fin: "" })
      setEtapas([{ nombre: "", descripcion: "" }])
      setProjectId(null)
    } catch (error) {
      console.error(" Error al crear etapas:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full border-4 font-bold ${
              step === "project"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-primary bg-card text-primary"
            }`}
          >
            1
          </div>
          <span className={`font-semibold ${step === "project" ? "text-primary" : "text-muted-foreground"}`}>
            Datos del Proyecto
          </span>
        </div>
        <div className="h-1 w-16 bg-border" />
        <div className="flex items-center gap-2">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full border-4 font-bold ${
              step === "stages"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            2
          </div>
          <span className={`font-semibold ${step === "stages" ? "text-primary" : "text-muted-foreground"}`}>
            Etapas
          </span>
        </div>
      </div>

      {/* Step 1: Project Form */}
      {step === "project" && (
        <Card className="border-4 border-primary">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">PASO 1: DATOS DEL PROYECTO</CardTitle>
            <CardDescription>Completa la información básica del proyecto</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProjectSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="nombre" className="text-sm font-bold uppercase text-primary">
                  Nombre del Proyecto
                </Label>
                <Input
                  id="nombre"
                  value={projectData.nombre}
                  onChange={(e) => setProjectData({ ...projectData, nombre: e.target.value })}
                  required
                  className="border-2 border-primary bg-card"
                  placeholder="Ingresa el nombre del proyecto"
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fecha_inicio" className="text-sm font-bold uppercase text-primary">
                    Fecha de Inicio
                  </Label>
                  <Input
                    id="fecha_inicio"
                    type="date"
                    value={projectData.fecha_inicio}
                    onChange={(e) => setProjectData({ ...projectData, fecha_inicio: e.target.value })}
                    required
                    className="border-2 border-primary bg-card"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fecha_fin" className="text-sm font-bold uppercase text-primary">
                    Fecha de Fin
                  </Label>
                  <Input
                    id="fecha_fin"
                    type="date"
                    value={projectData.fecha_fin}
                    onChange={(e) => setProjectData({ ...projectData, fecha_fin: e.target.value })}
                    required
                    className="border-2 border-primary bg-card"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                size="lg"
              >
                {isLoading ? "Guardando..." : "Continuar a Etapas"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Stages Form */}
      {step === "stages" && (
        <div className="space-y-6">
          <Card className="border-4 border-primary">
            <CardHeader>
              <CardTitle className="text-2xl text-primary">PASO 2: CREAR ETAPAS</CardTitle>
              <CardDescription>Define las etapas del proyecto. Puedes agregar múltiples etapas.</CardDescription>
            </CardHeader>
          </Card>

          <form onSubmit={handleStagesSubmit} className="space-y-4">
            {etapas.map((etapa, index) => (
              <Card key={index} className="border-4 border-primary">
                <CardHeader className="bg-primary text-primary-foreground">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Etapa {index + 1}</CardTitle>
                    {etapas.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveEtapa(index)}
                        className="text-primary-foreground hover:bg-primary-foreground/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-2">
                    <Label htmlFor={`nombre-${index}`} className="text-sm font-bold uppercase text-primary">
                      Nombre de la Etapa
                    </Label>
                    <Input
                      id={`nombre-${index}`}
                      value={etapa.nombre}
                      onChange={(e) => handleEtapaChange(index, "nombre", e.target.value)}
                      required
                      className="border-2 border-primary bg-card"
                      placeholder="Ej: Planificación inicial"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`descripcion-${index}`} className="text-sm font-bold uppercase text-primary">
                      Descripción
                    </Label>
                    <Textarea
                      id={`descripcion-${index}`}
                      value={etapa.descripcion}
                      onChange={(e) => handleEtapaChange(index, "descripcion", e.target.value)}
                      required
                      className="border-2 border-primary bg-card"
                      placeholder="Describe los objetivos y actividades de esta etapa"
                      rows={4}
                    />
                  </div>

                  <div className="rounded-md bg-muted p-3">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold">ONG Responsable:</span> Se asignará posteriormente
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="flex gap-4">
              <Button
                type="button"
                onClick={handleAddEtapa}
                variant="outline"
                className="flex-1 border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground bg-transparent"
                size="lg"
              >
                <Plus className="mr-2 h-5 w-5" />
                Agregar Otra Etapa
              </Button>

              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                size="lg"
              >
                {isLoading ? "Guardando..." : "Guardar Etapas"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
