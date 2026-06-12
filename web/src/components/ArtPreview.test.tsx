/**
 * ArtPreview — client-side render of the composed plan: one polyline per
 * segment, dashed connectors, dotted retraces, solid ink.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { plan } from '../test/fixtures';
import { theme } from '../theme';
import { ArtPreview } from './ArtPreview';

function renderPreview(previewSvg?: string | null) {
  return render(
    <ThemeProvider theme={theme}>
      <ArtPreview plan={plan} previewSvg={previewSvg} />
    </ThemeProvider>
  );
}

describe('ArtPreview', () => {
  it('renders one polyline per segment with provenance styling', () => {
    const { container } = renderPreview();
    const polylines = container.querySelectorAll('svg[role="img"] polyline');
    expect(polylines).toHaveLength(plan.segments.length);

    const [ink, connector, retrace] = [...polylines];
    expect(ink.getAttribute('stroke')).toBe(theme.color.segmentInk);
    expect(ink.getAttribute('stroke-dasharray')).toBeNull(); // solid
    expect(connector.getAttribute('stroke-dasharray')).toBe('4 3'); // dashed
    expect(retrace.getAttribute('stroke-dasharray')).toBe('0.5 4'); // dotted
  });

  it('shows the stroke/connector legend', () => {
    renderPreview();
    expect(screen.getByText('Ink')).toBeInTheDocument();
    expect(screen.getByText('Connector')).toBeInTheDocument();
    expect(screen.getByText('Retrace')).toBeInTheDocument();
  });

  it('prefers the backend preview_svg when provided', () => {
    const { container } = renderPreview('<svg data-testid="server-svg"></svg>');
    expect(container.querySelector('[data-testid="server-svg"]')).not.toBeNull();
    expect(container.querySelector('polyline')).toBeNull();
  });
});
