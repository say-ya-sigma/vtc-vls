import * as path from "path";
import { TextDocument } from "vscode-languageserver-textdocument"
import { Diagnostic } from "vscode-languageserver";
import { createConnection } from "vscode-languageserver/node"
import {
  VueInterpolationMode,
  getJavascriptMode,
  getServiceHost,
  getLanguageModelCache,
  getVueDocumentRegions,
  createEnvironmentService,
  EnvironmentService,
  parseHTMLDocument,
  HTMLDocument,
  createDependencyService,
  VueInfoService,
  createRefTokensService,
  getDefaultVLSConfig,
} from "vls";
import tsModule from "typescript";
import ProgressBar from "progress";
import {
  getLines,
  formatLine,
  formatCursor,
  printError,
  printMessage,
  printLog,
} from "./print";
import { globSync, readFile, extractTargetFileExtension } from "./file-util";

interface Options {
  workspace: string;
  srcDir?: string;
  onlyTemplate?: boolean;
  onlyTypeScript?: boolean;
  excludeDir?: string | string[];
}

interface Source {
  docs: TextDocument[];
  workspace: string;
  env: EnvironmentService;
  onlyTemplate: boolean;
}

let validLanguages = ["vue"];

export async function check(options: Options) {
  const { workspace, onlyTemplate = false, onlyTypeScript = false, excludeDir } = options;
  if (onlyTypeScript) {
    validLanguages = ["ts", "tsx", "vue"];
  }
  const srcDir = options.srcDir || options.workspace;
  const config = getDefaultVLSConfig()
  config.vetur.experimental.templateInterpolationService = true;
  const env = createEnvironmentService(workspace, srcDir, workspace + '/tsconfig.json', workspace + '/package.json', '', [], config);
  tsModule.readConfigFile('tsconfig.json', (workspace) => workspace)
  const excludeDirs = typeof excludeDir === "string" ? [excludeDir] : excludeDir;
  const docs = await traverse(srcDir, onlyTypeScript, excludeDirs);

  await getDiagnostics({ docs, workspace, env, onlyTemplate });
}

async function traverse(
  root: string,
  onlyTypeScript: boolean,
  excludeDirs?: string[]
): Promise<TextDocument[]> {
  let targetFiles = globSync(
    path.join(
      root,
      onlyTypeScript ? `**/*.{${validLanguages.join(",")}}` : "**/*.vue"
    )
  );

  if (excludeDirs) {
    const filterTargets = excludeDirs.map((dir) => path.resolve(dir)).join("|");
    targetFiles = targetFiles.filter((targetFile) =>
      !new RegExp(`^(?:${filterTargets}).*$`).test(targetFile)
    );
  }

  let files = await Promise.all(
    targetFiles.map(async (absFilePath) => {
      const src = await readFile(absFilePath);
      return {
        absFilePath,
        fileExt: extractTargetFileExtension(absFilePath) as string,
        src,
      };
    })
  );

  if (onlyTypeScript) {
    files = files.filter(({ src, fileExt }) => {
      if (fileExt !== "vue" || !hasScriptTag(src)) {
        return true;
      }
      return isTs(src) || isImportOtherTs(src);
    });
  }

  const docs = files.map(({ absFilePath, src, fileExt }) =>
    TextDocument.create(`file://${absFilePath}`, fileExt, 0, src)
  );

  return docs;
}

async function getDiagnostics({ docs, workspace, env, onlyTemplate }: Source) {
  const documentRegions = getLanguageModelCache(10, 60, (document) =>
    getVueDocumentRegions(document)
  );
  const scriptRegionDocuments = getLanguageModelCache(10, 60, (document) => {
    const vueDocumentRegions = documentRegions.refreshAndGet(document);
    return vueDocumentRegions.getSingleTypeDocument("script");
  });
  const vueDocument = getLanguageModelCache<HTMLDocument>(10, 60, document => parseHTMLDocument(document));
  let hasError = false;
  const connection = createConnection(process.stdin, process.stdout)
  try {
    const serviceHost = getServiceHost(
      tsModule,
      env,
      scriptRegionDocuments
    );
    const vueMode = new VueInterpolationMode(
      documentRegions,
      tsModule,
      serviceHost,
      env,
      vueDocument
    );
    const dependencyService = await createDependencyService(workspace, workspace, false, []);
    const refTokensService = createRefTokensService(connection)
    const vueInfoService = new VueInfoService()
    const scriptMode = await getJavascriptMode(
      tsModule,
      serviceHost,
      env,
      documentRegions,
      dependencyService,
      [],
      vueInfoService,
      refTokensService
    );
    const bar = new ProgressBar("checking [:bar] :current/:total", {
      total: docs.length,
      width: 20,
      clear: true,
    });
    for (const doc of docs) {
      const vueTplResults = await vueMode.doValidation(doc);
      let scriptResults: Diagnostic[] = [];
      if (!onlyTemplate && scriptMode.doValidation) {
        scriptResults = await scriptMode.doValidation(doc);
      }
      const results = vueTplResults.concat(scriptResults);
      if (results.length) {
        hasError = true;
        for (const result of results) {
          const total = doc.lineCount;
          const lines = getLines({
            start: result.range.start.line,
            end: result.range.end.line,
            total,
          });
          printError(`Error in ${doc.uri}`);
          printMessage(
            `${result.range.start.line}:${result.range.start.character} ${result.message}`
          );
          for (const line of lines) {
            const code = doc
              .getText({
                start: { line, character: 0 },
                end: { line, character: Infinity },
              })
              .replace(/\n$/, "");
            const isError = line === result.range.start.line;
            printLog(formatLine({ number: line, code, isError }));
            if (isError) {
              printLog(formatCursor(result.range));
            }
          }
        }
      }
      bar.tick();
    }
  } catch (error) {
    hasError = true;
    console.error(error);
  } finally {
    documentRegions.dispose();
    scriptRegionDocuments.dispose();
    process.exit(hasError ? 1 : 0);
  }
}

function hasScriptTag(src: string) {
  return /.*\<script.*\>/.test(src);
}

function isTs(src: string) {
  return /.*\<script.*lang="tsx?".*\>/.test(src);
}

function isImportOtherTs(src: string) {
  return /.*\<script.*src=".*".*\>/.test(src);
}
