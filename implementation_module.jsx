import React, { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  Users2,
  CalendarClock,
  CalendarOff,
  Banknote,
  Network,
  Check,
  X,
  Search,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Design tokens — kept deliberately plain
// ---------------------------------------------------------------------------
const C = {
  paper: "#F6F7F9",
  card: "#FFFFFF",
  border: "#E4E7EC",
  text: "#1B2434",
  sub: "#68717F",
  teal: "#0E7C6B",
  tealSoft: "#E7F3F1",
  amber: "#C77C1F",
  amberSoft: "#FBF1E2",
  slateSoft: "#EEF0F3",
};

// ---------------------------------------------------------------------------
// tab_id -> module, and every mod_id grouped under it.
// mod_id / names are taken directly from the real ModuleMaster rows shared
// (12 Departments, 13 Designations, 35 Company Details, 42 Shift, 64 Onboard
// Employees, etc.) tab_id 1 = Employee and tab_id 5 = Organization are
// confirmed from the hrm_client_checklist sample; tab_id 3 (Leave) and
// tab_id 4 (Payroll) are assumed — correct these if your actual IDs differ.
// ---------------------------------------------------------------------------
const MODULES = [
  {
    tab_id: 1,
    key: "employee",
    label: "Employee",
    Icon: Users2,
    features: [{ mod_id: 64, name: "Onboard Employees" }],
  },
  {
    tab_id: 2,
    key: "attendance",
    label: "Attendance",
    Icon: CalendarClock,
    features: [
      { mod_id: 42, name: "Shift" },
      { mod_id: 185, name: "Projects" },
      { mod_id: 186, name: "Tasks" },
      { mod_id: 187, name: "Settings of Timesheet" },
      { mod_id: 502, name: "Regularization Settings" },
    ],
  },
  {
    tab_id: 3,
    key: "leave",
    label: "Leave",
    Icon: CalendarOff,
    features: [
      { mod_id: 31, name: "Leave Type Settings" },
      { mod_id: 193, name: "Import Leave Balance" },
    ],
  },
  {
    tab_id: 4,
    key: "payroll",
    label: "Payroll",
    Icon: Banknote,
    features: [
      { mod_id: 41, name: "Salary Heads" },
      { mod_id: 455, name: "Payroll Heads" },
      { mod_id: 474, name: "EPF Settings" },
      { mod_id: 478, name: "ESIC Settings" },
      { mod_id: 485, name: "Professional Tax Settings" },
      { mod_id: 509, name: "Labour Welfare Fund" },
    ],
  },
  {
    tab_id: 5,
    key: "organization",
    label: "Organization",
    Icon: Network,
    features: [
      { mod_id: 12, name: "Departments" },
      { mod_id: 13, name: "Designations" },
      { mod_id: 14, name: "Divisions" },
      { mod_id: 29, name: "Holidays" },
      { mod_id: 32, name: "Locations" },
      { mod_id: 35, name: "Company Details" },
      { mod_id: 54, name: "Company Policy" },
      { mod_id: 145, name: "Hierarchy" },
    ],
  },
];

const stamp = () =>
  new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

// ---------------------------------------------------------------------------
// Seed data — shaped exactly like hrm_client_checklist rows (per org_id,
// tab_id, mod_id). tab_sts (hrm_tab_checklist) is derived, not stored.
// ---------------------------------------------------------------------------
function buildChecklist(onModIds) {
  const rows = {};
  MODULES.forEach((m) =>
    m.features.forEach((f) => {
      const on = onModIds.includes(f.mod_id);
      rows[f.mod_id] = {
        approval_status: on ? 1 : 0,
        remark: "",
        started_at: on ? stamp() : null,
        completed_at: on ? stamp() : null,
      };
    })
  );
  return rows;
}

function seedClients() {
  const raw = [
    { org_id: 478190, name: "ABC Industries", on: [64, 42, 12, 13, 35] },
    { org_id: 480581, name: "XYZ Ltd", on: [64, 41, 455] },
    { org_id: 480606, name: "PQR Solutions", on: [] },
    { org_id: 469812, name: "LMN Group", on: [64, 42, 185, 186, 31, 193, 12, 13, 14, 32] },
    { org_id: 448120, name: "Kestrel Logistics", on: MODULES.flatMap((m) => m.features.map((f) => f.mod_id)) },
  ];
  return raw.map((c, i) => ({ id: i + 1, org_id: c.org_id, name: c.name, checklist: buildChecklist(c.on) }));
}

function moduleApprovedCount(client, module) {
  return module.features.filter((f) => client.checklist[f.mod_id].approval_status === 1).length;
}
// mirrors hrm_tab_checklist.tab_sts: 1 only if every mod_id under the tab is approved
function tabSts(client, module) {
  return moduleApprovedCount(client, module) === module.features.length ? 1 : 0;
}

// ---------------------------------------------------------------------------
// UI bits
// ---------------------------------------------------------------------------
function TabBadge({ client, module }) {
  const approved = moduleApprovedCount(client, module);
  const total = module.features.length;
  if (approved === 0) {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: C.slateSoft, color: C.sub }}>
        Not started
      </span>
    );
  }
  if (approved === total) {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: C.tealSoft, color: C.teal }}>
        Complete · tab_sts 1
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: C.amberSoft, color: C.amber }}>
      In progress · {approved}/{total}
    </span>
  );
}

