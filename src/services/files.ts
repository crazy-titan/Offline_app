import * as FileSystem from 'expo-file-system/legacy';

export interface FileItem {
  name: string;
  uri: string;
  isDirectory: boolean;
  sizeBytes?: number;
  updatedAt?: number; // timestamp
}

// Define the root sandbox directory for developer resources
export const SANDBOX_ROOT = FileSystem.documentDirectory + 'dev_sandbox/';
// Define the attachments directory for snippet screenshots/files
export const ATTACHMENTS_DIR = FileSystem.documentDirectory + 'attachments/';

/**
 * Initializes directories if they do not exist.
 */
export async function initFileSystem(): Promise<void> {
  const sandboxInfo = await FileSystem.getInfoAsync(SANDBOX_ROOT);
  if (!sandboxInfo.exists) {
    await FileSystem.makeDirectoryAsync(SANDBOX_ROOT, { intermediates: true });
  }

  const attachmentsInfo = await FileSystem.getInfoAsync(ATTACHMENTS_DIR);
  if (!attachmentsInfo.exists) {
    await FileSystem.makeDirectoryAsync(ATTACHMENTS_DIR, { intermediates: true });
  }
}

/**
 * Get the full path in the sandbox given a path relative to the sandbox root.
 */
export function getFullPath(relPath: string): string {
  const normalized = relPath.replace(/^\//, ''); // strip leading slash
  return `${SANDBOX_ROOT}${normalized}`;
}

/**
 * Get relative path from a full URI if it falls under sandbox root.
 */
export function getRelativePath(uri: string): string {
  if (uri.startsWith(SANDBOX_ROOT)) {
    return uri.substring(SANDBOX_ROOT.length);
  }
  return uri;
}

/**
 * Lists all contents (files and directories) in a sub-folder under the sandbox.
 * @param relativeDirPath Subfolder path relative to sandbox root (e.g. '', 'src/components')
 */
export async function listDirectory(relativeDirPath: string = ''): Promise<FileItem[]> {
  const fullPath = getFullPath(relativeDirPath);
  const contents = await FileSystem.readDirectoryAsync(fullPath);

  const items: FileItem[] = [];

  for (const name of contents) {
    const fileUri = `${fullPath}${name}`;
    const info = await FileSystem.getInfoAsync(fileUri);

    if (info.exists) {
      items.push({
        name,
        uri: fileUri,
        isDirectory: info.isDirectory,
        sizeBytes: info.isDirectory ? undefined : info.size,
        updatedAt: info.modificationTime ? info.modificationTime * 1000 : undefined,
      });
    }
  }

  // Sort directories first, then files alphabetically
  return items.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Create a new folder inside the sandbox.
 */
export async function createFolder(relativeParentPath: string, folderName: string): Promise<string> {
  const folderPath = getFullPath(`${relativeParentPath}/${folderName}`);
  await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
  return folderPath;
}

/**
 * Write a text file (code file) to the sandbox.
 */
export async function writeTextFile(relativeFilePath: string, content: string): Promise<string> {
  const filePath = getFullPath(relativeFilePath);
  // Ensure parent directory exists
  const parts = relativeFilePath.split('/');
  if (parts.length > 1) {
    const parentDir = parts.slice(0, -1).join('/');
    await FileSystem.makeDirectoryAsync(getFullPath(parentDir), { intermediates: true });
  }
  await FileSystem.writeAsStringAsync(filePath, content, { encoding: FileSystem.EncodingType.UTF8 });
  return filePath;
}

/**
 * Read contents of a text file.
 */
export async function readTextFile(relativeFilePath: string): Promise<string> {
  const filePath = getFullPath(relativeFilePath);
  return await FileSystem.readAsStringAsync(filePath, { encoding: FileSystem.EncodingType.UTF8 });
}

/**
 * Delete a file or directory.
 */
export async function deleteItem(relativeItemPath: string): Promise<void> {
  const itemPath = getFullPath(relativeItemPath);
  await FileSystem.deleteAsync(itemPath, { idempotent: true });
}

/**
 * Move a file or directory.
 */
export async function moveItem(relativeFromPath: string, relativeToPath: string): Promise<void> {
  const fromPath = getFullPath(relativeFromPath);
  const toPath = getFullPath(relativeToPath);

  // Ensure destination parent directory exists
  const parts = relativeToPath.split('/');
  if (parts.length > 1) {
    const parentDir = parts.slice(0, -1).join('/');
    await FileSystem.makeDirectoryAsync(getFullPath(parentDir), { intermediates: true });
  }

  await FileSystem.moveAsync({ from: fromPath, to: toPath });
}

/**
 * Copy a file or directory.
 */
export async function copyItem(relativeFromPath: string, relativeToPath: string): Promise<void> {
  const fromPath = getFullPath(relativeFromPath);
  const toPath = getFullPath(relativeToPath);

  // Ensure destination parent directory exists
  const parts = relativeToPath.split('/');
  if (parts.length > 1) {
    const parentDir = parts.slice(0, -1).join('/');
    await FileSystem.makeDirectoryAsync(getFullPath(parentDir), { intermediates: true });
  }

  await FileSystem.copyAsync({ from: fromPath, to: toPath });
}

/**
 * Copy an external file (e.g. from an image picker) into the sandbox's attachments directory
 * to attach it to a snippet.
 */
export async function copyToAttachments(externalUri: string, originalName: string): Promise<{ fullUri: string; relativePath: string }> {
  // Ensure target folder exists
  await initFileSystem();

  const timestamp = Date.now();
  const fileExt = originalName.split('.').pop() || 'jpg';
  const cleanName = `${timestamp}_${originalName.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExt}`;
  const targetUri = `${ATTACHMENTS_DIR}${cleanName}`;

  await FileSystem.copyAsync({ from: externalUri, to: targetUri });

  // Store path relative to standard documentDirectory
  const relativePath = `attachments/${cleanName}`;
  return {
    fullUri: targetUri,
    relativePath,
  };
}

/**
 * Remove an attachment file.
 */
export async function deleteAttachmentFile(relativePath: string): Promise<void> {
  const fileUri = `${FileSystem.documentDirectory}${relativePath}`;
  await FileSystem.deleteAsync(fileUri, { idempotent: true });
}

// Developer templates/resources that can be downloaded/saved
export interface DevTemplate {
  name: string;
  fileName: string;
  description: string;
  content: string;
  language: string;
}

export const DEV_TEMPLATES: DevTemplate[] = [
  {
    name: 'React Component (TSX)',
    fileName: 'Button.tsx',
    description: 'A reusable React Native touchable button component with TypeScript and custom themes.',
    language: 'typescript',
    content: `import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export const CustomButton: React.FC<ButtonProps> = ({
  title,
  onPress,
  loading = false,
  variant = 'primary',
  disabled = false,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.button,
        styles[variant],
        disabled && styles.disabledButton,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={[styles.text, disabled && styles.disabledText]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primary: {
    backgroundColor: '#007AFF',
  },
  secondary: {
    backgroundColor: '#5856D6',
  },
  danger: {
    backgroundColor: '#FF3B30',
  },
  disabledButton: {
    backgroundColor: '#D1D1D6',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledText: {
    color: '#8E8E93',
  },
});
`,
  },
  {
    name: 'Express API Server (JS)',
    fileName: 'server.js',
    description: 'A basic Node.js Express server template with CORS, JSON parsing, and standard error handling.',
    language: 'javascript',
    content: `const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/snippets', (req, res) => {
  res.json([
    { id: 1, title: 'Debounce Function', language: 'javascript' },
    { id: 2, title: 'Flexbox Layout', language: 'css' }
  ]);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(\`Server is running on http://localhost:\${PORT}\`);
});
`,
  },
  {
    name: 'TypeScript Config (JSON)',
    fileName: 'tsconfig.json',
    description: 'Recommended tsconfig.json setup for clean and strict TypeScript compiler settings.',
    language: 'json',
    content: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["es2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
`,
  },
  {
    name: 'HTML5 Template',
    fileName: 'index.html',
    description: 'A clean semantic HTML5 starter document with standard viewport and metadata setup.',
    language: 'html',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>Developer Sandbox Resource</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
      background-color: #f4f5f7;
      color: #333;
    }
    h1 {
      color: #111;
      border-bottom: 1px solid #ddd;
      padding-bottom: 10px;
    }
    code {
      background: #eee;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: Courier, monospace;
    }
  </style>
</head>
<body>
  <h1>Welcome to your offline workspace</h1>
  <p>This file was downloaded from your <code>Code Snippet Manager</code>.</p>
</body>
</html>
`,
  }
];
