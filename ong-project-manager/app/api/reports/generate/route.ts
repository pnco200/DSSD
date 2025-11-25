import { NextResponse } from "next/server";
import { getBonitaAuth, findCaseByLocalId, getCaseVarJsonString, assignTask, completeTask } from "@/lib/bonita-utils";
import { authUser } from "@/lib/auth";

const PROCESS_NAME = process.env.BONITA_PROCESS_NAME ?? "Proceso Project Planning";
const REPORT_TASK_NAME = "Generar informe de proyecto finalizado";

export async function POST(request: Request) {
  try {
    const user = await authUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id_proyecto } = await request.json();

    const bonitaAuth = await getBonitaAuth();

    // 1. Buscar Case ID usando el ID local
    const caseId = await findCaseByLocalId(bonitaAuth, PROCESS_NAME, id_proyecto);
    
    if (!caseId) {
      return NextResponse.json({ error: "No se encontró instancia activa en Bonita para este proyecto" }, { status: 404 });
    }

    // 2. Buscar la tarea de reporte
    // Buscamos tareas "ready" o "assigned" para este caso
    const urlTasks = `${process.env.BONITA_URL}/API/bpm/humanTask?f=caseId=${caseId}&p=0&c=50`;
    const resTasks = await fetch(urlTasks, { headers: { Cookie: bonitaAuth.cookies, "X-Bonita-API-Token": bonitaAuth.token }});
    const tasks = await resTasks.json();

    const reportTask = tasks.find((t: any) => t.name === REPORT_TASK_NAME || t.displayName === REPORT_TASK_NAME);

    if (!reportTask) {
        // Quizás ya se completó o el flujo no llegó ahí
        // Intentamos devolver la variable igual por si ya finalizó
        const info = await getCaseVarJsonString({ cookies: bonitaAuth.cookies, token: bonitaAuth.token, caseId, varName: "info_reporte" });
        return NextResponse.json({ 
            message: "La tarea de reporte no está activa (quizás ya finalizó), pero aquí está la data.",
            reporte: typeof info === 'string' ? JSON.parse(info) : info 
        });
    }

    // 3. Asignar y Completar Tarea
    // Si no está asignada a mí, asignarla
    if (reportTask.assigned_id !== bonitaAuth.session.user_id) {
        await assignTask({ cookies: bonitaAuth.cookies, token: bonitaAuth.token, taskId: reportTask.id, userId: bonitaAuth.session.user_id });
    }
    
    // Completar
    await completeTask({ cookies: bonitaAuth.cookies, token: bonitaAuth.token, taskId: reportTask.id });

    // 4. Obtener la variable info_reporte FINAL
    const rawReport = await getCaseVarJsonString({
        cookies: bonitaAuth.cookies,
        token: bonitaAuth.token,
        caseId,
        varName: "info_reporte"
    });

    let reporteData = [];
    try {
        reporteData = typeof rawReport === 'string' ? JSON.parse(rawReport) : rawReport;
    } catch(e) { reporteData = [] }

    return NextResponse.json({ success: true, reporte: reporteData });

  } catch (error: any) {
    console.error("Error generando reporte:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}