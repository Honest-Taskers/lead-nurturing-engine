/**
 * Vercel serverless entry point. All /api/* requests are rewritten here
 * (see vercel.json); Vercel passes the original URL through, so the Express
 * router sees the full /api/... path exactly as in local dev.
 *
 * Imports the tsc-compiled server (built by the Vercel buildCommand) rather
 * than the TypeScript sources: Vercel's own TS pass can't resolve the .js
 * import specifier that points at reportPdf.tsx, so the sources 500 at boot.
 *
 * The dynamic import + catch turns any remaining boot-time failure (bad env,
 * missing module) into a readable JSON response instead of an opaque
 * FUNCTION_INVOCATION_FAILED.
 */
let handler;

try {
  const mod = await import('../server/dist/app.js');
  handler = mod.default;
} catch (err) {
  const detail = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
  console.error('API boot failure:', detail);
  handler = (_req, res) => {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'API failed to start', detail }));
  };
}

export default handler;
