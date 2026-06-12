import 'styled-components';
import type { AppTheme } from './theme';

declare module 'styled-components' {
  // Make the token object the typed theme for every styled`` call.
  export interface DefaultTheme extends AppTheme {}
}
