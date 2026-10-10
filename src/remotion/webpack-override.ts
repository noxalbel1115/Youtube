import type {WebpackOverrideFn} from '@remotion/bundler';

// Os imports usam extensao .js (exigencia do TypeScript em modo NodeNext); o webpack resolve para .ts/.tsx.
export const webpackOverride: WebpackOverrideFn = (config) => ({
  ...config,
  resolve: {...config.resolve, extensionAlias: {'.js': ['.tsx', '.ts', '.js']}},
});
