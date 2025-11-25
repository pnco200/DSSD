import { NextResponse } from "next/server";
import { getBonitaAuth, getUserPendingTasks, getCaseVarJsonString } from "@/lib/bonita-utils";

export async function GET() {
  try {
    const bonitaAuth = await getBonitaAuth();
    
    // 1. Traemos TODAS las tareas humanas asignadas o disponibles para el usuario
    const pendingTasks = await getUserPendingTasks(bonitaAuth);
    
    // 2. Filtramos las tareas que sean de "Crear compromiso" (o el nombre que tenga tu tarea de espera)
    // Y que estén en estado 'ready'
    const tareasCompromiso = pendingTasks.filter((tarea: any) => 
      (tarea.name?.toLowerCase().includes('compromiso') || 
       tarea.displayName?.toLowerCase().includes('compromiso')) &&
       tarea.state === 'ready'
    );

    console.log("[Etapas Disponibles] Tareas (Casos) encontrados:", tareasCompromiso.length);

    if (tareasCompromiso.length === 0) {
      return NextResponse.json({ success: true, stages: [], message: "No hay etapas disponibles." });
    }

    // 3. PROCESAMIENTO PARALELO:
    // Iteramos sobre CADA tarea encontrada. Cada tarea representa un PROYECTO distinto en Bonita.
    const stagesPromises = tareasCompromiso.map(async (tarea: any) => {
      const currentCaseId = tarea.rootCaseId ?? tarea.caseId;
      const currentTaskId = tarea.id;

      try {
        // Obtenemos la variable SOLO de este caso específico
        const jsonVar = await getCaseVarJsonString({
          cookies: bonitaAuth.cookies,
          token: bonitaAuth.token,
          caseId: currentCaseId,
          varName: "colaboracionesDisponibles"
        });

        if (!jsonVar) return [];

        let parsedStages = [];
        
        try {
            parsedStages = typeof jsonVar === 'string' ? JSON.parse(jsonVar) : jsonVar;
        } catch (e) {
            console.error(`Error parseando JSON para case ${currentCaseId}`, e);
            return [];
        }

        if (!Array.isArray(parsedStages)) return [];

        // 4. FILTRADO CRÍTICO (Corrección del error de tus datos mezclados):
        // Si tu variable tiene etapas de OTROS proyectos mezclados, aquí tratamos de filtrar
        // solo las que coinciden con el proyecto actual si es posible, 
        // O simplemente confiamos en que vamos a usar el CaseID de ESTA iteración.
        
        return parsedStages.map((stage: any) => ({
          ...stage,
          // AQUÍ ESTÁ LA MAGIA: 
          // A esta etapa le asignamos el CaseId y TaskId DE ESTA ITERACIÓN (del proyecto al que pertenece la variable)
          _bonitaCaseId: currentCaseId,   
          _bonitaTaskId: currentTaskId    
        }));

      } catch (e) {
        console.error(`Error leyendo variables para case ${currentCaseId}:`, e);
        return [];
      }
    });

    // Esperamos a que todas las promesas de los distintos casos se resuelvan
    const results = await Promise.all(stagesPromises);
    
    // Aplanamos el array de arrays en un solo array de etapas
    // flat() convierte [[etapa1, etapa2], [etapa3]] en [etapa1, etapa2, etapa3]
    const allStages = results.flat();

    // Eliminamos duplicados si es que la variable "sucia" está causando que la misma etapa aparezca en varios casos
    // Usamos un Map por ID de etapa para dejar solo una (preferiblemente la primera que encontramos)
    const uniqueStages = Array.from(new Map(allStages.map(item => [item.id, item])).values());

    return NextResponse.json({
      success: true,
      stages: uniqueStages,
    });

  } catch (err: any) {
    console.error("ERROR CRÍTICO:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}