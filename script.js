/***** Full script.js: NetWise (Gemini) + WebSocket frontend *****/

 /***** Frontend logic (vanilla JS) *****/
document.addEventListener('DOMContentLoaded', () => {
  const WS_URL = 'ws://localhost:3000/';

  const LOADER_FADE_MS = 1200; // ms to fully fade loader out
  const ANIMATION_DELAY_MS = 300; // extra delay before showing app
  let ws = null;
  let soundOn = true;

  // DOM refs
  const loader = document.getElementById('loader');
  const app = document.getElementById('app');
  const connDot = document.getElementById('conn-dot');
  const connText = document.getElementById('conn-text');
  const messages = document.getElementById('messages');
  const form = document.getElementById('form');
  const input = document.getElementById('input');
  const topicChips = document.getElementById('topic-chips');
  const clearBtn = document.getElementById('clearBtn');
  const toggleSound = document.getElementById('toggleSound');

  // Elements for Gemini (NetWise) UI (if present)
  const sendBtn = document.getElementById('sendBtn');         // button to send to Gemini
  const chatInput = document.getElementById('chatInput');     // text area/input for Gemini
  const askButton = document.getElementById('askButton');     // another Gemini trigger (coding Q)
  const questionInput = document.getElementById('questionInput');
  const outputArea = document.getElementById('outputArea');
  const loadingIndicator = document.getElementById('loadingIndicator');

  // Basic safety if some elements are missing
  if (!loader || !app || !messages || !form || !input) {
    console.error('Essential DOM nodes missing. Check your HTML IDs (loader, app, messages, form, input).');
    return;
  }

  const SUGGESTED = ['TCP', 'Routing', 'DNS', 'Congestion Control', 'Socket programming', 'ARP', 'DHCP'];

  // Create topic chips
  if (topicChips) {
    SUGGESTED.forEach(t => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'text-xs px-3 py-1 rounded-full bg-slate-700/50 text-slate-200 hover:bg-slate-700 hover:text-sky-400 transition';
      btn.innerText = t;
      btn.onclick = () => { input.value = t; input.focus(); };
      topicChips.appendChild(btn);
    });
  }

  // Sound ping for responses
  function playPing(){
    if(!soundOn) return;
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.value = 0.02;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.06);
    }catch(e){
      // ignore if audio context unavailable
    }
  }

  // Connection indicator logic
  function setConn(status, text){
    if (!connDot || !connText) return;
    const dotClass = status === 'connected'
      ? 'bg-green-500 shadow-green-500/50'
      : (status === 'connecting'
          ? 'bg-yellow-400 shadow-yellow-400/30 animate-pulse'
          : 'bg-red-500 shadow-red-500/50');
    connDot.className = `w-3 h-3 rounded-full ${dotClass} shadow-md`;
    connText.textContent = text;
  }

  // Message rendering logic
  function appendMessage(text, who='bot'){
    const welcome = document.getElementById('welcome');
    if(welcome) welcome.remove();

    const wrapper = document.createElement('div');
    wrapper.className = 'flex ' + (who === 'user' ? 'justify-end' : 'justify-start');

    const bubble = document.createElement('div');
    bubble.className = (who === 'user' ? 'bubble-user' : 'bubble-bot') + ' px-4 py-2 rounded-2xl max-w-[80%] break-words whitespace-pre-wrap';

    if (who === 'bot') {
      bubble.innerHTML = `<span class="text-violet-500 text-lg mr-2 inline-block">⚡</span>${text}`;
    } else {
      bubble.textContent = text;
    }

    wrapper.appendChild(bubble);
    messages.appendChild(wrapper);
    // smooth scroll
    messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });

    if(who === 'bot') playPing();
  }

  // Typing indicator
  function showTyping(){
    hideTyping();
    const el = document.createElement('div');
    el.className = 'flex items-center gap-2';
    el.id = 'typing';
    el.innerHTML = '<div class="w-3 h-3 rounded-full bg-sky-400/80 animate-pulse shadow-lg shadow-sky-400/40"></div><div class="text-slate-300 text-sm">NetWise is typing…</div>';
    messages.appendChild(el);
    messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
  }
  function hideTyping(){ const t = document.getElementById('typing'); if(t) t.remove(); }

  // Logic to fade out the loader and show the app
  function transitionToApp() {
    // Ensure loader is visible first
    if (loader) {
      loader.style.opacity = '0';
      // after fade, hide it
      setTimeout(() => {
        if (loader) loader.style.visibility = 'hidden';
      }, LOADER_FADE_MS);
    }
    // reveal the app
    app.style.opacity = '1';
    app.style.pointerEvents = 'auto';
    app.removeAttribute('aria-hidden');
  }

  /***** GEMINI (NetWise) API Integration *****/
  // Keep the key here for local dev; consider moving to server for production
  const GEMINI_API_KEY = "AIzaSyAvWfZqVWS9BRg4sFQRgKstub68HiCRxlQ";
  const MODEL_NAME = "gemini-2.5-flash";
  const systemInstructionText = `
You are NetWise — an AI that ONLY answers Computer Networking questions:
OSI layers, TCP/IP, routing, switching, DNS, DHCP, ARP, network security, IoT protocols.
Politely refuse non-networking questions.
You may greet when user says hi or hello.
Tone: short, technical, helpful.
`;

  async function sendToGemini(message) {
    // Use showTyping/ hideTyping + appendMessage for consistent UI
    appendMessage(message,"user");
    showTyping();

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
    const requestBody = {
      contents:[{role:"user",parts:[{text:message}]}],
      systemInstruction:{parts:[{text:systemInstructionText}]}
    };

    try {
      const res = await fetch(API_URL,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const txt = await res.text();
        hideTyping();
        appendMessage(`API Error: ${res.status} ${res.statusText} - ${txt}`,"bot");
        return;
      }

      const data = await res.json();
      hideTyping();

      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI";
      appendMessage(reply,"bot");
    } catch(err){
      hideTyping();
      appendMessage("Error: "+(err.message || err),"bot");
    }
  }

  // Chat input (Gemini / NetWise)
  if (sendBtn && chatInput) {
    sendBtn.addEventListener("click",()=>{ const msg = chatInput.value.trim(); if(msg){ chatInput.value=""; sendToGemini(msg);} });
    chatInput.addEventListener("keypress",e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendBtn.click(); } });
  }

  // Gemini coding question button (if present) — uses same NetWise model
  if (askButton && questionInput && outputArea && loadingIndicator) {
    askButton.addEventListener("click", async () => {
      const question = questionInput.value.trim();
      if(!question){ outputArea.innerHTML="Please enter a coding question."; return;}
      outputArea.innerHTML=""; loadingIndicator.style.display="block"; askButton.disabled=true;

      const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
      const requestBody = {
        contents: [{ role: "user", parts: [{ text: question }] }],
        systemInstruction: { parts: [{ text: systemInstructionText }] }
      };

      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        });

        if (!res.ok) {
          const errtxt = await res.text();
          throw new Error(`API Error: ${res.status} ${res.statusText} — ${errtxt}`);
        }

        const data = await res.json();
        const answerText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No answer.";

        outputArea.innerHTML = answerText.replace(
          /(```[\s\S]*?```)|(`[^`]+`)/g,
          m =>
            m.startsWith("```")
              ? `<pre><code>${m.replace(/```/g, '')}</code></pre>`
              : `<code>${m.replace(/`/g, '')}</code>`
        );
      } catch (err) {
        outputArea.innerHTML = "Error: " + err.message;
      } finally {
        askButton.disabled = false;
        loadingIndicator.style.display = "none";
      }
    });
  }

  /***** WebSocket connection handler *****/
  function connect(){
    setConn('connecting','Connecting...');
    // make loader visible (in case reconnect)
    if (loader) { loader.style.visibility = 'visible'; loader.style.opacity = '1'; }
    app.setAttribute('aria-hidden', 'true');
    app.style.pointerEvents = 'none';

    // ensure the app shows after a minimum duration even if WS fails quickly
    setTimeout(() => {
      transitionToApp();
    }, LOADER_FADE_MS + ANIMATION_DELAY_MS);

    try {
      ws = new WebSocket(WS_URL);
    } catch (err) {
      console.error('WebSocket creation failed:', err);
      setConn('disconnected', 'WS failed');
      appendMessage('WebSocket creation failed. Check URL.', 'bot');
      return;
    }

    ws.onopen = () => {
      setConn('connected','Connected');
      appendMessage('Connection established. Ask a CN question.', 'bot');
    };

    ws.onmessage = (ev) => {
      // assume plain text from server; if JSON, adjust accordingly
      try { hideTyping(); appendMessage(typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data)); }
      catch (e) { console.error('onmessage error', e); }
    };

    ws.onclose = () => {
      setConn('disconnected','Disconnected');
      appendMessage('Bridge disconnected.', 'bot');
    };

    ws.onerror = (e) => {
      setConn('disconnected','Error');
      appendMessage('Connection error. Is the bridge running?', 'bot');
      console.error('WebSocket error', e);
    };
  }

  // Submit handler (sends to WebSocket bridge)
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if(!text) return;
    appendMessage(text, 'user');
    input.value = '';
    if(!ws || ws.readyState !== WebSocket.OPEN){
      appendMessage('Not connected to bridge. Try reconnecting.', 'bot');
      return;
    }
    try{
      ws.send(JSON.stringify({ type:'prompt', prompt:text }));
      showTyping();
    }catch(e){
      appendMessage('Send failed: ' + (e.message || e), 'bot');
    }
  });

  // Clear chat
  if (clearBtn) {
    clearBtn.addEventListener('click', ()=> {
      messages.innerHTML = '';
      messages.innerHTML = '<div id="welcome" class="text-center text-slate-400 pt-12"><div class="text-3xl text-sky-400 font-extrabold tracking-wide">NETWORK YOUR KNOWLEDGE</div><div class="mt-4 text-slate-300">Type a question about Computer Networks to begin.</div></div>';
    });
  }

  // Toggle sound
  if (toggleSound) {
    toggleSound.addEventListener('click', ()=> {
      soundOn = !soundOn;
      toggleSound.textContent = soundOn ? '🔔' : '🔕';
    });
  }

  // reconnect on focus
  window.addEventListener('focus', ()=> {
    if(!ws || ws.readyState === WebSocket.CLOSED) connect();
  });

  // Decorative particles
  (function spawnParticles(){
    const container = document.getElementById('particles');
    if (!container) return;
    for(let i=0;i<20;i++){
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random()*100 + 'vw';
      p.style.top = Math.random()*100 + 'vh';
      p.style.opacity = (Math.random()*0.07 + 0.02);
      p.style.transform = 'scale(' + (Math.random()*1.4+0.3) + ')';
      container.appendChild(p);
    }
  })();

  // Initial connect on load
  connect();
});
