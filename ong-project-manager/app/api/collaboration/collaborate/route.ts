import { NextResponse } from "next/server";
import { assignTask, completeTask, getBonitaAuth, getCaseVarJsonString, setCaseVarInteger, setCaseVarJsonString } from "@/lib/bonita-utils";
import { authUser, getTokenJWT } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { caseId, taskId, etapaId } = await request.json();
    
    if (!taskId || !caseId || !etapaId) {
      return NextResponse.json(
        { success: false, error: "taskId ,caseId y etapaId son requeridos" },
        { status: 400 }
      );
    }

    console.log(" Iniciando colaboración - Task:", taskId, "Etapa:", etapaId);

    const bonitaAuth = await getBonitaAuth();
    const etapasNoAdjudicadas = await getCaseVarJsonString({
          cookies: bonitaAuth.cookies,
          token: bonitaAuth.token,
          caseId: caseId,
          varName: "etapasNoAdjudicadas"
        });
        
    const tokenJWT = await getTokenJWT()  
    await setCaseVarJsonString({
          cookies: bonitaAuth.cookies,
          token: bonitaAuth.token,
          caseId: caseId,
          varName: "tokenJWT",
          value: tokenJWT,
    })
    await setCaseVarInteger({
          cookies: bonitaAuth.cookies,
          token: bonitaAuth.token,
          caseId: caseId,
          varName: "etapasNoAdjudicadas",
          value: (etapasNoAdjudicadas-1),
    })
    const usuario = await authUser();
    if (!usuario) throw new Error("No autenticado");

    await setCaseVarJsonString({
      cookies: bonitaAuth.cookies,
      token: bonitaAuth.token,
      caseId: caseId,
      varName: "idOngEjecutora",
      value: JSON.stringify({ ong_id: usuario.id_ong })
    })

    const result = await setCaseVarJsonString({
      cookies: bonitaAuth.cookies,
      token: bonitaAuth.token,
      caseId: caseId,
      varName: "etapaIdAdjudicada",
      value: etapaId
      });
    await assignTask({ cookies: bonitaAuth.cookies, token: bonitaAuth.token, taskId: taskId, userId: bonitaAuth.session.user_id })
    await completeTask({ cookies: bonitaAuth.cookies, token: bonitaAuth.token, taskId: taskId })

    console.log("Resultado:", result)
    

    return NextResponse.json({
      success: true,
      message: "Etapa adjudicada exitosamente",
      data: {
        taskId,
        caseId,
        etapaId,
        adjudicadaPor: bonitaAuth.session.user_name
      }
    });

  } catch (err: any) {
    console.error(" Error en colaboración:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}