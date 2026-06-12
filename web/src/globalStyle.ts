import { createGlobalStyle } from 'styled-components';

/**
 * Global canvas — editorial-minimal, dark-on-light, one accent.
 * Layout utilities come from UnoCSS; this only sets the page substrate.
 */
export const GlobalStyle = createGlobalStyle`
  :root {
    color-scheme: light;
  }

  html, body, #root {
    height: 100%;
  }

  body {
    margin: 0;
    background: ${({ theme }) => theme.color.paper};
    color: ${({ theme }) => theme.color.coal};
    font-family: ${({ theme }) => theme.type.family};
    font-size: ${({ theme }) => theme.type.body};
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  ::selection {
    background: ${({ theme }) => theme.color.inkSoft};
    color: ${({ theme }) => theme.color.coal};
  }

  button {
    font: inherit;
    cursor: pointer;
  }

  a {
    color: inherit;
  }

  /* Mapbox chrome should sit under our panels */
  .mapboxgl-ctrl-top-right { z-index: 5; }
`;
