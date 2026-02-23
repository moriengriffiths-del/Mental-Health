/**
 * Simple multi-page survey.
 * Stores answers in localStorage so each page can be a real "page".
 */
const STORAGE_KEY = "mhSurvey_v1";

const SCALE = [
  { label: "Very bad",  score: 1, emoji: "😞", hint: "I’m struggling" },
  { label: "Bad",       score: 2, emoji: "😕", hint: "Not great" },
  { label: "Neutral",   score: 3, emoji: "😐", hint: "So-so" },
  { label: "Good",      score: 4, emoji: "🙂", hint: "Pretty okay" },
  { label: "Very good", score: 5, emoji: "😄", hint: "I’m doing well" },
];

function loadState(){
  try{
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { answers: {}, startedAt: Date.now() };
  }catch(e){
    return { answers: {}, startedAt: Date.now() };
  }
}
function saveState(state){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState(){
  localStorage.removeItem(STORAGE_KEY);
}

function totalScore(state){
  const vals = Object.values(state.answers).map(Number).filter(n => !Number.isNaN(n));
  return vals.reduce((a,b)=>a+b,0);
}
function answeredCount(state){
  return Object.keys(state.answers).length;
}

function setProgress(qIndex, total){
  const bar = document.querySelector(".progress > div");
  if(!bar) return;
  const pct = Math.round((qIndex / total) * 100);
  bar.style.width = pct + "%";
}

function renderOptions(container, currentScore, onPick){
  container.innerHTML = "";
  for(const opt of SCALE){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option" + (currentScore === opt.score ? " selected" : "");
    btn.setAttribute("data-score", String(opt.score));

    btn.innerHTML = `
      <span class="left">
        <span class="face" aria-hidden="true">${opt.emoji}</span>
        <span style="min-width:0">
          <span class="label">${opt.label}</span>
          <span class="sub">${opt.hint}</span>
        </span>
      </span>
      <span class="score">${opt.score} pt</span>
    `;
    btn.addEventListener("click", () => onPick(opt.score));
    container.appendChild(btn);
  }
}

function initQuestionPage(){
  const root = document.querySelector("[data-question-id]");
  if(!root) return;

  const qId = root.getAttribute("data-question-id");
  const qIndex = Number(root.getAttribute("data-question-index")); // 1..10
  const total = Number(root.getAttribute("data-question-total"));  // 10
  const nextUrl = root.getAttribute("data-next-url");
  const prevUrl = root.getAttribute("data-prev-url");

  const state = loadState();
  const existing = Number(state.answers[qId] || 0) || null;

  // header pill
  const pill = document.querySelector("[data-pill]");
  if(pill){
    pill.textContent = `Question ${qIndex} of ${total}`;
  }

  setProgress(qIndex-1, total);

  // render options
  const container = document.querySelector("[data-options]");
  const nextBtn = document.querySelector("[data-next]");
  const backBtn = document.querySelector("[data-back]");

  let selected = existing;

  function updateButtons(){
    if(nextBtn) nextBtn.disabled = !selected;
    // highlight selected
    const opts = Array.from(container.querySelectorAll(".option"));
    opts.forEach(o => o.classList.toggle("selected", Number(o.dataset.score) === selected));
  }

  renderOptions(container, selected, (score) => {
    selected = score;
    state.answers[qId] = score;
    saveState(state);
    updateButtons();
    // auto-advance after a short delay to feel like "next page"
    window.setTimeout(() => window.location.href = nextUrl, 180);
  });

  if(nextBtn){
    nextBtn.disabled = !selected;
    nextBtn.addEventListener("click", () => {
      if(!selected) return;
      window.location.href = nextUrl;
    });
  }
  if(backBtn){
    backBtn.addEventListener("click", () => window.location.href = prevUrl || "index.html");
  }

  updateButtons();
  setProgress(qIndex, total);
}

function bracketFromScore(score){
  // Matches your sketch:
  // 5-20: talk to someone / wellbeing contact
  // 21-30: repeat test in a week
  // 31-40: you're chilling
  // 41-50: thriving (extra top bracket so the scale completes)
  if(score <= 20) return { key:"support", label:"Consider reaching out", note:"Your score suggests you may benefit from talking to someone." };
  if(score <= 30) return { key:"watch", label:"Keep an eye on it", note:"You might want to check in again in a week." };
  if(score <= 40) return { key:"okay", label:"You’re doing okay", note:"Overall you seem to be managing — keep up the healthy habits." };
  return { key:"great", label:"You’re thriving", note:"You’re reporting a strong level of wellbeing right now." };
}

function initHomePage(){
  const startBtn = document.querySelector("[data-start]");
  const resetBtn = document.querySelector("[data-reset]");
  const state = loadState();
  const pill = document.querySelector("[data-pill]");
  if(pill){
    const n = answeredCount(state);
    pill.textContent = n ? `Saved progress: ${n}/10` : "10 quick questions";
  }
  if(startBtn){
    startBtn.addEventListener("click", () => {
      window.location.href = "q1.html";
    });
  }
  if(resetBtn){
    resetBtn.addEventListener("click", () => {
      resetState();
      window.location.reload();
    });
  }
}

function initResultPage(){
  const state = loadState();
  const count = answeredCount(state);
  if(count < 10){
    // if incomplete, send them back to first unanswered
    for(let i=1;i<=10;i++){
      if(!(state.answers[`q${i}`])){
        window.location.href = `q${i}.html`;
        return;
      }
    }
  }

  const score = totalScore(state);
  const bracket = bracketFromScore(score);

  const nEl = document.querySelector("[data-total]");
  const badge = document.querySelector("[data-badge]");
  const note = document.querySelector("[data-note]");
  if(nEl) nEl.textContent = String(score);
  if(badge) badge.textContent = bracket.label;
  if(note) note.textContent = bracket.note;

  // show tailored panel
  const panel = document.querySelector("[data-panel]");
  if(panel){
    let html = "";
    if(bracket.key === "support"){
      html = `
        <p><strong>Suggestion:</strong> talk to someone you trust, or use one of the support options below.</p>
        <ul class="resources">
          <li><strong>University / local wellbeing:</strong> replace this with your wellbeing contact (e.g., “Exeter Wellbeing”).</li>
          <li><strong>NHS urgent mental health helpline:</strong> check your local number on the NHS site.</li>
          <li><strong>Immediate danger:</strong> call <strong>999</strong>.</li>
          <li><strong>Someone to talk to (UK):</strong> Samaritans <strong>116 123</strong> (24/7).</li>
        </ul>
      `;
    }else if(bracket.key === "watch"){
      html = `
        <p><strong>Suggestion:</strong> try a small change this week (sleep, movement, fresh air, talking to someone), then re‑take the test in 7 days.</p>
        <ul class="resources">
          <li>Put a reminder in your calendar to re‑test in a week.</li>
          <li>If things get worse, use the support contacts below.</li>
        </ul>
      `;
    }else if(bracket.key === "okay"){
      html = `
        <p><strong>Suggestion:</strong> keep doing what’s working — and check in again if your mood changes.</p>
        <ul class="resources">
          <li>Maintain routines that support you (sleep, food, friends, movement).</li>
          <li>If you want extra support, the contacts below are still available.</li>
        </ul>
      `;
    }else{
      html = `
        <p><strong>Suggestion:</strong> great job — keep the habits that are helping you feel good.</p>
        <ul class="resources">
          <li>Consider sharing what helps you with a friend — it can support them too.</li>
          <li>Re‑take the test any time you want a quick check‑in.</li>
        </ul>
      `;
    }
    panel.innerHTML = html;
  }

  const againBtn = document.querySelector("[data-again]");
  const clearBtn = document.querySelector("[data-clear]");
  if(againBtn){
    againBtn.addEventListener("click", () => window.location.href = "q1.html");
  }
  if(clearBtn){
    clearBtn.addEventListener("click", () => {
      resetState();
      window.location.href = "index.html";
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initHomePage();
  initQuestionPage();
  initResultPage();
});
