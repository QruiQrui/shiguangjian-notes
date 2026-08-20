"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { BookOpenText, CalendarDays, Download, FileText, Flower2, Heart, Home as HomeIcon, Lightbulb, RefreshCw, Settings2, ShieldCheck, Sparkles, Upload, X } from "lucide-react";

type NoteType = "灵感" | "启发" | "感谢自己" | "感谢他人";
type NoteRecord = { id: string; type: NoteType; text: string; recipient?: string; createdAt: string; updatedAt: string };
type NoteChoice = { icon: string; title: string; type: NoteType; hint: string; tone: string };

const STORAGE_KEY = "shiguangjian.notes.v1";
const CARD_BACKGROUND_KEY = "shiguangjian.card-background.v1";
const choices: NoteChoice[] = [
  { icon: "✦", title: "记录灵感", type: "灵感", hint: "刚刚冒出了什么想法？", tone: "peach" },
  { icon: "“", title: "今日启发", type: "启发", hint: "哪句话或哪件事触动了你？", tone: "yellow" },
  { icon: "♥", title: "感谢自己", type: "感谢自己", hint: "今天的自己，有什么值得感谢？", tone: "pink" },
  { icon: "✿", title: "感谢他人", type: "感谢他人", hint: "谁为你带来了一点温暖？", tone: "green" },
];
const choiceIcons = { 灵感: Sparkles, 启发: Lightbulb, 感谢自己: Heart, 感谢他人: Flower2 };
const toneByType: Record<NoteType, string> = { 灵感: "peach", 启发: "yellow", 感谢自己: "pink", 感谢他人: "green" };
const monthNames = ["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"];
const cardStyles = [
  { name: "薄荷花瓣", className: "card-spring petal-mint", background: "#fbfffd", color2: "#edf9f4", ink: "#17362c", accent: "#4fc29b", icon: "01", pattern: "petal" },
  { name: "丁香花瓣", className: "card-spring petal-lilac", background: "#fdfaff", color2: "#f1eafa", ink: "#352c43", accent: "#9a78c5", icon: "02", pattern: "petal" },
  { name: "蜜桃花瓣", className: "card-spring petal-peach", background: "#fffaf8", color2: "#fdece7", ink: "#402d2b", accent: "#e88a76", icon: "03", pattern: "petal" },
  { name: "晴蓝花瓣", className: "card-spring petal-blue", background: "#f9fdff", color2: "#e8f4fa", ink: "#233841", accent: "#65aeca", icon: "04", pattern: "petal" },
  { name: "薄荷窗口", className: "card-blush window-mint", background: "#fbfffd", color2: "#eafbf4", ink: "#17362c", accent: "#24b78b", icon: "05", pattern: "window" },
  { name: "晨粉窗口", className: "card-blush window-pink", background: "#fffafb", color2: "#fbe9ee", ink: "#402c35", accent: "#d97896", icon: "06", pattern: "window" },
  { name: "奶油窗口", className: "card-blush window-butter", background: "#fffdf7", color2: "#f8edcf", ink: "#3b3425", accent: "#d2a84f", icon: "07", pattern: "window" },
  { name: "雾紫窗口", className: "card-blush window-lilac", background: "#fcfaff", color2: "#eee8f8", ink: "#352f43", accent: "#8e79bd", icon: "08", pattern: "window" },
  { name: "雾蓝郁金香", className: "card-tulip-blue", background: "#edf6f7", color2: "#dbecef", ink: "#25363a", accent: "#c45e76", icon: "10", pattern: "modernTulip", image: "/floral/tulips-clean-v3.png" },
  { name: "暖白郁金香", className: "card-tulip-ivory", background: "#fffaf0", color2: "#f5ead7", ink: "#3d312c", accent: "#bd6676", icon: "11", pattern: "modernTulip", image: "/floral/tulips-clean-v3.png" },
  { name: "晨粉郁金香", className: "card-tulip-pink", background: "#fff1f4", color2: "#f7dfe7", ink: "#422d35", accent: "#bb6179", icon: "12", pattern: "modernTulip", image: "/floral/tulips-clean-v3.png" },
  { name: "丁香郁金香", className: "card-tulip-lilac", background: "#f8f2fc", color2: "#e9ddf2", ink: "#382f43", accent: "#9476b4", icon: "13", pattern: "modernTulip", image: "/floral/tulips-clean-v3.png" },
  { name: "奶油郁金香", className: "card-tulip-butter", background: "#fff9e8", color2: "#f4e6bd", ink: "#3d3525", accent: "#c89648", icon: "14", pattern: "modernTulip", image: "/floral/tulips-clean-v3.png" },
  { name: "鼠尾草郁金香", className: "card-tulip-sage", background: "#f2f7f0", color2: "#dfeadd", ink: "#2d3b2d", accent: "#718e6e", icon: "15", pattern: "modernTulip", image: "/floral/tulips-clean-v3.png" },
] as const;

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
  const [cardStyle, setCardStyle] = useState(0);
  const [customCardBackground, setCustomCardBackground] = useState("");
  const [filter, setFilter] = useState<"全部" | NoteType>("全部");
  const [selectedMonth, setSelectedMonth] = useState(monthKey(now));
  const [toast, setToast] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const cardBackgroundRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setRecords(JSON.parse(stored));
      const storedBackground = localStorage.getItem(CARD_BACKGROUND_KEY);
      if (storedBackground) setCustomCardBackground(storedBackground);
    } catch { /* Keep an empty notebook if old data is invalid. */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records, ready]);

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
    setCardStyle(Math.floor(Math.random() * cardStyles.length));
    setCardRecord(record);
  }

  function shuffleCard() {
    if (customCardBackground) setCustomCardBackground("");
    setCardStyle((current) => {
      if (cardStyles.length < 2) return current;
      let next = current;
      while (next === current) next = Math.floor(Math.random() * cardStyles.length);
      return next;
    });
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

  async function downloadCard(record: NoteRecord) {
    const style = cardStyles[cardStyle];
    const canvas = document.createElement("canvas");
    canvas.width = 1200; canvas.height = 760;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#f7f2e9"; ctx.fillRect(0,0,1200,760);
    const gradient = ctx.createLinearGradient(110,80,1090,680); gradient.addColorStop(0,style.background); gradient.addColorStop(1,style.color2);
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.roundRect(110,80,980,600,28); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.roundRect(110,80,980,600,28); ctx.clip();
    if (customCardBackground) {
      const custom = new Image(); custom.src = customCardBackground;
      await new Promise<void>((resolve) => { custom.onload = () => resolve(); custom.onerror = () => resolve(); });
      if (custom.naturalWidth) {
        ctx.drawImage(custom,110,80,980,600);
        const veil = ctx.createLinearGradient(110,80,920,80);
        veil.addColorStop(0,"rgba(255,252,246,.94)"); veil.addColorStop(.62,"rgba(255,252,246,.7)"); veil.addColorStop(1,"rgba(255,252,246,.12)");
        ctx.fillStyle = veil; ctx.fillRect(110,80,980,600);
      }
    }
    if (!customCardBackground && "image" in style && style.image) {
      const floral = new Image(); floral.src = style.image;
      await new Promise<void>((resolve) => { floral.onload = () => resolve(); floral.onerror = () => resolve(); });
      if (floral.naturalWidth) {
        if (style.pattern === "modernTulip") ctx.drawImage(floral,110,95,390,585);
      }
    }
    const deco = (x:number,y:number,r:number,color:string) => { ctx.fillStyle=color;ctx.globalAlpha=.5;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1; };
    if (!customCardBackground && style.pattern === "petal") { ctx.fillStyle=style.accent;ctx.globalAlpha=.13;[[980,145],[1040,205],[980,265],[920,205]].forEach(([x,y])=>{ctx.beginPath();ctx.ellipse(x,y,48,88,Math.atan2(y-205,x-980),0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1; }
    if (style.pattern === "sunrise") { ctx.strokeStyle=style.accent;ctx.globalAlpha=.75;ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(840,80);ctx.lineTo(1090,330);ctx.stroke();ctx.globalAlpha=1;deco(1015,155,38,style.accent); }
    if (style.pattern === "orbit") { ctx.strokeStyle=style.accent;ctx.globalAlpha=.28;ctx.lineWidth=18;[90,140,190].forEach(r=>{ctx.beginPath();ctx.arc(1035,170,r,0,Math.PI*2);ctx.stroke();});ctx.globalAlpha=1; }
    if (!customCardBackground && style.pattern === "window") { ctx.fillStyle=style.accent;ctx.globalAlpha=.18;ctx.beginPath();ctx.roundRect(850,110,190,190,42);ctx.fill();ctx.globalAlpha=1;deco(945,205,38,style.accent); }
    if (style.pattern === "book") { ctx.fillStyle=style.accent;ctx.globalAlpha=.12;ctx.fillRect(810,80,12,600);ctx.fillRect(850,80,2,600);ctx.globalAlpha=1;deco(1015,155,46,style.accent); }
    if (style.pattern === "collage") { ctx.fillStyle="#ff806f";ctx.globalAlpha=.74;ctx.fillRect(895,80,195,116);ctx.fillStyle=style.accent;ctx.beginPath();ctx.moveTo(1010,210);ctx.lineTo(1090,330);ctx.lineTo(930,330);ctx.closePath();ctx.fill();ctx.globalAlpha=1; }
    if (style.pattern === "letter") { ctx.strokeStyle=style.accent;ctx.globalAlpha=.35;ctx.lineWidth=3;ctx.strokeRect(142,112,916,536);ctx.globalAlpha=1;deco(1000,170,34,style.accent); }
    if (style.pattern === "echo") { ctx.strokeStyle=style.accent;ctx.globalAlpha=.22;ctx.lineWidth=6;[52,88,124].forEach(r=>{ctx.beginPath();ctx.arc(1010,175,r,0,Math.PI*2);ctx.stroke();});ctx.globalAlpha=1; }
    ctx.restore();
    const cardInk = customCardBackground ? "#2e2925" : style.ink;
    const cardAccent = customCardBackground ? "#8b6657" : style.accent;
    const textX = !customCardBackground && style.pattern === "modernTulip" ? 535 : 180;
    const maxTextWidth = !customCardBackground && style.pattern === "modernTulip" ? 470 : 820;
    ctx.fillStyle = cardInk; ctx.font = "600 40px serif"; ctx.fillText(record.recipient ? `写给 ${record.recipient}` : "谢谢你", textX,220);
    ctx.fillStyle = cardInk; ctx.font = "28px sans-serif";
    const chars = Array.from(record.text); const lines: string[] = []; let line = "";
    chars.forEach((char) => { const next = line + char; if (ctx.measureText(next).width > maxTextWidth) { lines.push(line); line = char; } else line = next; }); if (line) lines.push(line);
    lines.slice(0,7).forEach((item,i) => ctx.fillText(item,textX,310+i*52));
    ctx.strokeStyle = cardAccent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(textX,590); ctx.lineTo(textX+130,590); ctx.stroke();
    ctx.fillStyle = cardAccent; ctx.font = "24px serif"; ctx.fillText("拾光笺 · 一份被说出口的感谢",textX,635);
    const link = document.createElement("a"); link.href = canvas.toDataURL("image/png"); link.download = `拾光笺-${style.name}.png`; link.click();
    showToast("感谢卡已经下载");
  }

  const todayLabel = new Intl.DateTimeFormat("zh-CN", { year:"numeric", month:"long", day:"numeric", weekday:"long" }).format(now);
  const customBackgroundStyle = customCardBackground ? {
    backgroundImage: `linear-gradient(90deg,rgba(255,252,246,.94) 0%,rgba(255,252,246,.7) 62%,rgba(255,252,246,.12) 100%),url(${customCardBackground})`,
    backgroundSize: "cover", backgroundPosition: "center"
  } : undefined;

  return (
    <main>
      <header className="topbar">
        <button className="brand brand-button" onClick={() => setView("home")}><span className="logo">拾</span><span>拾光笺</span></button>
        <button className="avatar" aria-label="数据与备份" onClick={() => setView("data")}><Settings2 size={17}/></button>
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
        <div className="page-head"><div><div className="date">我的时光</div><h1>那些被好好接住的瞬间</h1></div><select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="筛选记录类型"><option>全部</option>{choices.map((c) => <option key={c.type}>{c.type}</option>)}</select></div>
        {visibleRecords.length ? <div className="timeline">{visibleRecords.map((item) => { const date = new Date(item.createdAt); return <article key={item.id} className="timeline-row"><div className="day">{String(date.getDate()).padStart(2,"0")}<small>{monthNames[date.getMonth()]}</small></div><div className={`saved-note ${toneByType[item.type]}`}><div className="saved-meta"><span>{item.type}{item.recipient ? ` · 写给${item.recipient}` : ""}</span><div><button onClick={() => openComposer(choices.find((c) => c.type === item.type)!, item)}>编辑</button><button onClick={() => removeRecord(item)}>删除</button></div></div><p>{item.text}</p>{item.type === "感谢他人" && <button className="card-link" onClick={() => openCard(item)}>生成感谢卡 →</button>}</div></article>})}</div> : <div className="empty"><span>✦</span><h2>这里还没有微光</h2><p>回到首页，写下第一句话吧。</p><button onClick={() => setView("home")}>去记录</button></div>}
      </section>}

      {view === "month" && <section className="inner-page report">
        <div className="report-tools"><button className="back" onClick={() => setView("home")}>← 返回</button><select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>{availableMonths.map((key) => { const [y,m] = key.split("-").map(Number); return <option key={key} value={key}>{y} 年 {monthNames[m-1]}</option>})}</select></div>
        <div className="report-head"><span>{monthLabel}</span><h1>拾光小结</h1><p>{monthRecords.length ? `这个月，你认真接住了 ${monthRecords.length} 个发光的时刻。` : "这个月还在等待第一片微光。"}</p></div>
        <div className="stats">{choices.map((c) => <div key={c.type}><b>{counts[c.type]}</b><span>{c.type}</span></div>)}</div>
        {monthRecords.length ? <><blockquote>“{inspiration?.text}”<small>{inspiration?.type === "启发" ? "本月最触动你的话" : "本月留下的第一片光"}</small></blockquote><div className="letter"><span>写给{monthLabel}的你</span><p>你留下了 {counts["灵感"]} 个念头、{counts["启发"]} 次触动，也认真看见了自己与他人的善意。零散的片刻正在这里慢慢连成你的故事。</p></div></> : <div className="empty compact"><p>每一次记录，都会成为月末回望自己的线索。</p><button onClick={() => setView("home")}>收集第一片微光</button></div>}
      </section>}

      {view === "data" && <section className="inner-page data-page"><div className="date">我的拾光笺</div><h1>让记录安心留在这里</h1><div className="privacy-notice"><span aria-hidden="true"><ShieldCheck size={22}/></span><div><strong>本地保存，安心记录</strong><p>你的记录仅保存在当前设备的浏览器中，不会上传至拾光笺服务器。请妥善保管设备，并定期导出备份。</p></div></div><div className="data-actions"><article><span><Download size={28}/></span><h2>拾光笺备份</h2><p>用于在拾光笺中完整恢复全部记录。</p><button onClick={exportData} disabled={!records.length}>下载 JSON 备份</button></article><article><span><FileText size={28}/></span><h2>通用笔记文件</h2><p>导出 Markdown，可迁移到支持该格式的笔记应用。</p><button onClick={exportMarkdown} disabled={!records.length}>下载 Markdown</button></article><article><span><Upload size={28}/></span><h2>导入备份</h2><p>从以前下载的拾光笺 JSON 文件恢复记录。</p><button onClick={() => importRef.current?.click()}>选择备份文件</button><input ref={importRef} type="file" accept=".json,application/json" hidden onChange={importData}/></article></div><div className="data-summary">当前共保存 <b>{records.length}</b> 片微光</div></section>}

      <nav aria-label="主导航"><button className={view === "home" ? "active" : ""} onClick={() => setView("home")}><HomeIcon size={18}/><span>记录</span></button><button className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")}><BookOpenText size={18}/><span>时光</span></button><button className={view === "month" ? "active" : ""} onClick={() => setView("month")}><CalendarDays size={18}/><span>回顾</span></button></nav>

      {active && <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && closeComposer()}><section className={`composer ${active.tone}`}><button className="close" onClick={closeComposer} aria-label="关闭"><X size={20}/></button><span className="note-icon">{(() => { const Icon = choiceIcons[active.type]; return <Icon size={20}/>; })()}</span><div className="composer-label">{editing ? "编辑" : active.title}</div><h2>{active.hint}</h2>{active.type === "感谢他人" && <input className="recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="对方的名字（选填）"/>}<textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="写下一句话就好……" maxLength={300}/>{active.type === "感谢他人" && <label className="send-option"><input type="checkbox" checked={makeCard} onChange={(e) => setMakeCard(e.target.checked)}/> 保存后预览感谢卡</label>}<div className="composer-foot"><small>{text.length}/300</small><button onClick={saveRecord} disabled={!text.trim()}>{editing ? "保存修改" : "收好这片微光"}</button></div></section></div>}

      {cardRecord && <div className="overlay"><section className="card-modal"><button className="close" onClick={() => setCardRecord(null)} aria-label="关闭"><X size={20}/></button><div className={`gratitude-card ${cardStyles[cardStyle].className}${customCardBackground ? " card-custom" : ""}`} style={customBackgroundStyle}><h2>{cardRecord.recipient ? `写给 ${cardRecord.recipient}` : "谢谢你"}</h2><p>{cardRecord.text}</p><small>拾光笺 · 一份被说出口的感谢</small></div><input ref={cardBackgroundRef} type="file" accept="image/*" hidden onChange={uploadCardBackground}/><div className="card-actions"><button className="shuffle" onClick={shuffleCard}><RefreshCw size={15}/> {customCardBackground ? "恢复模板" : "换一张"}</button><button className="background-upload" onClick={() => cardBackgroundRef.current?.click()}><Upload size={15}/> 上传背景</button>{customCardBackground && <button className="back" onClick={() => setCustomCardBackground("")}>移除背景</button>}<button className="back" onClick={() => setCardRecord(null)}>稍后再说</button><button onClick={() => downloadCard(cardRecord)}><Download size={15}/> 下载感谢卡</button></div></section></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
