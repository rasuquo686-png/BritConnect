import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey),
    timestamp: new Date().toISOString(),
  });
});

// Executive Summary Generation
app.post('/api/gemini/executive-summary', async (req, res) => {
  try {
    const { metrics, keySegments, topReasons, riskSummary } = req.body;
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured in environment secrets.',
      });
    }

    const prompt = `You are the Chief Data Officer & Retention Strategist for BritConnect, a major UK telecommunications provider.
Review the following deterministic customer metrics and generate an executive summary.

DETERMINISTIC METRICS EVIDENCE:
- Total Customers: ${metrics.totalCustomers}
- Active Customers: ${metrics.activeCustomers}
- Churned Customers: ${metrics.churnedCustomers}
- Churn Rate: ${metrics.churnRate}%
- Monthly Revenue Lost to Churn: £${metrics.monthlyRevenueLost?.toLocaleString()}
- Predicted Monthly Revenue at Risk: £${metrics.monthlyRevenueAtRisk?.toLocaleString()}
- Avg Monthly Charge: £${metrics.avgMonthlyCharge}
- Avg Tenure: ${metrics.avgTenure} months
- Net Promoter Score (NPS): ${metrics.nps}
- Critical/High Risk Active Customers: ${metrics.highRiskCount} (${metrics.highRiskPct}%)
- Model ROC-AUC: ${metrics.modelAuc || 'N/A'}

KEY SEGMENT CHURN FINDINGS:
${JSON.stringify(keySegments, null, 2)}

TOP RECORDED CHURN REASONS:
${JSON.stringify(topReasons, null, 2)}

ACTIVE CUSTOMER RISK DISTRIBUTION:
${JSON.stringify(riskSummary, null, 2)}

INSTRUCTIONS:
1. Every number in your analysis MUST match the evidence above. Never invent numbers.
2. Provide:
   - "headlineFindings": Array of 5 concise, data-grounded strategic findings (e.g., out-of-contract vulnerability, competitor pricing pressure, fiber upgrade friction).
   - "strategicRisks": Array of 3 critical risks to revenue and EBITDA over the next quarter.
   - "recommendedActions": Array of 3 prioritized executive interventions with target audience and expected operational owner.
3. Tone: Authoritative, British telecommunications executive consultancy style. Return purely JSON matching the structure.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    res.json(JSON.parse(text));
  } catch (error: any) {
    console.error('Gemini executive summary error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate summary' });
  }
});

// AI Retention Recommendations
app.post('/api/gemini/recommendations', async (req, res) => {
  try {
    const { scope, evidencePacket } = req.body;
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured in environment secrets.',
      });
    }

    const prompt = `You are a Principal Retention Data Scientist for BritConnect (UK Telecom).
Generate tailored, high-impact retention recommendations based strictly on the provided evidence packet.

SCOPE: ${scope} (e.g. Portfolio, Segment, or Individual)
EVIDENCE PACKET (DETERMINISTIC):
${JSON.stringify(evidencePacket, null, 2)}

MANDATORY RULES:
- Ground every single metric, percentage, customer count, and pound (£) amount strictly in the evidence packet.
- Strictly adhere to UK Ofcom and consumer fair-treatment regulations. Do not use protected characteristics (gender, age) for commercial targeting.
- Generate an array of recommendations. Each recommendation must have:
  - id: unique string
  - title: clear, punchy title
  - priority: "P1 (Immediate 0-14d)" | "P2 (30d)" | "P3 (60-90d)"
  - priorityRankScore: number (benefit/effort ratio 1-10)
  - targetAudience: description of targeted customer cohort, size (number), and £ monthly revenue at risk
  - rootCause: behavioral, commercial or network driver
  - evidencePoints: array of 3-5 quantified facts from the evidence packet
  - personalizedAction: concrete offer or operational intervention (e.g. loyalty contract renewal, engineer appointment with bill credit, direct debit migration incentive)
  - implementationSteps: array of 4-6 objects with { stepNumber, step, ownerRole, channel, timing }
  - expectedImpact: { addressableCustomers, assumedSaveRatePct, grossMonthlySavedGbp, netBenefitGbpLow, netBenefitGbpBase, netBenefitGbpHigh, assumptionsUsed }
  - kpis: array of 3-4 objects with { name, baseline, target, measurementWindow, dataSource }
  - risksAndGuardrails: array of 2-3 risks (margin erosion, fatigue, regulatory)
  - testDesign: description of recommended A/B or holdout test (e.g. 10% holdout group for 60 days)
  - confidence: "High" | "Medium" | "Low"

Return ONLY valid JSON matching this structure.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{"recommendations":[]}';
    res.json(JSON.parse(text));
  } catch (error: any) {
    console.error('Gemini recommendations error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate recommendations' });
  }
});

// AI Analyst Natural Language Chatbot with Local Tool Call Reflection
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { messages, datasetContext } = req.body;
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured in environment secrets.',
      });
    }

    const systemInstruction = `You are the BritConnect AI Analyst — an expert UK Telecom data scientist and commercial strategist embedded in BritConnect's Customer Churn Intelligence Platform.
You have immediate access to the current dataset context and model metrics:

CURRENT DATASET SUMMARY:
${JSON.stringify(datasetContext, null, 2)}

CORE PRINCIPLES & GUARDRAILS:
1. Every numeric metric must come directly from the dataset context or computed tools. Do NOT guess or hallucinate any numbers.
2. If data needed to answer a query is not in the context, explicitly state that and specify which columns are missing.
3. Currency is GBP (£) and UK date format (DD/MM/YYYY).
4. Guardrails: Refuse any request to discriminate based on protected characteristics (Gender, Age) for offer eligibility under UK Equality Act & Ofcom rules.
5. Provide actionable commercial clarity, executive insight, and concrete next steps.
6. When suggesting an analytical breakdown, provide structured data or suggest specific chart visualisations.`;

    // Format chat history
    const contents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
      },
    });

    const reply = response.text || 'I analyzed the current data but could not generate a response.';
    res.json({ reply });
  } catch (error: any) {
    console.error('Gemini chat error:', error);
    res.status(500).json({ error: error.message || 'Chat service encountered an issue' });
  }
});

// Serve frontend in production or integrate with Vite in development
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BritConnect server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
