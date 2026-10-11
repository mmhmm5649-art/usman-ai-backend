const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Rate Limiting to prevent API abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' }
});

app.use('/api/', apiLimiter);

// Root endpoint for simple browser status verification
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    app: 'USMAN AI 2.0 Backend Service',
    endpoints: {
      health: 'GET /health',
      tts: 'POST /api/tts',
      chat: 'POST /api/chat'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'USMAN AI 2.0 Backend Proxy',
    timestamp: new Date().toISOString()
  });
});

/**
 * Text-to-Speech proxy endpoint for ElevenLabs
 * POST /api/tts
 * Body: { text: string, voice_id?: string, voice_settings?: object }
 */
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice_id, voice_settings } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text payload is required and must not be empty.' });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ELEVENLABS_API_KEY is not configured on the backend server.' });
    }

    const voiceId = voice_id || process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
    const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

    const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?optimize_streaming_latency=2`;

    const response = await fetch(elevenLabsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: modelId,
        voice_settings: voice_settings || {
          stability: 0.65,
          similarity_boost: 0.80
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ElevenLabs API Error ${response.status}]:`, errText);
      return res.status(response.status).json({ error: 'Failed to synthesize voice from ElevenLabs.' });
    }

    // Pipe audio stream to Android client
    res.setHeader('Content-Type', 'audio/mpeg');
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);

  } catch (error) {
    console.error('[TTS Handler Exception]:', error.message);
    res.status(500).json({ error: 'Internal server error processing TTS request.' });
  }
});

/**
 * Gemini Chat Reasoning proxy endpoint (Optional backend router)
 * POST /api/chat
 * Body: { prompt: string, history?: array }
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt, history } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the backend server.' });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const contents = [];
    if (Array.isArray(history)) {
      history.slice(-6).forEach(msg => {
        contents.push({
          role: msg.isUser ? 'user' : 'model',
          parts: [{ text: msg.text }]
        });
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{
            text: 'You are USMAN AI 2.0, an advanced personal voice assistant. Provide concise, spoken-friendly responses without markdown syntax. Support English, Telugu, and Hindi.'
          }]
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Gemini API Error ${response.status}]:`, errText);
      return res.status(response.status).json({ error: 'Gemini API call failed.' });
    }

    const data = await response.json();
    const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';

    res.json({ text: replyText });

  } catch (error) {
    console.error('[Chat Handler Exception]:', error.message);
    res.status(500).json({ error: 'Internal server error generating AI reply.' });
  }
});
// OpenAI API proxy for USMAN AI 2.0
app.post(['/api/openai', '/api/openai/'], async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'OPENAI_API_KEY is not configured on the backend server.'
      });
    }

    const { messages, prompt } = req.body || {};

    let chatMessages = Array.isArray(messages) ? messages : [];

    if (chatMessages.length === 0 && typeof prompt === 'string' && prompt.trim()) {
      chatMessages = [{ role: 'user', content: prompt.trim() }];
    }

    if (chatMessages.length === 0) {
      return res.status(400).json({
        error: 'Provide a messages array or a non-empty prompt.'
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: chatMessages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[OpenAI API Error]:', response.status, data);
      return res.status(response.status).json({
        error: data.error?.message || 'OpenAI API request failed.'
      });
    }

    const replyText = data.choices?.[0]?.message?.content || '';

    return res.json({
      text: replyText,
      reply: replyText,
      message: replyText
    });
  } catch (error) {
    console.error('[OpenAI Handler Exception]:', error.message);
    return res.status(500).json({
      error: 'Internal server error generating OpenAI reply.'
    });
  }
});
app.listen(PORT, () => {
  console.log(`USMAN AI 2.0 Backend running on port ${PORT}`);
});
