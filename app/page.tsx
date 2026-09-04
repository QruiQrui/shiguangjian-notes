"use client";

import { ChangeEvent, RefObject, useEffect, useMemo, useRef, useState } from "react";
import { BookOpenText, CalendarDays, Cloud, Download, FileText, Flower2, HardDrive, Heart, Home as HomeIcon, Lightbulb, LogOut, RefreshCw, Settings2, ShieldCheck, Sparkles, Upload, X } from "lucide-react";
import { supabase } from "../lib/supabase";

type NoteType = "灵感" | "启发" | "感谢自己" | "感谢他人";
type NoteRecord = { id: string; type: NoteType; text: string; recipient?: string; createdAt: string; updatedAt: string };
type NoteChoice = { icon: string; title: string; type: NoteType; hint: string; tone: string };

const STORAGE_KEY = "shiguangjian.notes.v1";
const CARD_BACKGROUND_KEY = "shiguangjian.card-background.v1";
const DELETED_KEY = "shiguangjian.deleted.v1";
const SYNC_CODE_KEY = "shiguangjian.sync-code.v1";
const choices: NoteChoice[] = [
  { icon: "✦", title: "灵感捕捉", type: "灵感", hint: "留住一闪而过的想法", tone: "peach" },
  { icon: "“", title: "每日洞察", type: "启发", hint: "在平凡日常中看见成长", tone: "yellow" },
  { icon: "♥", title: "感恩自己", type: "感谢自己", hint: "温柔记录每一点努力", tone: "pink" },
  { icon: "✿", title: "感恩他人", type: "感谢他人", hint: "铭记他人的善意与支持", tone: "green" },
];
const labelByType = Object.fromEntries(choices.map((choice) => [choice.type, choice.title])) as Record<NoteType, string>;
const choiceIcons = { 灵感: Sparkles, 启发: Lightbulb, 感谢自己: Heart, 感谢他人: Flower2 };
const toneByType: Record<NoteType, string> = { 灵感: "peach", 启发: "yellow", 感谢自己: "pink", 感谢他人: "green" };
const monthNames = ["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"];
const PUBLIC_BASE = typeof document === "undefined" ? "/" : new URL(".", document.baseURI).pathname;
const cardTemplates = [
  { name: "微光花瓣", caption: "温柔日常", pattern: "petal", className: "card-petal", colors: [
    { name: "薄荷", background: "#fbfffd", color2: "#edf9f4", ink: "#17362c", accent: "#4fc29b" },
    { name: "丁香", background: "#fdfaff", color2: "#f1eafa", ink: "#352c43", accent: "#9a78c5" },
    { name: "蜜桃", background: "#fffaf8", color2: "#fdece7", ink: "#402d2b", accent: "#e88a76" },
    { name: "晴蓝", background: "#f9fdff", color2: "#e8f4fa", ink: "#233841", accent: "#65aeca" },
  ]},
  { name: "彩色拼片", caption: "明亮惊喜", pattern: "collage", className: "card-collage-new", colors: [
    { name: "暖阳", background: "#fffbed", color2: "#fff3c9", ink: "#342d27", accent: "#8b73d5" },
    { name: "莓果", background: "#fff7f7", color2: "#f9e2ea", ink: "#3f2932", accent: "#c75f7c" },
    { name: "湖蓝", background: "#f5fcfd", color2: "#dff1f4", ink: "#20383d", accent: "#4c99a5" },
  ]},
  { name: "静谧回响", caption: "安静郑重", pattern: "echo", className: "card-echo-new", colors: [
    { name: "雾蓝", background: "#f7f9fc", color2: "#e4eaf2", ink: "#263142", accent: "#6f87a6" },
    { name: "暖灰", background: "#fbfaf7", color2: "#ece8e1", ink: "#36322d", accent: "#8e8174" },
    { name: "深靛", background: "#202f57", color2: "#344778", ink: "#fff8e8", accent: "#f4c76d" },
  ]},
  { name: "一束郁金香", caption: "亲密柔软", pattern: "modernTulip", className: "card-tulip-new", image: `${PUBLIC_BASE}floral/tulips-clean-v3.png`, colors: [
    { name: "暖白", background: "#fffaf0", color2: "#f5ead7", ink: "#3d312c", accent: "#bd6676" },
    { name: "晨粉", background: "#fff1f4", color2: "#f7dfe7", ink: "#422d35", accent: "#bb6179" },
    { name: "雾蓝", background: "#edf6f7", color2: "#dbecef", ink: "#25363a", accent: "#c45e76" },
  ]},
] as const;

type CardColor = { name: string; background: string; color2: string; ink: string; accent: string };
type CardTemplate = typeof cardTemplates[number];

function wrapCardText(text: string, maxUnits: number) {
  const lines: string[] = [];
  text.split("\n").forEach((paragraph) => {
    let line = "";
    let units = 0;
    Array.from(paragraph).forEach((char) => {
      const charUnits = /[\u0000-\u00ff]/.test(char) ? .55 : 1;
      if (line && units + charUnits > maxUnits) {
        lines.push(line);
        line = char;
        units = charUnits;
      } else {
        line += char;
        units += charUnits;
      }
    });
    lines.push(line || " ");
  });
  return lines;
}

function blobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function CardArtwork({ record, template, color, customBackground, svgRef }: { record: NoteRecord; template: CardTemplate; color: CardColor; customBackground: string; svgRef: RefObject<SVGSVGElement | null> }) {
  const floral = !customBackground && template.pattern === "modernTulip";
  const long = record.text.length > 190;
  const medium = record.text.length > 90;
  const textX = floral ? (long ? 420 : 535) : 150;
  const textWidth = floral ? (long ? 680 : 500) : long ? 690 : 655;
  const fontSize = long ? 20 : medium ? 27 : record.text.length <= 36 ? 36 : 30;
  const lineHeight = Math.round(fontSize * 1.72);
  const lines = wrapCardText(record.text, textWidth / fontSize);
  const titleSize = Math.max(38, Math.min(52, 650 / Math.max(10, Array.from(record.recipient ? `写给 ${record.recipient}` : "谢谢你").length)));
  const titleY = long ? 165 : 195;
  const bodyY = titleY + (long ? 92 : 132);
  const footerY = 630;
  const ink = customBackground ? "#2e2925" : color.ink;
  const accent = customBackground ? "#8b6657" : color.accent;
  const footerLabel = template.pattern === "echo" ? "拾光笺" : "拾光笺 · 谢谢你";
  return <svg ref={svgRef} className="gratitude-card-svg" viewBox="0 0 1200 760" role="img" aria-label={`${record.recipient ? `写给 ${record.recipient}` : "谢谢你"}：${record.text}`} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="card-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={color.background}/><stop offset="1" stopColor={floral ? color.background : color.color2}/></linearGradient>
      <linearGradient id="custom-veil" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fffcf6" stopOpacity=".94"/><stop offset=".62" stopColor="#fffcf6" stopOpacity=".7"/><stop offset="1" stopColor="#fffcf6" stopOpacity=".12"/></linearGradient>
      <linearGradient id="floral-veil" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={color.background} stopOpacity="0"/><stop offset="1" stopColor={color.background}/></linearGradient>
      <clipPath id="card-clip"><rect x="24" y="18" width="1152" height="724" rx="52"/></clipPath>
      <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="5" stdDeviation="9" floodColor="#433328" floodOpacity=".14"/></filter>
    </defs>
    <rect x="24" y="18" width="1152" height="724" rx="52" fill="url(#card-gradient)" filter="url(#card-shadow)"/>
    <g clipPath="url(#card-clip)">
      <rect x="24" y="18" width="1152" height="724" fill="url(#card-gradient)"/>
      {customBackground && <><image href={customBackground} x="24" y="18" width="1152" height="724" preserveAspectRatio="xMidYMid slice"/><rect x="24" y="18" width="1152" height="724" fill="url(#custom-veil)"/></>}
      {floral && "image" in template && <><image href={template.image} x="14" y="26" width="470" height="716" preserveAspectRatio="xMidYMid meet"/><rect x="324" y="18" width="852" height="724" fill="url(#floral-veil)"/></>}
      {!customBackground && template.pattern === "petal" && <g fill={color.accent} fillOpacity=".13" transform="rotate(18 1000 200)"><ellipse cx="1000" cy="130" rx="52" ry="82"/><ellipse cx="1070" cy="200" rx="82" ry="52"/><ellipse cx="1000" cy="270" rx="52" ry="82"/><ellipse cx="930" cy="200" rx="82" ry="52"/><circle cx="1000" cy="200" r="9" fillOpacity=".8"/></g>}
      {!customBackground && template.pattern === "collage" && <g opacity=".82"><rect x="906" y="62" width="198" height="126" rx="4" fill="#ff806f" transform="rotate(4 1005 125)"/><path d="M1010 217 L1091 343 L929 343 Z" fill={color.accent}/></g>}
      {!customBackground && template.pattern === "echo" && <g fill="none" stroke={color.accent} strokeWidth="6" opacity=".24"><circle cx="1010" cy="175" r="54"/><circle cx="1010" cy="175" r="92"/><circle cx="1010" cy="175" r="130"/></g>}
      <text x={textX} y={titleY} fill={ink} fontFamily='"Songti SC","STSong","Noto Serif CJK SC",serif' fontSize={titleSize} fontWeight="600">{record.recipient ? `写给 ${record.recipient}` : "谢谢你"}</text>
      <text x={textX} y={bodyY} fill={ink} fontFamily='"PingFang SC","Microsoft YaHei",sans-serif' fontSize={fontSize} letterSpacing=".7">{lines.map((line,index)=><tspan key={`${line}-${index}`} x={textX} dy={index ? lineHeight : 0}>{line}</tspan>)}</text>
      <line x1={textX} y1={footerY-30} x2={textX+110} y2={footerY-30} stroke={accent} strokeWidth="3"/>
      <text x={textX} y={footerY} fill={accent} fontFamily='"Songti SC","STSong",serif' fontSize="19" letterSpacing="1">{footerLabel}</text>
    </g>
  </svg>;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeSyncCode(value: string) {
  return value.trim().replace(/\s+/g, "").replace(/[a-z]/g, (letter) => letter.toUpperCase()).slice(0, 40);
}

function validSyncCode(value: string) {
  const code = normalizeSyncCode(value);
  return Array.from(code).length >= 4;
}

function mergeNotebook(
  localRecords: NoteRecord[],
  localDeleted: Record<string, string>,
  incomingRecords: NoteRecord[] = [],
  incomingDeleted: Record<string, string> = {},
) {
  const merged = new Map<string, NoteRecord>();
  const deleted: Record<string, string> = {};
  const applyRecord = (record: NoteRecord) => {
    const deletedAt = deleted[record.id];
    if (deletedAt && deletedAt >= record.updatedAt) return;
    const current = merged.get(record.id);
    if (!current || record.updatedAt > current.updatedAt) merged.set(record.id, record);
    delete deleted[record.id];
  };
  const applyDeletion = (id: string, deletedAt: string) => {
    const newestDeletion = !deleted[id] || deletedAt > deleted[id] ? deletedAt : deleted[id];
    const current = merged.get(id);
    if (!current || newestDeletion >= current.updatedAt) {
      merged.delete(id);
      deleted[id] = newestDeletion;
    }
  };
  localRecords.forEach(applyRecord);
  Object.entries(localDeleted).forEach(([id, deletedAt]) => applyDeletion(id, deletedAt));
  incomingRecords.forEach(applyRecord);
  Object.entries(incomingDeleted).forEach(([id, deletedAt]) => applyDeletion(id, deletedAt));
  return { records: Array.from(merged.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), deleted };
}

function notebookSignature(records: NoteRecord[], deleted: Record<string, string>) {
  return JSON.stringify({
    records: records.map(({ id, updatedAt }) => [id, updatedAt]).sort(),
    deleted: Object.entries(deleted).sort(),
  });
}

export default function Home() {
  const now = new Date();
  const [view, setView] = useState<"home" | "timeline" | "month" | "data">("home");
  const [records, setRecords] = useState<NoteRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<NoteChoice | null>(null);
  const [editing, setEditing] = useState<NoteRecord | null>(null);
  const [text, setText] = useState("");
  const [recipient, setRecipient] = useState("");
  const [makeCard, setMakeCard] = useState(true);
  const [cardRecord, setCardRecord] = useState<NoteRecord | null>(null);
  const [cardTemplate, setCardTemplate] = useState(0);
  const [cardColor, setCardColor] = useState(0);
  const [customCardBackground, setCustomCardBackground] = useState("");
  const [filter, setFilter] = useState<"全部" | NoteType>("全部");
  const [selectedMonth, setSelectedMonth] = useState(monthKey(now));
  const [toast, setToast] = useState("");
  const [syncCode, setSyncCode] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [changingSyncCode, setChangingSyncCode] = useState(false);
  const [newCodeInput, setNewCodeInput] = useState("");
  const [confirmCodeInput, setConfirmCodeInput] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [authError, setAuthError] = useState("");
  const recordsRef = useRef<NoteRecord[]>([]);
  const deletedRef = useRef<Record<string, string>>({});
  const syncRunningRef = useRef(false);
  const syncQueuedRef = useRef(false);
  const queuedPullRef = useRef(false);
  const importRef = useRef<HTMLInputElement>(null);
  const cardBackgroundRef = useRef<HTMLInputElement>(null);
  const cardSvgRef = useRef<SVGSVGElement>(null);

  const showTimelineForType = (type: NoteType) => {
    setFilter(type);
    setView("timeline");
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        recordsRef.current = parsed;
        setRecords(parsed);
      }
      const storedBackground = localStorage.getItem(CARD_BACKGROUND_KEY);
      if (storedBackground) setCustomCardBackground(storedBackground);
      const deleted = localStorage.getItem(DELETED_KEY);
      if (deleted) deletedRef.current = JSON.parse(deleted);
      const storedCode = localStorage.getItem(SYNC_CODE_KEY);
      if (storedCode) setSyncCode(storedCode);
    } catch { /* Keep an empty notebook if old data is invalid. */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !syncCode) return;
    void syncNotes(syncCode, true);
    const refresh = () => { if (document.visibilityState === "visible") void syncNotes(syncCode, true); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [ready, syncCode]);

  useEffect(() => {
    recordsRef.current = records;
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records, ready]);

  useEffect(() => {
    if (!ready || !syncCode) return;
    const timer = window.setTimeout(() => void syncNotes(syncCode, false), 700);
    return () => window.clearTimeout(timer);
  }, [records, ready, syncCode]);

  useEffect(() => {
    if (!ready) return;
    try {
      if (customCardBackground) localStorage.setItem(CARD_BACKGROUND_KEY, customCardBackground);
      else localStorage.removeItem(CARD_BACKGROUND_KEY);
    } catch { showToast("图片已应用，但设备空间不足，暂时无法保存"); }
  }, [customCardBackground, ready]);

  const availableMonths = useMemo(() => {
    const keys = new Set(records.map((r) => r.createdAt.slice(0, 7)));
    keys.add(monthKey(now));
    return Array.from(keys).sort().reverse();
  }, [records]);
  const monthRecords = useMemo(() => records.filter((r) => r.createdAt.startsWith(selectedMonth)), [records, selectedMonth]);
  const visibleRecords = useMemo(() => records.filter((r) => filter === "全部" || r.type === filter).sort((a,b) => b.createdAt.localeCompare(a.createdAt)), [records, filter]);
  const counts = useMemo(() => Object.fromEntries(choices.map((c) => [c.type, monthRecords.filter((r) => r.type === c.type).length])) as Record<NoteType, number>, [monthRecords]);
  const monthLabel = (() => { const [year, month] = selectedMonth.split("-").map(Number); return `${year} 年 ${monthNames[month - 1]}`; })();
  const inspiration = monthRecords.find((r) => r.type === "启发") ?? monthRecords[0];

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }

  async function syncNotes(activeCode: string, pullFirst: boolean) {
    syncQueuedRef.current = true;
    queuedPullRef.current = queuedPullRef.current || pullFirst;
    if (syncRunningRef.current) return;
    syncRunningRef.current = true;
    setSyncing(true);
    try {
      while (syncQueuedRef.current) {
        syncQueuedRef.current = false;
        const shouldPull = queuedPullRef.current;
        queuedPullRef.current = false;
        let remoteRecords: NoteRecord[] = [];
        let remoteDeleted: Record<string, string> = {};
        if (shouldPull) {
          const { data, error } = await supabase.rpc("pull_test_notebook", { p_code: activeCode });
          if (error) throw error;
          const payload = data as { records?: NoteRecord[]; deleted?: Record<string,string> } | null;
          remoteRecords = payload?.records ?? [];
          remoteDeleted = payload?.deleted ?? {};
        }
        const merged = mergeNotebook(recordsRef.current, deletedRef.current, remoteRecords, remoteDeleted);
        const pushedSignature = notebookSignature(merged.records, merged.deleted);
        const { data: pushed, error } = await supabase.rpc("push_test_notebook", { p_code: activeCode, p_payload: { version: 1, records: merged.records, deleted: merged.deleted } });
        if (error) throw error;
        if (!pushed) throw new Error("sync notebook not found");

        // A local edit or deletion may have happened while the network request was running.
        // Merge it again before updating the screen; a newer deletion always beats an older record.
        const currentSignature = notebookSignature(recordsRef.current, deletedRef.current);
        const latest = mergeNotebook(merged.records, merged.deleted, recordsRef.current, deletedRef.current);
        const latestSignature = notebookSignature(latest.records, latest.deleted);
        if (latestSignature !== pushedSignature) syncQueuedRef.current = true;
        deletedRef.current = latest.deleted;
        recordsRef.current = latest.records;
        localStorage.setItem(DELETED_KEY, JSON.stringify(latest.deleted));
        if (latestSignature !== currentSignature) setRecords(latest.records);
      }
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error && error.message === "sync notebook not found" ? "同步暗语已失效，请输入新的暗语重新连接" : "云端暂时未连接，本地记录不会丢失");
      return false;
    } finally {
      syncRunningRef.current = false;
      setSyncing(false);
    }
    return true;
  }

  async function createSyncCode() {
    const code = normalizeSyncCode(codeInput);
    if (!validSyncCode(code)) { setAuthError("请写下至少 4 个字符的同步暗语。"); return; }
    setSyncing(true);
    const { data, error } = await supabase.rpc("create_test_notebook", { p_code: code, p_payload: { version: 1, records, deleted: deletedRef.current } });
    setSyncing(false);
    if (error) { setAuthError("暂时无法创建，请稍后重试。"); return; }
    if (!data) { setAuthError("这个同步暗语已经有人使用，请换一个更独特的。"); return; }
    localStorage.setItem(SYNC_CODE_KEY, code);
    setSyncCode(code);
    setCodeInput(code);
    setShowCode(true);
    setAuthError("");
  }

  async function connectSyncCode() {
    const code = normalizeSyncCode(codeInput);
    if (!validSyncCode(code)) { setAuthError("同步暗语至少需要 4 个字符。"); return; }
    setSyncing(true);
    const { data, error } = await supabase.rpc("pull_test_notebook", { p_code: code });
    setSyncing(false);
    if (error || !data) { setAuthError("没有找到这份拾光笺，请检查同步码。"); return; }
    localStorage.setItem(SYNC_CODE_KEY, code);
    setSyncCode(code);
    setAuthError("");
    showToast("已连接，正在合并两边的记录");
  }

  async function copySyncCode() {
    await navigator.clipboard.writeText(syncCode);
    showToast("同步码已复制，请妥善保管");
  }

  function openSyncCodeChange() {
    setChangingSyncCode(true);
    setNewCodeInput("");
    setConfirmCodeInput("");
    setAuthError("");
  }

  function cancelSyncCodeChange() {
    setChangingSyncCode(false);
    setNewCodeInput("");
    setConfirmCodeInput("");
    setAuthError("");
  }

  async function changeSyncCode() {
    const nextCode = normalizeSyncCode(newCodeInput);
    const confirmedCode = normalizeSyncCode(confirmCodeInput);
    if (!validSyncCode(nextCode)) { setAuthError("新的同步暗语至少需要 4 个字符。"); return; }
    if (nextCode === syncCode) { setAuthError("请写一句和当前不同的新暗语。"); return; }
    if (nextCode !== confirmedCode) { setAuthError("两次输入的同步暗语不一致。"); return; }

    const synced = await syncNotes(syncCode, true);
    if (!synced) { setAuthError("暂时无法确认云端记录，请稍后重试。"); return; }

    setSyncing(true);
    const { data, error } = await supabase.rpc("rename_test_notebook_v2", {
      p_old_code: syncCode,
      p_new_code: nextCode,
      p_payload: { version: 1, records: recordsRef.current, deleted: deletedRef.current },
    });
    setSyncing(false);
    if (error) { setAuthError("暂时无法修改暗语，请稍后重试。"); return; }
    if (data === "change_limit") { setAuthError("每份拾光笺一年只能修改一次暗语，请在满一年后再试。"); return; }
    if (data !== "renamed") { setAuthError("这句新暗语已被使用或永久废止，请换一句更独特的。"); return; }

    localStorage.setItem(SYNC_CODE_KEY, nextCode);
    setSyncCode(nextCode);
    setCodeInput(nextCode);
    setShowCode(true);
    cancelSyncCodeChange();
    showToast("暗语已更新；其他设备请重新输入新暗语连接");
  }

  function stopSync() {
    localStorage.removeItem(SYNC_CODE_KEY);
    setSyncCode("");
    setCodeInput("");
    setShowCode(false);
    cancelSyncCodeChange();
    showToast("已停止同步，本机记录仍然保留");
  }

  function openComposer(choice: NoteChoice, record?: NoteRecord) {
    setActive(choice);
    setEditing(record ?? null);
    setText(record?.text ?? "");
    setRecipient(record?.recipient ?? "");
    setMakeCard(choice.type === "感谢他人");
  }

  function closeComposer() {
    setActive(null); setEditing(null); setText(""); setRecipient("");
  }

  function saveRecord() {
    if (!active || !text.trim()) return;
    const stamp = new Date().toISOString();
    let saved: NoteRecord;
    if (editing) {
      saved = { ...editing, text: text.trim(), recipient: recipient.trim() || undefined, updatedAt: stamp };
      setRecords((items) => items.map((item) => item.id === saved.id ? saved : item));
      showToast("修改已经收好");
    } else {
      saved = { id: crypto.randomUUID(), type: active.type, text: text.trim(), recipient: recipient.trim() || undefined, createdAt: stamp, updatedAt: stamp };
      setRecords((items) => [saved, ...items]);
      showToast("已经替你收好了");
    }
    const wantsCard = active.type === "感谢他人" && makeCard;
    closeComposer();
    if (wantsCard) openCard(saved);
  }

  function openCard(record: NoteRecord) {
    setCardTemplate(0);
    setCardColor(0);
    setCardRecord(record);
  }

  function chooseCardTemplate(index: number) {
    setCustomCardBackground("");
    setCardTemplate(index);
    setCardColor(0);
  }

  function uploadCardBackground(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("请选择一张图片"); return; }
    if (file.size > 15 * 1024 * 1024) { showToast("图片太大，请选择 15MB 以内的图片"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1600; canvas.height = 980;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
        const width = image.naturalWidth * scale; const height = image.naturalHeight * scale;
        ctx.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
        setCustomCardBackground(canvas.toDataURL("image/jpeg", .82));
        showToast("自定义背景已经应用");
      };
      image.onerror = () => showToast("这张图片暂时无法读取");
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function removeRecord(record: NoteRecord) {
    if (!window.confirm("确定要移除这片微光吗？")) return;
    const stamp = new Date().toISOString();
    deletedRef.current = { ...deletedRef.current, [record.id]: stamp };
    localStorage.setItem(DELETED_KEY, JSON.stringify(deletedRef.current));
    setRecords((items) => items.filter((item) => item.id !== record.id));
    showToast("记录已移除");
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `拾光笺备份-${monthKey(now)}.json`; link.click();
    URL.revokeObjectURL(url);
    showToast("备份已经下载");
  }

  function exportMarkdown() {
    const body = [...records].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map((record) => {
      const date = new Intl.DateTimeFormat("zh-CN", { dateStyle: "long", timeStyle: "short" }).format(new Date(record.createdAt));
      const recipientLine = record.recipient ? `\n写给：${record.recipient}\n` : "";
      return `## ${record.type} · ${date}\n${recipientLine}\n${record.text}\n\n---\n`;
    }).join("\n");
    const markdown = `# 我的拾光笺\n\n> 导出时间：${new Date().toLocaleString("zh-CN")}\n\n${body}`;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `拾光笺-${monthKey(now)}.md`; link.click();
    URL.revokeObjectURL(url);
    showToast("通用笔记文件已经下载");
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (!Array.isArray(payload.records)) throw new Error();
      const incoming = payload.records.filter((r: NoteRecord) => r.id && r.type && r.text && r.createdAt);
      const merged = new Map(records.map((r) => [r.id, r]));
      incoming.forEach((r: NoteRecord) => merged.set(r.id, r));
      setRecords(Array.from(merged.values()));
      showToast(`已导入 ${incoming.length} 条记录`);
    } catch { showToast("这个备份文件无法识别"); }
    event.target.value = "";
  }

  async function renderCardBlob() {
    const source = cardSvgRef.current;
    if (!source) return null;
    const clone = source.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    await Promise.all(Array.from(clone.querySelectorAll("image")).map(async (image) => {
      const href = image.getAttribute("href");
      if (!href || href.startsWith("data:")) return;
      try {
        const response = await fetch(new URL(href, document.baseURI));
        if (!response.ok) throw new Error("image fetch failed");
        image.setAttribute("href", await blobAsDataUrl(await response.blob()));
      } catch {
        image.setAttribute("href", new URL(href, document.baseURI).href);
      }
    }));
    const markup = new XMLSerializer().serializeToString(clone);
    const canvas = document.createElement("canvas");
    canvas.width = 1200; canvas.height = 760;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("svg decode failed"));
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
      });
      ctx.drawImage(image, 0, 0, 1200, 760);
      return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    } catch {
      showToast("感谢卡生成失败，请再试一次");
      return null;
    }
  }

  function cardFileName(record: NoteRecord) {
    return `拾光笺-${record.recipient || cardTemplates[cardTemplate].name}.png`;
  }

  function saveCardBlob(blob: Blob, record: NoteRecord) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = cardFileName(record);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadCard(record: NoteRecord) {
    const blob = await renderCardBlob();
    if (!blob) return;
    saveCardBlob(blob, record);
    showToast("图片已保存，可发送到微信或飞书");
  }

  const todayLabel = new Intl.DateTimeFormat("zh-CN", { year:"numeric", month:"long", day:"numeric", weekday:"long" }).format(now);
  const selectedTemplate = cardTemplates[cardTemplate];
  const selectedCardColor = selectedTemplate.colors[cardColor];

  return (
    <main>
      <header className="topbar">
        <button className="brand brand-button" onClick={() => setView("home")}><span className="logo">拾</span><span>拾光笺</span></button>
        <div className="top-actions"><button className={`sync-pill ${syncCode ? "online" : "local"}`} onClick={() => setSyncOpen(true)} aria-label={syncCode ? "云端同步已开启，点击查看同步设置" : "已保存于本机，点击开启暗语同步"} title={syncCode ? "查看同步设置" : "开启暗语同步"}>{syncCode ? <Cloud size={16}/> : <HardDrive size={16}/>}<span>{syncCode ? (syncing ? "正在云端同步…" : "云端同步已开启") : "已保存于本机"}</span></button><button className="avatar" aria-label="数据与备份" onClick={() => setView("data")}><Settings2 size={17}/></button></div>
      </header>

      {view === "home" && <><section className="hero">
        <div className="date">{todayLabel}</div>
        <h1>此刻，想留下些什么？</h1>
        <p>把今天闪过的一点光，轻轻收好。</p>
        <div className="note-grid">{choices.map((choice) => { const Icon = choiceIcons[choice.type]; return <button className={`note ${choice.tone}`} key={choice.type} onClick={() => openComposer(choice)}>
          <span className="note-icon"><Icon size={20}/></span><span className="note-title">{choice.title}</span><span className="note-hint">{choice.hint}</span><span className="arrow">→</span>
        </button>})}</div>
      </section>
      <section className="month-card"><div><span className="eyebrow">{monthNames[now.getMonth()]} · 拾光小结</span><h2>{records.length ? `这个月，你已经收集了 ${monthRecords.length} 片微光` : "从第一片微光开始，写下你的这个月"}</h2></div><button onClick={() => { setSelectedMonth(monthKey(now)); setView("month"); }}>看看这个月 <span>→</span></button></section></>}

      {view === "timeline" && <section className="inner-page">
        <div className="page-head"><div><div className="date">我的时光</div><h1>那些被好好接住的瞬间</h1></div><select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="筛选记录类型"><option>全部</option>{choices.map((c) => <option key={c.type} value={c.type}>{c.title}</option>)}</select></div>
        {visibleRecords.length ? <div className="timeline">{visibleRecords.map((item) => { const date = new Date(item.createdAt); return <article key={item.id} className="timeline-row"><div className="day">{String(date.getDate()).padStart(2,"0")}<small>{monthNames[date.getMonth()]}</small></div><div className={`saved-note ${toneByType[item.type]}`}><div className="saved-meta"><span>{labelByType[item.type]}{item.recipient ? ` · 写给${item.recipient}` : ""}</span><div><button onClick={() => openComposer(choices.find((c) => c.type === item.type)!, item)}>编辑</button><button onClick={() => removeRecord(item)}>删除</button></div></div><p>{item.text}</p>{item.type === "感谢他人" && <button className="card-link" onClick={() => openCard(item)}>生成感谢卡 →</button>}</div></article>})}</div> : <div className="empty"><span>✦</span><h2>这里还没有微光</h2><p>回到首页，写下第一句话吧。</p><button onClick={() => setView("home")}>去记录</button></div>}
      </section>}

      {view === "month" && <section className="inner-page report">
        <div className="report-tools"><button className="back" onClick={() => setView("home")}>← 返回</button><select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>{availableMonths.map((key) => { const [y,m] = key.split("-").map(Number); return <option key={key} value={key}>{y} 年 {monthNames[m-1]}</option>})}</select></div>
        <div className="report-head"><span>{monthLabel}</span><h1>拾光小结</h1><p>{monthRecords.length ? `这个月，你认真接住了 ${monthRecords.length} 个发光的时刻。` : "这个月还在等待第一片微光。"}</p></div>
        <div className="stats">{choices.map((c) => <button type="button" key={c.type} onClick={() => showTimelineForType(c.type)} aria-label={`查看${c.title}记录`}><b>{counts[c.type]}</b><span>{c.title}</span><small>查看记录 →</small></button>)}</div>
        {monthRecords.length ? <><blockquote>“{inspiration?.text}”<small>{inspiration?.type === "启发" ? "本月最触动你的话" : "本月留下的第一片光"}</small></blockquote><div className="letter"><span>写给{monthLabel}的你</span><p>你留下了 {counts["灵感"]} 个念头、{counts["启发"]} 次触动，也认真看见了自己与他人的善意。零散的片刻正在这里慢慢连成你的故事。</p></div></> : <div className="empty compact"><p>每一次记录，都会成为月末回望自己的线索。</p><button onClick={() => setView("home")}>收集第一片微光</button></div>}
      </section>}

      {view === "data" && <section className="inner-page data-page"><div className="date">我的拾光笺</div><h1>让记录安心留下来</h1><div className="privacy-notice"><span aria-hidden="true"><ShieldCheck size={22}/></span><div><strong>{syncCode ? "暗语同步已开启" : "当前为本机保存"}</strong><p>{syncCode ? "记录保存在当前浏览器，也会根据你的暗语同步到云端。换一个浏览器输入同一句暗语，就能下载并继续同步。" : "记录只保存在当前浏览器。为了在更换浏览器或设备后仍能找回它们，你可以开启暗语同步，或定期下载备份。"}</p></div></div><section className="safety-rules" aria-labelledby="safety-title"><h2 id="safety-title">两种保存方式</h2><div className="safety-grid"><article><b>未开启暗语：保存在当前浏览器</b><p>换一个浏览器不会看到这里的记录。开启暗语后，就能在其他浏览器找回并同步同一份记录。</p></article><article><b>开启暗语：找回同一份记录</b><p>在其他浏览器输入同一句暗语，就能找回并同步记录。暗语请留给自己，不要告诉他人。</p></article></div></section><div className="data-actions"><article><span><Download size={28}/></span><h2>拾光笺备份</h2><p>用于在拾光笺中完整恢复全部记录。</p><button onClick={exportData} disabled={!records.length}>下载 JSON 备份</button></article><article><span><FileText size={28}/></span><h2>通用笔记文件</h2><p>导出 Markdown，可迁移到支持该格式的笔记应用。</p><button onClick={exportMarkdown} disabled={!records.length}>下载 Markdown</button></article><article><span><Upload size={28}/></span><h2>导入备份</h2><p>从以前下载的拾光笺 JSON 文件恢复记录。</p><button onClick={() => importRef.current?.click()}>选择备份文件</button><input ref={importRef} type="file" accept=".json,application/json" hidden onChange={importData}/></article></div><div className="data-summary">当前共保存 <b>{records.length}</b> 片微光</div></section>}

      <nav aria-label="主导航"><button className={view === "home" ? "active" : ""} onClick={() => setView("home")}><HomeIcon size={18}/><span>记录</span></button><button className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")}><BookOpenText size={18}/><span>时光</span></button><button className={view === "month" ? "active" : ""} onClick={() => setView("month")}><CalendarDays size={18}/><span>回顾</span></button></nav>

      {active && <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && closeComposer()}><section className={`composer ${active.tone}`}><button className="close" onClick={closeComposer} aria-label="关闭"><X size={20}/></button><span className="note-icon">{(() => { const Icon = choiceIcons[active.type]; return <Icon size={20}/>; })()}</span><div className="composer-label">{editing ? "编辑" : active.title}</div><h2>{active.hint}</h2>{active.type === "感谢他人" && <input className="recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="对方的名字（选填）"/>}<textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="写下一句话就好……" maxLength={300}/>{active.type === "感谢他人" && <label className="send-option"><input type="checkbox" checked={makeCard} onChange={(e) => setMakeCard(e.target.checked)}/> 保存后预览感谢卡</label>}<div className="composer-foot"><small>{text.length}/300</small><button onClick={saveRecord} disabled={!text.trim()}>{editing ? "保存修改" : "收好这片微光"}</button></div></section></div>}

      {cardRecord && <div className="overlay"><section className="card-modal"><button className="close" onClick={() => setCardRecord(null)} aria-label="关闭"><X size={20}/></button><div className="card-editor-label">选择一张适合此刻的卡片</div><CardArtwork record={cardRecord} template={selectedTemplate} color={selectedCardColor} customBackground={customCardBackground} svgRef={cardSvgRef}/><div className="card-template-picker" aria-label="感谢卡风格">{cardTemplates.map((template,index)=><button key={template.name} className={index===cardTemplate&&!customCardBackground?"active":""} onClick={()=>chooseCardTemplate(index)}><b>{template.name}</b><span>{template.caption}</span></button>)}</div><div className="card-color-picker" aria-label="背景颜色">{selectedTemplate.colors.map((color,index)=><button key={color.name} className={index===cardColor&&!customCardBackground?"active":""} onClick={()=>{setCustomCardBackground("");setCardColor(index)}} aria-label={color.name} title={color.name} style={{background:`linear-gradient(135deg,${color.background},${color.color2})`}}/>)}</div><input ref={cardBackgroundRef} type="file" accept="image/*" hidden onChange={uploadCardBackground}/><div className="card-actions"><button className="background-upload" onClick={() => cardBackgroundRef.current?.click()}><Upload size={15}/> 上传背景</button>{customCardBackground && <button className="back" onClick={() => setCustomCardBackground("")}>恢复模板</button>}<button className="back later" onClick={() => setCardRecord(null)}>稍后再说</button><button className="save-card" onClick={() => downloadCard(cardRecord)}><Download size={15}/> 保存图片</button></div></section></div>}
      {syncOpen && <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setSyncOpen(false)}><section className="sync-modal"><button className="close" onClick={() => { cancelSyncCodeChange(); setSyncOpen(false); }} aria-label="关闭"><X size={20}/></button><span className="sync-cloud"><Cloud size={24}/></span>{syncCode ? (changingSyncCode ? <><h2>修改同步暗语</h2><p>迁移完成后，旧暗语会被释放，其他人可以重新使用它创建新的拾光笺。</p>{authError && <div className="auth-error" role="alert">{authError}</div>}<label>新的同步暗语<input className="code-input" value={newCodeInput} onChange={(e) => setNewCodeInput(e.target.value)} placeholder="例如：山谷晚风与拾光" maxLength={40} autoFocus/></label><label>再次输入新暗语<input className="code-input" value={confirmCodeInput} onChange={(e) => setConfirmCodeInput(e.target.value)} placeholder="再写一次，避免输错" maxLength={40} onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && void changeSyncCode()}/></label><button className="primary-sync" onClick={() => void changeSyncCode()} disabled={!newCodeInput || !confirmCodeInput || syncing}>{syncing ? "正在迁移…" : "确认修改并释放旧暗语"}</button><button className="signout" onClick={cancelSyncCodeChange} disabled={syncing}>暂不修改</button><small>其他设备上的旧暗语会失效，需要输入新暗语才能继续同步。</small></> : <><h2>测试同步已开启</h2><p>在其他浏览器输入同一暗语，就能连接这份拾光笺。</p>{showCode ? <div className="sync-code">{syncCode}</div> : <button className="reveal-code" onClick={() => setShowCode(true)}>显示我的同步暗语</button>}{showCode && <button className="copy-code" onClick={copySyncCode}>复制同步暗语</button>}<button className="primary-sync" onClick={() => void syncNotes(syncCode, true)} disabled={syncing}><RefreshCw size={16}/>{syncing ? "正在同步…" : "立即同步"}</button><button className="change-sync-code" onClick={openSyncCodeChange} disabled={syncing}>修改同步暗语</button><button className="signout" onClick={stopSync}><LogOut size={15}/>停止测试同步</button><small>暗语会用于在云端找到并同步这份记录，请把它留给自己，不要告诉他人。</small></>) : <><h2>为这份拾光笺，写一句暗语</h2><p>不用登录。暗语由你决定，在另一浏览器输入同一句，就能连接这份记录。</p>{authError && <div className="auth-error" role="alert">{authError}</div>}<label>我的同步暗语<input className="code-input" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="例如：山谷晚风与拾光" maxLength={40} onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && void createSyncCode()}/></label><button className="primary-sync" onClick={createSyncCode} disabled={!codeInput || syncing}><Cloud size={16}/>{syncing ? "正在开启…" : "用这句暗语开启同步"}</button><div className="sync-divider"><span>已经在其他浏览器开启过？</span></div><button className="connect-code" onClick={connectSyncCode} disabled={!codeInput || syncing}>连接已有拾光笺</button><small>暗语会用于在云端找到并同步你的记录。请写下自己容易记住、但不会告诉他人的一句话。</small></>}</section></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
