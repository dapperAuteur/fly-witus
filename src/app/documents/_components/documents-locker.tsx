"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AIRCRAFT_DOCUMENT_KINDS,
  AIRCRAFT_DOCUMENT_LABELS,
  CREDENTIAL_KINDS,
  CREDENTIAL_LABELS,
  KIND_NOTES,
  classifyExpiry,
  type AircraftDocumentKind,
  type CredentialKind,
  type ExpiryStatus,
} from "@/lib/documents-api";

interface Credential {
  id: string;
  kind: CredentialKind;
  label: string | null;
  referenceNumber: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  notes: string | null;
}

interface AircraftDoc {
  id: string;
  aircraftId: string;
  kind: AircraftDocumentKind;
  label: string | null;
  referenceNumber: string | null;
  onBoard: boolean;
  issuedOn: string | null;
  expiresOn: string | null;
  notes: string | null;
}

interface Aircraft {
  id: string;
  name: string;
  model: string | null;
}

const STATUS_STYLES: Record<ExpiryStatus, string> = {
  expired:
    "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
  expiring:
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  current:
    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  "not-tracked":
    "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-600",
};

const STATUS_WORDS: Record<ExpiryStatus, string> = {
  expired: "Expired",
  expiring: "Expiring",
  current: "Current",
  "not-tracked": "Not tracked",
};

export const DocumentsLocker: React.FC = () => {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [documents, setDocuments] = useState<AircraftDoc[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [credRes, docRes, acRes] = await Promise.all([
        fetch("/api/documents/credentials"),
        fetch("/api/documents/aircraft"),
        fetch("/api/aircraft-profiles"),
      ]);

      if (credRes.status === 401) {
        setError("Sign in to use the documents locker.");
        return;
      }
      if (!credRes.ok || !docRes.ok) {
        setError("Couldn't load your documents. Try again in a moment.");
        return;
      }

      setCredentials((await credRes.json()).credentials ?? []);
      setDocuments((await docRes.json()).documents ?? []);
      setAircraft(acRes.ok ? ((await acRes.json()).profiles ?? []) : []);
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addCredential = async (kind: CredentialKind, expiresOn: string, label: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/documents/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          label: label || null,
          expiresOn: expiresOn || null,
        }),
      });
      if (res.ok) await load();
      else setError("Couldn't save that. Check the date and try again.");
    } finally {
      setSaving(false);
    }
  };

  const addDocument = async (
    aircraftId: string,
    kind: AircraftDocumentKind,
    expiresOn: string,
    onBoard: boolean,
  ) => {
    setSaving(true);
    try {
      const res = await fetch("/api/documents/aircraft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aircraftId, kind, expiresOn: expiresOn || null, onBoard }),
      });
      if (res.ok) await load();
      else setError("Couldn't save that. Check the date and try again.");
    } finally {
      setSaving(false);
    }
  };

  const removeCredential = async (id: string) => {
    if (!confirm("Remove this credential?")) return;
    await fetch(`/api/documents/credentials/${id}`, { method: "DELETE" });
    await load();
  };

  const removeDocument = async (id: string) => {
    if (!confirm("Remove this document?")) return;
    await fetch(`/api/documents/aircraft/${id}`, { method: "DELETE" });
    await load();
  };

  const toggleOnBoard = async (doc: AircraftDoc) => {
    await fetch(`/api/documents/aircraft/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onBoard: !doc.onBoard }),
    });
    await load();
  };

  if (loading) return <p className="text-muted-foreground">Loading your documents…</p>;

  if (error) {
    return (
      <div className="p-4 rounded-lg border border-border bg-muted">
        <p className="text-sm text-card-foreground">{error}</p>
        <button
          onClick={() => void load()}
          className="mt-3 px-4 py-2 border border-border rounded-lg hover:bg-card text-sm font-semibold"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <CredentialsSection
        credentials={credentials}
        saving={saving}
        onAdd={addCredential}
        onRemove={removeCredential}
      />
      <AircraftDocumentsSection
        documents={documents}
        aircraft={aircraft}
        saving={saving}
        onAdd={addDocument}
        onRemove={removeDocument}
        onToggleOnBoard={toggleOnBoard}
      />
    </div>
  );
};

const StatusChip: React.FC<{ expiresOn: string | null }> = ({ expiresOn }) => {
  const view = classifyExpiry(expiresOn);
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${STATUS_STYLES[view.status]}`}
      title={view.message}
    >
      {STATUS_WORDS[view.status]}
    </span>
  );
};

