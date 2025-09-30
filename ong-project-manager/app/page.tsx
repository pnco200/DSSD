import CreateProjectForm from "@/components/create-project-form"

export default function Home() {
  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary md:text-4xl">Gestión de Proyectos ONG</h1>
          <p className="mt-2 text-muted-foreground">Crea y administra proyectos con sus etapas</p>
        </div>
        <CreateProjectForm />
      </div>
    </main>
  )
}
