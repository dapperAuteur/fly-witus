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

// Status here is ground truth, not aspiration. If a feature ships, flip it to
// 'completed' in the same branch that ships it (docs-sync rule in CLAUDE.md).
// A pilot reading this page uses it to decide whether the product does what
// they need — an item left at 'planned' after it ships undersells us, and an
// item marked 'completed' before it ships is a lie we can't walk back.
const ROADMAP_FEATURES: Feature[] = [
  // High Priority - Q1 2026
  { id: 'p1', title: 'Digital Signature Capture', description: 'Canvas-based signature pad for legal compliance. Auto-embed in PDF exports with timestamp.', priority: 'high', status: 'planned', quarter: 'Q1 2026' },
  { id: 'p2', title: 'Photo Attachments', description: 'Attach photos to a mission via Cloudinary to document equipment condition, weather, and site hazards. Embedded in the PDF export.', priority: 'high', status: 'completed', quarter: 'Q1 2026' },
  { id: 'p3', title: 'Offline Map Integration', description: 'Embedded map showing no-fly zones, airports, and restricted areas within 5-mile radius. Works offline.', priority: 'high', status: 'planned', quarter: 'Q1 2026' },
  { id: 'p4', title: 'Pre-Flight Risk Assessment', description: 'Weighted go/no-go score from weather versus your personal minimums, daylight margin, airspace, and external pressure. Advisory only — the PIC decides.', priority: 'high', status: 'in-progress', quarter: 'Q1 2026' },
  { id: 'p5', title: 'Maintenance Tracker', description: 'Flight hour counter with automated alerts for scheduled maintenance intervals.', priority: 'high', status: 'planned', quarter: 'Q1 2026' },

  // Medium Priority - Q2 2026
  { id: 'm1', title: 'Flight Time Calculator', description: 'Times are captured per flight today; auto-compute of elapsed time from launch and landing is in progress.', priority: 'medium', status: 'in-progress', quarter: 'Q2 2026' },
  { id: 'm2', title: 'Battery Health Log', description: 'Per-flight and per-battery voltage is captured today; trend analysis and degradation flagging are still to come.', priority: 'medium', status: 'in-progress', quarter: 'Q2 2026' },
  { id: 'm3', title: 'Emergency Contacts', description: 'Quick-access list for ATC, local authorities, insurance. One-tap call with GPS location share.', priority: 'medium', status: 'planned', quarter: 'Q2 2026' },
  { id: 'm4', title: 'Custom Checklist Items', description: 'Add site-specific or client-specific items. Support per-profile custom checklists.', priority: 'medium', status: 'planned', quarter: 'Q2 2026' },
  { id: 'm5', title: 'Multi-Language Support', description: 'Spanish and French translations with auto-detect browser language.', priority: 'medium', status: 'planned', quarter: 'Q2 2026' },

  // Nice to Have - Q3-Q4 2026
  { id: 'n1', title: 'Voice Notes', description: 'Record verbal observations during walk-around. Auto-transcribe to text and attach to items.', priority: 'low', status: 'planned', quarter: 'Q3 2026' },
  { id: 'n2', title: 'Sunset/Sunrise Calculator', description: 'Sunrise, sunset, and civil twilight computed from your launch location. Warns when a flight runs past legal daylight.', priority: 'low', status: 'in-progress', quarter: 'Q3 2026' },
  { id: 'n3', title: 'Wind Speed Alerts', description: 'Folded into Personal Minimums — forecast wind, gust, and crosswind checked against the limits you set.', priority: 'low', status: 'in-progress', quarter: 'Q3 2026' },
  { id: 'n4', title: 'Batch Export to Excel', description: 'Export all missions as CSV/XLSX with pivot tables for analysis. (A full JSON export of your data already ships under Dashboard → Account.)', priority: 'low', status: 'planned', quarter: 'Q4 2026' },
  { id: 'n5', title: 'Cloud Sync (Premium)', description: 'Signed-in missions sync to our Postgres database across every device on a paid plan, with an offline outbox that flushes on reconnect.', priority: 'low', status: 'completed', quarter: 'Q4 2026' },

  // Pilot module — see plans/08. Personal minimums and the solar engine serve
  // Part 107 operators too; the manned-aviation items build on top of them.
  { id: 'a1', title: 'Personal Minimums', description: 'Set your own limits for wind, gust, crosswind, ceiling, and visibility. Every pre-flight checks the forecast against them and flags what is outside your comfort.', priority: 'high', status: 'in-progress', quarter: 'Q3 2026' },
  { id: 'a2', title: 'IMSAFE Self-Assessment', description: 'The pilot-fitness checklist — Illness, Medication, Stress, Alcohol, Fatigue, Emotion — recorded with the flight and fed into the risk score.', priority: 'medium', status: 'planned', quarter: 'Q4 2026' },
  { id: 'a3', title: 'Documents Locker', description: 'Track pilot credentials and aircraft documents with expiry reminders. Covers Part 107 and manned-aviation operators flying both.', priority: 'medium', status: 'planned', quarter: 'Q4 2026' },
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
      default: return 'bg-gray-100 text-card-foreground border-gray-300';
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
    <div className="min-h-screen bg-background font-sans p-4 sm:p-8">
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
              <h1 className="text-4xl font-extrabold text-card-foreground">
                Product <span className="text-sky-600">Roadmap</span>
              </h1>
            </div>
            <p className="text-muted-foreground">UAS Pre-Flight Checklist System - Future Features</p>
          </Link>
        </header>

        {/* Filters */}
        <div className="bg-card text-card-foreground rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-card-foreground mb-2">Filter by Priority:</label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Nice to Have</option>
              </select>
            </div>
            
            <div className="flex-1">
              <label className="block text-sm font-semibold text-card-foreground mb-2">Filter by Quarter:</label>
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
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
              <div key={quarter} className="bg-card text-card-foreground rounded-2xl shadow-lg p-6 border-t-4 border-sky-500">
                <h2 className="text-2xl font-bold text-card-foreground mb-4">{quarter}</h2>
                <div className="space-y-4">
                  {quarterFeatures.map(feature => (
                    <div 
                      key={feature.id} 
                      className="border-l-4 border-sky-400 pl-4 py-3 bg-muted rounded-r-lg hover:bg-muted transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">{getStatusIcon(feature.status)}</span>
                            <h3 className="text-lg font-bold text-card-foreground">{feature.title}</h3>
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getPriorityColor(feature.priority)}`}>
                              {feature.priority.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground ml-9">{feature.description}</p>
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
        <div className="bg-card text-card-foreground rounded-xl shadow-lg p-6 mt-6">
          <h3 className="text-lg font-bold text-card-foreground mb-3">Status Legend</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">○</span>
              <span className="text-sm text-muted-foreground">Planned</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⟳</span>
              <span className="text-sm text-muted-foreground">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">✓</span>
              <span className="text-sm text-muted-foreground">Completed</span>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-sky-500 to-blue-600 rounded-2xl shadow-xl p-8 mt-8 text-center text-white">
          <h2 className="text-3xl font-bold mb-3">Want to Contribute?</h2>
          <p className="text-lg mb-6">Help us build the future of UAS pre-flight checklists.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="https://i.witus.online/fly-witus-contributing"
              className="px-6 py-3 bg-white text-sky-600 rounded-lg font-bold hover:bg-gray-100 transition"
            >
              Contributor Guidelines
            </Link>
            <Link 
              href="https://i.witus.online/fly-witus-issues-tracker"
              className="px-6 py-3 bg-sky-700 text-white rounded-lg font-bold hover:bg-sky-800 transition"
            >
              Report Issues
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-sm text-muted-foreground py-6 mt-8 border-t">
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
                <p className="font-bold text-card-foreground">FLY WIT US</p>
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