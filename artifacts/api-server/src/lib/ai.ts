import OpenAI from "openai";

// Configurable AI provider — defaults to OpenAI-compatible endpoint
// Set AI_API_KEY and optionally AI_BASE_URL + AI_MODEL in env
const client = new OpenAI({
  apiKey: process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY ?? "sk-placeholder",
  baseURL: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
});

const DEFAULT_MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";

export async function generateProjectPackage(prompt: string, context?: string, imageUrl?: string, educationMode?: boolean) {
  const systemPrompt = `You are MakerForge AI — a precision engineering assistant that transforms hardware project ideas into complete, buildable project packages.

Output a single JSON object with this exact structure:
{
  "title": "string — short project title",
  "description": "string — 2-3 sentence overview",
  "category": "string — e.g. Electronics, Mechanical, Robotics, Energy, IoT",
  "skillLevel": "beginner|intermediate|advanced",
  "estimatedCost": number (USD, balanced tier),
  "estimatedTime": "string e.g. 4-6 hours",
  "mechanical": {
    "openScadCode": "string — complete parametric OpenSCAD code with comments",
    "printSettings": "string — layer height, infill, supports, material recommendations",
    "materials": ["string"],
    "assemblyNotes": "string"
  },
  "electronics": {
    "schematicDescription": "string — describe the circuit clearly",
    "kiCadInstructions": "string — net list and component placement guidance",
    "wiringDiagram": "string — ASCII or text wiring diagram",
    "powerCalcs": "string — voltage, current, power calculations",
    "components": ["string — component name with spec"]
  },
  "bom": {
    "tiers": {
      "budget": [{"name":"string","quantity":number,"unit":"string","estimatedPrice":number,"affiliateUrl":null,"supplier":"AliExpress/LCSC","partNumber":"string or null","alternatives":["string"]}],
      "balanced": [{"name":"string","quantity":number,"unit":"string","estimatedPrice":number,"affiliateUrl":null,"supplier":"Digi-Key/Mouser","partNumber":"string or null","alternatives":["string"]}],
      "premium": [{"name":"string","quantity":number,"unit":"string","estimatedPrice":number,"affiliateUrl":null,"supplier":"Premium/Local","partNumber":"string or null","alternatives":["string"]}]
    }
  },
  "buildGuide": {
    "steps": [{"stepNumber":number,"title":"string","description":"string","imageUrl":null,"warning":"string or null"}],
    "toolsList": ["string"],
    "estimatedTime": "string",
    "estimatedCost": number,
    "troubleshooting": "string — common issues and fixes"
  },
  "educationPack": ${educationMode ? `{
    "lessonPlan": "string — full lesson plan markdown",
    "learningObjectives": ["string"],
    "ngssAlignments": ["string — NGSS standard code and description"],
    "worksheetMarkdown": "string — printable student worksheet in markdown",
    "reflectionPrompts": ["string"],
    "ageGroups": ["string — e.g. Grades 6-8", "Grades 9-12"]
  }` : `null`},
  "safety": {
    "riskScore": number (1-10),
    "riskLevel": "low|medium|high",
    "disclaimers": ["string"],
    "safetyNotes": ["string"],
    "environmentalImpact": "string"
  }
}

Always provide complete, working OpenSCAD code. Always include at least 8 BOM items per tier. Build guide should have at least 6 steps. Be specific and technical.
DISCLAIMER: All designs are educational/inspirational. Users must verify all designs before fabrication.`;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  if (context) {
    messages.push({ role: "assistant", content: `Previous context: ${context}` });
  }

  const userContent: OpenAI.Chat.ChatCompletionUserMessageParam["content"] = imageUrl
    ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageUrl } },
      ]
    : prompt;

  messages.push({ role: "user", content: userContent });

  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages,
    response_format: { type: "json_object" },
    max_tokens: 8000,
    temperature: 0.7,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw);
}

export async function refineSection(section: string, prompt: string, currentContent: any, projectContext: string) {
  const systemPrompt = `You are MakerForge AI. The user wants to refine the "${section}" section of their hardware project.
Return ONLY a JSON object representing the updated "${section}" section data (same schema as before).
Project context: ${projectContext}`;

  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Current ${section} data: ${JSON.stringify(currentContent)}\n\nUser request: ${prompt}` },
    ],
    response_format: { type: "json_object" },
    max_tokens: 4000,
    temperature: 0.7,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw);
}

export async function generateChatResponse(projectContext: string, userMessage: string, chatHistory: Array<{role: string, content: string}>) {
  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: "system",
        content: `You are MakerForge AI assistant. Help the user iterate on their hardware project. Project context: ${projectContext}. Be concise and technical. Suggest specific changes.`,
      },
      ...chatHistory.slice(-10).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: userMessage },
    ],
    max_tokens: 1000,
    temperature: 0.7,
  });
  return response.choices[0]?.message?.content ?? "I couldn't process that request.";
}
