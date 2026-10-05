import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const compat = new FlatCompat({ baseDirectory: path.dirname(fileURLToPath(import.meta.url)) });
export default [
  ...compat.extends('next/core-web-vitals'),
  {
    // Immutable embedded assets and PDF capture require native img elements.
    // This performance recommendation does not affect correctness validation.
    rules: { '@next/next/no-img-element': 'off' },
  },
];
