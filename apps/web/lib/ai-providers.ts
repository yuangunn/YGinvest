/**
 * Plan #24 — Multi-provider AI wrapper.
 * 각 provider의 chat API를 한 형식으로 추상화.
 */

export type Provider = "anthropic" | "openai" | "google";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type ChatResult = {
  text: string;
  model: string;
  tokens?: { input: number; output: number };
};

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-3-5-sonnet-latest",
  openai: "gpt-4o-mini",
  google: "gemini-1.5-flash-latest",
};

export const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: "Anthropic Claude",
  openai: "OpenAI GPT",
  google: "Google Gemini",
};

export const PROVIDER_INFO: Record<
  Provider,
  { url: string; keyFormat: string; defaultModel: string; modelOptions: string[] }
> = {
  anthropic: {
    url: "https://console.anthropic.com/settings/keys",
    keyFormat: "sk-ant-...",
    defaultModel: "claude-3-5-sonnet-latest",
    modelOptions: [
      "claude-3-5-sonnet-latest",
      "claude-3-5-haiku-latest",
      "claude-3-opus-latest",
    ],
  },
  openai: {
    url: "https://platform.openai.com/api-keys",
    keyFormat: "sk-...",
    defaultModel: "gpt-4o-mini",
    modelOptions: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  },
  google: {
    url: "https://aistudio.google.com/app/apikey",
    keyFormat: "AIzaSy...",
    defaultModel: "gemini-1.5-flash-latest",
    modelOptions: [
      "gemini-1.5-pro-latest",
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash-8b-latest",
    ],
  },
};

/**
 * Anthropic Claude API (Messages API v1).
 */
async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<ChatResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";
  return {
    text,
    model: data.model ?? model,
    tokens: {
      input: data.usage?.input_tokens ?? 0,
      output: data.usage?.output_tokens ?? 0,
    },
  };
}

/**
 * OpenAI Chat Completions API.
 */
async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<ChatResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  return {
    text,
    model: data.model ?? model,
    tokens: {
      input: data.usage?.prompt_tokens ?? 0,
      output: data.usage?.completion_tokens ?? 0,
    },
  };
}

/**
 * Google Gemini API.
 * https://ai.google.dev/api/generate-content
 */
async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<ChatResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: { maxOutputTokens: 2048 },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google API ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return {
    text,
    model,
    tokens: {
      input: data.usageMetadata?.promptTokenCount ?? 0,
      output: data.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}

/**
 * Unified entry point.
 */
export async function callAI(
  provider: Provider,
  apiKey: string,
  model: string | null,
  systemPrompt: string,
  userPrompt: string,
): Promise<ChatResult> {
  const m = model || DEFAULT_MODELS[provider];
  switch (provider) {
    case "anthropic":
      return callAnthropic(apiKey, m, systemPrompt, userPrompt);
    case "openai":
      return callOpenAI(apiKey, m, systemPrompt, userPrompt);
    case "google":
      return callGemini(apiKey, m, systemPrompt, userPrompt);
  }
}
