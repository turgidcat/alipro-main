// Assemble the current outline prompt using an isolated copy of a local experiment.
// No provider requests, source database writes, client restart or deployment.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
async function main() {
  const dataset = process.argv[2];
  if (!dataset) throw new Error('Usage: node scripts/preview-chapter-outline.cjs <experiment-directory> [chapter-number]');
  const chapterNumber = Number(process.argv[3] || 12);
  const manifest = JSON.parse(fs.readFileSync(path.join(dataset, 'experiment.json'), 'utf8'));
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'alipro-outline-preview-'));
  Object.assign(process.env, { NOVEL_DB_PATH: path.join(folder, 'novel.db'), ALIPRO_DATA_DIR: folder,
    ALIPRO_LOG_DIR: path.join(folder, 'logs'), ALIPRO_AI_MONITOR: '0', DEEPSEEK_API_KEY: 'preview-only-no-network' });
  fs.copyFileSync(path.join(dataset, 'novel.db'), process.env.NOVEL_DB_PATH);
  // Prevent accidental model calls even if a future context loader starts using AI.
  const provider = require('../backend/services/deepseek');
  for (const method of ['chat', 'chatStream', 'generate', 'generateText', 'generateStream']) {
    provider[method] = () => { throw new Error('Model calls are disabled in prompt preview'); };
  }
  const filename = path.join(root, 'backend/routes/ai.js');
  const route = new Module(filename, module);
  route.filename = filename;
  route.paths = Module._nodeModulePaths(path.dirname(filename));
  route._compile(fs.readFileSync(filename, 'utf8')
    + '\nrunTextGeneration = async () => { throw new Error("Model calls are disabled in prompt preview"); };'
    + '\nmodule.exports.previewInternals={loadBookGenerationContext,buildOutlinePrompt,buildOutlineStorylineConstraintText};', filename);
  const api = route.exports.previewInternals;
  const ctx = await api.loadBookGenerationContext(manifest.bookId, chapterNumber, { excludeCurrentOutline: true, forOutline: true });
  const db = await require('../backend/database/init');
  const { execQueryOne } = require('../backend/services/database');
  const book = execQueryOne(db, 'SELECT * FROM books WHERE id = ?', [manifest.bookId]);
  const constraints = api.buildOutlineStorylineConstraintText(ctx.chapterStorylineContext);
  const prompt = api.buildOutlinePrompt({ genre: book.genre || 'fantasy', subgenre: book.subgenre || '',
    bookTitle: ctx.bookTitle, chapterTitle: ctx.chapterPlan?.chapter_name || '未命名章节', chapterNumber,
    characters: ctx.outlineCharacters, contextNotes: ctx.contextNotes, chapterStorylinePrompt: constraints });
  const inputFile = path.join(root, 'artifacts', `chapter${chapterNumber}-outline-input-current.txt`);
  const meta = { inputFile, characters: Array.from(prompt).length, contextCharacters: Array.from(ctx.contextNotes).length,
    constraintCharacters: Array.from(constraints).length, roleNames: ctx.outlineCharacters,
    contextHash: ctx.contextHash, sourceContextHash: ctx.sourceContextHash, feedbackFreshness: ctx.feedbackFreshness,
    generationBlocked: (ctx.chapterStorylineContext.storylineContexts || []).some(item => item.beatSummary && !item.chapterTask),
    sourceDatabase: path.join(dataset, 'novel.db'), sourceExportedAt: manifest.exportedAt, modelCalled: false };
  fs.mkdirSync(path.dirname(inputFile), { recursive: true });
  fs.writeFileSync(inputFile, prompt, 'utf8');
  fs.writeFileSync(inputFile.replace('.txt', '.meta.json'), JSON.stringify(meta, null, 2));
  console.log(JSON.stringify(meta, null, 2));
  db.close();
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
