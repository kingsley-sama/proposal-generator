'use client';

import React from 'react';
import { BulletPoint, isPlaceholder, hasPlaceholders } from '@/utils/descriptionHelpers';

interface Props {
  description: BulletPoint[];
  onChange: (newDescription: BulletPoint[]) => void;
  serviceData?: {
    quantity?: number;
    projectName?: string;
  };
}

/**
 * Recursive component for editing nested bullet points
 * Shows visual indentation and allows adding children at any level
 */
export function DynamicDescriptionEditor({ description, onChange, serviceData }: Props) {
  
  const updateText = (path: number[], newText: string) => {
    const newDesc = JSON.parse(JSON.stringify(description));
    let current: any = newDesc;
    
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]].children;
    }
    current[path[path.length - 1]].text = newText;
    
    onChange(newDesc);
  };

  const addChild = (path: number[]) => {
    const newDesc = JSON.parse(JSON.stringify(description));
    let current: any = newDesc;
    
    for (let i = 0; i < path.length; i++) {
      current = current[path[i]];
      if (i < path.length - 1) {
        current = current.children;
      }
    }
    
    if (!current.children) current.children = [];
    current.children.push({ text: '[Enter detail here]', children: [] });
    
    onChange(newDesc);
  };

  const addSibling = (path: number[]) => {
    const newDesc = JSON.parse(JSON.stringify(description));
    let current: any = newDesc;
    
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]].children;
    }
    
    current.splice(path[path.length - 1] + 1, 0, { 
      text: '[Enter detail here]', 
      children: [] 
    });
    
    onChange(newDesc);
  };

  const removeBullet = (path: number[]) => {
    const newDesc = JSON.parse(JSON.stringify(description));
    let current: any = newDesc;
    
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]].children;
    }
    
    current.splice(path[path.length - 1], 1);
    onChange(newDesc);
  };

  const renderBullets = (bullets: BulletPoint[], path: number[] = [], level: number = 0) => {
    return bullets.map((bullet, index) => {
      const currentPath = [...path, index];
      const needsEdit = isPlaceholder(bullet.text);
      const hasQuantity = hasPlaceholders(bullet.text);
      
      // Indentation based on nesting level
      const indent = level * 24;
      
      return (
        <div key={currentPath.join('-')} style={{ marginLeft: `${indent}px` }}>
          <div className="flex items-start gap-2 mb-2 group">
            {/* Bullet indicator */}
            <span className="mt-2 text-gray-400">
              {level === 0 ? '•' : level === 1 ? '○' : '▪'}
            </span>
            
            {/* Editable text */}
            <div className="flex-1">
              <textarea
                value={bullet.text}
                onChange={(e) => updateText(currentPath, e.target.value)}
                className={`w-full p-2 border rounded resize-none ${
                  needsEdit ? 'bg-yellow-50 border-yellow-300' : 'border-gray-300'
                } ${hasQuantity ? 'font-medium' : ''}`}
                rows={Math.max(1, Math.ceil(bullet.text.length / 60))}
                placeholder="Enter description..."
              />
              
              {needsEdit && (
                <p className="text-xs text-yellow-600 mt-1">
                  ⚠️ This field needs your input
                </p>
              )}
            </div>
            
            {/* Action buttons */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => addChild(currentPath)}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                title="Add sub-bullet"
              >
                + Child
              </button>
              <button
                onClick={() => addSibling(currentPath)}
                className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                title="Add bullet below"
              >
                + Sibling
              </button>
              <button
                onClick={() => removeBullet(currentPath)}
                className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                title="Remove"
              >
                ✕
              </button>
            </div>
          </div>
          
          {/* Recursively render children */}
          {bullet.children && bullet.children.length > 0 && (
            <div>
              {renderBullets(bullet.children, currentPath, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Service Description</h3>
        {serviceData && (
          <div className="text-xs text-gray-500">
            {serviceData.quantity && `Quantity: ${serviceData.quantity} | `}
            {serviceData.projectName && `Project: "${serviceData.projectName}"`}
          </div>
        )}
      </div>
      
      {renderBullets(description)}
      
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
        <p className="font-medium text-blue-800 mb-1">💡 Tips:</p>
        <ul className="text-blue-700 space-y-1 ml-4 list-disc">
          <li><strong>Yellow highlights</strong> = fields that need your input</li>
          <li><strong>XXX</strong> = will be replaced with quantity</li>
          <li><strong>"XXX"</strong> = will be replaced with project name</li>
          <li>Hover over any bullet to add/remove bullets</li>
          <li>Use <strong>+ Child</strong> for sub-bullets (nested levels)</li>
        </ul>
      </div>
    </div>
  );
}
