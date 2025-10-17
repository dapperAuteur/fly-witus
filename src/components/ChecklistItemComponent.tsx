import React, { useState, useEffect, useMemo } from 'react';

interface ChecklistSection {
  title: string;
  items: ChecklistItem[];
}

interface ChecklistItem {
  id: string;
  label: string;
  type: 'checkbox' | 'text' | 'weather';
  required?: boolean;
  subfields?: { id: string; label: string; type: 'text' | 'number' }[];
}

export const ChecklistItemComponent: React.FC<{
  item: ChecklistItem;
  checked: boolean;
  value?: string;
  subValues?: { [key: string]: string };
  weatherData?: { temperature?: string; wind?: string; precipitation?: string };
  onToggle: () => void;
  onValueChange: (value: string) => void;
  onSubValueChange: (subfieldId: string, value: string) => void;
  onWeatherChange: (field: string, value: string) => void;
}> = ({ item, checked, value, subValues, weatherData, onToggle, onValueChange, onSubValueChange, onWeatherChange }) => {
  
  if (item.type === 'weather') {
    return (
      <div className="border-l-4 border-sky-400 pl-4 py-3 bg-sky-50 rounded-r-lg">
        <label className="flex items-start font-medium text-gray-800 mb-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            className="mt-1 mr-3 w-5 h-5 accent-sky-600"
          />
          <span className={checked ? 'line-through text-gray-500' : ''}>
            {item.label} {item.required && <span className="text-red-500">*</span>}
          </span>
        </label>
        <div className="grid grid-cols-3 gap-3 ml-8">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Temperature:</label>
            <input
              type="text"
              value={weatherData?.temperature || ''}
              onChange={(e) => onWeatherChange('temperature', e.target.value)}
              placeholder="e.g., 72°F"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Wind:</label>
            <input
              type="text"
              value={weatherData?.wind || ''}
              onChange={(e) => onWeatherChange('wind', e.target.value)}
              placeholder="e.g., 5 mph NW"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Precipitation:</label>
            <input
              type="text"
              value={weatherData?.precipitation || ''}
              onChange={(e) => onWeatherChange('precipitation', e.target.value)}
              placeholder="None"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
        </div>
      </div>
    );
  }

  if (item.type === 'text') {
    return (
      <div className="flex items-center py-2">
        <label className="flex-grow font-medium text-gray-800">
          {item.label} {item.required && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onValueChange(e.target.value)}
          className="ml-4 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
        />
      </div>
    );
  }

  return (
    <div className="py-2">
      <label className="flex items-start cursor-pointer group">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1 mr-3 w-5 h-5 accent-lime-600 cursor-pointer"
        />
        <span className={`font-medium transition-all ${checked ? 'line-through text-gray-500' : 'text-gray-800 group-hover:text-lime-600'}`}>
          {item.label} {item.required && <span className="text-red-500">*</span>}
        </span>
      </label>
      
      {item.subfields && checked && (
        <div className="ml-8 mt-2 space-y-2">
          {item.subfields.map(subfield => (
            <div key={subfield.id} className="flex items-center">
              <label className="text-sm text-gray-700 w-32">{subfield.label}:</label>
              <input
                type={subfield.type}
                value={subValues?.[subfield.id] || ''}
                onChange={(e) => onSubValueChange(subfield.id, e.target.value)}
                placeholder={subfield.type === 'number' ? '0.0' : ''}
                className="ml-2 px-2 py-1 w-24 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};