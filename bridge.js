import WebSocket, { WebSocketServer } from "ws";
import fetch from "node-fetch";

const WSS_PORT = 3000;

// 🔑 YOUR API KEY HERE
const GEMINI_API_KEY = "AIzaSyAvWfZqVWS9BRg4sFQRgKstub68HiCRxlQ";

const MODEL = "gemini-2.5-flash";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const systemInstructionText = `
You are NetWise — an AI that ONLY answers Computer Networking questions:
OSI layers, TCP/IP, routing, switching, DNS, DHCP, ARP, network security, IoT protocols.
Politely refuse non-networking questions.
You may greet when user says hi or hello.
Tone: short, technical, helpful.
`;

console.log(`✅ WebSocket Bridge ready on ws://localhost:${WSS_PORT}`);

const wss = new WebSocketServer({ port: WSS_PORT });

wss.on("connection", (ws) => {
  console.log("🌐 Client connected");

  ws.on("message", async (msgRaw) => {
    let text;

    try {
      text = JSON.parse(msgRaw.toString()).prompt;
    } catch {
      text = msgRaw.toString();
    }

    console.log("📩 UI →", text);

    try {
      const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            role: "system",
            parts: [{ text: systemInstructionText }]
          },
          contents: [
            { role: "user", parts: [{ text }] }
          ]
        })
      });

      const data = await response.json();
      console.log("🔥 Gemini raw:", data);

      const reply =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "❌ NetWise blocked non-networking topic.";

      ws.send(reply);
      console.log("🤖 Sent →", reply);

    } catch (err) {
      console.error("❌ Gemini Error: ", err);
      ws.send("⚠️ Internal error: NetWise unreachable.");
    }
  });

  ws.send("✅ Connected to NetWise! Ask a CN question.");
});
