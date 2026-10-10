// Configuracao do Remotion Studio (npm run studio). O render do pipeline usa src/stages/render.ts.
import {Config} from '@remotion/cli/config';
import {webpackOverride} from './src/remotion/webpack-override';

Config.overrideWebpackConfig(webpackOverride);
