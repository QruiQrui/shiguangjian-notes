"use client";

import { useMemo, useState } from "react";

const notes = [
  { icon: "✦", title: "记录灵感", hint: "刚刚冒出了什么想法？", tone: "peach" },
  { icon: "“", title: "今日启发", hint: "哪句话或哪件事触动了你？", tone: "yellow" },
  { icon: "♥", title: "感谢自己", hint: "今天的自己，有什么值得感谢？", tone: "pink" },
  { icon: "✿", title: "感谢他人", hint: "谁为你带来了一点温暖？", tone: "green" },
];

export default function Home() {
  const [view, setView] = useState<"home" | "timeline" | "month">("home");
  const [active, setActive] = useState<(typeof notes)[number] | null>(null);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const sampleNotes = useMemo(() => [
    { day: "19", type: "灵感", color: "peach", text: "真正好的记录工具，应该让人忘记工具本身。" },
    { day: "16", type: "感谢自己", color: "pink", text: "谢谢今天的我，在很累的时候依然温柔地完成了重要的事。" },
    { day: "11", type: "启发", color: "yellow", text: "慢一点不是停下来，而是让感受跟上脚步。" },
    { day: "04", type: "感谢他人", color: "green", text: "谢谢小林在会议结束后留下来，听我把那个还不成熟的想法说完。" },
  ], []);

  function saveNote() {
    if (!text.trim()) return;
    setSaved(true);
    setTimeout(() => { setActive(null); setText(""); setSaved(false); }, 900);
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="logo">拾</span><span>拾光笺</span></div>
        <button className="avatar" aria-label="个人中心">R</button>
      </header>
      {view === "home" && <><section className="hero">
        <div className="date">2026 年 8 月 19 日 · 星期三</div>
        <h1>此刻，想留下些什么？</h1>
        <p>把今天闪过的一点光，轻轻收好。</p>
        <div className="note-grid">
          {notes.map((note) => (
            <button className={`note ${note.tone}`} key={note.title} onClick={() => setActive(note)}>
              <span className="note-icon">{note.icon}</span>
              <span className="note-title">{note.title}</span>
              <span className="note-hint">{note.hint}</span>
              <span className="arrow">→</span>
            </button>
          ))}
        </div>
      </section>
      <section className="month-card">
        <div><span className="eyebrow">八月 · 拾光小结</span><h2>这个月，你已经收集了 12 片微光</h2></div>
        <button onClick={() => setView("month")}>看看这个月 <span>→</span></button>
      </section></>}

      {view === "timeline" && <section className="inner-page"><div className="date">2026 · 我的时光</div><h1>那些被好好接住的瞬间</h1><div className="timeline">{sampleNotes.map((item) => <article key={item.day} className="timeline-row"><div className="day">{item.day}<small>八月</small></div><div className={`saved-note ${item.color}`}><span>{item.type}</span><p>{item.text}</p></div></article>)}</div></section>}

      {view === "month" && <section className="inner-page report"><button className="back" onClick={() => setView("home")}>← 返回</button><div className="report-head"><span>2026 · AUGUST</span><h1>八月拾光小结</h1><p>这个月，你认真接住了 12 个发光的时刻。</p></div><div className="stats"><div><b>4</b><span>灵感</span></div><div><b>3</b><span>启发</span></div><div><b>3</b><span>感谢自己</span></div><div><b>2</b><span>感谢他人</span></div></div><blockquote>“慢一点不是停下来，而是让感受跟上脚步。”<small>本月最触动你的话</small></blockquote><div className="letter"><span>写给八月的你</span><p>你在忙碌里依然保留着感受生活的能力。你记住了那些突然闪过的念头，也没有错过别人递来的善意。愿这些微小的光，在往后的日子里继续照亮你。</p></div></section>}

      <nav aria-label="主导航"><button className={view === "home" ? "active" : ""} onClick={() => setView("home")}>⌂<span>记录</span></button><button className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")}>▤<span>时光</span></button><button onClick={() => setView("month")}>◌<span>回顾</span></button></nav>

      {active && <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setActive(null)}><section className={`composer ${active.tone}`}><button className="close" onClick={() => setActive(null)} aria-label="关闭">×</button><span className="note-icon">{active.icon}</span><div className="composer-label">{active.title}</div><h2>{active.hint}</h2><textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="写下一句话就好……" maxLength={300}/>{active.title === "感谢他人" && <label className="send-option"><input type="checkbox"/> 同时生成一张感谢卡，发送给对方</label>}<div className="composer-foot"><small>{text.length}/300</small><button className={saved ? "saved" : ""} onClick={saveNote}>{saved ? "已经替你收好了 ✓" : "收好这片微光"}</button></div></section></div>}
    </main>
  );
}