const CredentialsSection: React.FC<{
  credentials: Credential[];
  saving: boolean;
  onAdd: (kind: CredentialKind, expiresOn: string, label: string) => void;
  onRemove: (id: string) => void;
}> = ({ credentials, saving, onAdd, onRemove }) => {
  const [kind, setKind] = useState<CredentialKind>("pilot_certificate");
  const [expiresOn, setExpiresOn] = useState("");
  const [label, setLabel] = useState("");

  const note = KIND_NOTES[kind];

  return (
    <section className="bg-card text-card-foreground rounded-2xl shadow-lg p-6 border-t-4 border-sky-500">
      <h2 className="text-2xl font-bold mb-1">Your credentials</h2>
      <p className="text-sm text-muted-foreground mb-4">
        What you carry as a pilot. Add only what applies to the flying you actually do.
      </p>

      <form
        className="mb-5 p-4 bg-muted rounded-lg border border-border"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(kind, expiresOn, label);
          setExpiresOn("");
          setLabel("");
        }}
      >
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="cred-kind" className="text-xs font-semibold text-muted-foreground block mb-1">
              Credential
            </label>
            <select
              id="cred-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as CredentialKind)}
              className="w-full px-2 py-1.5 text-sm border border-border rounded focus:ring-2 focus:ring-sky-500"
            >
              {CREDENTIAL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {CREDENTIAL_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cred-label" className="text-xs font-semibold text-muted-foreground block mb-1">
              Label (optional)
            </label>
            <input
              id="cred-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Third class"
              className="w-full px-2 py-1.5 text-sm border border-border rounded focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label htmlFor="cred-expiry" className="text-xs font-semibold text-muted-foreground block mb-1">
              Expires (optional)
            </label>
            <input
              id="cred-expiry"
              type="date"
              value={expiresOn}
              onChange={(e) => setExpiresOn(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-border rounded focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {note && <p className="text-xs text-muted-foreground mt-2">{note}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-3 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-semibold text-sm disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add credential"}
        </button>
      </form>

      {credentials.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing added yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {credentials.map((cred) => (
            <li key={cred.id} className="py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-card-foreground">
                  {CREDENTIAL_LABELS[cred.kind]}
                  {cred.label && (
                    <span className="ml-2 font-normal text-muted-foreground">{cred.label}</span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {classifyExpiry(cred.expiresOn).message}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusChip expiresOn={cred.expiresOn} />
                <button
                  onClick={() => onRemove(cred.id)}
                  className="text-sm text-muted-foreground hover:text-red-600 underline"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const AircraftDocumentsSection: React.FC<{
  documents: AircraftDoc[];
  aircraft: Aircraft[];
  saving: boolean;
  onAdd: (
    aircraftId: string,
    kind: AircraftDocumentKind,
    expiresOn: string,
    onBoard: boolean,
  ) => void;
  onRemove: (id: string) => void;
  onToggleOnBoard: (doc: AircraftDoc) => void;
}> = ({ documents, aircraft, saving, onAdd, onRemove, onToggleOnBoard }) => {
  const [aircraftId, setAircraftId] = useState("");
  const [kind, setKind] = useState<AircraftDocumentKind>("airworthiness_certificate");
  const [expiresOn, setExpiresOn] = useState("");
  const [onBoard, setOnBoard] = useState(false);

  useEffect(() => {
    if (!aircraftId && aircraft.length > 0) setAircraftId(aircraft[0].id);
  }, [aircraft, aircraftId]);

  const note = KIND_NOTES[kind];

  return (
    <section className="bg-card text-card-foreground rounded-2xl shadow-lg p-6 border-t-4 border-fuchsia-500">
      <h2 className="text-2xl font-bold mb-1">Aircraft documents</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Tracked per aircraft. &ldquo;On board&rdquo; is separate from having one at all —
        a current document sitting on your desk at home is not in the aircraft.
      </p>

      {aircraft.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add an aircraft profile first and its documents can live here.
        </p>
      ) : (
        <form
          className="mb-5 p-4 bg-muted rounded-lg border border-border"
          onSubmit={(e) => {
            e.preventDefault();
            if (!aircraftId) return;
            onAdd(aircraftId, kind, expiresOn, onBoard);
            setExpiresOn("");
            setOnBoard(false);
          }}
        >
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="doc-aircraft" className="text-xs font-semibold text-muted-foreground block mb-1">
                Aircraft
              </label>
              <select
                id="doc-aircraft"
                value={aircraftId}
                onChange={(e) => setAircraftId(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-border rounded focus:ring-2 focus:ring-fuchsia-500"
              >
                {aircraft.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.model ? ` — ${a.model}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="doc-kind" className="text-xs font-semibold text-muted-foreground block mb-1">
                Document
              </label>
              <select
                id="doc-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as AircraftDocumentKind)}
                className="w-full px-2 py-1.5 text-sm border border-border rounded focus:ring-2 focus:ring-fuchsia-500"
              >
                {AIRCRAFT_DOCUMENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {AIRCRAFT_DOCUMENT_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="doc-expiry" className="text-xs font-semibold text-muted-foreground block mb-1">
                Expires (optional)
              </label>
              <input
                id="doc-expiry"
                type="date"
                value={expiresOn}
                onChange={(e) => setExpiresOn(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-border rounded focus:ring-2 focus:ring-fuchsia-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 mt-3 text-sm text-card-foreground">
            <input
              type="checkbox"
              checked={onBoard}
              onChange={(e) => setOnBoard(e.target.checked)}
              className="w-4 h-4 accent-fuchsia-600"
            />
            This document is in the aircraft
          </label>

          {note && <p className="text-xs text-muted-foreground mt-2">{note}</p>}

          <button
            type="submit"
            disabled={saving}
            className="mt-3 px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 font-semibold text-sm disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add document"}
          </button>
        </form>
      )}

      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No aircraft documents added yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {documents.map((doc) => {
            const owner = aircraft.find((a) => a.id === doc.aircraftId);
            return (
              <li key={doc.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-card-foreground">
                    {AIRCRAFT_DOCUMENT_LABELS[doc.kind]}
                    {owner && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        {owner.name}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {classifyExpiry(doc.expiresOn).message}
                  </p>
                  <label className="inline-flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={doc.onBoard}
                      onChange={() => onToggleOnBoard(doc)}
                      className="w-3.5 h-3.5 accent-fuchsia-600"
                    />
                    In the aircraft
                  </label>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusChip expiresOn={doc.expiresOn} />
                  <button
                    onClick={() => onRemove(doc.id)}
                    className="text-sm text-muted-foreground hover:text-red-600 underline"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
