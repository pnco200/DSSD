'use client';

import { useState, useEffect } from 'react';

interface Stage {
  id: string;
  nombre: string;
  descripcion: string;
  requisitos: string[];
  fechaLimite: string;
  proyecto: string;
}

export default function AvailableStagesPage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskId, setTaskId] = useState<string | null>(null);

  useEffect(() => {
    loadAvailableStages();
  }, []);

  const loadAvailableStages = async () => {
    try {
      const response = await fetch('/api/collaboration/available');
      const data = await response.json();
      
      setStages(data.stages);
      setTaskId(data.taskId);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCollaborate = async (stageId: string) => {
    if (!taskId) return;

    try {
      const response = await fetch('/api/stages/collaborate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          stageId
        })
      });

      if (response.ok) {
        alert('¡Ahora estás colaborando en esta etapa!');
        loadAvailableStages(); // Recargar lista
      }
    } catch (error) {
      alert('Error al colaborar');
      console.error(error);
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

          {stages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                No hay etapas disponibles para colaboración en este momento.
              </p>
              <p className="text-gray-400 mt-2">
                Las etapas aparecerán aquí cuando otros usuarios creen proyectos.
              </p>
            </div>
          ) : (
            <div className="grid gap-6">
              {stages.map((stage) => (
                <div key={stage.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-800">
                        {stage.nombre}
                      </h3>
                      <p className="text-gray-600 mt-1">{stage.proyecto}</p>
                    </div>
                    <button
                      onClick={() => handleCollaborate(stage.id)}
                      className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Colaborar
                    </button>
                  </div>

                  <p className="text-gray-700 mb-4">{stage.descripcion}</p>

                  {stage.requisitos && stage.requisitos.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-800 mb-2">Requisitos:</h4>
                      <ul className="list-disc list-inside text-gray-600 space-y-1">
                        {stage.requisitos.map((req, index) => (
                          <li key={index}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="text-sm text-gray-500">
                    Fecha límite: {new Date(stage.fechaLimite).toLocaleDateString()}
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