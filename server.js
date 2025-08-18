require('dotenv').config();
const express = require('express');
const cors = require('cors');
const undici = require('undici');
const NodeCache = require('node-cache');

const app = express();
const responseCache = new NodeCache({ stdTTL: 600 });
const corsOptions = {
  origin: '*'
};

app.use(cors(corsOptions));
app.use(express.json());

const apiKeyAuth = (req, res, next) => {
    const apiKey = req.header('X-API-Key');
    if (apiKey && apiKey === process.env.MY_SECRET_API_KEY) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }
};

async function getOpenAIResponse(prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }]
        }),
        dispatcher: new undici.Agent({
            headersTimeout: 30_000,
            bodyTimeout: 30_000,
        })
    });

    const data = await response.json();
    if (!response.ok) {
        console.error('OpenAI API Error:', data);
        throw new Error(data.error?.message || 'Failed to get response from OpenAI.');
    }
    return data.choices?.[0]?.message?.content || 'Maaf, terjadi kesalahan saat memproses jawaban.';
}

app.get('/', (req, res) => {
    res.status(200).send(`
        <div style="font-family: sans-serif; text-align: center; padding: 40px;">
            <h1 style="color: #2c3e50;">VERSION 1.0.0</h1>
            <p style="color: #34495e; font-size: 1.2em;">Service is up and running..</p>
        </div>
    `);
});

app.post('/ask', apiKeyAuth, async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  if (prompt.length > 2000) {
    return res.status(400).json({ error: 'Prompt is too long.' });
  }

  try {
    const cachedAnswer = responseCache.get(prompt);
    if (cachedAnswer) {
        console.log('Serving from cache...');
        return res.json({ answer: cachedAnswer });
    }

    const answer = await getOpenAIResponse(prompt);
    
    responseCache.set(prompt, answer);
    res.json({ answer });

  } catch (err) {
    console.error('Error in /ask route:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/neuroner', apiKeyAuth, async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  if (prompt.length > 10000) {
    return res.status(400).json({ error: 'Prompt is too long. Maximum 10,000 characters allowed.' });
  }

  try {
    const cachedAnswer = responseCache.get(prompt);
    if (cachedAnswer) {
        console.log('Serving from cache...');
        return res.json({ answer: cachedAnswer });
    }
    const answer = await getOpenAIResponse(prompt);
    responseCache.set(prompt, answer);
    res.json({ answer });
  } catch (err) {
    console.error('[Service NEURONER ERROR]', err);
    res.status(500).json({ 
      error: err.message || 'Failed to process neuroner request' 
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`AI Responder API listening on port ${PORT}`));
