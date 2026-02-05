'use client';

import { useProposal } from '@/contexts/ProposalContext';
import { DynamicDescriptionEditor } from '@/components/DynamicDescriptionEditor';
import { ALL_SERVICES } from '@/lib/services';

/**
 * Example showing how to use dynamic bullet point editing
 */
export default function DynamicDescriptionExample() {
  const {
    state,
    addService,
    removeService,
    updateServiceDescription,
    isServiceActive
  } = useProposal();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Dynamic Service Descriptions</h1>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="font-semibold mb-2">💡 How It Works:</h2>
        <ul className="text-sm space-y-1 list-disc list-inside">
          <li>Service descriptions come from <code>service_description.js</code></li>
          <li>Fields marked with <strong>XXX</strong>, <strong>xx</strong>, or <strong>○ xxx</strong> are editable</li>
          <li><span className="bg-yellow-200 px-1">Yellow highlighted</span> items need to be filled in</li>
          <li>You can add custom bullet points and sub-bullets</li>
          <li>XXX placeholders auto-replace with quantity/project name</li>
        </ul>
      </div>

      {/* Service Selection */}
      <section className="mb-8 p-6 bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Select Services</h2>
        
        <div className="grid grid-cols-2 gap-2">
          {ALL_SERVICES.slice(0, 6).map(service => (
            <label key={service.id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
              <input
                type="checkbox"
                className="mr-3"
                checked={isServiceActive(service.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    addService(service.id);
                  } else {
                    removeService(service.id);
                  }
                }}
              />
              <span className="text-sm">{service.name}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Service Descriptions */}
      {state.services.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          Select a service above to see its editable description
        </div>
      ) : (
        <div className="space-y-6">
          {state.services.map(service => (
            <section key={service.id} className="p-6 bg-white rounded-lg shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{service.name}</h3>
                  <div className="text-sm text-gray-600 mt-1">
                    Quantity: {service.quantity} | 
                    Price: {service.unitPrice}€ | 
                    Total: {service.totalPrice}€
                  </div>
                </div>
                <button
                  onClick={() => removeService(service.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  ✕ Remove
                </button>
              </div>

              {/* Quantity Control */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  className="border rounded px-3 py-2 w-32"
                  value={service.quantity}
                  onChange={(e) => {
                    const { updateService } = useProposal();
                    updateService(service.id, {
                      quantity: parseInt(e.target.value) || 1
                    });
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Changes "XXX" in description to {service.quantity}
                </p>
              </div>

              {/* Description Editor */}
              {service.customDescription && service.customDescription.length > 0 && (
                <div className="border-t pt-4">
                  <DynamicDescriptionEditor
                    description={service.customDescription}
                    onChange={(newDescription) => {
                      updateServiceDescription(service.id, newDescription);
                    }}
                  />
                </div>
              )}

              {/* Show what will be in final document */}
              <div className="mt-4 p-4 bg-gray-50 rounded">
                <h4 className="text-sm font-semibold mb-2">Preview (Final Document):</h4>
                <div className="text-sm text-gray-700">
                  {(() => {
                    const { getFormattedDescription } = useProposal();
                    const formatted = getFormattedDescription(service.id);
                    return (
                      <ul className="space-y-1">
                        {formatted.map((item, idx) => {
                          const text = typeof item === 'string' ? item : item.text;
                          return (
                            <li key={idx} className="flex gap-2">
                              <span>•</span>
                              <span>{text}</span>
                            </li>
                          );
                        })}
                      </ul>
                    );
                  })()}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Example Scenarios */}
      <section className="mt-8 p-6 bg-green-50 rounded-lg border border-green-200">
        <h2 className="font-semibold mb-3">🎯 Try These Scenarios:</h2>
        <ol className="space-y-2 text-sm list-decimal list-inside">
          <li>
            <strong>Add "3D-Außenvisualisierung"</strong> - 
            You'll see editable "○ xxx" placeholders for perspectives
          </li>
          <li>
            <strong>Change the quantity</strong> - 
            Watch "XXX" in description update to the new quantity
          </li>
          <li>
            <strong>Click yellow highlighted items</strong> - 
            Fill in specific details for your project
          </li>
          <li>
            <strong>Add custom bullets</strong> - 
            Click "+ Add Bullet Point" to add project-specific details
          </li>
          <li>
            <strong>Remove placeholders</strong> - 
            Hover and click "×" to remove unwanted bullet points
          </li>
        </ol>
      </section>
    </div>
  );
}
