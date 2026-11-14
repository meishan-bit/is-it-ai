// Lets the tests import the TypeScript source files without file extensions, exactly as the app does.
import { register } from 'node:module';
register('./loader.mjs', import.meta.url);
