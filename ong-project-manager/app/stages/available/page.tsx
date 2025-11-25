'use client';

import { useState, useEffect } from 'react';

interface Etapa {
  id: number;
  id_externa: string;
  nombre: string;
  descripcion: string;
  is_completed: boolean;
  // Campos inyectados por el backend nuevo
  _bonitaCaseId: string;
  _bonitaTaskId: string;
  ong_ejecutora: any;
  proyecto: {
    id: number;
    nombre: string;
    descripcion: string;
  };
  observaciones: any[];
}

export default function AvailableStagesPage() {
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [loading, setLoading] = useState(true);
  // ELIMINAMOS taskId y caseId globales
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAvailableEtapas();
  }, []);

  const loadAvailableEtapas = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/collaboration/available');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Error al cargar etapas');

      setEtapas(data.stages || []);

    } catch (err: any) {
      console.error('Error cargando etapas:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCollaborate = async (etapa: Etapa) => { // Recibimos el objeto completo
    // Usamos los IDs específicos de ESTA etapa
    const taskId = etapa._bonitaTaskId;
    const caseId = etapa._bonitaCaseId;

    if (!taskId || !caseId) {
      alert("Error: Información de Bonita faltante en esta etapa.");
      return;
    }

    console.log(`🟡 Colaborando en etapa ${etapa.id} (Case: ${caseId}, Task: ${taskId})`);

    try {
      const confirmar = window.confirm(
        `¿Estás seguro de que quieres colaborar en la etapa "${etapa.nombre}"?`
      );
      if (!confirmar) return;

      const response = await fetch('/api/collaboration/collaborate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,   // ID específico
          caseId,   // ID específico
          idExterna: etapa.id_externa,
          etapaId: etapa.id.toString()
        })
      });

      const result = await response.json();
      if (result.success) {
        alert(`¡Éxito! Ahora estás colaborando en: ${etapa.nombre}`);
        // 1. Recargar lista localmente
        await loadAvailableEtapas();

        // 2. Delay de 3 segundos
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 3. Refresh completo de la página
        window.location.reload();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Error colaborando:', error);
      alert('Error al colaborar: ' + error.message);
    }
  };

  if (loading) return <div className="p-8 text-center">Cargando...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Etapas Disponibles</h1>

          {etapas.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <p className="text-gray-500">No hay etapas disponibles.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {etapas.map((etapa) => (
                <div key={`${etapa.id}-${etapa._bonitaTaskId}`} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-800">{etapa.nombre}</h3>
                      <p className="text-gray-600 mt-1">Proyecto: <strong>{etapa.proyecto?.nombre}</strong></p>
                    </div>

                    <button
                      onClick={() => handleCollaborate(etapa)} // Pasamos el objeto entero
                      disabled={etapa.is_completed}
                      className={`ml-4 px-6 py-2 rounded-lg font-medium transition-colors ${etapa.is_completed
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                    >
                      {etapa.is_completed ? 'No Disponible' : 'Colaborar'}
                    </button>
                  </div>
                  <p className="text-gray-700 mb-4">{etapa.descripcion}</p>
                  <div className="text-xs text-gray-400">
                    Case: {etapa._bonitaCaseId} | Task: {etapa._bonitaTaskId}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}