import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fontverter from "fontverter";
import harfbuzzPromise from "harfbuzzjs";
import subsetFont from "subset-font";
import ts from "typescript";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = join(projectRoot, "config", "material-symbols.json");
const sourceFontPath = join(
  projectRoot,
  "node_modules",
  "@fontsource-variable",
  "material-symbols-rounded",
  "files",
  "material-symbols-rounded-latin-fill-normal.woff2"
);
const sourceLicensePath = join(projectRoot, "node_modules", "@fontsource-variable", "material-symbols-rounded", "LICENSE");
const appSourceDirectory = join(projectRoot, "src", "app");
const publicFontDirectory = join(projectRoot, "public", "fonts");
const generatedDirectory = join(projectRoot, "src", "generated");
const generatedFontPattern = /^material-symbols-rounded\.[a-f0-9]{12}\.woff2$/;
const checkOnly = process.argv.includes("--check");

function validateSymbolNames(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("config/material-symbols.json 必须是非空数组。");
  }

  const names = value.map((name) => {
    if (typeof name !== "string" || !/^[a-z0-9_]+$/.test(name)) {
      throw new Error(`无效的 Material Symbol 名称：${String(name)}`);
    }
    return name;
  });
  const expectedOrder = [...new Set(names)].sort();
  if (expectedOrder.length !== names.length || expectedOrder.some((name, index) => name !== names[index])) {
    throw new Error("config/material-symbols.json 必须按字母排序且不能包含重复项。");
  }
  return names;
}

function createTypeSource(symbolCodepoints) {
  const entries = Object.entries(symbolCodepoints)
    .map(([name, codepoint]) => {
      const escapedCodepoint = [...codepoint].map((symbol) => `\\u{${symbol.codePointAt(0).toString(16)}}`).join("");
      return `  ${JSON.stringify(name)}: "${escapedCodepoint}"`;
    })
    .join(",\n");
  return `// 此文件由 pnpm run fonts:build 生成，请勿手动修改。\n\nexport const materialSymbolCodepoints = {\n${entries}\n} as const;\n\nexport type MaterialSymbolName = keyof typeof materialSymbolCodepoints;\n`;
}

function createCssSource(fontFileName) {
  return `/* 此文件由 pnpm run fonts:build 生成，请勿手动修改。 */\n@font-face {\n  font-family: "Material Symbols Rounded Variable";\n  font-style: normal;\n  font-display: swap;\n  font-weight: 400;\n  src: url("/fonts/${fontFileName}") format("woff2");\n}\n`;
}

async function collectTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return collectTypeScriptFiles(path);
      return /\.tsx?$/.test(entry.name) ? [path] : [];
    })
  );
  return nestedFiles.flat();
}

async function assertSymbolsAreUsed(symbolNames) {
  const expected = new Set(symbolNames);
  const referenced = new Set();
  const sourcePaths = await collectTypeScriptFiles(appSourceDirectory);

  await Promise.all(
    sourcePaths.map(async (path) => {
      const sourceFile = ts.createSourceFile(path, await readFile(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node) {
        if (ts.isStringLiteralLike(node) && expected.has(node.text)) referenced.add(node.text);
        ts.forEachChild(node, visit);
      }
      visit(sourceFile);
    })
  );

  const unused = symbolNames.filter((name) => !referenced.has(name));
  if (unused.length > 0) {
    throw new Error(`图标清单包含未使用的符号：${unused.join(", ")}`);
  }
}

async function assertFileMatches(path, expected, label) {
  try {
    const actual = await readFile(path);
    if (!actual.equals(expected)) throw new Error(`${label} 与图标清单不一致，请运行 pnpm run fonts:build。`);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`${label} 不存在，请运行 pnpm run fonts:build。`);
    }
    throw error;
  }
}

function isPrivateUseCodepoint(codepoint) {
  return (
    (codepoint >= 0xe000 && codepoint <= 0xf8ff) ||
    (codepoint >= 0xf0000 && codepoint <= 0xffffd) ||
    (codepoint >= 0x100000 && codepoint <= 0x10fffd)
  );
}

