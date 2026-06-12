/**
 * Share — /r/:share_id. Read-only render of an ArtRoute: static map with the
 * solved route, distance/fidelity, GPX download, per-platform import guide.
 */
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import styled from 'styled-components';
import { ApiError, getSharedRoute } from '../api';
import { ImportInstructions } from '../components/ImportInstructions';
import { FitBounds, MapView, RouteLayers } from '../components/MapView';
import { Button, Card, ErrorPanel, Kicker, Metric, Skeleton } from '../components/ui';
import { downloadGPX } from '../lib/gpx';
import { theme as tokens } from '../theme';
import type { ArtRoute } from '../types';

const Page = styled.main`
  max-width: 880px;
  margin: 0 auto;
  padding: ${({ theme }) => `${theme.space.xl} ${theme.space.lg} ${theme.space.xxl}`};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.lg};
`;

const MapCard = styled(Card)`
  position: relative;
  height: 420px;
  overflow: hidden;
`;

function routeTitle(route: ArtRoute): string {
  const parts = [...route.intent.texts, ...route.intent.shapes.map((s) => s.name)];
  return parts.join(' · ') || route.intent.occasion || 'A Ghost Tracks route';
}

export function Share() {
  const { shareId } = useParams<{ shareId: string }>();
  const [route, setRoute] = useState<ArtRoute | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareId) return;
    const ac = new AbortController();
    setRoute(null);
    setError(null);
    getSharedRoute(shareId, ac.signal)
      .then(setRoute)
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(
          err instanceof ApiError && err.status === 404
            ? 'This route doesn’t exist — the link may be mistyped or expired.'
            : err instanceof Error
              ? err.message
              : 'Could not load this route.'
        );
      });
    return () => ac.abort();
  }, [shareId]);

  return (
    <Page>
      <header className="row-between">
        <Link to="/" className="row gap-2 no-underline">
          <img src="/ghost.svg" alt="" width={20} height={20} />
          <span className="f-small font-700 tracking-tight">Ghost Tracks</span>
        </Link>
        <Link to="/" className="no-underline">
          <Button $variant="ghost">Make your own →</Button>
        </Link>
      </header>

      {error ? (
        <ErrorPanel role="alert">
          <strong>Route not found.</strong> {error}
          <div className="mt-3">
            <Link to="/" className="no-underline">
              <Button>Compose a new one</Button>
            </Link>
          </div>
        </ErrorPanel>
      ) : !route ? (
        <div className="stack gap-4" aria-label="Loading route" data-testid="share-skeleton">
          <Skeleton $w="50%" $h="2rem" />
          <Skeleton $h="420px" $r={tokens.radius.lg} />
          <Skeleton $w="40%" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          className="stack gap-6"
        >
          <div>
            <Kicker>{route.intent.occasion ?? 'Shared route'}</Kicker>
            <h1 className="f-title mt-1 mb-0" style={{ fontSize: '2rem', letterSpacing: '-0.02em' }}>
              {routeTitle(route)}
            </h1>
            {route.intent.area && (
              <p className="f-small mt-1 mb-0" style={{ color: tokens.color.slate }}>
                {route.intent.area}, Prague
              </p>
            )}
          </div>

          <MapCard>
            <MapView interactive={false}>
              <FitBounds bbox={route.placement.bbox} padding={50} />
              <RouteLayers
                id="shared"
                coords={route.solve.coordinates}
                segments={route.solve.segments}
              />
            </MapView>
          </MapCard>

          <div className="row gap-2 flex-wrap">
            <Metric>
              <strong>{route.solve.distance_km.toFixed(1)}</strong>
              <span>km</span>
            </Metric>
            <Metric>
              <strong>{Math.round(route.solve.duration_min)}</strong>
              <span>min</span>
            </Metric>
            <Metric>
              <strong
                style={{
                  color:
                    route.solve.fidelity >= 70
                      ? tokens.color.good
                      : route.solve.fidelity >= 50
                        ? tokens.color.warn
                        : tokens.color.bad
                }}
              >
                {Math.round(route.solve.fidelity)}
              </strong>
              <span>fidelity</span>
            </Metric>
            <span className="flex-1" />
            <Button onClick={() => downloadGPX(route.solve.coordinates, routeTitle(route))}>
              Download GPX
            </Button>
          </div>

          <section className="stack gap-3">
            <Kicker>Run it — import the GPX</Kicker>
            <ImportInstructions />
          </section>
        </motion.div>
      )}
    </Page>
  );
}
