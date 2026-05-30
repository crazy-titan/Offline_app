import { getGeminiApiKey, getForceOfflineFallbackPreference } from './preferences';

export interface ExplanationResponse {
  summary: string;
  explanation: string;
  suggestions: string;
  isOffline: boolean;
}

/**
 * Generates an explanation for a code snippet.
 * Automatically switches between Gemini API and local fallback based on internet / api keys.
 */
export async function explainCode(
  code: string,
  language: string,
  title: string
): Promise<ExplanationResponse> {
  const apiKey = await getGeminiApiKey();
  const forceOffline = await getForceOfflineFallbackPreference();

  if (!apiKey || forceOffline) {
    return generateOfflineExplanation(code, language, title);
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const promptText = `
Analyze the following code snippet. Provide a structured response in plain text that I can separate into three distinct parts:
PART 1: SUMMARY (Provide a 1-2 sentence high-level summary of what this code does)
PART 2: DETAILED EXPLANATION (Provide a structured, step-by-step breakdown of how the code works)
PART 3: SUGGESTIONS (Provide 2-3 specific optimization, readability, or safety improvements, with small code blocks if relevant)

Please use these exact headers "PART 1: SUMMARY", "PART 2: DETAILED EXPLANATION", and "PART 3: SUGGESTIONS" so that I can parse them.

Snippet Title: ${title}
Language: ${language}
Code:
\`\`\`${language}
${code}
\`\`\`
`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: promptText,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Empty response from AI provider');
    }

    return parseGeminiResponse(text);
  } catch (error) {
    console.warn('Gemini explanation failed, falling back to offline analysis:', error);
    return generateOfflineExplanation(code, language, title, true);
  }
}

/**
 * Parses the custom text response from Gemini into structured fields.
 */
function parseGeminiResponse(text: string): ExplanationResponse {
  let summary = 'No summary generated.';
  let explanation = 'No explanation generated.';
  let suggestions = 'No suggestions generated.';

  const summaryIndex = text.indexOf('PART 1: SUMMARY');
  const detailsIndex = text.indexOf('PART 2: DETAILED EXPLANATION');
  const suggestionsIndex = text.indexOf('PART 3: SUGGESTIONS');

  if (summaryIndex !== -1) {
    const end = detailsIndex !== -1 ? detailsIndex : (suggestionsIndex !== -1 ? suggestionsIndex : text.length);
    summary = text.substring(summaryIndex + 'PART 1: SUMMARY'.length, end).trim();
  }

  if (detailsIndex !== -1) {
    const end = suggestionsIndex !== -1 ? suggestionsIndex : text.length;
    explanation = text.substring(detailsIndex + 'PART 2: DETAILED EXPLANATION'.length, end).trim();
  }

  if (suggestionsIndex !== -1) {
    suggestions = text.substring(suggestionsIndex + 'PART 3: SUGGESTIONS'.length).trim();
  }

  // Strip initial colons or characters if Gemini left them
  const clean = (str: string) => str.replace(/^:\s*/, '');

  return {
    summary: clean(summary),
    explanation: clean(explanation),
    suggestions: clean(suggestions),
    isOffline: false,
  };
}

/**
 * Local offline rule-based AST/regex analyzer.
 * Generates immediate mock explanation based on the code structure.
 */
