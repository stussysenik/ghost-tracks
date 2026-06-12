import '@unocss/reset/tailwind.css';
import 'virtual:uno.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ThemeProvider } from 'styled-components';
import { App } from './App';
import { GlobalStyle } from './globalStyle';
import { theme } from './theme';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);
