// The tests are this folder's own: a working copy of another branch kept
// under .claude/ has tests of its own, and they are not run from here.
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: { exclude: [...configDefaults.exclude, '.claude/**'] }
});