async function createSymbolCodepoints(sourceFont, symbolNames) {
  const sfntFont = await fontverter.convert(sourceFont, "sfnt");
  const harfbuzz = await harfbuzzPromise;
  const blob = harfbuzz.createBlob(new Uint8Array(sfntFont));
  const face = harfbuzz.createFace(blob, 0);
  const font = harfbuzz.createFont(face);

  function shape(text) {
    const buffer = harfbuzz.createBuffer();
    try {
      buffer.addText(text);
      buffer.guessSegmentProperties();
      harfbuzz.shape(font, buffer);
      return buffer.json().map((glyph) => glyph.g);
    } finally {
      buffer.destroy();
    }
  }

  try {
    const codepointByGlyph = new Map();
    for (const codepoint of face.collectUnicodes()) {
      if (!isPrivateUseCodepoint(codepoint)) continue;
      const glyphs = shape(String.fromCodePoint(codepoint));
      if (glyphs.length === 1 && !codepointByGlyph.has(glyphs[0])) {
        codepointByGlyph.set(glyphs[0], codepoint);
      }
    }

    return Object.fromEntries(
      symbolNames.map((name) => {
        const glyphs = shape(name);
        const codepoint = glyphs.length === 1 ? codepointByGlyph.get(glyphs[0]) : undefined;
        if (codepoint === undefined) {
          throw new Error(`无法为 Material Symbol ${name} 找到唯一的私用区码点。`);
        }
        return [name, String.fromCodePoint(codepoint)];
      })
    );
  } finally {
    font.destroy();
    face.destroy();
    blob.destroy();
  }
}

async function main() {
  const symbolNames = validateSymbolNames(JSON.parse(await readFile(configPath, "utf8")));
  await assertSymbolsAreUsed(symbolNames);
  const [sourceFont, sourceLicense] = await Promise.all([readFile(sourceFontPath), readFile(sourceLicensePath)]);
  const symbolCodepoints = await createSymbolCodepoints(sourceFont, symbolNames);
  const subset = await subsetFont(sourceFont, Object.values(symbolCodepoints).join(""), {
    targetFormat: "woff2",
    noLayoutClosure: true
  });
  const hash = createHash("sha256").update(subset).digest("hex").slice(0, 12);
  const fontFileName = `material-symbols-rounded.${hash}.woff2`;
  const artifacts = [
    {
      path: join(publicFontDirectory, fontFileName),
      contents: subset,
      label: "Material Symbols 子集字体"
    },
    {
      path: join(publicFontDirectory, "LICENSE.material-symbols-rounded.txt"),
      contents: sourceLicense,
      label: "Material Symbols 字体许可证"
    },
    {
      path: join(generatedDirectory, "material-symbols.css"),
      contents: Buffer.from(createCssSource(fontFileName)),
      label: "Material Symbols 字体样式"
    },
    {
      path: join(generatedDirectory, "material-symbols.ts"),
      contents: Buffer.from(createTypeSource(symbolCodepoints)),
      label: "Material Symbols 类型定义"
    }
  ];

  if (checkOnly) {
    await Promise.all(artifacts.map((artifact) => assertFileMatches(artifact.path, artifact.contents, artifact.label)));
    const fontFiles = (await readdir(publicFontDirectory)).filter((name) => generatedFontPattern.test(name));
    if (fontFiles.length !== 1 || fontFiles[0] !== fontFileName) {
      throw new Error("public/fonts 中存在过期的 Material Symbols 子集，请运行 pnpm run fonts:build。");
    }
    console.log(`Material Symbols 子集检查通过：${symbolNames.length} 个符号，${subset.length} 字节。`);
    return;
  }

  await Promise.all([mkdir(publicFontDirectory, { recursive: true }), mkdir(generatedDirectory, { recursive: true })]);
  const existingFontFiles = (await readdir(publicFontDirectory)).filter((name) => generatedFontPattern.test(name) && name !== fontFileName);
  await Promise.all(existingFontFiles.map((name) => unlink(join(publicFontDirectory, name))));
  await Promise.all(artifacts.map((artifact) => writeFile(artifact.path, artifact.contents)));
  await access(join(publicFontDirectory, fontFileName));
  console.log(`已生成 Material Symbols 子集：${symbolNames.length} 个符号，${sourceFont.length} → ${subset.length} 字节。`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
