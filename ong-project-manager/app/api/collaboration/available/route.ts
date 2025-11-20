import { NextResponse } from "next/server";
import { getBonitaAuth, getUserPendingTasks ,getCaseVarJsonString} from "@/lib/bonita-utils";



export async function GET() {
  try {
    const bonitaAuth = await getBonitaAuth();
    
    const pendingTasks = await getUserPendingTasks(bonitaAuth);
    console.log("[Etapas Disponibles] Tareas pendientes:", pendingTasks.length);

    
    const tareasCrearCompromiso = pendingTasks.filter((tarea: any) => 
      tarea.name?.toLowerCase().includes('compromiso') || 
      tarea.displayName?.toLowerCase().includes('compromiso') 
    );

    console.log("[Etapas Disponibles] Tareas de crear compromiso:", tareasCrearCompromiso.length);

    if (tareasCrearCompromiso.length === 0) {
      return NextResponse.json({
        success: true,
        stages: [],
        message: "No hay etapas disponibles para colaboración"
      });
    }

    // 3. Obtener la primera tarea y su CASE ID 
    const primeraTarea = tareasCrearCompromiso[0];
    const caseId = primeraTarea.rootCaseId;
    
    const colaboracionesDisponibles = await getCaseVarJsonString({
      cookies: bonitaAuth.cookies,
      token: bonitaAuth.token,
      caseId: caseId,
      varName: "colaboracionesDisponibles"
    });


    if (!colaboracionesDisponibles) {
      
      return NextResponse.json({
        success: true,
        stages: [],
        message: "No se encontraron etapas en las variables del proceso"
      });
    }

    
    let stages;
    try {
      if (typeof colaboracionesDisponibles === 'string') {
        stages = JSON.parse(colaboracionesDisponibles);
        console.log(" Etapas parseadas correctamente desde string JSON");
      } else {
        stages = colaboracionesDisponibles;
        
      }
    } catch (parseError) {
      console.error(" Error parseando JSON:", parseError);
      console.log("Valor que falló:", colaboracionesDisponibles);
      stages = [];
    }



    return NextResponse.json({
      success: true,
      stages,
      taskId: primeraTarea.id,
      processInstanceId: caseId,
      taskName: primeraTarea.displayName || primeraTarea.name
    });

  } catch (err: any) {
    console.error(" ERROR CRÍTICO:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) }, 
      { status: 500 }
    );
  }
}