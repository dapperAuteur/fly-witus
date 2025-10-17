"use client"

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';


interface Feature {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'planned' | 'in-progress' | 'completed';
  quarter: string;
}

const ROADMAP_FEATURES: Feature[] = [
  // High Priority - Q1 2026
  { id: 'p1', title: 'Digital Signature Capture', description: 'Canvas-based signature pad for legal compliance. Auto-embed in PDF exports with timestamp.', priority: 'high', status: 'planned', quarter: 'Q1 2026' },
  { id: 'p2', title: 'Photo Attachments', description: 'Camera integration to document equipment condition, weather, and site hazards. Up to 5 photos per mission.', priority: 'high', status: 'planned', quarter: 'Q1 2026' },
  { id: 'p3', title: 'Offline Map Integration', description: 'Embedded map showing no-fly zones, airports, and restricted areas within 5-mile radius. Works offline.', priority: 'high', status: 'planned', quarter: 'Q1 2026' },
  { id: 'p4', title: 'Pre-Flight Risk Assessment', description: 'Auto-calculate risk score (1-10) based on weather, airspace, time of day, and pilot experience.', priority: 'high', status: 'planned', quarter: 'Q1 2026' },
  { id: 'p5', title: 'Maintenance Tracker', description: 'Flight hour counter with automated alerts for scheduled maintenance intervals.', priority: 'high', status: 'planned', quarter: 'Q1 2026' },
  
  // Medium Priority - Q2 2026
  { id: 'm1', title: 'Flight Time Calculator', description: 'Auto-compute elapsed time from takeoff/landing timestamps in HH:MM:SS format.', priority: 'medium', status: 'planned', quarter: 'Q2 2026' },
  { id: 'm2', title: 'Battery Health Log', description: 'Track voltage trends over time. Flag batteries showing >10% degradation with graphs.', priority: 'medium', status: 'planned', quarter: 'Q2 2026' },
  { id: 'm3', title: 'Emergency Contacts', description: 'Quick-access list for ATC, local authorities, insurance. One-tap call with GPS location share.', priority: 'medium', status: 'planned', quarter: 'Q2 2026' },
  { id: 'm4', title: 'Custom Checklist Items', description: 'Add site-specific or client-specific items. Support per-profile custom checklists.', priority: 'medium', status: 'planned', quarter: 'Q2 2026' },
  { id: 'm5', title: 'Multi-Language Support', description: 'Spanish and French translations with auto-detect browser language.', priority: 'medium', status: 'planned', quarter: 'Q2 2026' },
  
  // Nice to Have - Q3-Q4 2026
  { id: 'n1', title: 'Voice Notes', description: 'Record verbal observations during walk-around. Auto-transcribe to text and attach to items.', priority: 'low', status: 'planned', quarter: 'Q3 2026' },
  { id: 'n2', title: 'Sunset/Sunrise Calculator', description: 'Auto-fetch based on GPS. Warn if flight extends past civil twilight.', priority: 'low', status: 'planned', quarter: 'Q3 2026' },
  { id: 'n3', title: 'Wind Speed Alerts', description: 'Compare current wind to aircraft max specs. Display gust predictions.', priority: 'low', status: 'planned', quarter: 'Q3 2026' },
  { id: 'n4', title: 'Batch Export to Excel', description: 'Export all missions as CSV/XLSX with pivot tables for analysis.', priority: 'low', status: 'planned', quarter: 'Q4 2026' },
  { id: 'n5', title: 'Cloud Sync (Premium)', description: 'Optional Google Drive/Dropbox backup with end-to-end encryption. Real-time sync across devices.', priority: 'low', status: 'planned', quarter: 'Q4 2026' },
];

const RoadmapComponent: React.FC = () => {
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('all');

  const filteredFeatures = ROADMAP_FEATURES.filter(feature => {
    const priorityMatch = selectedPriority === 'all' || feature.priority === selectedPriority;
    const quarterMatch = selectedQuarter === 'all' || feature.quarter === selectedQuarter;
    return priorityMatch && quarterMatch;
  });

  const quarters = ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 border-red-300';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✓';
      case 'in-progress': return '⟳';
      case 'planned': return '○';
      default: return '○';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8 text-center">
          <Link
            href={'/'}>
            <div className="flex items-center justify-center gap-4 mb-4">
              <Image
                width={80}
                height={80}
                src="/flywitus-platypus-logo.png" 
                alt="Fly Wit Us" 
                className="h-12 w-auto"
              />
              <h1 className="text-4xl font-extrabold text-gray-900">
                Product <span className="text-sky-600">Roadmap</span>
              </h1>
            </div>
            <p className="text-gray-600">UAS Pre-Flight Checklist System - Future Features</p>
          </Link>
        </header>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Priority:</label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Nice to Have</option>
              </select>
            </div>
            
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Quarter:</label>
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="all">All Quarters</option>
                {quarters.map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Timeline View */}
        <div className="space-y-6">
          {quarters.map(quarter => {
            const quarterFeatures = filteredFeatures.filter(f => f.quarter === quarter);
            if (quarterFeatures.length === 0) return null;

            return (
              <div key={quarter} className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-sky-500">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{quarter}</h2>
                <div className="space-y-4">
                  {quarterFeatures.map(feature => (
                    <div 
                      key={feature.id} 
                      className="border-l-4 border-sky-400 pl-4 py-3 bg-gray-50 rounded-r-lg hover:bg-gray-100 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">{getStatusIcon(feature.status)}</span>
                            <h3 className="text-lg font-bold text-gray-800">{feature.title}</h3>
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getPriorityColor(feature.priority)}`}>
                              {feature.priority.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 ml-9">{feature.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Status Legend</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">○</span>
              <span className="text-sm text-gray-600">Planned</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⟳</span>
              <span className="text-sm text-gray-600">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">✓</span>
              <span className="text-sm text-gray-600">Completed</span>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-sky-500 to-blue-600 rounded-2xl shadow-xl p-8 mt-8 text-center text-white">
          <h2 className="text-3xl font-bold mb-3">Want to Contribute?</h2>
          <p className="text-lg mb-6">Help us build the future of UAS pre-flight checklists.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="https://github.com/dapperAuteur/fly-witus/blob/main/CONTRIBUTING.md"
              className="px-6 py-3 bg-white text-sky-600 rounded-lg font-bold hover:bg-gray-100 transition"
            >
              Contributor Guidelines
            </Link>
            <Link 
              href="https://github.com/dapperAuteur/fly-witus/issues"
              className="px-6 py-3 bg-sky-700 text-white rounded-lg font-bold hover:bg-sky-800 transition"
            >
              Report Issues
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-sm text-gray-500 py-6 mt-8 border-t">
          <Link
            href={'/'}>
            <div className="flex items-center justify-center gap-3 mb-2">
              <Image
                width={80}
                height={80}
                src="/flywitus-platypus-logo.png" 
                alt="Fly Wit Us" 
                className="h-12 w-auto"
              />
              <div className="text-left">
                <p className="font-bold text-gray-700">FLY WIT US</p>
                <p className="text-xs">fly.witus.online</p>
              </div>
            </div>
          </Link>
          <p>Roadmap subject to change based on user feedback and priorities.</p>
        </footer>
      </div>
    </div>
  );
};

export default RoadmapComponent;