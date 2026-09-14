"use client";
import { useEffect, useState } from "react";
import { getJSON } from "../lib/format";
import { readPlans } from "../lib/plans";
import PeriodRows, { toPeriodRows } from "./PeriodRows";
import ViewModelView from "./ViewModelView";

export default function Generate({ subject, grade }) {
  const [chapters, setChapters] = useState([]);
  const [plans, setPlans] = useState([]);
  const [chNum, setChNum] = useState("");
  const [rows, setRows] = useState([{ name: "", count: 4, minutes: 45 }, { name: "", count: 1, minutes: 60 }]);
  const [view, setView] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setView(null); setNote("");
    getJSON(`/subjects/${subject}/${grade}/chapters`).then((d) => { setChapters(d.chapters); setChNum(String(d.chapters[0]?.chapter_number ?? "")); }).catch(() => setChapters([]));
    readPlans(`${subject}/${grade}`, setPlans).catch(() => setPlans([]));
  }, [subject, grade]);

  const run = async () => { setBusy(true); setView(null); setNote("");
    try {
      const sched = toPeriodRows(rows).map((r) => `${r.count}×${r.minutes}′`).join(" + ") || "—";
      const match = plans.find((p) => String(p.chapter_number) === String(chNum));
      if (match) {
        setView((await getJSON(`/plans/${subject}/${grade}/${match.filename}/view`)).view);
        setNote(`Preview — live generation is coming soon. Showing a previously generated plan for this chapter (your schedule: ${sched}).`);
      } else { setNote("Live generation is wired but deferred, and there is no saved example for this chapter yet."); }
    } finally { setBusy(false); }
  };

  return (
    <div>
      <p className="h2">Generate a lesson plan &amp; assessment.</p>
      <label className="fld" style={{ marginBottom: 16, maxWidth: 480 }}><span>Chapter</span>
        <select value={chNum} onChange={(e) => setChNum(e.target.value)}>
          {chapters.map((c) => <option key={c.chapter_number} value={c.chapter_number}>Ch {c.chapter_number} — {c.chapter_title}</option>)}
        </select></label>
      <div className="kicker" style={{ marginBottom: 9 }}>Period schedule</div>
      <PeriodRows rows={rows} setRows={setRows} />
      <button className="primary" onClick={run} disabled={busy || !chapters.length} style={{ marginBottom: 22 }}>{busy ? "Generating…" : "Generate"}</button>
      {note && <div className="note">{note}</div>}
      {view ? <ViewModelView view={view} /> : !note && <div className="empty">Pick a chapter &amp; period schedule, then Generate.</div>}
    </div>
  );
}
