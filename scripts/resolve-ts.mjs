export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      for (const ext of ['.ts', '.tsx', '.js', '/index.ts']) {
        try {
          return await nextResolve(specifier + ext, context);
        } catch {}
      }
    }
    throw err;
  }
}
