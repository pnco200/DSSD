import { NextResponse } from "next/server";
import { 
  getBonitaAuth, 
  findCaseByLocalId, 
  findArchivedCaseByLocalId, // Importar nueva función
  getCaseVarJsonString, 
  getArchivedCaseVarJsonString, // Importar nueva función
  assignTask, 
  completeTask 
} from "@/lib/bonita-utils";
import { authUser } from "@/lib/auth";

const PROCESS_NAME = process.env.BONITA_PROCESS_NAME ?? "Proceso Project Planning";
const REPORT_TASK_NAME = "Generar informe de proyecto finalizado";

export async function POST(request: Request) {
  try {
    const user = await authUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id_proyecto } = await request.json();
    const bonitaAuth = await getBonitaAuth();

    let reportData = [];
    let isArchived = false;

    // ---------------------------------------------------------
    // INTENTO 1: Buscar en Casos ACTIVOS (Flujo normal)
    // ---------------------------------------------------------
    let caseId = await findCaseByLocalId(bonitaAuth, PROCESS_NAME, id_proyecto);

    if (caseId) {
      // El caso está activo. Buscamos si la tarea existe para completarla.
      const urlTasks = `${process.env.BONITA_URL}/API/bpm/humanTask?f=caseId=${caseId}&p=0&c=50`;
      const resTasks = await fetch(urlTasks, { headers: { Cookie: bonitaAuth.cookies, "X-Bonita-API-Token": bonitaAuth.token }});
      const tasks = await resTasks.json();

      const reportTask = tasks.find((t: any) => t.name === REPORT_TASK_NAME || t.displayName === REPORT_TASK_NAME);

      if (reportTask) {
        // Si la tarea existe, la asignamos y completamos (Primera vez)
        if (reportTask.assigned_id !== bonitaAuth.session.user_id) {
            await assignTask({ cookies: bonitaAuth.cookies, token: bonitaAuth.token, taskId: reportTask.id, userId: bonitaAuth.session.user_id });
        }
        await completeTask({ cookies: bonitaAuth.cookies, token: bonitaAuth.token, taskId: reportTask.id });
        
        // Nota: Al completar la tarea, el caso podría pasar a estado "Archived" inmediatamente 
        // si era la última tarea. Pero la variable suele estar disponible en cache unos milisegundos.
        // Si falla leer la variable activa, caeremos en el bloque de abajo.
      }

      // Intentar leer variable ACTIVA
      try {
        const rawReport = await getCaseVarJsonString({
            cookies: bonitaAuth.cookies,
            token: bonitaAuth.token,
            caseId,
            varName: "info_reporte"
        });
        reportData = typeof rawReport === 'string' ? JSON.parse(rawReport) : rawReport;
        return NextResponse.json({ success: true, status: "active", reporte: reportData });
      } catch (e) {
        console.log("No se pudo leer variable activa, intentando buscar como archivado...");
        // Si falla, es probable que al completar la tarea el caso se archivó al instante.
        // Dejamos que siga al bloque de abajo.
      }
    }

    // ---------------------------------------------------------
    // INTENTO 2: Buscar en Casos ARCHIVADOS (Histórico)
    // ---------------------------------------------------------
    // Si llegamos acá, es porque findCaseByLocalId retornó null (ya no está activo)
    // o porque falló la lectura de la variable activa.
    
    const archivedCaseId = await findArchivedCaseByLocalId(bonitaAuth, PROCESS_NAME, id_proyecto);

    if (archivedCaseId) {
      const rawReportArchived = archivedCaseId
      if (rawReportArchived) {
        reportData = typeof rawReportArchived === 'string' ? JSON.parse(rawReportArchived) : rawReportArchived;
        return NextResponse.json({ success: true, status: "archived", reporte: reportData });
      }
    }

    return NextResponse.json({ 
      error: "No se encontró el reporte ni en procesos activos ni en el historial." 
    }, { status: 404 });

  } catch (error: any) {
    console.error("Error generando/obteniendo reporte:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}