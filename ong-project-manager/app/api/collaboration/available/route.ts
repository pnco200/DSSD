
import { NextResponse } from "next/server";
import { getBonitaAuth, getUserPendingTasks, getTaskVariables } from "@/lib/bonita-utils";

export async function GET() {
  try {
    // 1. Autenticar en Bonita (una sola línea)
    const bonitaAuth = await getBonitaAuth();
    
    console.log("[Etapas Disponibles] Usuario Bonita:", bonitaAuth.session.user_name);

    // 2. Obtener tareas pendientes
    const pendingTasks = await getUserPendingTasks(bonitaAuth);
    console.log("[Etapas Disponibles] Tareas pendientes:", pendingTasks.length);

    // 3. Filtrar tareas de compromiso/adjudicación
    const tareasCrearCompromiso = pendingTasks.filter((tarea: any) => 
      tarea.name?.toLowerCase().includes('compromiso') || 
      tarea.displayName?.toLowerCase().includes('compromiso') 
    );

    console.log("[Etapas Disponibles] Tareas de crear compromiso:", tareasCrearCompromiso.length);

    // 4. Si no hay tareas, retornar vacío
    if (tareasCrearCompromiso.length === 0) {
      return NextResponse.json({
        success: true,
        stages: [],
        message: "No hay etapas disponibles para colaboración"
      });
    }

    // 5. Obtener variables de la primera tarea
    const primeraTarea = tareasCrearCompromiso[0];
    const variables = await getTaskVariables(primeraTarea.id, bonitaAuth);

    // 6. Extraer etapas disponibles
    const etapasVariable = variables.etapasDisponiblesActuales || 
                          variables.etapasDisponibles || 
                          variables.etapasParaColaborar;

    if (!etapasVariable) {
      return NextResponse.json({
        success: true,
        stages: [],
        message: "No se encontraron etapas en las variables del proceso"
      });
    }

    const stages = typeof etapasVariable === 'string' ? JSON.parse(etapasVariable) : etapasVariable;
    console.log("[Etapas Disponibles] Etapas encontradas:", stages.length);

    return NextResponse.json({
      success: true,
      stages,
      taskId: primeraTarea.id,
      processInstanceId: primeraTarea.rootCaseId,
      taskName: primeraTarea.displayName || primeraTarea.name
    });

  } catch (err: any) {
    console.error("[Etapas Disponibles] Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) }, 
      { status: 500 }
    );
  }
}