function generateOfflineExplanation(
  code: string,
  language: string,
  title: string,
  wasError: boolean = false
): ExplanationResponse {
  const lang = language.toLowerCase();
  
  // Basic structural analysis
  const lines = code.split('\n');
  const functions = code.match(/(function\s+\w+|const\s+\w+\s*=\s*(\([^)]*\)|[^=])\s*=>|def\s+\w+|func\s+\w+)/g) || [];
  const classes = code.match(/(class\s+\w+)/g) || [];
  const imports = code.match(/(import\s+.*|require\(.*\))/g) || [];
  const hooks = code.match(/(use[A-Z]\w+)/g) || [];
  const asyncAwait = code.match(/(async|await|\.then\(|Promise)/g) || [];

  // 1. Summary
  let summary = `This is a offline analysis of the "${title}" snippet written in ${language}.`;
  if (wasError) {
    summary = `[Connection Fallback] ${summary}`;
  }
  
  if (functions.length > 0) {
    summary += ` It defines ${functions.length} function(s) and structured operations.`;
  }
  if (classes.length > 0) {
    summary += ` It contains ${classes.length} class definition(s).`;
  }
  
  // 2. Explanation
  let explanation = `### Code Composition\n`;
  explanation += `- **Total Lines:** ${lines.length} lines of code.\n`;
  
  if (imports.length > 0) {
    explanation += `- **Dependencies:** Detected ${imports.length} imports or requires. It relies on external modules/libraries.\n`;
  }
  if (hooks.length > 0) {
    explanation += `- **React Hooks:** Detected React hook pattern(s) (${Array.from(new Set(hooks)).join(', ')}), implying it manages local state, side effects, or contexts.\n`;
  }
  if (asyncAwait.length > 0) {
    explanation += `- **Asynchronous Operations:** Found async/await or promise indicators. This code performs non-blocking asynchronous workflows (e.g. API requests, I/O, timers).\n`;
  }
  
  explanation += `\n### Step-by-Step Breakdown\n`;
  if (imports.length > 0) {
    explanation += `1. **Setup:** The code starts by importing required assets and interfaces.\n`;
  }
  if (functions.length > 0) {
    const mainFunc = functions[0]!.replace(/const\s+/, '').replace(/\s*=\s*.*/, '').trim();
    explanation += `2. **Implementation:** It sets up the primary executable block \`${mainFunc}\` to carry out the core logic.\n`;
  } else {
    explanation += `2. **Implementation:** It executes procedural statements line-by-line in sequential order.\n`;
  }
  explanation += `3. **Data Flow:** The program processes input variables or events, updates state or variables, and optionally returns a result.\n`;

  // 3. Suggestions
  let suggestions = `### Offline Optimization Suggestions\n`;
  
  if (lang === 'javascript' || lang === 'typescript' || lang === 'tsx') {
    suggestions += `1. **Strict Type Safety:** Ensure variables are properly typed. Avoid using \`any\` if writing TypeScript to prevent runtime undefined errors.\n`;
    if (hooks.length > 0 && code.includes('useEffect')) {
      suggestions += `2. **Hook Dependencies:** Review dependency arrays in \`useEffect\` or \`useMemo\` hooks to avoid stale closures or infinite re-renders.\n`;
    } else {
      suggestions += `2. **Memory Management:** If registering timers (e.g., \`setInterval\`) or listeners, ensure you return cleanups to prevent memory leaks.\n`;
    }
    suggestions += `3. **Async Error Handling:** If calling async resources, wrap logic in \`try/catch\` blocks to catch network or platform failures.\n`;
  } else if (lang === 'python') {
    suggestions += `1. **Pythonic Syntax:** Prefer list comprehensions instead of standard \`for\` loops for simple arrays to improve performance.\n`;
    suggestions += `2. **Docstrings:** Add PEP 257 docstrings to specify input parameters and return types.\n`;
    suggestions += `3. **Resource Contexts:** Use \`with\` statement contexts for file, socket, or DB I/O to ensure safe resource disposal.\n`;
  } else if (lang === 'sql') {
    suggestions += `1. **Index Optimization:** Ensure columns frequently used in \`WHERE\`, \`JOIN\`, or \`ORDER BY\` have secondary indexes.\n`;
    suggestions += `2. **Parameter Binding:** Always use parameterized placeholders (\`?\` or \`$1\`) instead of string interpolation to prevent SQL injection vulnerabilities.\n`;
    suggestions += `3. **Selectivity:** Limit queries with explicit column selections instead of \`SELECT *\` to save memory and parsing overhead.\n`;
  } else {
    suggestions += `1. **Clean Code Structure:** Keep functions small (ideally under 30 lines) and single-purpose.\n`;
    suggestions += `2. **Input Validation:** Validate function arguments or interface responses before performing deep updates.\n`;
    suggestions += `3. **Error Logging:** Implement detailed telemetry or error logging for runtime boundary cases.\n`;
  }

  return {
    summary,
    explanation,
    suggestions,
    isOffline: true,
  };
}
