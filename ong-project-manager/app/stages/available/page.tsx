'use client';

import { useState, useEffect } from 'react';

interface Etapa {
  id: number;
  id_externa: string;
  nombre: string;
  descripcion: string;
  is_completed: boolean;
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
  const [taskId, setTaskId] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAvailableEtapas();
  }, []);

  const loadAvailableEtapas = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("Cargando etapas...");
      const response = await fetch('/api/collaboration/available');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error al cargar etapas');
      }
      
      setEtapas(data.stages);
      setTaskId(data.taskId);
      setCaseId(data.caseId);
      
      
    } catch (err: any) {
      console.error(' Error cargando etapas:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCollaborate = async (etapaId: number) => {
      if (!taskId) return;
      console.log("🟡 Llamando a API...");
      try {
        // 1. Confirmación del usuario
        const etapaNombre = etapas.find(e => e.id === etapaId)?.nombre;
        const confirmar = window.confirm(
          `¿Estás seguro de que quieres colaborar en la etapa "${etapaNombre}"?`
        );       
        if (!confirmar) return;
        // 2. Llamar a tu API para completar la tarea en Bonita
        const response = await fetch('/api/collaboration/collaborate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            taskId,
            caseId,
            etapaId: etapaId.toString()
          })
        });

        const result = await response.json();
        if (result.success) {
          alert(`¡Éxito! Ahora estás colaborando en: ${etapaNombre}`);
          loadAvailableEtapas();
          
        } else {
          throw new Error(result.error);
        }
      } catch (error: any) {
        console.error('Error colaborando:', error);
        alert('Error al colaborar: ' + error.message);
      }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando etapas disponibles...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">{error}</p>
          <button
            onClick={loadAvailableEtapas}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Etapas Disponibles para Colaboración
          </h1>
          <p className="text-gray-600 mb-8">
            Explora oportunidades de colaboración en proyectos de otras ONGs
          </p>

          {etapas.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <p className="text-gray-500 text-lg">
                No hay etapas disponibles para colaboración en este momento.
              </p>
              <p className="text-gray-400 mt-2">
                Las etapas aparecerán aquí cuando otros usuarios creen proyectos y habiliten colaboraciones.
              </p>
            </div>
          ) : (
            <div className="grid gap-6">
              {etapas.map((etapa) => (
                <div key={etapa.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-800">
                        {etapa.nombre}
                      </h3>
                      <p className="text-gray-600 mt-1">
                        Proyecto: <strong>{etapa.proyecto.nombre}</strong>
                      </p>
                      <p className="text-gray-500 text-sm mt-1">
                        {etapa.proyecto.descripcion}
                      </p>
                    </div>
                    
                    <button
                      onClick={() => handleCollaborate(etapa.id)}
                      disabled={etapa.is_completed}
                      className={`ml-4 px-6 py-2 rounded-lg font-medium transition-colors ${
                        etapa.is_completed
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-green-500 hover:bg-green-600 text-white'
                      }`}
                    >
                      {etapa.is_completed ? 'No Disponible' : 'Colaborar'}
                    </button>
                    
                  </div>

                  <p className="text-gray-700 mb-4">{etapa.descripcion}</p>

                  {/* Estado */}
                  <div className="flex items-center mb-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        etapa.is_completed
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {etapa.is_completed ? 'Completada' : 'Disponible'}
                    </span>
                    
                    {etapa.observaciones && etapa.observaciones.length > 0 && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {etapa.observaciones.length} observación(es)
                      </span>
                    )}
                  </div>

                  {/* Información adicional */}
                  <div className="text-sm text-gray-500">
                    <p>ID: {etapa.id_externa || etapa.id}</p>
                    {etapa.ong_ejecutora && (
                      <p>ONG Ejecutora: {etapa.ong_ejecutora.nombre}</p>
                    )}
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