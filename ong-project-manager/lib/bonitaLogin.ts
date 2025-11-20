interface BonitaSession {
  id: number;
  tenant_id: string;
  user_id: string;
  user_name: string;
  last_connection: string;
}

/**
 * Login a Bonita y devuelve cookies, token y sesión
 */
export async function loginToBonita(username: string, password: string) {
  try {
    console.log("[Bonita] Iniciando login para usuario:", username);

    const res = await fetch(`${process.env.BONITA_URL}/loginservice`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
    });

    console.log("[Bonita] Respuesta login status:", res.status);
    if (!res.ok) throw new Error(`Error al hacer login en Bonita: ${res.status} ${res.statusText}`);

    const cookies = res.headers.get("set-cookie") ?? "";
    console.log("[Bonita] Cookies recibidas:", cookies);

    const token = cookies.match(/X-Bonita-API-Token=([^;]+)/)?.[1] ?? "";
    console.log("[Bonita] Token extraído:", token);
    if (!token) throw new Error("No llegó X-Bonita-API-Token en login");

    const sesRes = await fetch(`${process.env.BONITA_URL}/API/system/session/1`, {
      headers: { Cookie: cookies, "X-Bonita-API-Token": token },
    });

    console.log("[Bonita] Respuesta session status:", sesRes.status);
    if (!sesRes.ok) throw new Error(`No pude leer la sesión de Bonita: ${sesRes.status} ${sesRes.statusText}`);

    const session = (await sesRes.json()) as BonitaSession;
    console.log("[Bonita] Sesión obtenida:", session);

    return { cookies, token, session };
  } catch (err: any) {
    console.error("[Bonita][API] Error en loginToBonita:", err.message);
    throw err;
  }
}

/**
 * Logout de Bonita usando cookie y token
 */
export async function logoutFromBonita(cookies: string, token: string) {
  try {
    console.log("[Bonita] Iniciando logout...");

    const res = await fetch(`${process.env.BONITA_URL}/logoutservice`, {
      method: "POST",
      headers: { 
        Cookie: cookies,
        "X-Bonita-API-Token": token,
      },
    });

    console.log("[Bonita] Logout status:", res.status);
    if (!res.ok) throw new Error(`Error al hacer logout en Bonita: ${res.status} ${res.statusText}`);

    console.log("[Bonita] Logout exitoso");
  } catch (err: any) {
    console.error("[Bonita][API] Error en logoutFromBonita:", err.message);
    throw err;
  }
}