function ModuleSection({ client, module, onToggle, onRemark }) {
  const [open, setOpen] = useState(false);
  const approved = moduleApprovedCount(client, module);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: C.card }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: C.slateSoft }}>
          <module.Icon size={15} color={C.text} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">{module.label}</div>
          <div className="text-[11px]" style={{ color: C.sub }}>
            tab_id {module.tab_id} · {approved}/{module.features.length} features approved
          </div>
        </div>
        <TabBadge client={client} module={module} />
        {open ? <ChevronUp size={16} color={C.sub} /> : <ChevronDown size={16} color={C.sub} />}
      </button>

      {open && (
        <div className="border-t" style={{ borderColor: C.border }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: C.paper }}>
                <th className="text-left font-medium px-4 py-2 text-xs" style={{ color: C.sub }}>mod_id</th>
                <th className="text-left font-medium px-4 py-2 text-xs" style={{ color: C.sub }}>Feature</th>
                <th className="text-left font-medium px-4 py-2 text-xs" style={{ color: C.sub }}>Status</th>
                <th className="text-left font-medium px-4 py-2 text-xs" style={{ color: C.sub }}>Remark</th>
                <th className="text-left font-medium px-4 py-2 text-xs" style={{ color: C.sub }}>Started</th>
                <th className="text-left font-medium px-4 py-2 text-xs" style={{ color: C.sub }}>Completed</th>
              </tr>
            </thead>
            <tbody>
              {module.features.map((f) => {
                const row = client.checklist[f.mod_id];
                const on = row.approval_status === 1;
                return (
                  <tr key={f.mod_id} className="border-t" style={{ borderColor: C.border }}>
                    <td className="px-4 py-2 text-xs" style={{ color: C.sub }}>{f.mod_id}</td>
                    <td className="px-4 py-2 font-medium">{f.name}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => onToggle(f.mod_id)}
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{
                          background: on ? C.tealSoft : C.slateSoft,
                          color: on ? C.teal : C.sub,
                        }}
                      >
                        {on ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                        {on ? "Approved" : "Pending"}
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={row.remark}
                        onChange={(e) => onRemark(f.mod_id, e.target.value)}
                        placeholder="—"
                        className="w-full bg-transparent text-xs outline-none border-b border-transparent focus:border-current"
                        style={{ color: C.text }}
                      />
                    </td>
                    <td className="px-4 py-2 text-xs" style={{ color: C.sub }}>{row.started_at || "—"}</td>
                    <td className="px-4 py-2 text-xs" style={{ color: C.sub }}>{row.completed_at || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function ImplementationChecklist() {
  const [clients, setClients] = useState(seedClients);
  const [selectedId, setSelectedId] = useState(1);
  const [query, setQuery] = useState("");

  const selected = clients.find((c) => c.id === selectedId) || clients[0];
  const filteredClients = clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  function toggle(modId) {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== selected.id) return c;
        const row = c.checklist[modId];
        const nextOn = row.approval_status === 0;
        return {
          ...c,
          checklist: {
            ...c.checklist,
            [modId]: {
              ...row,
              approval_status: nextOn ? 1 : 0,
              started_at: nextOn ? row.started_at || stamp() : null,
              completed_at: nextOn ? stamp() : null,
            },
          },
        };
      })
    );
  }

  function setRemark(modId, value) {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== selected.id) return c;
        return { ...c, checklist: { ...c.checklist, [modId]: { ...c.checklist[modId], remark: value } } };
      })
    );
  }

  const totalFeatures = MODULES.reduce((a, m) => a + m.features.length, 0);
  const approvedFeatures = MODULES.reduce((a, m) => a + moduleApprovedCount(selected, m), 0);

  return (
    <div className="min-h-screen w-full" style={{ background: C.paper, fontFamily: "Inter, sans-serif", color: C.text }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>

      <div className="mx-auto max-w-[880px] px-6 py-8">
        <h1 className="text-xl font-bold">Implementation Checklist</h1>
        <p className="text-sm mt-1" style={{ color: C.sub }}>
          One row per module (tab_id), one line item per feature (mod_id) — mirrors hrm_client_checklist.
        </p>

        {/* client picker */}
        <div className="mt-5 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <Search size={14} color={C.sub} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search client…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {filteredClients.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                background: c.id === selected.id ? C.text : C.card,
                color: c.id === selected.id ? "#fff" : C.text,
                border: `1px solid ${c.id === selected.id ? C.text : C.border}`,
              }}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* selected client summary */}
        <div className="mt-6 flex items-center justify-between rounded-xl px-4 py-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div>
            <div className="text-sm font-semibold">{selected.name}</div>
            <div className="text-xs font-mono" style={{ color: C.sub }}>org_id {selected.org_id}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold">{approvedFeatures}/{totalFeatures} features approved</div>
            <div className="mt-1 h-1.5 w-40 rounded-full" style={{ background: C.slateSoft }}>
              <div
                className="h-1.5 rounded-full"
                style={{ width: `${(approvedFeatures / totalFeatures) * 100}%`, background: C.teal, transition: "width 300ms ease" }}
              />
            </div>
          </div>
        </div>

        {/* modules */}
        <div className="mt-4 space-y-3">
          {MODULES.map((m) => (
            <ModuleSection key={m.key} client={selected} module={m} onToggle={toggle} onRemark={setRemark} />
          ))}
        </div>
      </div>
    </div>
  );
}
